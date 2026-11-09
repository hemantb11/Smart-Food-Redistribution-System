from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        DONOR = "DONOR", "Donor"
        NGO = "NGO", "NGO"
        VOLUNTEER = "VOLUNTEER", "Volunteer"
        ADMIN = "ADMIN", "Admin"

    class AccountStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    account_status = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class DonorProfile(models.Model):
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='donor_profile'
    )
    organisation_name = models.CharField(max_length=255)
    address = models.TextField()
    location = models.CharField(max_length=255, blank=True, null=True)
    verification_status = models.CharField(
        max_length=20, 
        choices=User.AccountStatus.choices, 
        default=User.AccountStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.organisation_name} (Donor)"


class NGOProfile(models.Model):
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='ngo_profile'
    )
    organisation_name = models.CharField(max_length=255)
    service_area = models.CharField(max_length=255)
    address = models.TextField()
    verification_status = models.CharField(
        max_length=20, 
        choices=User.AccountStatus.choices, 
        default=User.AccountStatus.PENDING
    )
    late_cancel_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.organisation_name} (NGO)"


class AvailabilityStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available'
    BUSY = 'BUSY', 'Busy'
    OFFLINE = 'OFFLINE', 'Offline'


class VolunteerProfile(models.Model):
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='volunteer_profile'
    )
    ngo = models.ForeignKey(
        NGOProfile, 
        on_delete=models.CASCADE, 
        related_name='volunteers', 
        null=True, 
        blank=True
    )
    availability_status = models.CharField(
        max_length=20, 
        choices=AvailabilityStatus.choices, 
        default=AvailabilityStatus.AVAILABLE
    )
    service_area = models.CharField(max_length=255)
    ngo_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} (Volunteer)"


class DistributionPoint(models.Model):
    ngo = models.ForeignKey(
        NGOProfile, 
        on_delete=models.CASCADE, 
        related_name='distribution_points'
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=100)
    address = models.TextField()
    usual_headcount = models.PositiveIntegerField(default=0)
    dietary_notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.ngo.organisation_name}"