from django.urls import path
from .views import (
    DonationRequestListCreateView,
    AcceptRequestView,
    CancelRequestView,
    RejectRequestView,
    ReceiptCheckRequestView,
)

urlpatterns = [
    path('', DonationRequestListCreateView.as_view(), name='requests_list_create'),
    path('<int:pk>/accept/', AcceptRequestView.as_view(), name='accept_request'),
    path('<int:pk>/cancel/', CancelRequestView.as_view(), name='cancel_request'),
    path('<int:pk>/reject/', RejectRequestView.as_view(), name='request-reject'),
    path('<int:pk>/receipt-check/', ReceiptCheckRequestView.as_view(), name='receipt_check'),
]