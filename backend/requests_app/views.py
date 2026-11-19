from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import IsDonor, IsNGO, IsVerified
from allocations.services import (
    HandoverCheck,
    submit_donation_request,
    decide_donation_request,
    cancel_donation_request,
    ServiceValidationError,
    ServicePermissionError,
    ServiceConflictError,
)
from .models import DonationRequest
from .serializers import DonationRequestSerializer


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


class DonationRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = DonationRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        qs = DonationRequest.objects.select_related(
            'donation__donor__user', 'ngo__user', 'distribution_point'
        )
        if user.role == 'NGO' and hasattr(user, 'ngo_profile'):
            return qs.filter(ngo=user.ngo_profile)
        elif user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            return qs.filter(donation__donor=user.donor_profile)
        return qs.all()

    def create(self, request, *args, **kwargs):
        if request.user.role != 'NGO' or not hasattr(request.user, 'ngo_profile'):
            return Response(
                {"error": "Only verified NGOs can submit food requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        try:
            req = submit_donation_request(
                donation_id=vd['donation'].id,
                ngo_profile=request.user.ngo_profile,
                distribution_point_id=vd['distribution_point'].id,
                requested_quantity=vd['requested_quantity'],
                expected_beneficiaries=vd['expected_beneficiaries'],
                min_acceptable_quantity=vd.get('min_acceptable_quantity'),
                message=vd.get('message'),
                safety_acknowledged=vd.get('safety_acknowledged', True),
            )
            return Response(
                DonationRequestSerializer(req, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return _handle_service_error(exc)


class AcceptRequestView(APIView):
    """SRS Section 4.3 & 5.4: Donor accepts full/partial quantity (or rejects via decision='REJECT')."""
    permission_classes = [permissions.IsAuthenticated, IsDonor, IsVerified]
    serializer_class = DonationRequestSerializer

    def post(self, request, pk):
        decision = request.data.get("decision", "ACCEPT").upper()
        accepted_qty_input = request.data.get("accepted_quantity")
        reason_code = request.data.get("reason_code") or request.data.get("reason")
        client_version = request.data.get("version")

        if decision == "ACCEPT" and accepted_qty_input is None:
            return Response(
                {"error": "accepted_quantity is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            req = decide_donation_request(
                request_id=pk,
                actor=request.user,
                decision=decision,
                accepted_quantity=accepted_qty_input,
                reason_code=reason_code,
                expected_version=client_version,
            )
            msg = (
                f"Request {req.status.lower().replace('_', ' ')} for {req.accepted_quantity} {req.donation.unit}."
                if decision == "ACCEPT"
                else f"Request rejected ({reason_code})."
            )
            return Response({
                "message": msg,
                "request": DonationRequestSerializer(req, context={'request': request}).data,
            })
        except DonationRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class RejectRequestView(APIView):
    """SRS Section 4.3 & 4.5: Donor rejects a pending request with a mandatory reason code."""
    permission_classes = [permissions.IsAuthenticated, IsDonor, IsVerified]

    def post(self, request, pk):
        reason_code = request.data.get("reason_code") or request.data.get("reason")
        client_version = request.data.get("version")

        try:
            req = decide_donation_request(
                request_id=pk,
                actor=request.user,
                decision="REJECT",
                reason_code=reason_code,
                expected_version=client_version,
            )
            return Response({
                "message": f"Request rejected ({reason_code}).",
                "request": DonationRequestSerializer(req, context={'request': request}).data,
            })
        except DonationRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class CancelRequestView(APIView):
    """SRS Section 4.3 & 5.4 AL-4: NGO/Admin cancels request with mandatory reason."""
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request, pk):
        reason_code = request.data.get("reason_code") or request.data.get("reason")
        remarks = request.data.get("remarks")
        client_version = request.data.get("version")

        try:
            req = cancel_donation_request(
                request_id=pk,
                actor=request.user,
                reason_code=reason_code,
                remarks=remarks,
                expected_version=client_version,
            )
            return Response({
                "message": "Request cancelled successfully.",
                "request": DonationRequestSerializer(req, context={'request': request}).data,
            })
        except DonationRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class ReceiptCheckRequestView(APIView):
    """SRS Section 6.4 Checkpoint 4: NGO logs post-delivery receipt hygiene check."""
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def post(self, request, pk):
        try:
            req = DonationRequest.objects.select_related('ngo', 'donation').get(pk=pk)
        except DonationRequest.DoesNotExist:
            return Response({"error": "Request not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role != 'ADMIN' and req.ngo.user_id != request.user.id:
            return Response(
                {"error": "Only the receiving NGO can verify receipt."},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = req.assignments.filter(status='DELIVERED').first() or req.assignments.order_by('-id').first()
        if not assignment:
            return Response(
                {"error": "No volunteer delivery assignment found for this request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        condition = str(request.data.get("receipt_condition", "GOOD")).upper()
        notes = request.data.get("receipt_notes", f"NGO inspection verified: {condition}")

        HandoverCheck.objects.create(
            assignment=assignment,
            stage=HandoverCheck.CheckStage.RECEIPT,
            checklist_result={"receipt_condition": condition},
            passed=(condition != "REJECTED"),
            checked_by=request.user,
            notes=notes,
        )

        return Response({
            "message": f"Receipt hygiene inspection logged ({condition}).",
            "request": DonationRequestSerializer(req, context={'request': request}).data,
        })