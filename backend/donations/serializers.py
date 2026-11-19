from decimal import Decimal
from rest_framework import serializers
from django.utils import timezone
from .models import FoodCategory, FoodDonation, FoodState


class FoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodCategory
        fields = ['id', 'category_name', 'description', 'max_age_hours_policy']


class FoodDonationSerializer(serializers.ModelSerializer):
    available_quantity = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    category_name = serializers.ReadOnlyField(source='category.category_name')
    donor_name = serializers.ReadOnlyField(source='donor.organisation_name')
    pending_requests_count = serializers.SerializerMethodField()
    donor_declaration = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = FoodDonation
        fields = [
            'id', 'donor', 'donor_name', 'category', 'category_name', 'food_name',
            'unit', 'total_quantity', 'reserved_quantity', 'available_quantity',
            'distributed_quantity', 'food_type', 'food_state', 'prepared_at',
            'consume_by', 'best_before', 'pickup_deadline', 'earliest_pickup',
            'storage_condition', 'packaging', 'allergens', 'ingredients_notes',
            'temperature_c', 'location', 'image', 'donor_declared_at',
            'donor_declaration', 'status', 'version', 'pending_requests_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'donor', 'reserved_quantity', 'distributed_quantity',
            'status', 'version', 'donor_declared_at'
        ]

    def get_pending_requests_count(self, obj):
        return obj.requests.filter(status='PENDING').count()

    def validate_allergens(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError(
                "Allergen declaration cannot be blank. Mention allergens or 'None declared'/'Unknown'."
            )
        return value.strip()

    def validate(self, attrs):
        now = timezone.now()
        instance = self.instance

        food_state = attrs.get('food_state', getattr(instance, 'food_state', None))
        category = attrs.get('category', getattr(instance, 'category', None))
        prepared_at = attrs.get('prepared_at', getattr(instance, 'prepared_at', None))
        consume_by = attrs.get('consume_by', getattr(instance, 'consume_by', None))
        best_before = attrs.get('best_before', getattr(instance, 'best_before', None))
        pickup_deadline = attrs.get('pickup_deadline', getattr(instance, 'pickup_deadline', None))
        earliest_pickup = attrs.get('earliest_pickup', getattr(instance, 'earliest_pickup', None))
        total_quantity = attrs.get('total_quantity', getattr(instance, 'total_quantity', None))

        # AL-6: Edit restrictions on existing listing
        if instance is not None:
            if 'unit' in attrs and attrs['unit'] != instance.unit and instance.requests.exists():
                raise serializers.ValidationError({"unit": "Unit cannot be changed after the first request is submitted."})

            if total_quantity is not None and Decimal(str(total_quantity)) < Decimal(str(instance.reserved_quantity)):
                raise serializers.ValidationError({
                    "total_quantity": f"Total quantity cannot be reduced below reserved quantity ({instance.reserved_quantity})."
                })

            # Lock material fields once any request is Accepted / Partially Accepted
            if Decimal(str(instance.reserved_quantity)) > Decimal('0.00'):
                locked_fields = [
                    'category', 'food_name', 'food_type', 'food_state', 'allergens',
                    'consume_by', 'best_before', 'pickup_deadline', 'storage_condition',
                    'packaging', 'location'
                ]
                for field in locked_fields:
                    if field in attrs and attrs[field] != getattr(instance, field):
                        raise serializers.ValidationError({
                            field: "Material fields are locked once a request has been accepted."
                        })

        if total_quantity is not None and Decimal(str(total_quantity)) <= Decimal('0.00'):
            raise serializers.ValidationError({"total_quantity": "Total quantity must be greater than 0."})

        # Section 6.3 Safety Validation Rules
        if prepared_at and prepared_at > now:
            raise serializers.ValidationError({"prepared_at": "Preparation time cannot be in the future."})

        if food_state in (FoodState.COOKED_MEAL, FoodState.BAKERY):
            if not consume_by:
                raise serializers.ValidationError({"consume_by": "Consume-by time is required for cooked meals and bakery items."})
            if consume_by <= now:
                raise serializers.ValidationError({"consume_by": "Consume-by time must be in the future."})
            if prepared_at and category and category.max_age_hours_policy:
                age_hours = (now - prepared_at).total_seconds() / 3600.0
                if age_hours > category.max_age_hours_policy:
                    raise serializers.ValidationError({
                        "prepared_at": f"Food exceeds max allowed age of {category.max_age_hours_policy} hours for {category.category_name}."
                    })

        if food_state == FoodState.PACKAGED:
            if not best_before:
                raise serializers.ValidationError({"best_before": "Best-before / expiry date is required for packaged food."})
            if best_before < now.date():
                raise serializers.ValidationError({"best_before": "Expired packaged food cannot be listed."})

        if pickup_deadline:
            if instance is None and pickup_deadline <= now:
                raise serializers.ValidationError({"pickup_deadline": "Pickup deadline must be in the future."})
            if consume_by and pickup_deadline > consume_by:
                raise serializers.ValidationError({"pickup_deadline": "Pickup deadline cannot be later than consume-by time."})
            if earliest_pickup and earliest_pickup >= pickup_deadline:
                raise serializers.ValidationError({"earliest_pickup": "Earliest pickup time must be before pickup deadline."})

        return attrs

    def create(self, validated_data):
        declaration = validated_data.pop('donor_declaration', False)
        if declaration:
            validated_data['donor_declared_at'] = timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        declaration = validated_data.pop('donor_declaration', False)
        if declaration and not instance.donor_declared_at:
            validated_data['donor_declared_at'] = timezone.now()
        return super().update(instance, validated_data)