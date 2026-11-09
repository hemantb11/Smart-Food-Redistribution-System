from django.db import models
from django.conf import settings
from accounts.models import DonorProfile


class FoodCategory(models.Model):
    category_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    max_age_hours_policy = models.PositiveIntegerField(
        help_text="Max hours allowed after preparation as per category safety rules",
        default=24
    )

    def __str__(self):
        return self.category_name


class FoodType(models.TextChoices):
    VEGETARIAN = 'VEGETARIAN', 'Vegetarian'
    NON_VEGETARIAN = 'NON_VEGETARIAN', 'Non-Vegetarian'
    EGG = 'EGG', 'Egg'
    VEGAN = 'VEGAN', 'Vegan'


class FoodState(models.TextChoices):
    COOKED_MEAL = 'COOKED_MEAL', 'Cooked Meal'
    PACKAGED = 'PACKAGED', 'Packaged'
    RAW_PRODUCE = 'RAW_PRODUCE', 'Raw Produce'
    BAKERY = 'BAKERY', 'Bakery'
    BEVERAGE = 'BEVERAGE', 'Beverage'


class StorageCondition(models.TextChoices):
    HOT_HELD = 'HOT_HELD', 'Hot-held'
    AMBIENT = 'AMBIENT', 'Ambient'
    REFRIGERATED = 'REFRIGERATED', 'Refrigerated'
    FROZEN = 'FROZEN', 'Frozen'


class PackagingType(models.TextChoices):
    SEALED_CONTAINER = 'SEALED_CONTAINER', 'Sealed Container'
    COVERED_TRAY = 'COVERED_TRAY', 'Covered Tray'
    FOIL_WRAP = 'FOIL_WRAP', 'Foil/Wrap'
    ORIGINAL_SEALED = 'ORIGINAL_SEALED', 'Original Sealed Pack'
    OPEN = 'OPEN', 'Open'


class DonationStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    AVAILABLE = 'AVAILABLE', 'Available'
    PARTIALLY_RESERVED = 'PARTIALLY_RESERVED', 'Partially Reserved'
    FULLY_RESERVED = 'FULLY_RESERVED', 'Fully Reserved'
    COMPLETED = 'COMPLETED', 'Completed'
    EXPIRED = 'EXPIRED', 'Expired'
    WITHDRAWN = 'WITHDRAWN', 'Withdrawn'


class FoodDonation(models.Model):
    donor = models.ForeignKey(
        DonorProfile, 
        on_delete=models.CASCADE, 
        related_name='donations'
    )
    category = models.ForeignKey(
        FoodCategory, 
        on_delete=models.PROTECT, 
        related_name='donations'
    )
    food_name = models.CharField(max_length=255)
    unit = models.CharField(max_length=50, help_text="e.g. kg, litres, portions, pieces")
    
    # Quantity Model (SRS Section 5.1)
    total_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    reserved_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    distributed_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Food Safety Fields (SRS Section 6.2)
    food_type = models.CharField(max_length=20, choices=FoodType.choices)
    food_state = models.CharField(max_length=20, choices=FoodState.choices)
    prepared_at = models.DateTimeField(null=True, blank=True)
    consume_by = models.DateTimeField()
    best_before = models.DateField(null=True, blank=True)
    pickup_deadline = models.DateTimeField()
    earliest_pickup = models.DateTimeField(null=True, blank=True)
    
    storage_condition = models.CharField(max_length=20, choices=StorageCondition.choices)
    packaging = models.CharField(max_length=250, choices=PackagingType.choices)
    allergens = models.CharField(
        max_length=255, 
        help_text="Comma-separated list or 'None declared'/'Unknown'"
    )
    ingredients_notes = models.TextField(blank=True, null=True)
    temperature_c = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    location = models.CharField(max_length=255)
    image = models.ImageField(upload_to='donations/', null=True, blank=True)
    donor_declared_at = models.DateTimeField(null=True, blank=True)

    # Status & Optimistic Concurrency Control (SRS Section 4.2 & Section 5.5)
    status = models.CharField(
        max_length=20, 
        choices=DonationStatus.choices, 
        default=DonationStatus.DRAFT
    )
    version = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def available_quantity(self):
        """Computed field: A = Total - Reserved"""
        return self.total_quantity - self.reserved_quantity

    def __str__(self):
        return f"{self.food_name} ({self.total_quantity} {self.unit}) - {self.status}"