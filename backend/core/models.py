from decimal import Decimal
from django.db import models
from django.conf import settings


class StatusHistory(models.Model):
    class EntityType(models.TextChoices):
        DONATION = 'DONATION', 'Food Donation'
        REQUEST = 'REQUEST', 'Donation Request'
        ASSIGNMENT = 'ASSIGNMENT', 'Volunteer Assignment'

    entity_type = models.CharField(max_length=20, choices=EntityType.choices)
    entity_id = models.PositiveIntegerField()
    old_status = models.CharField(max_length=30, blank=True, null=True)
    new_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_changes'
    )
    actor_label = models.CharField(max_length=50, default='SYSTEM')
    reason_code = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self):
        return f"{self.entity_type} #{self.entity_id}: {self.old_status} -> {self.new_status}"


class AIRecommendationLog(models.Model):
    class FeatureType(models.TextChoices):
        MATCHING = 'MATCHING', 'Smart Food Matching'
        DESCRIPTION = 'DESCRIPTION', 'Description Generator'
        PRIORITY = 'PRIORITY', 'Donation Priority Suggestion'

    feature_type = models.CharField(max_length=30, choices=FeatureType.choices)
    related_record_id = models.PositiveIntegerField(null=True, blank=True)
    input_summary = models.JSONField(default=dict)
    output_summary = models.JSONField(default=dict)
    user_action = models.CharField(max_length=50, default='VIEWED')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"AI {self.feature_type} ({self.user_action})"


class SystemConfiguration(models.Model):
    volunteer_response_timeout_minutes = models.PositiveIntegerField(default=30)
    late_cancellation_window_minutes = models.PositiveIntegerField(default=60)
    high_priority_hours_threshold = models.PositiveIntegerField(default=2)
    medium_priority_hours_threshold = models.PositiveIntegerField(default=6)
    distribution_tolerance_qty = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.50')
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"System Config (Timeout: {self.volunteer_response_timeout_minutes}m)"