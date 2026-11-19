from django.urls import path
from .views import *

urlpatterns = [
    path('assignments/', VolunteerAssignmentListCreateView.as_view(), name='volunteer_assignments'),
    path('assignments/<int:pk>/status/', UpdateAssignmentStatusView.as_view(), name='update_assignment_status'),
    path('assignments/<int:pk>/respond/', RespondAssignmentView.as_view(), name='assignment-respond'),
    path('assignments/<int:pk>/start-pickup/', StartPickupView.as_view(), name='assignment-start-pickup'),
    path('assignments/<int:pk>/pickup/', CompletePickupView.as_view(), name='assignment-pickup'),
    path('assignments/<int:pk>/deliver/', CompleteDeliveryView.as_view(), name='assignment-deliver'),
    path('assignments/<int:pk>/fail/', FailAssignmentView.as_view(), name='assignment-fail'),
]