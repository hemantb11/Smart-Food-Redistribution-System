from decimal import Decimal
from django.db import models
from django.conf import settings
from requests_app.models import DonationRequest
from accounts.models import DistributionPoint, NGOProfile


class DistributionRecord(models.Model):
    request = models.ForeignKey(
        DonationRequest,
        on_delete=models.CASCADE,
        related_name='distribution_records'
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
    discarded_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discard_reason = models.CharField(max_length=255, blank=True, null=True)

    photo = models.ImageField(upload_to='distributions/', null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    feedback_note = models.TextField(blank=True, null=True)

    distributed_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='confirmed_distributions'
    )

    @property
    def beneficiaries_served(self):
        return self.actual_headcount_served

    def __str__(self):
        return f"Distribution #{self.id} for Request #{self.request.id} ({self.actual_headcount_served} served)"