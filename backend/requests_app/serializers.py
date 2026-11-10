from rest_framework import serializers
from .models import DonationRequest, RequestStatus
from donations.models import FoodDonation, DonationStatus


class DonationRequestSerializer(serializers.ModelSerializer):
    ngo_name = serializers.ReadOnlyField(source='ngo.organisation_name')
    food_name = serializers.ReadOnlyField(source='donation.food_name')
    donation_unit = serializers.ReadOnlyField(source='donation.unit')

    class Meta:
        model = DonationRequest
        fields = [
            'id', 'donation', 'food_name', 'donation_unit', 'ngo', 'ngo_name',
            'distribution_point', 'requested_quantity', 'min_acceptable_quantity',
            'accepted_quantity', 'expected_beneficiaries', 'ngo_safety_ack_at',
            'message', 'status', 'decision_reason', 'cancel_reason', 'requested_at',
            'decision_at', 'version'
        ]
        read_only_fields = ['ngo', 'accepted_quantity', 'status', 'decision_reason', 'cancel_reason', 'decision_at', 'version']

    def validate(self, attrs):
        donation = attrs.get('donation')
        requested_qty = attrs.get('requested_quantity')
        min_qty = attrs.get('min_acceptable_quantity')

        # Rule AL-1: Request quantity must be positive and <= available quantity
        if requested_qty <= 0:
            raise serializers.ValidationError({"requested_quantity": "Requested quantity must be greater than 0."})

        if donation.available_quantity < requested_qty:
            raise serializers.ValidationError({"requested_quantity": f"Requested quantity exceeds available quantity ({donation.available_quantity} {donation.unit})."})

        if min_qty and min_qty > requested_qty:
            raise serializers.ValidationError({"min_acceptable_quantity": "Minimum acceptable quantity cannot be greater than requested quantity."})

        # Rule BR-05: Check if NGO already has an active request on this donation
        request_user = self.context['request'].user
        if hasattr(request_user, 'ngo_profile'):
            existing_request = DonationRequest.objects.filter(
                donation=donation,
                ngo=request_user.ngo_profile,
                status__in=[RequestStatus.PENDING, RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED]
            ).exists()
            if existing_request:
                raise serializers.ValidationError("Your NGO already has an active request for this donation.")

        return attrs