from rest_framework import serializers
from .models import DistributionRecord
from donations.models import DonationStatus


class DistributionRecordSerializer(serializers.ModelSerializer):
    ngo_name = serializers.ReadOnlyField(source='ngo.organisation_name')
    point_name = serializers.ReadOnlyField(source='distribution_point.name')

    class Meta:
        model = DistributionRecord
        fields = [
            'id', 'request', 'ngo', 'ngo_name', 'distribution_point', 'point_name',
            'actual_headcount_served', 'quantity_distributed', 'photo', 'notes', 'completed_at'
        ]
        read_only_fields = ['ngo', 'completed_at']

    def validate(self, attrs):
        req = attrs.get('request')
        distributed_qty = attrs.get('quantity_distributed')

        if req.status not in ['ACCEPTED', 'PARTIALLY_ACCEPTED']:
            raise serializers.ValidationError({"request": "Distribution record can only be created for ACCEPTED requests."})

        if distributed_qty <= 0:
            raise serializers.ValidationError({"quantity_distributed": "Distributed quantity must be greater than 0."})

        return attrs

    def create(self, validated_data):
        record = super().create(validated_data)
        
        # Sync donation distributed_quantity & update status if fully distributed
        donation = record.request.donation
        donation.distributed_quantity = float(donation.distributed_quantity) + float(record.quantity_distributed)
        
        if donation.distributed_quantity >= donation.total_quantity:
            donation.status = DonationStatus.COMPLETED
            
        donation.save()
        return record