from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from core.permissions import IsVerified, IsNGO, IsVolunteer
from .models import VolunteerAssignment, AssignmentStatus
from .serializers import VolunteerAssignmentSerializer


class VolunteerAssignmentListCreateView(generics.ListCreateAPIView):
    serializer_class = VolunteerAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'VOLUNTEER' and hasattr(user, 'volunteer_profile'):
            return VolunteerAssignment.objects.filter(volunteer=user.volunteer_profile)
        elif user.role == 'NGO' and hasattr(user, 'ngo_profile'):
            return VolunteerAssignment.objects.filter(request__ngo=user.ngo_profile)
        return VolunteerAssignment.objects.all()

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)


class UpdateAssignmentStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def patch(self, request, pk):
        try:
            assignment = VolunteerAssignment.objects.get(pk=pk)
        except VolunteerAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        input_code = request.data.get("verification_code")

        if new_status not in [AssignmentStatus.EN_ROUTE, AssignmentStatus.PICKED_UP, AssignmentStatus.DELIVERED, AssignmentStatus.CANCELLED]:
            return Response({"error": "Invalid status transition"}, status=status.HTTP_400_BAD_REQUEST)

        # Verification OTP check when marking PICKED_UP
        if new_status == AssignmentStatus.PICKED_UP:
            if assignment.verification_code and input_code != assignment.verification_code:
                return Response({"error": "Invalid verification code for pickup."}, status=status.HTTP_400_BAD_REQUEST)
            assignment.picked_up_at = timezone.now()

        if new_status == AssignmentStatus.DELIVERED:
            assignment.delivered_at = timezone.now()

        assignment.status = new_status
        assignment.save()

        return Response({
            "message": f"Assignment status updated to {new_status}",
            "assignment": VolunteerAssignmentSerializer(assignment).data
        })