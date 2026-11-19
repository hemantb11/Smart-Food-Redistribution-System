from decimal import Decimal
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import IsNGO, IsVerified
from requests_app.models import DonationRequest
from allocations.services import (
    record_distribution_session,
    confirm_distribution_completion,
    ServiceValidationError,
    ServicePermissionError,
    ServiceConflictError,
)
from .models import DistributionRecord
from .serializers import DistributionRecordSerializer


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


class DistributionRecordListCreateView(generics.ListCreateAPIView):
    """SRS Section 8.2 & 8.3: Record beneficiary distribution sessions & view impact logs."""
    serializer_class = DistributionRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        qs = DistributionRecord.objects.select_related(
            'request__donation__donor',
            'ngo',
            'distribution_point',
            'confirmed_by',
        ).order_by('-distributed_at')

        if user.role == 'NGO' and hasattr(user, 'ngo_profile'):
            return qs.filter(ngo=user.ngo_profile)
        if user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            return qs.filter(request__donation__donor=user.donor_profile)
        return qs.all()

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('NGO', 'ADMIN') and not request.user.is_superuser:
            return Response(
                {"error": "Only the receiving NGO can record distribution sessions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        req_obj = vd['request']
        dp = vd.get('distribution_point') or req_obj.distribution_point
        auto_confirm = request.data.get('auto_confirm', True)

        try:
            record = record_distribution_session(
                request_id=req_obj.id,
                actor=request.user,
                distribution_point_id=dp.id,
                actual_headcount_served=vd['actual_headcount_served'],
                quantity_distributed=vd['quantity_distributed'],
                discarded_quantity=vd.get('discarded_quantity', Decimal('0.00')),
                discard_reason=vd.get('discard_reason'),
                notes=vd.get('notes'),
                feedback_note=vd.get('feedback_note'),
                auto_confirm=bool(auto_confirm),
            )
            if request.FILES.get('photo'):
                record.photo = request.FILES['photo']
                record.save(update_fields=['photo'])

            return Response(
                DistributionRecordSerializer(record).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return _handle_service_error(exc)


class ConfirmDistributionCompletionView(APIView):
    """SRS Section 8.2 Stage 5: NGO confirms distribution completion for a request."""
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def post(self, request, request_id):
        try:
            donation = confirm_distribution_completion(
                request_id=request_id,
                actor=request.user,
            )
            return Response({
                "message": "Distribution confirmed and donation impact metrics updated.",
                "donation_id": donation.id,
                "donation_status": donation.status,
                "distributed_quantity": str(donation.distributed_quantity),
            })
        except DonationRequest.DoesNotExist:
            return Response({"error": "Donation request not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)