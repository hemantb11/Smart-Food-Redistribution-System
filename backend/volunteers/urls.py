from django.urls import path
from .views import VolunteerAssignmentListCreateView, UpdateAssignmentStatusView

urlpatterns = [
    path('assignments/', VolunteerAssignmentListCreateView.as_view(), name='volunteer_assignments'),
    path('assignments/<int:pk>/status/', UpdateAssignmentStatusView.as_view(), name='update_assignment_status'),
]