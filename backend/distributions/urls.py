from django.urls import path
from .views import *

urlpatterns = [
    path('', DistributionRecordListCreateView.as_view(), name='distribution-list-create'),
    path('confirm/<int:request_id>/', ConfirmDistributionCompletionView.as_view(), name='distribution-confirm'),
]