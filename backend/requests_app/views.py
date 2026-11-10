from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from core.permissions import IsNGO, IsDonor, IsVerified, IsAdminRole
from donations.models import FoodDonation, DonationStatus
from .models import DonationRequest, RequestStatus
from .serializers import DonationRequestSerializer


class DonationRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = DonationRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'NGO' and hasattr(user, 'ngo_profile'):
            return DonationRequest.objects.filter(ngo=user.ngo_profile)
        elif user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            return DonationRequest.objects.filter(donation__donor=user.donor_profile)
        return DonationRequest.objects.all()

    def perform_create(self, serializer):
        serializer.save(ngo=self.request.user.ngo_profile, status=RequestStatus.PENDING)


class AcceptRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDonor, IsVerified]
    serializer_class = DonationRequestSerializer

    def post(self, request, pk):
        accepted_qty_input = request.data.get("accepted_quantity")
        client_version = request.data.get("version")

        if accepted_qty_input is None:
            return Response({"error": "accepted_quantity is required"}, status=status.HTTP_400_BAD_REQUEST)

        accepted_qty = float(accepted_qty_input)

        # Concurrency Lock (SRS Section 5.5 - C-2 Transaction and Lock)
        with transaction.atomic():
            try:
                # Lock request row first
                req = DonationRequest.objects.select_for_update().get(pk=pk)
            except DonationRequest.DoesNotExist:
                return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

            # Lock donation row second
            donation = FoodDonation.objects.select_for_update().get(pk=req.donation.id)

            if req.donation.donor != request.user.donor_profile:
                return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

            if req.status != RequestStatus.PENDING:
                return Response({"error": f"Request is already processed ({req.status})."}, status=status.HTTP_409_CONFLICT)

            # Version Check (Optimistic Locking Control)
            if client_version and int(client_version) != req.version:
                return Response({
                    "error": "Stale version. The record was modified by another action.",
                    "current_state": DonationRequestSerializer(req).data
                }, status=status.HTTP_409_CONFLICT)

            available_qty = float(donation.available_quantity)

            if accepted_qty > available_qty:
                return Response({
                    "error": f"Only {available_qty} {donation.unit} available. Cannot accept {accepted_qty}.",
                    "available_quantity": available_qty
                }, status=status.HTTP_409_CONFLICT)

            if req.min_acceptable_quantity and accepted_qty < float(req.min_acceptable_quantity):
                return Response({"error": f"Accepted quantity is below NGO's minimum acceptable quantity ({req.min_acceptable_quantity})."}, status=status.HTTP_400_BAD_REQUEST)

            # Update Quantities & Request Status
            req.accepted_quantity = accepted_qty
            if accepted_qty == float(req.requested_quantity):
                req.status = RequestStatus.ACCEPTED
            else:
                req.status = RequestStatus.PARTIALLY_ACCEPTED

            req.decision_at = timezone.now()
            req.version += 1
            req.save()

            # Reserve quantity on donation pool
            donation.reserved_quantity = float(donation.reserved_quantity) + accepted_qty
            
            # Derive Food Donation Status (SRS Section 4.2)
            if donation.reserved_quantity >= donation.total_quantity:
                donation.status = DonationStatus.FULLY_RESERVED
            else:
                donation.status = DonationStatus.PARTIALLY_RESERVED

            donation.version += 1
            donation.save()

            # Rule AL-3: Auto-reject remaining pending requests if available quantity becomes 0
            if donation.available_quantity == 0:
                other_pending = DonationRequest.objects.filter(donation=donation, status=RequestStatus.PENDING).exclude(pk=req.pk)
                for pending_req in other_pending:
                    pending_req.status = RequestStatus.REJECTED
                    pending_req.decision_reason = "QUANTITY_UNAVAILABLE"
                    pending_req.decision_at = timezone.now()
                    pending_req.save()

        return Response({
            "message": f"Request accepted for {accepted_qty} {donation.unit}.",
            "request": DonationRequestSerializer(req).data
        })


class CancelRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request, pk):
        reason = request.data.get("reason")
        if not reason:
            return Response({"error": "Cancellation reason is mandatory."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                req = DonationRequest.objects.select_for_update().get(pk=pk)
                donation = FoodDonation.objects.select_for_update().get(pk=req.donation.id)
            except DonationRequest.DoesNotExist:
                return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

            # Rule AL-4: Quantity release if cancelled before pickup & before deadline
            if req.status in [RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED]:
                donation.reserved_quantity = float(donation.reserved_quantity) - float(req.accepted_quantity)
                if donation.reserved_quantity == 0:
                    donation.status = DonationStatus.AVAILABLE
                else:
                    donation.status = DonationStatus.PARTIALLY_RESERVED
                donation.save()

            req.status = RequestStatus.CANCELLED
            req.cancelled_by = request.user
            req.cancel_reason = reason
            req.version += 1
            req.save()

        return Response({
            "message": "Request cancelled successfully.",
            "request": DonationRequestSerializer(req).data
        })