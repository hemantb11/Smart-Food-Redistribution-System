from rest_framework import serializers
from .models import SafetyReport


class SafetyReportSerializer(serializers.ModelSerializer):
    food_name = serializers.ReadOnlyField(source='donation.food_name')
    donor_name = serializers.ReadOnlyField(source='donation.donor.organisation_name')
    donation_status = serializers.ReadOnlyField(source='donation.status')
    reported_by_name = serializers.ReadOnlyField(source='reported_by.username')
    resolved_by_name = serializers.ReadOnlyField(source='resolved_by.username')

    class Meta:
        model = SafetyReport
        fields = [
            'id', 'donation', 'food_name', 'donor_name', 'donation_status',
            'reported_by', 'reported_by_name', 'description', 'is_resolved',
            'resolved_by', 'resolved_by_name', 'resolution', 'resolved_at', 'created_at'
        ]
        read_only_fields = ['reported_by', 'is_resolved', 'resolved_by', 'resolution', 'resolved_at', 'created_at']