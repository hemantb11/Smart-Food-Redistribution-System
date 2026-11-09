from rest_framework import serializers
from django.utils import timezone
from .models import FoodCategory, FoodDonation, DonationStatus


class FoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodCategory
        fields = ['id', 'category_name', 'description', 'max_age_hours_policy']


class FoodDonationSerializer(serializers.ModelSerializer):
    available_quantity = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    category_name = serializers.ReadOnlyField(source='category.category_name')
    donor_name = serializers.ReadOnlyField(source='donor.organisation_name')

    class Meta:
        model = FoodDonation
        fields = [
            'id', 'donor', 'donor_name', 'category', 'category_name', 'food_name', 
            'unit', 'total_quantity', 'reserved_quantity', 'available_quantity', 
            'distributed_quantity', 'food_type', 'food_state', 'prepared_at', 
            'consume_by', 'best_before', 'pickup_deadline', 'earliest_pickup', 
            'storage_condition', 'packaging', 'allergens', 'ingredients_notes', 
            'temperature_c', 'location', 'image', 'donor_declared_at', 'status', 
            'version', 'created_at', 'updated_at'
        ]
        read_only_fields = ['donor', 'reserved_quantity', 'distributed_quantity', 'status', 'version', 'donor_declared_at']

    def validate_allergens(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Allergen declaration cannot be blank. Mention allergens or 'None declared'/'Unknown'.")
        return value

    def validate(self, attrs):
        now = timezone.now()

        # Rule 1: Prepared time cannot be in the future
        prepared_at = attrs.get('prepared_at')
        if prepared_at and prepared_at > now:
            raise serializers.ValidationError({"prepared_at": "Preparation time cannot be in the future."})

        # Rule 2: Consume by time must be in the future
        consume_by = attrs.get('consume_by')
        if consume_by and consume_by <= now:
            raise serializers.ValidationError({"consume_by": "Consume-by time must be in the future."})

        # Rule 3: Pickup deadline must not be later than consume-by time
        pickup_deadline = attrs.get('pickup_deadline')
        if pickup_deadline and consume_by and pickup_deadline > consume_by:
            raise serializers.ValidationError({"pickup_deadline": "Pickup deadline cannot be later than consume-by time."})

        return attrs