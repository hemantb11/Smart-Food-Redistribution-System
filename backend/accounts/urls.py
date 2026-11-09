from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import *

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/", ProfileUpdateView.as_view(), name="profile_update"),
    path("distribution-points/", DistributionPointListCreateView.as_view(), name="distribution_points"),
    path("admin/verify-user/<int:user_id>/", AdminVerifyUserView.as_view(), name="admin_verify_user"),
]