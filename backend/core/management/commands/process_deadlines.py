from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from donations.models import FoodDonation, DonationStatus
from requests_app.models import DonationRequest, RequestStatus
from volunteers.models import VolunteerAssignment, AssignmentStatus, PickupTracking
from allocations.services import (
    get_system_config,
    _log_status_change,
    _notify,
    _recalculate_donation_status,
)
from core.models import StatusHistory


class Command(BaseCommand):
    help = "SRS Section 5.5 C-9 & FR-32: Process expired listings, unpicked requests & volunteer response timeouts."

    def handle(self, *args, **options):
        now = timezone.now()
        cfg = get_system_config()

        # 1. Volunteer response timeouts (SRS Section 7.2 Step 3)
        timeout_cutoff = now - timedelta(minutes=cfg.volunteer_response_timeout_minutes)
        timed_out_assignments = VolunteerAssignment.objects.filter(
            status=AssignmentStatus.ASSIGNED,
            assigned_at__lte=timeout_cutoff,
        ).values_list('id', flat=True)

        for ass_id in timed_out_assignments:
            with transaction.atomic():
                ass = VolunteerAssignment.objects.select_for_update().select_related(
                    'request__donation', 'request__ngo__user', 'volunteer__user'
                ).filter(pk=ass_id, status=AssignmentStatus.ASSIGNED).first()
                if not ass:
                    continue
                ass.status = AssignmentStatus.REJECTED
                ass.failure_reason = 'NO_RESPONSE_TIMEOUT'
                ass.active_slot = None
                ass.responded_at = now
                ass.save()

                PickupTracking.objects.create(
                    assignment=ass,
                    event_type='REJECTED',
                    notes='Auto-rejected due to volunteer response timeout.',
                )
                _log_status_change(
                    StatusHistory.EntityType.ASSIGNMENT,
                    ass.id,
                    AssignmentStatus.ASSIGNED,
                    AssignmentStatus.REJECTED,
                    actor=None,
                    reason_code='NO_RESPONSE_TIMEOUT',
                )
                _notify(
                    ass.request.ngo.user,
                    "Volunteer Response Timeout",
                    f"{ass.volunteer.user.username} did not respond in time for '{ass.request.donation.food_name}'. Please reassign.",
                    event_type='ASSIGNMENT_TIMEOUT',
                    entity_type='ASSIGNMENT',
                    entity_id=ass.id,
                )

        # 2. Expired pickup deadlines (SRS Section 4.6 & 10 FR-32)
        past_deadline_donations = FoodDonation.objects.filter(
            status__in=[
                DonationStatus.AVAILABLE,
                DonationStatus.PARTIALLY_RESERVED,
                DonationStatus.FULLY_RESERVED,
            ],
            pickup_deadline__lte=now,
        ).values_list('id', flat=True)

        for don_id in past_deadline_donations:
            with transaction.atomic():
                don = FoodDonation.objects.select_for_update().filter(pk=don_id).first()
                if not don:
                    continue

                for req in DonationRequest.objects.select_for_update().filter(
                    donation=don, status=RequestStatus.PENDING
                ):
                    req.status = RequestStatus.REJECTED
                    req.decision_reason = 'LISTING_EXPIRED'
                    req.decision_at = now
                    req.version += 1
                    req.save()
                    _log_status_change(
                        StatusHistory.EntityType.REQUEST,
                        req.id,
                        RequestStatus.PENDING,
                        RequestStatus.REJECTED,
                        actor=None,
                        reason_code='LISTING_EXPIRED',
                    )
                    _notify(
                        req.ngo.user,
                        "Request Expired",
                        f"Pickup deadline passed for '{don.food_name}'.",
                        event_type='REQUEST_EXPIRED',
                        entity_type='REQUEST',
                        entity_id=req.id,
                    )

                for req in DonationRequest.objects.select_for_update().filter(
                    donation=don,
                    status__in=[RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED],
                ):
                    has_picked_up = req.assignments.filter(
                        status__in=[AssignmentStatus.PICKED_UP, AssignmentStatus.DELIVERED]
                    ).exists()
                    if not has_picked_up:
                        old_req_st = req.status
                        req.status = RequestStatus.CANCELLED
                        req.cancel_reason = 'DEADLINE_PASSED'
                        req.version += 1
                        req.save()
                        _log_status_change(
                            StatusHistory.EntityType.REQUEST,
                            req.id,
                            old_req_st,
                            RequestStatus.CANCELLED,
                            actor=None,
                            reason_code='DEADLINE_PASSED',
                        )

                        active_ass = VolunteerAssignment.objects.select_for_update().filter(
                            request=req, active_slot=1
                        ).first()
                        if active_ass:
                            old_ass_st = active_ass.status
                            active_ass.status = AssignmentStatus.FAILED
                            active_ass.failure_reason = 'DEADLINE_MISSED'
                            active_ass.active_slot = None
                            active_ass.save()
                            _log_status_change(
                                StatusHistory.EntityType.ASSIGNMENT,
                                active_ass.id,
                                old_ass_st,
                                AssignmentStatus.FAILED,
                                actor=None,
                                reason_code='DEADLINE_MISSED',
                            )
                            _notify(
                                active_ass.volunteer.user,
                                "Pickup Deadline Missed",
                                f"Assignment for '{don.food_name}' closed because pickup deadline passed.",
                                event_type='DEADLINE_MISSED',
                                entity_type='ASSIGNMENT',
                                entity_id=active_ass.id,
                            )

                        don.reserved_quantity = max(
                            Decimal('0.00'),
                            Decimal(str(don.reserved_quantity)) - Decimal(str(req.accepted_quantity)),
                        )
                        don.save(update_fields=['reserved_quantity'])

                _recalculate_donation_status(
                    don,
                    actor=None,
                    reason_code='DEADLINE_PASSED',
                    remarks='Scheduled deadline processing job.',
                )

        self.stdout.write(self.style.SUCCESS("Processed deadlines and volunteer timeouts."))