from django.db import models
from django.conf import settings
from donations.models import FoodDonation


class SafetyReport(models.Model):
    donation = models.ForeignKey(
        FoodDonation,
        on_delete=models.CASCADE,
        related_name='safety_reports'
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reported_safety_concerns'
    )
    description = models.TextField()
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_safety_reports'
    )
    resolution = models.TextField(blank=True, null=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"SafetyReport #{self.id} on {self.donation.food_name}"