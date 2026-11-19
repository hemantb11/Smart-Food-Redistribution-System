from decimal import Decimal
from rest_framework import serializers
from .models import DonationRequest, RequestStatus


class DonationRequestSerializer(serializers.ModelSerializer):
    ngo_name = serializers.ReadOnlyField(source='ngo.organisation_name')
    food_name = serializers.ReadOnlyField(source='donation.food_name')
    donation_unit = serializers.ReadOnlyField(source='donation.unit')
    donation_status = serializers.ReadOnlyField(source='donation.status')
    donation_available_quantity = serializers.DecimalField(
        source='donation.available_quantity',
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    donation_allergens = serializers.ReadOnlyField(source='donation.allergens')
    donation_storage_condition = serializers.ReadOnlyField(source='donation.storage_condition')
    donation_pickup_deadline = serializers.ReadOnlyField(source='donation.pickup_deadline')
    donation_consume_by = serializers.ReadOnlyField(source='donation.consume_by')
    distribution_point_name = serializers.ReadOnlyField(source='distribution_point.name')
    distribution_point_address = serializers.ReadOnlyField(source='distribution_point.address')

    # Write-only safety acknowledgement flag (SRS Section 6.4 Checkpoint 2)
    safety_acknowledged = serializers.BooleanField(write_only=True, required=False, default=True)

    # Conditional contact details (SRS Section 10 FR-25)
    donor_contact = serializers.SerializerMethodField()
    ngo_contact = serializers.SerializerMethodField()
    receipt_checked_at = serializers.SerializerMethodField()

    class Meta:
        model = DonationRequest
        fields = [
            'id', 'donation', 'food_name', 'donation_unit', 'donation_status',
            'donation_available_quantity', 'donation_allergens',
            'donation_storage_condition', 'donation_pickup_deadline',
            'donation_consume_by', 'ngo', 'ngo_name', 'distribution_point',
            'distribution_point_name', 'distribution_point_address',
            'requested_quantity', 'min_acceptable_quantity', 'accepted_quantity',
            'expected_beneficiaries', 'ngo_safety_ack_at', 'safety_acknowledged',
            'message', 'status', 'decision_reason', 'cancel_reason',
            'donor_contact', 'ngo_contact', 'receipt_checked_at',
            'requested_at', 'decision_at', 'version'
        ]
        read_only_fields = [
            'ngo', 'accepted_quantity', 'status', 'decision_reason',
            'cancel_reason', 'ngo_safety_ack_at', 'decision_at', 'version'
        ]

    def get_donor_contact(self, obj):
        if obj.status in (RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED):
            donor = obj.donation.donor
            return {
                'organisation_name': donor.organisation_name,
                'phone': donor.user.phone,
                'address': donor.address,
                'location': obj.donation.location,
            }
        return None

    def get_ngo_contact(self, obj):
        ngo = obj.ngo
        return {
            'organisation_name': ngo.organisation_name,
            'phone': ngo.user.phone,
            'service_area': ngo.service_area,
        }

    def get_receipt_checked_at(self, obj):
        from allocations.services import HandoverCheck
        exists = HandoverCheck.objects.filter(
            assignment__request=obj,
            stage=HandoverCheck.CheckStage.RECEIPT,
        ).exists()
        return (obj.decision_at or obj.requested_at) if exists else None

    def validate(self, attrs):
        donation = attrs.get('donation')
        requested_qty = attrs.get('requested_quantity')
        min_qty = attrs.get('min_acceptable_quantity')
        safety_ack = attrs.get('safety_acknowledged', True)

        if not safety_ack:
            raise serializers.ValidationError({
                "safety_acknowledged": "You must acknowledge the food safety, allergen, and storage details before submitting a request."
            })

        if requested_qty is None or Decimal(str(requested_qty)) <= Decimal('0.00'):
            raise serializers.ValidationError({
                "requested_quantity": "Requested quantity must be greater than 0."
            })

        if donation and Decimal(str(donation.available_quantity)) < Decimal(str(requested_qty)):
            raise serializers.ValidationError({
                "requested_quantity": f"Requested quantity exceeds available quantity ({donation.available_quantity} {donation.unit})."
            })

        if min_qty is not None:
            if Decimal(str(min_qty)) <= Decimal('0.00'):
                raise serializers.ValidationError({
                    "min_acceptable_quantity": "Minimum acceptable quantity must be greater than 0."
                })
            if Decimal(str(min_qty)) > Decimal(str(requested_qty)):
                raise serializers.ValidationError({
                    "min_acceptable_quantity": "Minimum acceptable quantity cannot be greater than requested quantity."
                })

        request = self.context.get('request')
        if request and hasattr(request.user, 'ngo_profile'):
            dp = attrs.get('distribution_point')
            if dp and dp.ngo_id != request.user.ngo_profile.id:
                raise serializers.ValidationError({
                    "distribution_point": "Selected distribution point does not belong to your NGO."
                })

            existing_request = DonationRequest.objects.filter(
                donation=donation,
                ngo=request.user.ngo_profile,
                status__in=[
                    RequestStatus.PENDING,
                    RequestStatus.ACCEPTED,
                    RequestStatus.PARTIALLY_ACCEPTED,
                ],
            ).exists()
            if existing_request:
                raise serializers.ValidationError(
                    "Your NGO already has an open request for this donation."
                )

        return attrs