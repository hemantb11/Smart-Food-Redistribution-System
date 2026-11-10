from django.db import models
from django.conf import settings
from donations.models import FoodDonation
from accounts.models import NGOProfile, DistributionPoint


class RequestStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED', 'Partially Accepted'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'


class DonationRequest(models.Model):
    donation = models.ForeignKey(
        FoodDonation, 
        on_delete=models.CASCADE, 
        related_name='requests'
    )
    ngo = models.ForeignKey(
        NGOProfile, 
        on_delete=models.CASCADE, 
        related_name='requests'
    )
    distribution_point = models.ForeignKey(
        DistributionPoint, 
        on_delete=models.PROTECT, 
        related_name='requests'
    )
    
    # Quantity requested & accepted
    requested_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    min_acceptable_quantity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    accepted_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    expected_beneficiaries = models.PositiveIntegerField()
    ngo_safety_ack_at = models.DateTimeField(auto_now_add=True)
    message = models.TextField(blank=True, null=True)
    
    # Status & Audit
    status = models.CharField(
        max_length=20, 
        choices=RequestStatus.choices, 
        default=RequestStatus.PENDING
    )
    decision_reason = models.CharField(max_length=255, blank=True, null=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='cancelled_requests'
    )
    cancel_reason = models.CharField(max_length=255, blank=True, null=True)
    
    requested_at = models.DateTimeField(auto_now_add=True)
    decision_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['-requested_at']

    def __str__(self):
        return f"Request by {self.ngo.organisation_name} for {self.donation.food_name} ({self.status})"