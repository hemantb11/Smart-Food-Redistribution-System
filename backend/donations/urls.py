from django.urls import path
from .views import (
    FoodCategoryListView,
    FoodDonationListCreateView,
    FoodDonationDetailView,
    PublishDonationView,
    WithdrawDonationView,
    CloseDonationRemainderView
)

urlpatterns = [
    path('categories/', FoodCategoryListView.as_view(), name='food_categories'),
    path('', FoodDonationListCreateView.as_view(), name='donations_list_create'),
    path('<int:pk>/', FoodDonationDetailView.as_view(), name='donation_detail'),
    path('<int:pk>/publish/', PublishDonationView.as_view(), name='publish_donation'),
    path('<int:pk>/withdraw/', WithdrawDonationView.as_view(), name='withdraw_donation'),
    path('<int:pk>/close-remainder/', CloseDonationRemainderView.as_view(), name='donation-close-remainder'),
]