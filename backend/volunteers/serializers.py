from rest_framework import serializers
from .models import (
    VolunteerAssignment,
    AssignmentStatus,
    PickupTracking,
    HandoverCheck,
)
from requests_app.models import RequestStatus


class PickupTrackingSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.ReadOnlyField(source='updated_by.username')

    class Meta:
        model = PickupTracking
        fields = ['id', 'event_type', 'notes', 'photo', 'event_time', 'updated_by_name']


class HandoverCheckSerializer(serializers.ModelSerializer):
    checked_by_name = serializers.ReadOnlyField(source='checked_by.username')

    class Meta:
        model = HandoverCheck
        fields = [
            'id', 'stage', 'checklist_result', 'passed',
            'checked_by_name', 'checked_at', 'notes'
        ]


class VolunteerAssignmentSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.ReadOnlyField(source='volunteer.user.username')
    volunteer_phone = serializers.ReadOnlyField(source='volunteer.user.phone')
    ngo_name = serializers.ReadOnlyField(source='request.ngo.organisation_name')
    ngo_phone = serializers.ReadOnlyField(source='request.ngo.user.phone')
    food_name = serializers.ReadOnlyField(source='request.donation.food_name')
    donation_unit = serializers.ReadOnlyField(source='request.donation.unit')
    accepted_quantity = serializers.DecimalField(
        source='request.accepted_quantity',
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    storage_condition = serializers.ReadOnlyField(source='request.donation.storage_condition')
    packaging = serializers.ReadOnlyField(source='request.donation.packaging')
    allergens = serializers.ReadOnlyField(source='request.donation.allergens')
    pickup_deadline = serializers.ReadOnlyField(source='request.donation.pickup_deadline')
    consume_by = serializers.ReadOnlyField(source='request.donation.consume_by')

    pickup_address = serializers.SerializerMethodField()
    donor_contact = serializers.SerializerMethodField()
    delivery_address = serializers.ReadOnlyField(source='request.distribution_point.address')
    distribution_point_name = serializers.ReadOnlyField(source='request.distribution_point.name')

    tracking_events = PickupTrackingSerializer(many=True, read_only=True)
    handover_checks = HandoverCheckSerializer(many=True, read_only=True)

    class Meta:
        model = VolunteerAssignment
        fields = [
            'id', 'request', 'ngo_name', 'ngo_phone', 'food_name', 'donation_unit',
            'accepted_quantity', 'storage_condition', 'packaging', 'allergens',
            'pickup_deadline', 'consume_by', 'volunteer', 'volunteer_name',
            'volunteer_phone', 'assigned_by', 'status', 'verification_code',
            'actual_quantity', 'shortfall_reason', 'failure_reason', 'active_slot',
            'pickup_address', 'donor_contact', 'delivery_address',
            'distribution_point_name', 'notes', 'assigned_at', 'responded_at',
            'picked_up_at', 'delivered_at', 'tracking_events', 'handover_checks'
        ]
        read_only_fields = [
            'assigned_by', 'status', 'verification_code', 'actual_quantity',
            'shortfall_reason', 'failure_reason', 'active_slot', 'assigned_at',
            'responded_at', 'picked_up_at', 'delivered_at'
        ]

    def _can_view_donor_details(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return True
        if request.user.role in ('DONOR', 'NGO', 'ADMIN') or request.user.is_superuser:
            return True
        # SRS Section 7.1: Donor address & contact revealed to volunteer only after accepting
        return obj.status in (
            AssignmentStatus.ACCEPTED,
            AssignmentStatus.PICKUP_IN_PROGRESS,
            AssignmentStatus.PICKED_UP,
            AssignmentStatus.DELIVERED,
        )

    def get_pickup_address(self, obj):
        if self._can_view_donor_details(obj):
            return obj.request.donation.location
        return "Accept assignment to reveal exact pickup address"

    def get_donor_contact(self, obj):
        if self._can_view_donor_details(obj):
            donor = obj.request.donation.donor
            return {
                'organisation_name': donor.organisation_name,
                'phone': donor.user.phone,
                'address': donor.address,
            }
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        # Hide 6-digit OTP from Volunteer so they verify it physically from Donor at pickup
        if request and getattr(request.user, 'role', None) == 'VOLUNTEER':
            data.pop('verification_code', None)
        return data

    def validate_request(self, value):
        if value.status not in [RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED]:
            raise serializers.ValidationError(
                "Can only assign volunteers to ACCEPTED or PARTIALLY_ACCEPTED requests."
            )
        return value