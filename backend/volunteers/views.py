from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import IsVerified, IsNGO, IsVolunteer
from allocations.services import (
    assign_volunteer,
    respond_to_assignment,
    start_pickup,
    complete_pickup,
    complete_delivery_with_receipt_check,
    fail_assignment,
    ServiceValidationError,
    ServicePermissionError,
    ServiceConflictError,
)
from .models import VolunteerAssignment, AssignmentStatus
from .serializers import VolunteerAssignmentSerializer


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


class VolunteerAssignmentListCreateView(generics.ListCreateAPIView):
    serializer_class = VolunteerAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        qs = VolunteerAssignment.objects.select_related(
            'request__donation__donor__user',
            'request__ngo__user',
            'request__distribution_point',
            'volunteer__user',
        ).prefetch_related('tracking_events', 'handover_checks')

        if user.role == 'VOLUNTEER' and hasattr(user, 'volunteer_profile'):
            return qs.filter(volunteer=user.volunteer_profile).order_by('-assigned_at')
        elif user.role == 'NGO' and hasattr(user, 'ngo_profile'):
            return qs.filter(request__ngo=user.ngo_profile).order_by('-assigned_at')
        elif user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            return qs.filter(request__donation__donor=user.donor_profile).order_by('-assigned_at')
        return qs.all().order_by('-assigned_at')

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('NGO', 'ADMIN') and not request.user.is_superuser:
            return Response(
                {"error": "Only the requesting NGO can assign volunteers."},
                status=status.HTTP_403_FORBIDDEN,
            )

        request_id = request.data.get('request')
        volunteer_id = request.data.get('volunteer')
        notes = request.data.get('notes')

        if not request_id or not volunteer_id:
            return Response(
                {"error": "Both 'request' and 'volunteer' IDs are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assignment = assign_volunteer(
                request_id=request_id,
                volunteer_profile_id=volunteer_id,
                actor=request.user,
                notes=notes,
            )
            return Response(
                VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return _handle_service_error(exc)


class RespondAssignmentView(APIView):
    """SRS Section 4.4 & 7.2 Step 2: Volunteer accepts or rejects assignment."""
    permission_classes = [permissions.IsAuthenticated, IsVolunteer, IsVerified]

    def post(self, request, pk):
        accept = request.data.get('accept')
        if accept is None:
            decision = str(request.data.get('decision', '')).upper()
            accept = decision == 'ACCEPT'
        reason_code = request.data.get('reason_code') or request.data.get('reason')

        try:
            assignment = respond_to_assignment(
                assignment_id=pk,
                actor=request.user,
                accept=bool(accept),
                reason_code=reason_code,
            )
            return Response({
                "message": f"Assignment {assignment.status.lower()}.",
                "assignment": VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
            })
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class StartPickupView(APIView):
    """SRS Section 7.2 Step 4: ACCEPTED -> PICKUP_IN_PROGRESS."""
    permission_classes = [permissions.IsAuthenticated, IsVolunteer, IsVerified]

    def post(self, request, pk):
        try:
            assignment = start_pickup(assignment_id=pk, actor=request.user)
            return Response({
                "message": "Pickup started (PICKUP_IN_PROGRESS).",
                "assignment": VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
            })
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class CompletePickupView(APIView):
    """SRS Section 6.4 #3 & 7.2 Step 5: Pickup checklist, OTP verification & actual quantity."""
    permission_classes = [permissions.IsAuthenticated, IsVolunteer, IsVerified]

    def post(self, request, pk):
        verification_code = request.data.get('verification_code')
        checklist_result = request.data.get('checklist_result', {
            "container_sealed_and_clean": True,
            "no_visible_spoilage_or_odour": True,
            "storage_condition_matches": True,
            "quantity_verified": True,
        })
        passed = request.data.get('passed', True)
        actual_quantity = request.data.get('actual_quantity')
        shortfall_reason = request.data.get('shortfall_reason')
        notes = request.data.get('notes')

        try:
            assignment = complete_pickup(
                assignment_id=pk,
                actor=request.user,
                verification_code=verification_code,
                checklist_result=checklist_result,
                passed=bool(passed),
                actual_quantity=actual_quantity,
                shortfall_reason=shortfall_reason,
                notes=notes,
            )
            return Response({
                "message": f"Pickup processed ({assignment.status}).",
                "assignment": VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
            })
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class CompleteDeliveryView(APIView):
    """SRS Section 6.4 #4 & 7.2 Step 6-7: Delivery & NGO Receipt Check -> DELIVERED."""
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request, pk):
        checklist_result = request.data.get('checklist_result', {
            "container_intact_on_arrival": True,
            "consume_by_still_valid": True,
            "temperature_and_hygiene_ok": True,
        })
        passed = request.data.get('passed', True)
        notes = request.data.get('notes')

        try:
            assignment = complete_delivery_with_receipt_check(
                assignment_id=pk,
                actor=request.user,
                checklist_result=checklist_result,
                passed=bool(passed),
                notes=notes,
            )
            return Response({
                "message": f"Delivery updated ({assignment.status}).",
                "assignment": VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
            })
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class FailAssignmentView(APIView):
    """SRS Section 7.4: Mark assignment FAILED with controlled reason code for NGO reassignment."""
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request, pk):
        reason_code = request.data.get('reason_code') or request.data.get('reason')
        remarks = request.data.get('remarks') or request.data.get('notes')

        try:
            assignment = fail_assignment(
                assignment_id=pk,
                actor=request.user,
                reason_code=reason_code,
                remarks=remarks,
            )
            return Response({
                "message": f"Assignment marked FAILED ({reason_code}).",
                "assignment": VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
            })
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)


class UpdateAssignmentStatusView(APIView):
    """Backward-compatible PATCH endpoint routed safely through the SRS service layer."""
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def patch(self, request, pk):
        new_status = request.data.get("status")
        input_code = request.data.get("verification_code")
        reason_code = request.data.get("reason_code") or request.data.get("reason")
        checklist_result = request.data.get("checklist_result")
        passed = request.data.get("passed", True)
        actual_quantity = request.data.get("actual_quantity")
        shortfall_reason = request.data.get("shortfall_reason")
        notes = request.data.get("notes")

        try:
            if new_status == AssignmentStatus.ACCEPTED:
                assignment = respond_to_assignment(pk, request.user, accept=True)
            elif new_status == AssignmentStatus.REJECTED:
                assignment = respond_to_assignment(pk, request.user, accept=False, reason_code=reason_code or 'OTHER')
            elif new_status in ('EN_ROUTE', AssignmentStatus.PICKUP_IN_PROGRESS):
                assignment = start_pickup(pk, request.user)
            elif new_status == AssignmentStatus.PICKED_UP:
                assignment = complete_pickup(
                    assignment_id=pk,
                    actor=request.user,
                    verification_code=input_code,
                    checklist_result=checklist_result or {"default_pickup_check": True},
                    passed=bool(passed),
                    actual_quantity=actual_quantity,
                    shortfall_reason=shortfall_reason,
                    notes=notes,
                )
            elif new_status == AssignmentStatus.DELIVERED:
                assignment = complete_delivery_with_receipt_check(
                    assignment_id=pk,
                    actor=request.user,
                    checklist_result=checklist_result,
                    passed=bool(passed),
                    notes=notes,
                )
            elif new_status in ('CANCELLED', AssignmentStatus.FAILED):
                assignment = fail_assignment(
                    assignment_id=pk,
                    actor=request.user,
                    reason_code=reason_code or 'OTHER',
                    remarks=notes,
                )
            else:
                return Response({"error": "Invalid status transition"}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "message": f"Assignment status updated to {assignment.status}",
                "assignment": VolunteerAssignmentSerializer(assignment, context={'request': request}).data,
            })
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return _handle_service_error(exc)