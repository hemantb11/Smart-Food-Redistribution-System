from rest_framework.permissions import BasePermission

from accounts.models import User


class IsVerified(BasePermission):
    """Only users whose account_status is VERIFIED (admin approved)."""

    message = "Your account is not verified by the admin yet."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.account_status == User.AccountStatus.VERIFIED
        )


class IsDonor(BasePermission):
    message = "Only donors can do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.DONOR)


class IsNGO(BasePermission):
    message = "Only NGOs can do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.NGO)


class IsVolunteer(BasePermission):
    message = "Only volunteers can do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.VOLUNTEER)


class IsAdminRole(BasePermission):
    message = "Only administrators can do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user 
            and user.is_authenticated 
            and (user.role == User.Role.ADMIN or user.is_superuser)
        )