from django.urls import path
from .views import DistributionRecordListCreateView

urlpatterns = [
    path('', DistributionRecordListCreateView.as_view(), name='distribution_records'),
]