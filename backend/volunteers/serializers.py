import random
import string
from rest_framework import serializers
from .models import VolunteerAssignment, AssignmentStatus
from requests_app.models import DonationRequest, RequestStatus


class VolunteerAssignmentSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.ReadOnlyField(source='volunteer.user.username')
    ngo_name = serializers.ReadOnlyField(source='request.ngo.organisation_name')
    food_name = serializers.ReadOnlyField(source='request.donation.food_name')
    pickup_address = serializers.ReadOnlyField(source='request.donation.location')
    delivery_address = serializers.ReadOnlyField(source='request.distribution_point.address')

    class Meta:
        model = VolunteerAssignment
        fields = [
            'id', 'request', 'ngo_name', 'food_name', 'volunteer', 'volunteer_name',
            'assigned_by', 'status', 'verification_code', 'pickup_address',
            'delivery_address', 'notes', 'assigned_at', 'picked_up_at', 'delivered_at'
        ]
        read_only_fields = ['assigned_by', 'verification_code', 'assigned_at', 'picked_up_at', 'delivered_at']

    def validate_request(self, value):
        if value.status not in [RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED]:
            raise serializers.ValidationError("Can only assign volunteers to ACCEPTED or PARTIALLY_ACCEPTED requests.")
        return value

    def create(self, validated_data):
        # 6-digit random pickup code generate kar
        code = ''.join(random.choices(string.digits, k=6))
        validated_data['verification_code'] = code
        return super().create(validated_data)