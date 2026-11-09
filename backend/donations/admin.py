from django.contrib import admin
from .models import FoodCategory, FoodDonation


@admin.register(FoodCategory)
class FoodCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'category_name', 'max_age_hours_policy')
    search_fields = ('category_name',)


@admin.register(FoodDonation)
class FoodDonationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'food_name', 'donor', 'category', 'total_quantity', 
        'reserved_quantity', 'unit', 'status', 'pickup_deadline', 'created_at'
    )
    list_filter = ('status', 'food_type', 'food_state', 'storage_condition')
    search_fields = ('food_name', 'donor__organisation_name', 'location')
    readonly_fields = ('reserved_quantity', 'distributed_quantity', 'version')