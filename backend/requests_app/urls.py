from django.urls import path
from .views import *

urlpatterns = [
    path('', DonationRequestListCreateView.as_view(), name='requests_list_create'),
    path('<int:pk>/accept/', AcceptRequestView.as_view(), name='accept_request'),
    path('<int:pk>/cancel/', CancelRequestView.as_view(), name='cancel_request'),
]