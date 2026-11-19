from django.db import models
from django.conf import settings
from requests_app.models import DonationRequest
from accounts.models import VolunteerProfile


class AssignmentStatus(models.TextChoices):
    ASSIGNED = 'ASSIGNED', 'Assigned'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    REJECTED = 'REJECTED', 'Rejected'
    PICKUP_IN_PROGRESS = 'PICKUP_IN_PROGRESS', 'Pickup In Progress'
    PICKED_UP = 'PICKED_UP', 'Picked Up'
    DELIVERED = 'DELIVERED', 'Delivered'
    FAILED = 'FAILED', 'Failed'


class VolunteerAssignment(models.Model):
    request = models.ForeignKey(
        DonationRequest,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    volunteer = models.ForeignKey(
        VolunteerProfile,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks'
    )

    status = models.CharField(
        max_length=25,
        choices=AssignmentStatus.choices,
        default=AssignmentStatus.ASSIGNED
    )
    verification_code = models.CharField(
        max_length=10,
        help_text="6-digit verification OTP/code for pickup confirmation",
        blank=True,
        null=True
    )
    actual_quantity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    shortfall_reason = models.CharField(max_length=255, blank=True, null=True)
    failure_reason = models.CharField(max_length=100, blank=True, null=True)

    # Active slot = 1 while active; set to None (NULL) when REJECTED/DELIVERED/FAILED (SRS Section 5.5 C-5)
    active_slot = models.PositiveSmallIntegerField(default=1, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    assigned_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['request', 'active_slot'],
                name='unique_active_assignment_per_request'
            )
        ]

    def __str__(self):
        return f"Assignment #{self.id} - {self.volunteer.user.username} ({self.status})"


class PickupTracking(models.Model):
    assignment = models.ForeignKey(
        VolunteerAssignment,
        on_delete=models.CASCADE,
        related_name='tracking_events'
    )
    event_type = models.CharField(max_length=50)
    notes = models.TextField(blank=True, null=True)
    photo = models.ImageField(upload_to='tracking/', null=True, blank=True)
    event_time = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['event_time']

    def __str__(self):
        return f"Tracking #{self.assignment.id}: {self.event_type}"


class HandoverCheck(models.Model):
    class CheckStage(models.TextChoices):
        PICKUP = 'PICKUP', 'Pickup Check'
        RECEIPT = 'RECEIPT', 'Receipt Check'

    assignment = models.ForeignKey(
        VolunteerAssignment,
        on_delete=models.CASCADE,
        related_name='handover_checks'
    )
    stage = models.CharField(max_length=20, choices=CheckStage.choices)
    checklist_result = models.JSONField(default=dict)
    passed = models.BooleanField(default=True)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    checked_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.stage} Check for Assignment #{self.assignment.id} ({'PASSED' if self.passed else 'FAILED'})"