from decimal import Decimal
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from core.permissions import IsDonor, IsVerified, IsAdminRole
from notifications.models import Notification
from allocations.services import (
    publish_donation,
    withdraw_donation,
    close_donation_remainder,
    ServiceValidationError,
    ServicePermissionError,
    ServiceConflictError,
)
from .models import FoodCategory, FoodDonation, DonationStatus
from .serializers import FoodCategorySerializer, FoodDonationSerializer


def _handle_service_error(exc):
    if isinstance(exc, ServiceValidationError):
        return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(exc, ServicePermissionError):
        return Response({"error": exc.message}, status=status.HTTP_403_FORBIDDEN)
    if isinstance(exc, ServiceConflictError):
        return Response(
            {"error": exc.message, "latest_state": exc.latest_state},
            status=status.HTTP_409_CONFLICT,
        )
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class FoodCategoryListView(generics.ListCreateAPIView):
    queryset = FoodCategory.objects.all()
    serializer_class = FoodCategorySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]


class FoodDonationListCreateView(generics.ListCreateAPIView):
    serializer_class = FoodDonationSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        queryset = FoodDonation.objects.select_related('donor', 'category').all()

        # Donors view all their own listings; Admins see all
        if user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            return queryset.filter(donor=user.donor_profile).order_by('-created_at')
        if user.role == 'ADMIN' or user.is_superuser:
            return queryset.order_by('-created_at')

        # NGOs browse only verified donors' AVAILABLE & PARTIALLY_RESERVED listings (FR-11 & Section 11.1)
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        else:
            queryset = queryset.filter(
                status__in=[DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_RESERVED],
                donor__verification_status='VERIFIED',
                pickup_deadline__gt=timezone.now(),
            )

        category = self.request.query_params.get('category')
        food_type = self.request.query_params.get('food_type')
        location = self.request.query_params.get('location')
        min_quantity = self.request.query_params.get('min_quantity')
        exclude_allergen = self.request.query_params.get('exclude_allergen')
        deadline_before = self.request.query_params.get('deadline_before')

        if category:
            queryset = queryset.filter(category_id=category)
        if food_type:
            queryset = queryset.filter(food_type=food_type)
        if location:
            queryset = queryset.filter(location__icontains=location)
        if exclude_allergen:
            queryset = queryset.exclude(allergens__icontains=exclude_allergen)
        if deadline_before:
            queryset = queryset.filter(pickup_deadline__lte=deadline_before)

        results = list(queryset.order_by('pickup_deadline'))
        if min_quantity:
            try:
                min_q = Decimal(str(min_quantity))
                results = [d for d in results if d.available_quantity >= min_q]
            except Exception:
                pass
        return results

    def create(self, request, *args, **kwargs):
        if request.user.role != 'DONOR' or not hasattr(request.user, 'donor_profile'):
            return Response(
                {"error": "Only verified donors can create food listings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donation = serializer.save(
            donor=request.user.donor_profile,
            status=DonationStatus.DRAFT,
        )

        # Optional one-step publish if client sends publish_now=True
        if request.data.get('publish_now'):
            try:
                donation = publish_donation(donation.id, request.user)
            except Exception as exc:
                return _handle_service_error(exc)

        out = self.get_serializer(donation)
        return Response(out.data, status=status.HTTP_201_CREATED)


class FoodDonationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FoodDonationSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]
    queryset = FoodDonation.objects.select_related('donor', 'category').all()

    def perform_update(self, serializer):
        instance = self.get_object()
        if self.request.user.role != 'ADMIN' and instance.donor.user_id != self.request.user.id:
            raise ServicePermissionError("You can only edit your own listings.")

        updated = serializer.save(version=instance.version + 1)

        # FR-09: Notify NGOs with Pending requests when a listing is edited before acceptance
        if Decimal(str(updated.reserved_quantity)) == Decimal('0.00'):
            pending_reqs = updated.requests.filter(status='PENDING').select_related('ngo__user')
            for req in pending_reqs:
                Notification.objects.create(
                    recipient=req.ngo.user,
                    title="Donation Listing Updated",
                    message=f"Donor updated details for '{updated.food_name}'. Please review before pickup.",
                    event_type='LISTING_EDITED',
                    related_entity_type='DONATION',
                    related_entity_id=updated.id,
                )

    def destroy(self, request, *args, **kwargs):
        # BR-14: Terminal/active records are never hard-deleted; soft-withdraw via service layer
        instance = self.get_object()
        try:
            donation = withdraw_donation(
                instance.id,
                request.user,
                reason_code=request.data.get('reason_code', 'DONOR_WITHDREW'),
                remarks=request.data.get('remarks', 'Soft-deleted/withdrawn via API'),
            )
            return Response(
                {"message": "Listing withdrawn.", "donation": FoodDonationSerializer(donation).data},
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return _handle_service_error(exc)


class PublishDonationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDonor, IsVerified]

    def post(self, request, pk):
        declaration = request.data.get("donor_declaration", True)
        if not declaration:
            return Response(
                {"error": "You must tick the food safety declaration before publishing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            donation = publish_donation(pk, request.user)
            return Response({
                "message": "Donation published successfully and is now AVAILABLE to NGOs.",
                "donation": FoodDonationSerializer(donation).data,
            })
        except FoodDonation.DoesNotExist:
            return Response({"error": "Donation listing not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class WithdrawDonationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request, pk):
        reason_code = request.data.get("reason_code") or (
            "ADMIN_ACTION" if request.user.role == "ADMIN" else "DONOR_WITHDREW"
        )
        remarks = request.data.get("remarks") or request.data.get("reason")
        expected_version = request.data.get("version")

        try:
            donation = withdraw_donation(
                pk,
                request.user,
                reason_code=reason_code,
                remarks=remarks,
                expected_version=expected_version,
            )
            return Response({
                "message": f"Listing withdrawn ({reason_code}).",
                "donation": FoodDonationSerializer(donation).data,
            })
        except FoodDonation.DoesNotExist:
            return Response({"error": "Donation listing not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class CloseDonationRemainderView(APIView):
    """SRS Section 5.4 AL-5: Donor closes unreserved remainder (T becomes R)."""
    permission_classes = [permissions.IsAuthenticated, IsDonor, IsVerified]

    def post(self, request, pk):
        expected_version = request.data.get("version")
        try:
            donation = close_donation_remainder(
                pk,
                request.user,
                expected_version=expected_version,
            )
            return Response({
                "message": "Unreserved remainder closed. Listing is now FULLY_RESERVED.",
                "donation": FoodDonationSerializer(donation).data,
            })
        except FoodDonation.DoesNotExist:
            return Response({"error": "Donation listing not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)