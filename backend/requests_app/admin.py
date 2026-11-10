from django.contrib import admin
from .models import DonationRequest


@admin.register(DonationRequest)
class DonationRequestAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'donation', 'ngo', 'requested_quantity', 
        'accepted_quantity', 'status', 'requested_at'
    )
    list_filter = ('status',)
    search_fields = ('ngo__organisation_name', 'donation__food_name')
    readonly_fields = ('accepted_quantity', 'version')