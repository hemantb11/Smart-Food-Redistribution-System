from django.shortcuts import render

# Create your views here.
from rest_framework import generics, permissions
from core.permissions import IsNGO, IsVerified
from .models import DistributionRecord
from .serializers import DistributionRecordSerializer


class DistributionRecordListCreateView(generics.ListCreateAPIView):
    serializer_class = DistributionRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'ngo_profile'):
            return DistributionRecord.objects.filter(ngo=user.ngo_profile)
        return DistributionRecord.objects.all()

    def perform_create(self, serializer):
        serializer.save(ngo=self.request.user.ngo_profile)