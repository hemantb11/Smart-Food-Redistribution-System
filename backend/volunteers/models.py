from django.db import models
from django.conf import settings
from requests_app.models import DonationRequest
from accounts.models import VolunteerProfile


class AssignmentStatus(models.TextChoices):
    ASSIGNED = 'ASSIGNED', 'Assigned'
    EN_ROUTE = 'EN_ROUTE', 'En Route'
    PICKED_UP = 'PICKED_UP', 'Picked Up'
    DELIVERED = 'DELIVERED', 'Delivered'
    CANCELLED = 'CANCELLED', 'Cancelled'


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
        blank=True
    )
    
    status = models.CharField(
        max_length=20, 
        choices=AssignmentStatus.choices, 
        default=AssignmentStatus.ASSIGNED
    )
    verification_code = models.CharField(
        max_length=10, 
        help_text="Simple verification OTP/code for pickup confirm", 
        blank=True, 
        null=True
    )
    notes = models.TextField(blank=True, null=True)
    
    assigned_at = models.DateTimeField(auto_now_add=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Assignment #{self.id} - {self.volunteer.user.username} ({self.status})"