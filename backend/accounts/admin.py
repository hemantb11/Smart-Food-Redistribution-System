from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import *


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "account_status", "is_active")
    list_filter = ("role", "account_status")
    fieldsets = UserAdmin.fieldsets + (
        ("Project fields", {"fields": ("phone", "role", "account_status")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Project fields", {"fields": ("email", "phone", "role", "account_status")}),
    )


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):
    list_display = ("organisation_name", "user", "verification_status", "created_at")
    list_filter = ("verification_status",)
    search_fields = ("organisation_name", "user__username")


@admin.register(NGOProfile)
class NGOProfileAdmin(admin.ModelAdmin):
    list_display = ("organisation_name", "user", "verification_status", "late_cancel_count", "created_at")
    list_filter = ("verification_status",)
    search_fields = ("organisation_name", "user__username")


@admin.register(VolunteerProfile)
class VolunteerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "ngo", "availability_status", "ngo_approved", "created_at")
    list_filter = ("availability_status", "ngo_approved")
    search_fields = ("user__username", "ngo__organisation_name")


@admin.register(DistributionPoint)
class DistributionPointAdmin(admin.ModelAdmin):
    list_display = ("name", "ngo", "type", "usual_headcount", "is_active")
    list_filter = ("is_active", "type")
    search_fields = ("name", "ngo__organisation_name")