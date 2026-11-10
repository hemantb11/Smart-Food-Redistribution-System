from django.db import models
from requests_app.models import DonationRequest
from accounts.models import DistributionPoint, NGOProfile


class DistributionRecord(models.Model):
    request = models.OneToOneField(
        DonationRequest, 
        on_delete=models.CASCADE, 
        related_name='distribution_record'
    )
    ngo = models.ForeignKey(
        NGOProfile, 
        on_delete=models.CASCADE, 
        related_name='distribution_records'
    )
    distribution_point = models.ForeignKey(
        DistributionPoint, 
        on_delete=models.PROTECT, 
        related_name='distribution_records'
    )
    
    actual_headcount_served = models.PositiveIntegerField()
    quantity_distributed = models.DecimalField(max_digits=10, decimal_places=2)
    photo = models.ImageField(upload_to='distributions/', null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    completed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Distribution Record for Request #{self.request.id} ({self.actual_headcount_served} served)"