from accounts.models import VolunteerProfile
from rest_framework import generics, permissions, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminRole, IsNGO, IsVolunteer, IsVerified
from notifications.models import Notification
from .models import (
    User,
    NGOProfile,
    VolunteerProfile,
    DistributionPoint,
    AvailabilityStatus,
    ContactMessage,
)
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    DonorProfileSerializer,
    NGOProfileSerializer,
    VolunteerProfileSerializer,
    DistributionPointSerializer,
    ContactMessageSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class VerifiedNGOListView(generics.ListAPIView):
    """Public/Auth list of verified NGOs so Volunteers can select their affiliated NGO."""
    serializer_class = NGOProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return NGOProfile.objects.filter(
            verification_status=User.AccountStatus.VERIFIED
        ).order_by("organisation_name")


class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _update(self, request):
        user = request.user
        if "phone" in request.data:
            user.phone = request.data["phone"]
            user.save(update_fields=["phone"])

        if user.role == User.Role.DONOR:
            profile = getattr(user, "donor_profile", None)
            serializer = DonorProfileSerializer(profile, data=request.data, partial=True)
        elif user.role == User.Role.NGO:
            profile = getattr(user, "ngo_profile", None)
            serializer = NGOProfileSerializer(profile, data=request.data, partial=True)
        elif user.role == User.Role.VOLUNTEER:
            profile = getattr(user, "volunteer_profile", None)
            old_ngo_id = profile.ngo_id if profile else None
            serializer = VolunteerProfileSerializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                updated_profile = serializer.save()
                if "ngo" in request.data and updated_profile.ngo_id != old_ngo_id:
                    updated_profile.ngo_approved = False
                    updated_profile.save(update_fields=["ngo_approved"])
                    user.account_status = User.AccountStatus.PENDING
                    user.save(update_fields=["account_status"])
                return Response(UserSerializer(user).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(UserSerializer(user).data)

        if serializer and serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        return self._update(request)

    def patch(self, request):
        return self._update(request)


class DistributionPointListCreateView(generics.ListCreateAPIView):
    serializer_class = DistributionPointSerializer
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def get_queryset(self):
        return DistributionPoint.objects.filter(ngo=self.request.user.ngo_profile).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(ngo=self.request.user.ngo_profile)


class DistributionPointDetailView(generics.RetrieveUpdateDestroyAPIView):
    """SRS Section 10 FR-05: NGO updates or deactivates its distribution points."""
    serializer_class = DistributionPointSerializer
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def get_queryset(self):
        return DistributionPoint.objects.filter(ngo=self.request.user.ngo_profile)


class NGOVolunteerListView(generics.ListAPIView):
    """SRS Section 3 & FR-04: NGO views all volunteers affiliated with its organisation."""
    serializer_class = VolunteerProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def get_queryset(self):
        return VolunteerProfile.objects.filter(
            ngo=self.request.user.ngo_profile
        ).select_related("user", "ngo").order_by("-created_at")


class NGOApproveVolunteerView(APIView):
    """SRS Section 3 & FR-04: NGO approves or revokes its own affiliated volunteers."""
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def post(self, request, volunteer_id):
        try:
            volunteer = VolunteerProfile.objects.select_related("user").get(
                id=volunteer_id,
                ngo=request.user.ngo_profile,
            )
        except VolunteerProfile.DoesNotExist:
            return Response(
                {"error": "Volunteer not found under your NGO."},
                status=status.HTTP_404_NOT_FOUND,
            )

        approve = bool(request.data.get("approve", True))
        volunteer.ngo_approved = approve
        volunteer.save(update_fields=["ngo_approved"])

        target_user = volunteer.user
        target_user.account_status = (
            User.AccountStatus.VERIFIED if approve else User.AccountStatus.PENDING
        )
        target_user.save(update_fields=["account_status"])

        Notification.objects.create(
            recipient=target_user,
            title="Volunteer Affiliation Updated",
            message=(
                f"{request.user.ngo_profile.organisation_name} approved your volunteer account."
                if approve
                else f"{request.user.ngo_profile.organisation_name} revoked your volunteer approval."
            ),
            event_type="VOLUNTEER_APPROVAL",
            related_entity_type="VOLUNTEER",
            related_entity_id=volunteer.id,
        )

        return Response({
            "message": f"Volunteer {target_user.username} {'approved' if approve else 'unapproved'}.",
            "volunteer": VolunteerProfileSerializer(volunteer).data,
        })


class VolunteerAvailabilityView(APIView):
    """SRS Section 7.1 & FR-04: Volunteer updates availability (AVAILABLE, BUSY, OFFLINE)."""
    permission_classes = [permissions.IsAuthenticated, IsVolunteer]

    def patch(self, request):
        profile = getattr(request.user, "volunteer_profile", None)
        if not profile:
            return Response({"error": "Volunteer profile not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = str(request.data.get("availability_status", "")).upper()
        if new_status not in (
            AvailabilityStatus.AVAILABLE,
            AvailabilityStatus.BUSY,
            AvailabilityStatus.OFFLINE,
        ):
            return Response(
                {"error": "availability_status must be AVAILABLE, BUSY, or OFFLINE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.availability_status = new_status
        profile.save(update_fields=["availability_status"])
        return Response({
            "message": f"Availability updated to {new_status}.",
            "volunteer": VolunteerProfileSerializer(profile).data,
        })


class AdminUserListView(generics.ListAPIView):
    """SRS Section 10 FR-37: Admin reviews all registered users & verification statuses."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        qs = User.objects.select_related(
            "donor_profile", "ngo_profile", "volunteer_profile__ngo"
        ).order_by("-created_at")
        role = self.request.query_params.get("role")
        account_status = self.request.query_params.get("account_status")
        if role:
            qs = qs.filter(role=role.upper())
        if account_status:
            qs = qs.filter(account_status=account_status.upper())
        return qs


class AdminVerifyUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("account_status")
        if new_status not in [
            User.AccountStatus.VERIFIED,
            User.AccountStatus.REJECTED,
            User.AccountStatus.SUSPENDED,
        ]:
            return Response({"error": "Invalid account_status"}, status=status.HTTP_400_BAD_REQUEST)

        target_user.account_status = new_status
        target_user.save(update_fields=["account_status"])

        if hasattr(target_user, "donor_profile"):
            target_user.donor_profile.verification_status = new_status
            target_user.donor_profile.save(update_fields=["verification_status"])
        elif hasattr(target_user, "ngo_profile"):
            target_user.ngo_profile.verification_status = new_status
            target_user.ngo_profile.save(update_fields=["verification_status"])

        Notification.objects.create(
            recipient=target_user,
            title="Account Verification Status Updated",
            message=f"Your account status has been updated to {new_status} by Admin.",
            event_type="ACCOUNT_VERIFICATION",
            related_entity_type="USER",
            related_entity_id=target_user.id,
        )

        return Response({
            "message": f"User {target_user.username} status updated to {new_status}",
            "user": UserSerializer(target_user).data,
        })


class ContactMessageCreateView(generics.CreateAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    authentication_classes = []
    permission_classes = [AllowAny]