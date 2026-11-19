from accounts.models import VolunteerProfile
from decimal import Decimal
from functools import wraps
import random
import time

from django.db import transaction, OperationalError
from django.db.models import Sum
from django.utils import timezone

from accounts.models import User, AvailabilityStatus
from donations.models import FoodDonation, FoodState, DonationStatus
from requests_app.models import DonationRequest, RequestStatus
from volunteers.models import (
    VolunteerAssignment,
    AssignmentStatus,
    PickupTracking,
    HandoverCheck,
)
from distributions.models import DistributionRecord
from safety.models import SafetyReport
from notifications.models import Notification
from core.models import StatusHistory, SystemConfiguration


# ==============================================================================
# CUSTOM EXCEPTIONS (Mapped to HTTP 400 / 403 / 409 in API Views)
# ==============================================================================

class ServiceValidationError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


class ServicePermissionError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


class ServiceConflictError(Exception):
    def __init__(self, message, latest_state=None):
        self.message = message
        self.latest_state = latest_state or {}
        super().__init__(message)


# ==============================================================================
# INTERNAL HELPERS (Deadlock Retry, Config, Audit Trail, On-Commit Notify)
# ==============================================================================

def retry_on_deadlock(max_retries=3, delay=0.05):
    """SRS Section 5.5 C-8: Retry bounded times when MySQL reports a deadlock."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            while True:
                try:
                    return func(*args, **kwargs)
                except OperationalError as exc:
                    attempts += 1
                    err_msg = str(exc).lower()
                    if attempts > max_retries or ('deadlock' not in err_msg and '1213' not in err_msg):
                        raise
                    time.sleep(delay * attempts)
        return wrapper
    return decorator


def get_system_config():
    cfg = SystemConfiguration.objects.first()
    if not cfg:
        cfg = SystemConfiguration.objects.create()
    return cfg


def _log_status_change(entity_type, entity_id, old_status, new_status, actor=None, reason_code=None, remarks=None):
    """SRS Section 4.7: Immutable StatusHistory audit log."""
    if old_status == new_status:
        return
    actor_label = actor.username if actor else 'SYSTEM'
    StatusHistory.objects.create(
        entity_type=entity_type,
        entity_id=entity_id,
        old_status=old_status,
        new_status=new_status,
        changed_by=actor if isinstance(actor, User) else None,
        actor_label=actor_label,
        reason_code=reason_code,
        remarks=remarks,
    )


def _notify(recipient, title, message, event_type=None, entity_type=None, entity_id=None):
    """SRS Section 5.5 C-6: Queue in-app notification after transaction commits."""
    if not recipient:
        return
    transaction.on_commit(
        lambda: Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            event_type=event_type,
            related_entity_type=entity_type,
            related_entity_id=entity_id,
        )
    )


def _donation_snapshot(donation):
    return {
        'id': donation.id,
        'status': donation.status,
        'total_quantity': str(donation.total_quantity),
        'reserved_quantity': str(donation.reserved_quantity),
        'available_quantity': str(donation.available_quantity),
        'distributed_quantity': str(donation.distributed_quantity),
        'version': donation.version,
    }


def _request_snapshot(req):
    return {
        'id': req.id,
        'status': req.status,
        'requested_quantity': str(req.requested_quantity),
        'accepted_quantity': str(req.accepted_quantity),
        'version': req.version,
    }


def _recalculate_donation_status(donation, actor=None, reason_code=None, remarks=None):
    """SRS Section 4.1 & 4.2: System-derived FoodDonation status from T, R, D & deadline."""
    if donation.status in (DonationStatus.DRAFT, DonationStatus.WITHDRAWN, DonationStatus.COMPLETED, DonationStatus.EXPIRED):
        return

    now = timezone.now()
    old_status = donation.status
    T = Decimal(str(donation.total_quantity))
    R = Decimal(str(donation.reserved_quantity))
    D = Decimal(str(donation.distributed_quantity))

    active_reqs = donation.requests.filter(
        status__in=[RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED]
    )
    in_progress_exists = False
    for r in active_reqs:
        has_active_ass = r.assignments.filter(active_slot=1).exists()
        confirmed_sum = (
            r.distribution_records.filter(confirmed_at__isnull=False)
            .aggregate(total=Sum('quantity_distributed'))['total']
            or Decimal('0.00')
        )
        if has_active_ass or confirmed_sum < Decimal(str(r.accepted_quantity)):
            in_progress_exists = True
            break

    if D > Decimal('0.00') and not in_progress_exists and (R == T or donation.pickup_deadline <= now):
        if donation.pickup_deadline <= now and R < T:
            donation.total_quantity = R
        new_status = DonationStatus.COMPLETED
    elif donation.pickup_deadline <= now and R == Decimal('0.00') and D == Decimal('0.00'):
        new_status = DonationStatus.EXPIRED
    elif R == Decimal('0.00'):
        new_status = DonationStatus.AVAILABLE
    elif R < T:
        if donation.pickup_deadline <= now:
            donation.total_quantity = R
            new_status = DonationStatus.FULLY_RESERVED
        else:
            new_status = DonationStatus.PARTIALLY_RESERVED
    else:
        new_status = DonationStatus.FULLY_RESERVED

    if new_status != old_status:
        donation.status = new_status
        donation.version += 1
        donation.save(update_fields=['total_quantity', 'status', 'version', 'updated_at'])
        _log_status_change(
            StatusHistory.EntityType.DONATION,
            donation.id,
            old_status,
            new_status,
            actor=actor,
            reason_code=reason_code,
            remarks=remarks,
        )


# ==============================================================================
# 1. DONATION LIFECYCLE SERVICES (Publish, Withdraw, Close Remainder)
# ==============================================================================

@retry_on_deadlock()
def publish_donation(donation_id, actor):
    """SRS Section 4.2 & 6.3: Draft -> Available after safety validation."""
    with transaction.atomic():
        donation = FoodDonation.objects.select_for_update().get(pk=donation_id)

        if actor.role != User.Role.ADMIN and donation.donor.user_id != actor.id:
            raise ServicePermissionError("You can only publish your own donations.")
        if donation.donor.verification_status != User.AccountStatus.VERIFIED:
            raise ServicePermissionError("Only verified donors may publish food listings.")
        if donation.status != DonationStatus.DRAFT:
            raise ServiceConflictError("Only DRAFT listings can be published.", _donation_snapshot(donation))

        now = timezone.now()
        if donation.pickup_deadline <= now:
            raise ServiceValidationError("Pickup deadline must be in the future.")
        if donation.prepared_at and donation.prepared_at > now:
            raise ServiceValidationError("Prepared-at time cannot be in the future.")
        if donation.food_state in (FoodState.COOKED_MEAL, FoodState.BAKERY):
            if not donation.consume_by or donation.consume_by <= now:
                raise ServiceValidationError("Consume-by time is required and must be in the future.")
            if donation.pickup_deadline > donation.consume_by:
                raise ServiceValidationError("Pickup deadline cannot be later than consume-by time.")
            if donation.prepared_at and donation.category.max_age_hours_policy:
                age_hours = (now - donation.prepared_at).total_seconds() / 3600.0
                if age_hours > donation.category.max_age_hours_policy:
                    raise ServiceValidationError(
                        f"Food exceeds max allowed age of {donation.category.max_age_hours_policy} hours for {donation.category.category_name}."
                    )
        if donation.food_state == FoodState.PACKAGED:
            if not donation.best_before or donation.best_before < now.date():
                raise ServiceValidationError("Packaged food requires a valid non-expired best-before date.")
        if not donation.allergens or not donation.allergens.strip():
            raise ServiceValidationError("Allergen declaration cannot be blank.")
        if not donation.donor_declared_at:
            donation.donor_declared_at = now

        old_status = donation.status
        donation.status = DonationStatus.AVAILABLE
        donation.version += 1
        donation.save()

        _log_status_change(
            StatusHistory.EntityType.DONATION,
            donation.id,
            old_status,
            DonationStatus.AVAILABLE,
            actor=actor,
            remarks="Donor published listing with safety declaration.",
        )
        return donation


@retry_on_deadlock()
def withdraw_donation(donation_id, actor, reason_code='DONOR_WITHDREW', remarks=None, expected_version=None):
    """SRS Section 4.2 & 4.6: Donor (R=0 only) or Admin (any time with cascade)."""
    with transaction.atomic():
        donation = FoodDonation.objects.select_for_update().get(pk=donation_id)

        if expected_version is not None and donation.version != int(expected_version):
            raise ServiceConflictError("Listing was updated by another action.", _donation_snapshot(donation))

        is_admin = actor.role == User.Role.ADMIN
        if not is_admin and donation.donor.user_id != actor.id:
            raise ServicePermissionError("You do not have permission to withdraw this listing.")

        if donation.status in (DonationStatus.WITHDRAWN, DonationStatus.COMPLETED, DonationStatus.EXPIRED):
            raise ServiceConflictError(f"Listing is already terminal ({donation.status}).", _donation_snapshot(donation))

        if not is_admin and Decimal(str(donation.reserved_quantity)) > Decimal('0.00'):
            raise ServiceConflictError(
                "Cannot withdraw listing once quantity is reserved. You may close the unreserved remainder instead.",
                _donation_snapshot(donation),
            )

        old_status = donation.status
        donation.status = DonationStatus.WITHDRAWN
        donation.version += 1
        donation.save(update_fields=['status', 'version', 'updated_at'])

        _log_status_change(
            StatusHistory.EntityType.DONATION,
            donation.id,
            old_status,
            DonationStatus.WITHDRAWN,
            actor=actor,
            reason_code=reason_code,
            remarks=remarks,
        )

        # Cascade to Pending requests (Section 4.6)
        pending_reqs = DonationRequest.objects.select_for_update().filter(
            donation=donation, status=RequestStatus.PENDING
        )
        for req in pending_reqs:
            req.status = RequestStatus.REJECTED
            req.decision_reason = 'LISTING_WITHDRAWN'
            req.decision_at = timezone.now()
            req.version += 1
            req.save()
            _log_status_change(
                StatusHistory.EntityType.REQUEST,
                req.id,
                RequestStatus.PENDING,
                RequestStatus.REJECTED,
                actor=actor,
                reason_code='LISTING_WITHDRAWN',
                remarks=remarks,
            )
            _notify(
                req.ngo.user,
                "Donation Withdrawn",
                f"Listing '{donation.food_name}' was withdrawn ({reason_code}).",
                event_type='LISTING_WITHDRAWN',
                entity_type='REQUEST',
                entity_id=req.id,
            )

        # Admin cascade to Accepted / Partially Accepted requests
        if is_admin:
            active_reqs = DonationRequest.objects.select_for_update().filter(
                donation=donation,
                status__in=[RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED],
            )
            for req in active_reqs:
                prev_req_status = req.status
                req.status = RequestStatus.CANCELLED
                req.cancelled_by = actor
                req.cancel_reason = reason_code or 'ADMIN_ACTION'
                req.version += 1
                req.save()
                _log_status_change(
                    StatusHistory.EntityType.REQUEST,
                    req.id,
                    prev_req_status,
                    RequestStatus.CANCELLED,
                    actor=actor,
                    reason_code=reason_code or 'ADMIN_ACTION',
                    remarks=remarks,
                )
                active_ass = VolunteerAssignment.objects.select_for_update().filter(
                    request=req, active_slot=1
                ).first()
                if active_ass:
                    prev_ass_status = active_ass.status
                    active_ass.status = AssignmentStatus.FAILED
                    active_ass.failure_reason = 'ADMIN_ACTION'
                    active_ass.active_slot = None
                    active_ass.save()
                    _log_status_change(
                        StatusHistory.EntityType.ASSIGNMENT,
                        active_ass.id,
                        prev_ass_status,
                        AssignmentStatus.FAILED,
                        actor=actor,
                        reason_code='ADMIN_ACTION',
                    )
                    _notify(
                        active_ass.volunteer.user,
                        "Assignment Cancelled by Admin",
                        f"Pickup for '{donation.food_name}' was cancelled ({reason_code}).",
                        event_type='ASSIGNMENT_FAILED',
                        entity_type='ASSIGNMENT',
                        entity_id=active_ass.id,
                    )
                _notify(
                    req.ngo.user,
                    "Allocation Cancelled by Admin",
                    f"Listing '{donation.food_name}' was moderated by Admin ({reason_code}).",
                    event_type='REQUEST_CANCELLED',
                    entity_type='REQUEST',
                    entity_id=req.id,
                )

        return donation


@retry_on_deadlock()
def close_donation_remainder(donation_id, actor, expected_version=None):
    """SRS Section 5.4 AL-5: Donor closes unreserved remainder so T becomes R."""
    with transaction.atomic():
        donation = FoodDonation.objects.select_for_update().get(pk=donation_id)

        if actor.role != User.Role.ADMIN and donation.donor.user_id != actor.id:
            raise ServicePermissionError("Only the owning donor can close the remainder.")
        if expected_version is not None and donation.version != int(expected_version):
            raise ServiceConflictError("Stale listing version.", _donation_snapshot(donation))
        if donation.status != DonationStatus.PARTIALLY_RESERVED:
            raise ServiceConflictError(
                "Remainder can only be closed when listing is PARTIALLY_RESERVED.",
                _donation_snapshot(donation),
            )

        old_status = donation.status
        donation.total_quantity = donation.reserved_quantity
        donation.status = DonationStatus.FULLY_RESERVED
        donation.version += 1
        donation.save(update_fields=['total_quantity', 'status', 'version', 'updated_at'])

        _log_status_change(
            StatusHistory.EntityType.DONATION,
            donation.id,
            old_status,
            DonationStatus.FULLY_RESERVED,
            actor=actor,
            remarks="Donor closed unreserved remainder (T set equal to R).",
        )

        # Auto-reject remaining Pending requests
        pending_reqs = DonationRequest.objects.select_for_update().filter(
            donation=donation, status=RequestStatus.PENDING
        )
        for req in pending_reqs:
            req.status = RequestStatus.REJECTED
            req.decision_reason = 'QUANTITY_UNAVAILABLE'
            req.decision_at = timezone.now()
            req.version += 1
            req.save()
            _log_status_change(
                StatusHistory.EntityType.REQUEST,
                req.id,
                RequestStatus.PENDING,
                RequestStatus.REJECTED,
                actor=actor,
                reason_code='QUANTITY_UNAVAILABLE',
            )
            _notify(
                req.ngo.user,
                "Request Auto-Rejected",
                f"No remaining quantity available for '{donation.food_name}'.",
                event_type='REQUEST_REJECTED',
                entity_type='REQUEST',
                entity_id=req.id,
            )

        return donation


# ==============================================================================
# 2. REQUEST & ALLOCATION SERVICES (Submit, Accept/Partial, Reject, Cancel)
# ==============================================================================

@retry_on_deadlock()
def submit_donation_request(
    donation_id,
    ngo_profile,
    distribution_point_id,
    requested_quantity,
    expected_beneficiaries,
    min_acceptable_quantity=None,
    message=None,
    safety_acknowledged=False,
):
    """SRS Section 5.4 AL-1 & Section 6.4 Checkpoint 2."""
    if not safety_acknowledged:
        raise ServiceValidationError("You must acknowledge the food safety, allergen, and storage details before requesting.")

    req_qty = Decimal(str(requested_quantity))
    min_qty = Decimal(str(min_acceptable_quantity)) if min_acceptable_quantity is not None else None

    if req_qty <= Decimal('0.00'):
        raise ServiceValidationError("Requested quantity must be greater than 0.")
    if min_qty is not None and (min_qty <= Decimal('0.00') or min_qty > req_qty):
        raise ServiceValidationError("Minimum acceptable quantity must be positive and at most requested quantity.")

    with transaction.atomic():
        donation = FoodDonation.objects.select_for_update().get(pk=donation_id)

        if ngo_profile.verification_status != User.AccountStatus.VERIFIED:
            raise ServicePermissionError("Only verified NGOs may submit food requests.")
        if donation.status not in (DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_RESERVED):
            raise ServiceConflictError(
                f"This donation is currently {donation.status} and cannot accept new requests.",
                _donation_snapshot(donation),
            )
        if donation.pickup_deadline <= timezone.now():
            raise ServiceConflictError("Pickup deadline for this donation has already passed.", _donation_snapshot(donation))

        # AL-1: Only one open request per NGO per donation
        open_exists = DonationRequest.objects.filter(
            donation=donation,
            ngo=ngo_profile,
            status__in=[RequestStatus.PENDING, RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED],
        ).exists()
        if open_exists:
            raise ServiceConflictError("Your NGO already has an open request for this donation.")

        if req_qty > donation.available_quantity:
            raise ServiceConflictError(
                f"Only {donation.available_quantity} {donation.unit} available.",
                _donation_snapshot(donation),
            )

        req = DonationRequest.objects.create(
            donation=donation,
            ngo=ngo_profile,
            distribution_point_id=distribution_point_id,
            requested_quantity=req_qty,
            min_acceptable_quantity=min_qty,
            expected_beneficiaries=expected_beneficiaries,
            message=message,
            status=RequestStatus.PENDING,
        )

        _log_status_change(
            StatusHistory.EntityType.REQUEST,
            req.id,
            None,
            RequestStatus.PENDING,
            actor=ngo_profile.user,
            remarks=f"NGO requested {req_qty} {donation.unit}.",
        )
        _notify(
            donation.donor.user,
            "New Food Request Received",
            f"{ngo_profile.organisation_name} requested {req_qty} {donation.unit} of '{donation.food_name}'.",
            event_type='NEW_REQUEST',
            entity_type='REQUEST',
            entity_id=req.id,
        )
        return req


@retry_on_deadlock()
def decide_donation_request(
    request_id,
    actor,
    decision,
    accepted_quantity=None,
    reason_code=None,
    expected_version=None,
):
    """SRS Section 4.3, 5.4 (AL-2, AL-3) & 5.5: Accept (Full/Partial) or Reject under lock."""
    with transaction.atomic():
        # Lock order: FoodDonation FIRST, then DonationRequest (C-2)
        req_lookup = DonationRequest.objects.select_related('donation').get(pk=request_id)
        donation = FoodDonation.objects.select_for_update().get(pk=req_lookup.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=request_id)

        if actor.role != User.Role.ADMIN and donation.donor.user_id != actor.id:
            raise ServicePermissionError("Only the owning donor or an admin may decide on this request.")

        if expected_version is not None and req.version != int(expected_version):
            raise ServiceConflictError(
                "Request state changed before your action. Refreshing latest state.",
                {**_request_snapshot(req), 'donation': _donation_snapshot(donation)},
            )

        if req.status != RequestStatus.PENDING:
            raise ServiceConflictError(
                f"Request already processed ({req.status}).",
                {**_request_snapshot(req), 'donation': _donation_snapshot(donation)},
            )

        if decision == 'REJECT':
            if not reason_code:
                raise ServiceValidationError("A rejection reason code is required.")
            req.status = RequestStatus.REJECTED
            req.decision_reason = reason_code
            req.decision_at = timezone.now()
            req.version += 1
            req.save()

            _log_status_change(
                StatusHistory.EntityType.REQUEST,
                req.id,
                RequestStatus.PENDING,
                RequestStatus.REJECTED,
                actor=actor,
                reason_code=reason_code,
            )
            _notify(
                req.ngo.user,
                "Food Request Rejected",
                f"Your request for '{donation.food_name}' was rejected ({reason_code}).",
                event_type='REQUEST_REJECTED',
                entity_type='REQUEST',
                entity_id=req.id,
            )
            return req

        if decision != 'ACCEPT':
            raise ServiceValidationError("Decision must be 'ACCEPT' or 'REJECT'.")

        if donation.status not in (DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_RESERVED):
            raise ServiceConflictError(
                f"Donation is {donation.status} and cannot allocate quantity.",
                _donation_snapshot(donation),
            )
        if donation.pickup_deadline <= timezone.now():
            raise ServiceConflictError("Pickup deadline has passed.", _donation_snapshot(donation))

        avail = donation.available_quantity
        acc_qty = Decimal(str(accepted_quantity)) if accepted_quantity is not None else Decimal(str(req.requested_quantity))

        if acc_qty <= Decimal('0.00'):
            raise ServiceValidationError("Accepted quantity must be greater than 0.")
        if acc_qty > Decimal(str(req.requested_quantity)):
            raise ServiceValidationError("Accepted quantity cannot exceed requested quantity.")
        if req.min_acceptable_quantity and acc_qty < Decimal(str(req.min_acceptable_quantity)):
            raise ServiceValidationError(
                f"Accepted quantity cannot be less than NGO's minimum acceptable quantity ({req.min_acceptable_quantity})."
            )
        if acc_qty > avail:
            raise ServiceConflictError(
                f"Only {avail} {donation.unit} available.",
                {**_request_snapshot(req), 'donation': _donation_snapshot(donation)},
            )

        new_req_status = (
            RequestStatus.ACCEPTED
            if acc_qty == Decimal(str(req.requested_quantity))
            else RequestStatus.PARTIALLY_ACCEPTED
        )

        req.accepted_quantity = acc_qty
        req.status = new_req_status
        req.decision_reason = reason_code
        req.decision_at = timezone.now()
        req.version += 1
        req.save()

        _log_status_change(
            StatusHistory.EntityType.REQUEST,
            req.id,
            RequestStatus.PENDING,
            new_req_status,
            actor=actor,
            reason_code=reason_code,
            remarks=f"Allocated {acc_qty} {donation.unit}.",
        )

        # Update Donation reserved_quantity (R) and status
        old_don_status = donation.status
        donation.reserved_quantity = Decimal(str(donation.reserved_quantity)) + acc_qty
        new_don_status = (
            DonationStatus.FULLY_RESERVED
            if donation.reserved_quantity == Decimal(str(donation.total_quantity))
            else DonationStatus.PARTIALLY_RESERVED
        )
        donation.status = new_don_status
        donation.version += 1
        donation.save(update_fields=['reserved_quantity', 'status', 'version', 'updated_at'])

        _log_status_change(
            StatusHistory.EntityType.DONATION,
            donation.id,
            old_don_status,
            new_don_status,
            actor=actor,
            remarks=f"Reserved {acc_qty} {donation.unit} (R={donation.reserved_quantity}/{donation.total_quantity}).",
        )

        _notify(
            req.ngo.user,
            f"Request {new_req_status.replace('_', ' ').title()}",
            f"Donor approved {acc_qty} {donation.unit} of '{donation.food_name}'. Please assign a volunteer.",
            event_type='REQUEST_DECIDED',
            entity_type='REQUEST',
            entity_id=req.id,
        )

        # AL-3: Auto-reject other Pending requests when A becomes 0
        if donation.available_quantity == Decimal('0.00'):
            other_pending = DonationRequest.objects.select_for_update().filter(
                donation=donation, status=RequestStatus.PENDING
            )
            for other in other_pending:
                other.status = RequestStatus.REJECTED
                other.decision_reason = 'QUANTITY_UNAVAILABLE'
                other.decision_at = timezone.now()
                other.version += 1
                other.save()
                _log_status_change(
                    StatusHistory.EntityType.REQUEST,
                    other.id,
                    RequestStatus.PENDING,
                    RequestStatus.REJECTED,
                    actor=None,
                    reason_code='QUANTITY_UNAVAILABLE',
                    remarks="Auto-rejected because available quantity reached 0.",
                )
                _notify(
                    other.ngo.user,
                    "Request Auto-Rejected (Quantity Unavailable)",
                    f"All quantity for '{donation.food_name}' has been allocated.",
                    event_type='REQUEST_REJECTED',
                    entity_type='REQUEST',
                    entity_id=other.id,
                )

        return req


@retry_on_deadlock()
def cancel_donation_request(request_id, actor, reason_code, remarks=None, expected_version=None):
    """SRS Section 4.3, 5.2 & 5.4 AL-4: NGO/Admin cancels request; releases R only before PICKED_UP & deadline."""
    if not reason_code:
        raise ServiceValidationError("Cancellation reason code is mandatory.")

    with transaction.atomic():
        req_lookup = DonationRequest.objects.select_related('donation').get(pk=request_id)
        donation = FoodDonation.objects.select_for_update().get(pk=req_lookup.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=request_id)
        active_ass = VolunteerAssignment.objects.select_for_update().filter(
            request=req, active_slot=1
        ).first()

        is_admin = actor.role == User.Role.ADMIN
        if not is_admin and req.ngo.user_id != actor.id:
            raise ServicePermissionError("Only the requesting NGO or an admin may cancel this request.")

        if expected_version is not None and req.version != int(expected_version):
            raise ServiceConflictError("Stale request version.", _request_snapshot(req))

        if req.status in (RequestStatus.REJECTED, RequestStatus.CANCELLED):
            raise ServiceConflictError(f"Request is already {req.status}.", _request_snapshot(req))

        # Cannot cancel once food has been picked up
        if active_ass and active_ass.status in (AssignmentStatus.PICKED_UP, AssignmentStatus.DELIVERED):
            raise ServiceConflictError(
                "Cannot cancel request after food has been picked up. Use the delivery-failure or receipt-rejection path.",
                _request_snapshot(req),
            )

        now = timezone.now()
        old_req_status = req.status
        req.status = RequestStatus.CANCELLED
        req.cancelled_by = actor
        req.cancel_reason = reason_code
        req.version += 1
        req.save()

        _log_status_change(
            StatusHistory.EntityType.REQUEST,
            req.id,
            old_req_status,
            RequestStatus.CANCELLED,
            actor=actor,
            reason_code=reason_code,
            remarks=remarks,
        )

        # Close active assignment as FAILED (REQUEST_CANCELLED)
        if active_ass:
            old_ass_status = active_ass.status
            active_ass.status = AssignmentStatus.FAILED
            active_ass.failure_reason = 'REQUEST_CANCELLED'
            active_ass.active_slot = None
            active_ass.save()
            _log_status_change(
                StatusHistory.EntityType.ASSIGNMENT,
                active_ass.id,
                old_ass_status,
                AssignmentStatus.FAILED,
                actor=actor,
                reason_code='REQUEST_CANCELLED',
                remarks=remarks,
            )
            _notify(
                active_ass.volunteer.user,
                "Pickup Assignment Cancelled",
                f"The NGO cancelled the request for '{donation.food_name}' ({reason_code}).",
                event_type='ASSIGNMENT_FAILED',
                entity_type='ASSIGNMENT',
                entity_id=active_ass.id,
            )

        # AL-4: Return quantity to pool if previously accepted, before pickup, before deadline, and not withdrawn
        if old_req_status in (RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED):
            cfg = get_system_config()
            minutes_to_deadline = (donation.pickup_deadline - now).total_seconds() / 60.0
            if 0 <= minutes_to_deadline <= cfg.late_cancellation_window_minutes:
                ngo = req.ngo
                ngo.late_cancel_count += 1
                ngo.save(update_fields=['late_cancel_count'])

            if donation.pickup_deadline > now and donation.status != DonationStatus.WITHDRAWN:
                donation.reserved_quantity = max(
                    Decimal('0.00'),
                    Decimal(str(donation.reserved_quantity)) - Decimal(str(req.accepted_quantity)),
                )
                donation.version += 1
                donation.save(update_fields=['reserved_quantity', 'version', 'updated_at'])
                _recalculate_donation_status(
                    donation,
                    actor=actor,
                    reason_code=reason_code,
                    remarks="Quantity returned to pool after pre-pickup cancellation.",
                )

        _notify(
            donation.donor.user,
            "NGO Cancelled Food Request",
            f"{req.ngo.organisation_name} cancelled their request for '{donation.food_name}' ({reason_code}).",
            event_type='REQUEST_CANCELLED',
            entity_type='REQUEST',
            entity_id=req.id,
        )
        return req


# ==============================================================================
# 3. VOLUNTEER WORKFLOW & HANDOVER CHECKLIST SERVICES (Section 6.4 & 7)
# ==============================================================================

@retry_on_deadlock()
def assign_volunteer(request_id, volunteer_profile_id, actor, notes=None):
    """SRS Section 4.4 & 7.3: NGO assigns an approved, available volunteer."""
    with transaction.atomic():
        req_lookup = DonationRequest.objects.select_related('donation').get(pk=request_id)
        donation = FoodDonation.objects.select_for_update().get(pk=req_lookup.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=request_id)

        if actor.role != User.Role.ADMIN and req.ngo.user_id != actor.id:
            raise ServicePermissionError("Only the requesting NGO can assign volunteers.")

        if req.status not in (RequestStatus.ACCEPTED, RequestStatus.PARTIALLY_ACCEPTED):
            raise ServiceConflictError("Volunteers can only be assigned to ACCEPTED or PARTIALLY_ACCEPTED requests.")

        if donation.pickup_deadline <= timezone.now():
            raise ServiceConflictError("Pickup deadline has passed.")

        if VolunteerAssignment.objects.filter(request=req, active_slot=1).exists():
            raise ServiceConflictError("An active volunteer assignment already exists for this request.")

        volunteer = VolunteerProfile.objects.select_for_update().get(pk=volunteer_profile_id)
        if volunteer.ngo_id != req.ngo_id:
            raise ServicePermissionError("Volunteer does not belong to your NGO.")
        if not volunteer.ngo_approved:
            raise ServicePermissionError("Volunteer is not yet approved by the NGO.")
        if volunteer.availability_status != AvailabilityStatus.AVAILABLE:
            raise ServiceConflictError(f"Volunteer is currently {volunteer.availability_status}.")

        # Section 7.3: Volunteer cannot hold two overlapping active assignments in MVP
        has_overlap = VolunteerAssignment.objects.filter(
            volunteer=volunteer, active_slot=1
        ).exists()
        if has_overlap:
            raise ServiceConflictError("This volunteer already has another active delivery task.")

        otp_code = f"{random.randint(100000, 999999)}"
        assignment = VolunteerAssignment.objects.create(
            request=req,
            volunteer=volunteer,
            assigned_by=actor,
            status=AssignmentStatus.ASSIGNED,
            verification_code=otp_code,
            active_slot=1,
            notes=notes,
        )

        PickupTracking.objects.create(
            assignment=assignment,
            event_type='ASSIGNED',
            notes=f"Assigned to {volunteer.user.username}. Pickup OTP generated.",
            updated_by=actor,
        )
        _log_status_change(
            StatusHistory.EntityType.ASSIGNMENT,
            assignment.id,
            None,
            AssignmentStatus.ASSIGNED,
            actor=actor,
        )
        _notify(
            volunteer.user,
            "New Pickup Assignment",
            f"You have been assigned to pick up '{donation.food_name}' for {req.ngo.organisation_name}.",
            event_type='NEW_ASSIGNMENT',
            entity_type='ASSIGNMENT',
            entity_id=assignment.id,
        )
        return assignment


@retry_on_deadlock()
def respond_to_assignment(assignment_id, actor, accept=True, reason_code=None):
    """SRS Section 4.4 & 7.2 Step 2: Volunteer accepts or rejects assignment."""
    with transaction.atomic():
        assignment = VolunteerAssignment.objects.select_for_update().select_related(
            'request__donation', 'request__ngo', 'volunteer__user'
        ).get(pk=assignment_id)

        if actor.role != User.Role.ADMIN and assignment.volunteer.user_id != actor.id:
            raise ServicePermissionError("You can only respond to your own assignments.")

        if assignment.status != AssignmentStatus.ASSIGNED:
            raise ServiceConflictError(f"Cannot respond when assignment is {assignment.status}.")

        now = timezone.now()
        assignment.responded_at = now

        if accept:
            assignment.status = AssignmentStatus.ACCEPTED
            assignment.save(update_fields=['status', 'responded_at'])
            PickupTracking.objects.create(
                assignment=assignment,
                event_type='ACCEPTED',
                notes="Volunteer accepted the pickup assignment.",
                updated_by=actor,
            )
            _log_status_change(
                StatusHistory.EntityType.ASSIGNMENT,
                assignment.id,
                AssignmentStatus.ASSIGNED,
                AssignmentStatus.ACCEPTED,
                actor=actor,
            )
            _notify(
                assignment.request.ngo.user,
                "Volunteer Accepted Pickup",
                f"{assignment.volunteer.user.username} accepted pickup for '{assignment.request.donation.food_name}'.",
                event_type='ASSIGNMENT_ACCEPTED',
                entity_type='ASSIGNMENT',
                entity_id=assignment.id,
            )
        else:
            if not reason_code:
                raise ServiceValidationError("Rejection reason code is required.")
            assignment.status = AssignmentStatus.REJECTED
            assignment.failure_reason = reason_code
            assignment.active_slot = None
            assignment.save(update_fields=['status', 'failure_reason', 'active_slot', 'responded_at'])
            PickupTracking.objects.create(
                assignment=assignment,
                event_type='REJECTED',
                notes=f"Volunteer declined: {reason_code}",
                updated_by=actor,
            )
            _log_status_change(
                StatusHistory.EntityType.ASSIGNMENT,
                assignment.id,
                AssignmentStatus.ASSIGNED,
                AssignmentStatus.REJECTED,
                actor=actor,
                reason_code=reason_code,
            )
            _notify(
                assignment.request.ngo.user,
                "Volunteer Declined Assignment",
                f"{assignment.volunteer.user.username} declined ({reason_code}). Please reassign another volunteer.",
                event_type='ASSIGNMENT_REJECTED',
                entity_type='ASSIGNMENT',
                entity_id=assignment.id,
            )

        return assignment


@retry_on_deadlock()
def start_pickup(assignment_id, actor):
    """SRS Section 4.4 & 7.2 Step 4: ACCEPTED -> PICKUP_IN_PROGRESS."""
    with transaction.atomic():
        assignment = VolunteerAssignment.objects.select_for_update().select_related(
            'request__donation__donor__user', 'request__ngo__user', 'volunteer__user'
        ).get(pk=assignment_id)

        if actor.role != User.Role.ADMIN and assignment.volunteer.user_id != actor.id:
            raise ServicePermissionError("Only the assigned volunteer can start pickup.")
        if assignment.status != AssignmentStatus.ACCEPTED:
            raise ServiceConflictError(f"Pickup can only start from ACCEPTED status (current: {assignment.status}).")

        assignment.status = AssignmentStatus.PICKUP_IN_PROGRESS
        assignment.save(update_fields=['status'])

        PickupTracking.objects.create(
            assignment=assignment,
            event_type='PICKUP_IN_PROGRESS',
            notes="Volunteer started pickup trip.",
            updated_by=actor,
        )
        _log_status_change(
            StatusHistory.EntityType.ASSIGNMENT,
            assignment.id,
            AssignmentStatus.ACCEPTED,
            AssignmentStatus.PICKUP_IN_PROGRESS,
            actor=actor,
        )
        _notify(
            assignment.request.donation.donor.user,
            "Volunteer En Route for Pickup",
            f"{assignment.volunteer.user.username} has started pickup for '{assignment.request.donation.food_name}'.",
            event_type='PICKUP_STARTED',
            entity_type='ASSIGNMENT',
            entity_id=assignment.id,
        )
        return assignment


@retry_on_deadlock()
def complete_pickup(
    assignment_id,
    actor,
    verification_code,
    checklist_result,
    passed=True,
    actual_quantity=None,
    shortfall_reason=None,
    notes=None,
):
    """SRS Section 6.4 Checkpoint 3, 7.2 Step 5 & AL-7: Pickup checklist, OTP & actual quantity."""
    with transaction.atomic():
        ass_lookup = VolunteerAssignment.objects.select_related('request__donation').get(pk=assignment_id)
        donation = FoodDonation.objects.select_for_update().get(pk=ass_lookup.request.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=ass_lookup.request_id)
        assignment = VolunteerAssignment.objects.select_for_update().get(pk=assignment_id)

        if actor.role != User.Role.ADMIN and assignment.volunteer.user_id != actor.id:
            raise ServicePermissionError("Only the assigned volunteer can record pickup.")

        if assignment.status not in (AssignmentStatus.ACCEPTED, AssignmentStatus.PICKUP_IN_PROGRESS):
            raise ServiceConflictError(f"Cannot record pickup from status {assignment.status}.")

        now = timezone.now()
        if donation.pickup_deadline <= now:
            raise ServiceConflictError("Pickup deadline has passed.")
        if donation.earliest_pickup and now < donation.earliest_pickup:
            raise ServiceValidationError("Pickup cannot be recorded before the earliest pickup time.")

        HandoverCheck.objects.create(
            assignment=assignment,
            stage=HandoverCheck.CheckStage.PICKUP,
            checklist_result=checklist_result or {},
            passed=bool(passed),
            checked_by=actor,
            notes=notes,
        )

        old_ass_status = assignment.status

        # Failed pickup safety check (Section 6.4 #3 & 7.4)
        if not passed:
            assignment.status = AssignmentStatus.FAILED
            assignment.failure_reason = 'FOOD_REJECTED_AT_PICKUP'
            assignment.active_slot = None
            assignment.save()

            _log_status_change(
                StatusHistory.EntityType.ASSIGNMENT,
                assignment.id,
                old_ass_status,
                AssignmentStatus.FAILED,
                actor=actor,
                reason_code='FOOD_REJECTED_AT_PICKUP',
                remarks=notes,
            )

            old_req_status = req.status
            req.status = RequestStatus.CANCELLED
            req.cancelled_by = actor
            req.cancel_reason = 'FOOD_UNSUITABLE'
            req.version += 1
            req.save()

            _log_status_change(
                StatusHistory.EntityType.REQUEST,
                req.id,
                old_req_status,
                RequestStatus.CANCELLED,
                actor=actor,
                reason_code='FOOD_UNSUITABLE',
                remarks=notes,
            )

            # Quantity rejected on safety grounds is NEVER returned to pool (BR-11)
            rejected_qty = Decimal(str(req.accepted_quantity))
            donation.reserved_quantity = max(Decimal('0.00'), Decimal(str(donation.reserved_quantity)) - rejected_qty)
            donation.total_quantity = max(donation.reserved_quantity, Decimal(str(donation.total_quantity)) - rejected_qty)
            donation.version += 1
            donation.save(update_fields=['total_quantity', 'reserved_quantity', 'version', 'updated_at'])
            _recalculate_donation_status(
                donation,
                actor=actor,
                reason_code='FOOD_REJECTED_AT_PICKUP',
                remarks="Safety-rejected quantity removed without returning to available pool.",
            )

            SafetyReport.objects.create(
                donation=donation,
                reported_by=actor,
                description=f"Pickup safety check failed by volunteer: {notes or 'Food rejected at pickup.'}",
            )
            _notify(
                req.ngo.user,
                "Pickup Rejected (Food Safety)",
                f"Volunteer rejected '{donation.food_name}' at pickup due to food safety check.",
                event_type='SAFETY_REJECTION',
                entity_type='ASSIGNMENT',
                entity_id=assignment.id,
            )
            return assignment

        # Verify 6-digit OTP
        if assignment.verification_code and str(verification_code).strip() != str(assignment.verification_code).strip():
            raise ServiceValidationError("Invalid 6-digit Pickup OTP.")

        act_qty = Decimal(str(actual_quantity)) if actual_quantity is not None else Decimal(str(req.accepted_quantity))
        if act_qty <= Decimal('0.00'):
            raise ServiceValidationError("Actual picked-up quantity must be greater than 0.")
        if act_qty > Decimal(str(req.accepted_quantity)):
            raise ServiceValidationError("Actual quantity cannot exceed accepted quantity.")

        # AL-7: Handle shortfall at pickup
        if act_qty < Decimal(str(req.accepted_quantity)):
            if not shortfall_reason:
                raise ServiceValidationError("A reason is required when actual picked-up quantity is less than accepted quantity.")
            diff = Decimal(str(req.accepted_quantity)) - act_qty
            req.accepted_quantity = act_qty
            req.decision_reason = f"SHORTFALL: {shortfall_reason}"
            req.version += 1
            req.save()

            # Shortfall difference is not re-offered to pool (AL-7)
            donation.reserved_quantity = max(Decimal('0.00'), Decimal(str(donation.reserved_quantity)) - diff)
            donation.total_quantity = max(donation.reserved_quantity, Decimal(str(donation.total_quantity)) - diff)
            donation.version += 1
            donation.save(update_fields=['total_quantity', 'reserved_quantity', 'version', 'updated_at'])

        assignment.actual_quantity = act_qty
        assignment.shortfall_reason = shortfall_reason
        assignment.status = AssignmentStatus.PICKED_UP
        assignment.picked_up_at = now
        assignment.save()

        PickupTracking.objects.create(
            assignment=assignment,
            event_type='PICKED_UP',
            notes=f"Picked up {act_qty} {donation.unit}. {notes or ''}".strip(),
            updated_by=actor,
        )
        _log_status_change(
            StatusHistory.EntityType.ASSIGNMENT,
            assignment.id,
            old_ass_status,
            AssignmentStatus.PICKED_UP,
            actor=actor,
            remarks=f"Actual quantity collected: {act_qty} {donation.unit}.",
        )
        _notify(
            req.ngo.user,
            "Food Picked Up by Volunteer",
            f"{assignment.volunteer.user.username} collected {act_qty} {donation.unit} of '{donation.food_name}'.",
            event_type='PICKUP_COMPLETED',
            entity_type='ASSIGNMENT',
            entity_id=assignment.id,
        )
        return assignment


@retry_on_deadlock()
def complete_delivery_with_receipt_check(
    assignment_id,
    actor,
    checklist_result=None,
    passed=True,
    notes=None,
):
    """SRS Section 6.4 Checkpoint 4 & 7.2 Step 6-7: Delivery & NGO Receipt Check -> DELIVERED."""
    with transaction.atomic():
        ass_lookup = VolunteerAssignment.objects.select_related('request__donation').get(pk=assignment_id)
        donation = FoodDonation.objects.select_for_update().get(pk=ass_lookup.request.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=ass_lookup.request_id)
        assignment = VolunteerAssignment.objects.select_for_update().get(pk=assignment_id)

        if actor.role not in (User.Role.ADMIN, User.Role.NGO, User.Role.VOLUNTEER):
            raise ServicePermissionError("Not authorised to update delivery.")
        if assignment.status != AssignmentStatus.PICKED_UP:
            raise ServiceConflictError(f"Assignment must be PICKED_UP before delivery (current: {assignment.status}).")

        if checklist_result is not None:
            HandoverCheck.objects.create(
                assignment=assignment,
                stage=HandoverCheck.CheckStage.RECEIPT,
                checklist_result=checklist_result,
                passed=bool(passed),
                checked_by=actor,
                notes=notes,
            )

        if not passed:
            assignment.status = AssignmentStatus.FAILED
            assignment.failure_reason = 'FOOD_REJECTED_AT_DELIVERY'
            assignment.active_slot = None
            assignment.save()

            _log_status_change(
                StatusHistory.EntityType.ASSIGNMENT,
                assignment.id,
                AssignmentStatus.PICKED_UP,
                AssignmentStatus.FAILED,
                actor=actor,
                reason_code='FOOD_REJECTED_AT_DELIVERY',
                remarks=notes,
            )
            SafetyReport.objects.create(
                donation=donation,
                reported_by=actor,
                description=f"Receipt safety check failed on arrival: {notes or 'Food rejected at delivery.'}",
            )
            return assignment

        assignment.status = AssignmentStatus.DELIVERED
        assignment.delivered_at = timezone.now()
        assignment.active_slot = None
        assignment.save()

        PickupTracking.objects.create(
            assignment=assignment,
            event_type='DELIVERED',
            notes=notes or "Delivered to NGO distribution point and receipt check passed.",
            updated_by=actor,
        )
        _log_status_change(
            StatusHistory.EntityType.ASSIGNMENT,
            assignment.id,
            AssignmentStatus.PICKED_UP,
            AssignmentStatus.DELIVERED,
            actor=actor,
        )
        _notify(
            req.ngo.user,
            "Food Delivered to Distribution Point",
            f"'{donation.food_name}' has been delivered. You may now record beneficiary distribution.",
            event_type='DELIVERY_COMPLETED',
            entity_type='ASSIGNMENT',
            entity_id=assignment.id,
        )
        return assignment


@retry_on_deadlock()
def fail_assignment(assignment_id, actor, reason_code, remarks=None):
    """SRS Section 7.4: Fail assignment with controlled reason code so NGO can reassign."""
    if not reason_code:
        raise ServiceValidationError("Failure reason code is required.")

    with transaction.atomic():
        assignment = VolunteerAssignment.objects.select_for_update().select_related(
            'request__donation', 'request__ngo', 'volunteer'
        ).get(pk=assignment_id)

        if assignment.status in (AssignmentStatus.DELIVERED, AssignmentStatus.REJECTED, AssignmentStatus.FAILED):
            raise ServiceConflictError(f"Assignment is already terminal ({assignment.status}).")

        old_status = assignment.status
        assignment.status = AssignmentStatus.FAILED
        assignment.failure_reason = reason_code
        assignment.active_slot = None
        assignment.save()

        PickupTracking.objects.create(
            assignment=assignment,
            event_type='FAILED',
            notes=f"Failed ({reason_code}): {remarks or ''}".strip(),
            updated_by=actor,
        )
        _log_status_change(
            StatusHistory.EntityType.ASSIGNMENT,
            assignment.id,
            old_status,
            AssignmentStatus.FAILED,
            actor=actor,
            reason_code=reason_code,
            remarks=remarks,
        )
        _notify(
            assignment.request.ngo.user,
            "Volunteer Assignment Failed",
            f"Delivery for '{assignment.request.donation.food_name}' failed ({reason_code}). You can reassign a volunteer.",
            event_type='ASSIGNMENT_FAILED',
            entity_type='ASSIGNMENT',
            entity_id=assignment.id,
        )
        return assignment


# ==============================================================================
# 4. BENEFICIARY DISTRIBUTION & COMPLETION SERVICES (Section 8)
# ==============================================================================

@retry_on_deadlock()
def record_distribution_session(
    request_id,
    actor,
    distribution_point_id,
    actual_headcount_served,
    quantity_distributed,
    discarded_quantity=Decimal('0.00'),
    discard_reason=None,
    notes=None,
    feedback_note=None,
    auto_confirm=True,
):
    """SRS Section 8.2 & 8.3: Record distribution session & enforce distributed + discarded <= delivered."""
    dist_qty = Decimal(str(quantity_distributed))
    disc_qty = Decimal(str(discarded_quantity or '0.00'))

    if dist_qty < Decimal('0.00') or disc_qty < Decimal('0.00'):
        raise ServiceValidationError("Distributed and discarded quantities cannot be negative.")
    if dist_qty == Decimal('0.00') and disc_qty == Decimal('0.00'):
        raise ServiceValidationError("Enter distributed quantity or discarded quantity.")
    if disc_qty > Decimal('0.00') and not discard_reason:
        raise ServiceValidationError("A discard reason is required when discarded quantity is greater than 0.")

    with transaction.atomic():
        req_lookup = DonationRequest.objects.select_related('donation').get(pk=request_id)
        donation = FoodDonation.objects.select_for_update().get(pk=req_lookup.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=request_id)

        if actor.role != User.Role.ADMIN and req.ngo.user_id != actor.id:
            raise ServicePermissionError("Only the receiving NGO can record distribution.")

        delivered_ass = req.assignments.filter(status=AssignmentStatus.DELIVERED).first()
        if not delivered_ass:
            raise ServiceConflictError("Cannot record distribution before delivery is completed.")

        delivered_qty = Decimal(str(delivered_ass.actual_quantity or req.accepted_quantity))

        existing_totals = req.distribution_records.aggregate(
            dist_sum=Sum('quantity_distributed'),
            disc_sum=Sum('discarded_quantity'),
        )
        already_accounted = (
            (existing_totals['dist_sum'] or Decimal('0.00'))
            + (existing_totals['disc_sum'] or Decimal('0.00'))
        )

        if already_accounted + dist_qty + disc_qty > delivered_qty:
            remaining_unaccounted = delivered_qty - already_accounted
            raise ServiceValidationError(
                f"Distributed + discarded quantity exceeds delivered quantity. Remaining unaccounted: {remaining_unaccounted} {donation.unit}."
            )

        record = DistributionRecord.objects.create(
            request=req,
            ngo=req.ngo,
            distribution_point_id=distribution_point_id or req.distribution_point_id,
            actual_headcount_served=int(actual_headcount_served),
            quantity_distributed=dist_qty,
            discarded_quantity=disc_qty,
            discard_reason=discard_reason,
            notes=notes,
            feedback_note=feedback_note,
        )

        if auto_confirm:
            confirm_distribution_completion(req.id, actor)

        return record


@retry_on_deadlock()
def confirm_distribution_completion(request_id, actor):
    """SRS Section 8.2 Stage 5 & 8.3: Confirm distribution records, update D on donation & derive COMPLETED."""
    with transaction.atomic():
        req_lookup = DonationRequest.objects.select_related('donation').get(pk=request_id)
        donation = FoodDonation.objects.select_for_update().get(pk=req_lookup.donation_id)
        req = DonationRequest.objects.select_for_update().get(pk=request_id)

        if actor.role != User.Role.ADMIN and req.ngo.user_id != actor.id:
            raise ServicePermissionError("Only the receiving NGO can confirm completion.")

        now = timezone.now()
        unconfirmed = req.distribution_records.filter(confirmed_at__isnull=True)
        for rec in unconfirmed:
            rec.confirmed_at = now
            rec.confirmed_by = actor
            rec.save(update_fields=['confirmed_at', 'confirmed_by'])

        total_distributed_for_donation = (
            DistributionRecord.objects.filter(
                request__donation=donation,
                confirmed_at__isnull=False,
            ).aggregate(total=Sum('quantity_distributed'))['total']
            or Decimal('0.00')
        )

        donation.distributed_quantity = total_distributed_for_donation
        donation.version += 1
        donation.save(update_fields=['distributed_quantity', 'version', 'updated_at'])

        _recalculate_donation_status(
            donation,
            actor=actor,
            remarks="Distribution confirmed by NGO.",
        )
        _notify(
            donation.donor.user,
            "Donation Impact Confirmed!",
            f"{req.ngo.organisation_name} confirmed distribution of '{donation.food_name}' to community beneficiaries.",
            event_type='DISTRIBUTION_CONFIRMED',
            entity_type='DONATION',
            entity_id=donation.id,
        )
        return donation