from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from core.permissions import IsDonor, IsNGO, IsVerified, IsAdminRole
from .models import FoodCategory, FoodDonation, DonationStatus
from .serializers import FoodCategorySerializer, FoodDonationSerializer


class FoodCategoryListView(generics.ListCreateAPIView):
    queryset = FoodCategory.objects.all()
    serializer_class = FoodCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class FoodDonationListCreateView(generics.ListCreateAPIView):
    serializer_class = FoodDonationSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def get_queryset(self):
        user = self.request.user
        queryset = FoodDonation.objects.all()

        # Donors view all their listings; NGOs view AVAILABLE & PARTIALLY_RESERVED
        if user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            return queryset.filter(donor=user.donor_profile)
        
        # Search and Filter for NGOs
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        else:
            queryset = queryset.filter(status__in=[DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_RESERVED])

        category = self.request.query_params.get('category')
        food_type = self.request.query_params.get('food_type')
        location = self.request.query_params.get('location')

        if category:
            queryset = queryset.filter(category_id=category)
        if food_type:
            queryset = queryset.filter(food_type=food_type)
        if location:
            queryset = queryset.filter(location__icontains=location)

        return queryset

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user.donor_profile, status=DonationStatus.DRAFT)


class FoodDonationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FoodDonationSerializer
    permission_classes = [permissions.IsAuthenticated, IsVerified]
    queryset = FoodDonation.objects.all()

    def perform_update(self, serializer):
        instance = self.get_object()
        # Rule AL-6: Lock material fields if already reserved
        if instance.reserved_quantity > 0:
            raise serializers.ValidationError("Cannot edit material details once a request is accepted.")
        serializer.save()


class PublishDonationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDonor, IsVerified]

    def post(self, request, pk):
        try:
            donation = FoodDonation.objects.get(pk=pk, donor=request.user.donor_profile)
        except FoodDonation.DoesNotExist:
            return Response({"error": "Donation listing not found"}, status=status.HTTP_404_NOT_FOUND)

        if donation.status != DonationStatus.DRAFT:
            return Response({"error": f"Cannot publish listing in {donation.status} status"}, status=status.HTTP_400_BAD_REQUEST)

        # Confirm safety declaration checkbox
        declaration = request.data.get("donor_declaration", False)
        if not declaration:
            return Response({"error": "You must tick the food safety declaration before publishing."}, status=status.HTTP_400_BAD_REQUEST)

        donation.status = DonationStatus.AVAILABLE
        donation.donor_declared_at = timezone.now()
        donation.save()

        return Response({
            "message": "Donation published successfully and is now AVAILABLE to NGOs.",
            "donation": FoodDonationSerializer(donation).data
        })


class WithdrawDonationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVerified]

    def post(self, request, pk):
        try:
            donation = FoodDonation.objects.get(pk=pk)
        except FoodDonation.DoesNotExist:
            return Response({"error": "Donation listing not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        reason = request.data.get("reason", "Withdrawn by donor/admin")

        # Donor can withdraw only if R=0; Admin can withdraw anytime
        if user.role == 'DONOR':
            if donation.donor != user.donor_profile:
                return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
            if donation.reserved_quantity > 0:
                return Response({"error": "Cannot withdraw listing with reserved food. Cancel requests first."}, status=status.HTTP_400_BAD_REQUEST)
        elif user.role != 'ADMIN' and not user.is_superuser:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        donation.status = DonationStatus.WITHDRAWN
        donation.save()

        return Response({
            "message": f"Listing withdrawn. Reason: {reason}",
            "donation": FoodDonationSerializer(donation).data
        })