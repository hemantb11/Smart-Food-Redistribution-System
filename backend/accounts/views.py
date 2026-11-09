from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminRole, IsNGO, IsVerified
from .models import *
from .serializers import *


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        user = request.user
        if user.role == User.Role.DONOR:
            profile = getattr(user, "donor_profile", None)
            serializer = DonorProfileSerializer(profile, data=request.data, partial=True)
        elif user.role == User.Role.NGO:
            profile = getattr(user, "ngo_profile", None)
            serializer = NGOProfileSerializer(profile, data=request.data, partial=True)
        elif user.role == User.Role.VOLUNTEER:
            profile = getattr(user, "volunteer_profile", None)
            serializer = VolunteerProfileSerializer(profile, data=request.data, partial=True)
        else:
            return Response({"error": "No editable profile for this role"}, status=status.HTTP_400_BAD_REQUEST)

        if serializer and serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DistributionPointListCreateView(generics.ListCreateAPIView):
    serializer_class = DistributionPointSerializer
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def get_queryset(self):
        return DistributionPoint.objects.filter(ngo=self.request.user.ngo_profile)

    def perform_create(self, serializer):
        serializer.save(ngo=self.request.user.ngo_profile)


class AdminVerifyUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("account_status")
        if new_status not in [User.AccountStatus.VERIFIED, User.AccountStatus.REJECTED, User.AccountStatus.SUSPENDED]:
            return Response({"error": "Invalid account_status"}, status=status.HTTP_400_BAD_REQUEST)

        target_user.account_status = new_status
        target_user.save()

        if hasattr(target_user, "donor_profile"):
            target_user.donor_profile.verification_status = new_status
            target_user.donor_profile.save()
        elif hasattr(target_user, "ngo_profile"):
            target_user.ngo_profile.verification_status = new_status
            target_user.ngo_profile.save()

        return Response({
            "message": f"User {target_user.username} status updated to {new_status}",
            "user": UserSerializer(target_user).data,
        })