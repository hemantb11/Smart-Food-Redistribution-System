from django.urls import path
from .views import (
    StatusHistoryListView,
    SystemConfigurationView,
    FilteredReportsView,
    ExportReportsCSVView,
    AIMatchingView,
    AIDescriptionGeneratorView,
    AIDonationPriorityView,
    AILogActionView,
    RunDeadlineSchedulerView,
)

urlpatterns = [
    path('status-history/', StatusHistoryListView.as_view(), name='status-history'),
    path('config/', SystemConfigurationView.as_view(), name='system-config'),
    path('reports/', FilteredReportsView.as_view(), name='filtered-reports'),
    path('reports/export-csv/', ExportReportsCSVView.as_view(), name='export-reports-csv'),
    path('ai/matching/', AIMatchingView.as_view(), name='ai-matching'),
    path('ai/description/', AIDescriptionGeneratorView.as_view(), name='ai-description'),
    path('ai/priority/', AIDonationPriorityView.as_view(), name='ai-priority'),
    path('ai/logs/<int:log_id>/action/', AILogActionView.as_view(), name='ai-log-action'),
    path('run-scheduler/', RunDeadlineSchedulerView.as_view(), name='run-scheduler'),
]