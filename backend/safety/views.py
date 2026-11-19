from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from accounts.models import User
from core.permissions import IsAdminRole
from notifications.models import Notification
from allocations.services import withdraw_donation
from .models import SafetyReport
from .serializers import SafetyReportSerializer


class SafetyReportListCreateView(generics.ListCreateAPIView):
    serializer_class = SafetyReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = SafetyReport.objects.select_related(
            'donation__donor', 'reported_by', 'resolved_by'
        ).order_by('-created_at')
        if user.role == 'ADMIN' or user.is_superuser:
            return qs
        return qs.filter(reported_by=user)

    def perform_create(self, serializer):
        report = serializer.save(reported_by=self.request.user)
        admins = User.objects.filter(role=User.Role.ADMIN) | User.objects.filter(is_superuser=True)
        for admin_user in admins.distinct():
            Notification.objects.create(
                recipient=admin_user,
                title="Food Safety Concern Reported",
                message=f"{self.request.user.username} reported a safety issue on '{report.donation.food_name}'.",
                event_type='SAFETY_REPORT',
                related_entity_type='DONATION',
                related_entity_id=report.donation.id,
            )


class ResolveSafetyReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            report = SafetyReport.objects.select_related('donation').get(pk=pk)
        except SafetyReport.DoesNotExist:
            return Response({"error": "Safety report not found."}, status=status.HTTP_404_NOT_FOUND)

        resolution = request.data.get('resolution', 'Reviewed and resolved by Admin.')
        withdraw_listing = bool(request.data.get('withdraw_listing', False))

        if withdraw_listing and report.donation.status not in ('WITHDRAWN', 'COMPLETED', 'EXPIRED'):
            try:
                withdraw_donation(
                    report.donation.id,
                    request.user,
                    reason_code='FOOD_UNSAFE_REPORTED',
                    remarks=resolution,
                )
            except Exception:
                pass

        report.is_resolved = True
        report.resolved_by = request.user
        report.resolution = resolution
        report.resolved_at = timezone.now()
        report.save()

        return Response({
            "message": "Safety report resolved.",
            "report": SafetyReportSerializer(report).data,
        })