from rest_framework import serializers
from .models import StatusHistory, AIRecommendationLog, SystemConfiguration


class StatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusHistory
        fields = [
            'id', 'entity_type', 'entity_id', 'old_status', 'new_status',
            'actor_label', 'reason_code', 'remarks', 'changed_at'
        ]


class SystemConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfiguration
        fields = [
            'id', 'volunteer_response_timeout_minutes',
            'late_cancellation_window_minutes', 'high_priority_hours_threshold',
            'medium_priority_hours_threshold', 'distribution_tolerance_qty', 'updated_at'
        ]


class AIRecommendationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRecommendationLog
        fields = '__all__'