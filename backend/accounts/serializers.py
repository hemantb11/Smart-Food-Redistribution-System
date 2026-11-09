from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "phone", "role", "password", "password2"]

    def validate_role(self, value):
        # Admin accounts are created only by an administrator (SRS FR-01)
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
        user = User(**validated_data)  # account_status defaults to PENDING
        user.set_password(password)  # hashes the password
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "phone", "role", "account_status", "created_at"]
        read_only_fields = fields