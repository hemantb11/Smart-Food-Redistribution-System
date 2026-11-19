from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import *

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("ngos/", VerifiedNGOListView.as_view(), name="verified_ngos"),
    path("profile/", ProfileUpdateView.as_view(), name="profile_update"),
    path("distribution-points/", DistributionPointListCreateView.as_view(), name="distribution_points"),
    path("distribution-points/<int:pk>/", DistributionPointDetailView.as_view(), name="distribution_point_detail"),
    path("ngo/volunteers/", NGOVolunteerListView.as_view(), name="ngo_volunteers"),
    path("ngo/volunteers/<int:volunteer_id>/approve/", NGOApproveVolunteerView.as_view(), name="ngo_approve_volunteer"),
    path("volunteer/availability/", VolunteerAvailabilityView.as_view(), name="volunteer_availability"),
    path("admin/users/", AdminUserListView.as_view(), name="admin_users"),
    path("admin/verify-user/<int:user_id>/", AdminVerifyUserView.as_view(), name="admin_verify_user"),
    path("contact/", ContactMessageCreateView.as_view(), name="contact-message"),
]