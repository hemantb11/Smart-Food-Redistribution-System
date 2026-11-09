from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import *


class DonorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonorProfile
        fields = ["id", "organisation_name", "address", "location", "verification_status", "created_at"]
        read_only_fields = ["verification_status", "created_at"]


class NGOProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = NGOProfile
        fields = ["id", "organisation_name", "service_area", "address", "verification_status", "late_cancel_count", "created_at"]
        read_only_fields = ["verification_status", "late_cancel_count", "created_at"]


class VolunteerProfileSerializer(serializers.ModelSerializer):
    ngo_name = serializers.ReadOnlyField(source="ngo.organisation_name")

    class Meta:
        model = VolunteerProfile
        fields = ["id", "ngo", "ngo_name", "availability_status", "service_area", "ngo_approved", "created_at"]
        read_only_fields = ["ngo_approved", "created_at"]


class DistributionPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = DistributionPoint
        fields = ["id", "ngo", "name", "type", "address", "usual_headcount", "dietary_notes", "is_active", "created_at"]
        read_only_fields = ["ngo", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    donor_profile = DonorProfileSerializer(read_only=True)
    ngo_profile = NGOProfileSerializer(read_only=True)
    volunteer_profile = VolunteerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "role",
            "account_status",
            "created_at",
            "donor_profile",
            "ngo_profile",
            "volunteer_profile",
        ]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "phone", "role", "password", "password2"]

    def validate_role(self, value):
        if value not in (User.Role.DONOR, User.Role.NGO, User.Role.VOLUNTEER):
            raise serializers.ValidationError(
                "Role must be DONOR, NGO or VOLUNTEER."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Role nusar default profiles automated creation
        if user.role == User.Role.DONOR:
            DonorProfile.objects.create(user=user, organisation_name=user.username, address="")
        elif user.role == User.Role.NGO:
            NGOProfile.objects.create(user=user, organisation_name=user.username, service_area="", address="")
        elif user.role == User.Role.VOLUNTEER:
            VolunteerProfile.objects.create(user=user, service_area="")

        return user