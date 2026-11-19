from django.urls import path
from .views import SafetyReportListCreateView, ResolveSafetyReportView

urlpatterns = [
    path('', SafetyReportListCreateView.as_view(), name='safety-report-list-create'),
    path('<int:pk>/resolve/', ResolveSafetyReportView.as_view(), name='safety-report-resolve'),
]