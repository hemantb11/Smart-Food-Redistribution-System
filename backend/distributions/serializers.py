from decimal import Decimal
from rest_framework import serializers
from .models import DistributionRecord


class DistributionRecordSerializer(serializers.ModelSerializer):
    ngo_name = serializers.ReadOnlyField(source='ngo.organisation_name')
    point_name = serializers.ReadOnlyField(source='distribution_point.name')
    food_name = serializers.ReadOnlyField(source='request.donation.food_name')
    donation_unit = serializers.ReadOnlyField(source='request.donation.unit')
    beneficiaries_served = serializers.ReadOnlyField()
    confirmed_by_name = serializers.ReadOnlyField(source='confirmed_by.username')

    class Meta:
        model = DistributionRecord
        fields = [
            'id', 'request', 'food_name', 'donation_unit', 'ngo', 'ngo_name',
            'distribution_point', 'point_name', 'actual_headcount_served',
            'beneficiaries_served', 'quantity_distributed', 'discarded_quantity',
            'discard_reason', 'photo', 'notes', 'feedback_note',
            'distributed_at', 'confirmed_at', 'confirmed_by', 'confirmed_by_name'
        ]
        read_only_fields = ['ngo', 'distributed_at', 'confirmed_at', 'confirmed_by']
        extra_kwargs = {
            'distribution_point': {'required': False},
            'discarded_quantity': {'required': False, 'default': Decimal('0.00')},
        }

    def validate(self, attrs):
        req = attrs.get('request')
        dist_qty = Decimal(str(attrs.get('quantity_distributed', '0.00')))
        disc_qty = Decimal(str(attrs.get('discarded_quantity', '0.00')))
        discard_reason = attrs.get('discard_reason')

        if req and req.status not in ['ACCEPTED', 'PARTIALLY_ACCEPTED']:
            raise serializers.ValidationError({
                "request": "Distribution record can only be created for ACCEPTED or PARTIALLY_ACCEPTED requests."
            })

        if dist_qty < Decimal('0.00') or disc_qty < Decimal('0.00'):
            raise serializers.ValidationError("Distributed and discarded quantities cannot be negative.")

        if dist_qty == Decimal('0.00') and disc_qty == Decimal('0.00'):
            raise serializers.ValidationError("Enter either distributed quantity or discarded quantity greater than 0.")

        if disc_qty > Decimal('0.00') and (not discard_reason or not str(discard_reason).strip()):
            raise serializers.ValidationError({
                "discard_reason": "A discard reason is required when discarded quantity is greater than 0."
            })

        return attrs