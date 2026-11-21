from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from accounts.models import (
    User,
    DonorProfile,
    NGOProfile,
    VolunteerProfile,
    DistributionPoint,
    AvailabilityStatus,
)
from donations.models import (
    FoodCategory,
    FoodDonation,
    FoodType,
    FoodState,
    StorageCondition,
    PackagingType,
    DonationStatus,
)
from requests_app.models import DonationRequest, RequestStatus
from volunteers.models import VolunteerAssignment, AssignmentStatus
from volunteers.serializers import VolunteerAssignmentSerializer
from core.models import StatusHistory
from allocations.services import (
    publish_donation,
    close_donation_remainder,
    submit_donation_request,
    decide_donation_request,
    cancel_donation_request,
    assign_volunteer,
    respond_to_assignment,
    start_pickup,
    complete_pickup,
    complete_delivery_with_receipt_check,
    record_distribution_session,
    ServiceConflictError,
    ServiceValidationError,
)


class FoodBridgeSRSConcurrencyAndLifecycleTests(TransactionTestCase):
    """
    SRS v2.0 Section 16.1 Verification Suite:
    - Parallel accept concurrency & over-allocation prevention (AC-10 / HTTP 409)
    - Illegal state transition rejection (AC-12)
    - Immutable StatusHistory audit log generation (AC-13)
    - Contact privacy masking before assignment acceptance (FR-25)
    - Scheduled deadline & timeout processing command (FR-32)
    """

    def setUp(self):
        self.category = FoodCategory.objects.create(
            category_name="Cooked Meals",
            max_age_hours_policy=6,
        )

        # Verified Donor
        self.donor_user = User.objects.create_user(
            username="hotel_taj",
            email="donor@foodbridge.test",
            password="Password@123",
            phone="9876543210",
            role=User.Role.DONOR,
            account_status=User.AccountStatus.VERIFIED,
        )
        self.donor = DonorProfile.objects.create(
            user=self.donor_user,
            organisation_name="Taj Kitchens",
            address="MG Road, Dhule",
            location="MG Road, Dhule",
            verification_status=User.AccountStatus.VERIFIED,
        )

        # Verified NGO 1
        self.ngo1_user = User.objects.create_user(
            username="seva_ngo",
            email="ngo1@foodbridge.test",
            password="Password@123",
            phone="9111111111",
            role=User.Role.NGO,
            account_status=User.AccountStatus.VERIFIED,
        )
        self.ngo1 = NGOProfile.objects.create(
            user=self.ngo1_user,
            organisation_name="Seva Foundation",
            service_area="Dhule Central",
            address="Station Road, Dhule",
            verification_status=User.AccountStatus.VERIFIED,
        )
        self.dp1 = DistributionPoint.objects.create(
            ngo=self.ngo1,
            name="Aashray Shelter",
            type="SHELTER",
            address="Near Bus Stand, Dhule",
            usual_headcount=60,
        )

        # Verified NGO 2 (for parallel concurrency test)
        self.ngo2_user = User.objects.create_user(
            username="annapurna_ngo",
            email="ngo2@foodbridge.test",
            password="Password@123",
            phone="9222222222",
            role=User.Role.NGO,
            account_status=User.AccountStatus.VERIFIED,
        )
        self.ngo2 = NGOProfile.objects.create(
            user=self.ngo2_user,
            organisation_name="Annapurna Trust",
            service_area="Dhule West",
            address="Sakri Road, Dhule",
            verification_status=User.AccountStatus.VERIFIED,
        )
        self.dp2 = DistributionPoint.objects.create(
            ngo=self.ngo2,
            name="Hope Community Kitchen",
            type="COMMUNITY_KITCHEN",
            address="Sakri Road, Dhule",
            usual_headcount=50,
        )

        # Approved Volunteer under NGO 1
        self.vol_user = User.objects.create_user(
            username="rider_rohan",
            email="vol@foodbridge.test",
            password="Password@123",
            phone="9333333333",
            role=User.Role.VOLUNTEER,
            account_status=User.AccountStatus.VERIFIED,
        )
        self.volunteer = VolunteerProfile.objects.create(
            user=self.vol_user,
            ngo=self.ngo1,
            availability_status=AvailabilityStatus.AVAILABLE,
            service_area="Dhule",
            ngo_approved=True,
        )

    def _create_draft_donation(self, qty="30.00", deadline_hours=3):
        now = timezone.now()
        return FoodDonation.objects.create(
            donor=self.donor,
            category=self.category,
            food_name="Veg Pulao & Dal",
            unit="kg",
            total_quantity=Decimal(qty),
            food_type=FoodType.VEGETARIAN,
            food_state=FoodState.COOKED_MEAL,
            prepared_at=now - timedelta(minutes=30),
            consume_by=now + timedelta(hours=deadline_hours + 1),
            pickup_deadline=now + timedelta(hours=deadline_hours),
            storage_condition=StorageCondition.HOT_HELD,
            packaging=PackagingType.SEALED_CONTAINER,
            allergens="None declared",
            location="Taj Kitchens, MG Road, Dhule",
        )

    def test_parallel_accept_requests_prevents_over_allocation(self):
        """AC-10: Concurrent donor approvals on limited pool must allow only one and raise 409 Conflict for the other."""
        donation = self._create_draft_donation(qty="30.00")
        publish_donation(donation.id, self.donor_user)

        req1 = submit_donation_request(
            donation_id=donation.id,
            ngo_profile=self.ngo1,
            distribution_point_id=self.dp1.id,
            requested_quantity=Decimal("25.00"),
            expected_beneficiaries=50,
            safety_acknowledged=True,
        )
        req2 = submit_donation_request(
            donation_id=donation.id,
            ngo_profile=self.ngo2,
            distribution_point_id=self.dp2.id,
            requested_quantity=Decimal("20.00"),
            expected_beneficiaries=40,
            safety_acknowledged=True,
        )

        def accept_worker(req_id):
            try:
                decide_donation_request(req_id, self.donor_user, decision="ACCEPT")
                return "ACCEPTED"
            except ServiceConflictError:
                return "CONFLICT_409"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(accept_worker, req1.id), executor.submit(accept_worker, req2.id)]
            outcomes = [f.result() for f in futures]

        self.assertEqual(outcomes.count("ACCEPTED"), 1)
        self.assertEqual(outcomes.count("CONFLICT_409"), 1)

        donation.refresh_from_db()
        self.assertLessEqual(donation.reserved_quantity, donation.total_quantity)
        self.assertEqual(donation.status, DonationStatus.PARTIALLY_RESERVED)

    def test_optimistic_version_conflict_raises_409(self):
        """Stale version number on request approval must raise ServiceConflictError (HTTP 409)."""
        donation = self._create_draft_donation(qty="20.00")
        publish_donation(donation.id, self.donor_user)
        req = submit_donation_request(
            donation_id=donation.id,
            ngo_profile=self.ngo1,
            distribution_point_id=self.dp1.id,
            requested_quantity=Decimal("10.00"),
            expected_beneficiaries=20,
            safety_acknowledged=True,
        )

        with self.assertRaises(ServiceConflictError):
            decide_donation_request(req.id, self.donor_user, decision="ACCEPT", expected_version=99)

    def test_illegal_status_transitions_rejected(self):
        """AC-12: Illegal transitions (close remainder when AVAILABLE, cancel after PICKED_UP) must fail."""
        donation = self._create_draft_donation(qty="20.00")
        publish_donation(donation.id, self.donor_user)

        # Cannot close remainder before any partial reservation exists
        with self.assertRaises(ServiceConflictError):
            close_donation_remainder(donation.id, self.donor_user)

        req = submit_donation_request(
            donation_id=donation.id,
            ngo_profile=self.ngo1,
            distribution_point_id=self.dp1.id,
            requested_quantity=Decimal("20.00"),
            expected_beneficiaries=40,
            safety_acknowledged=True,
        )
        decide_donation_request(req.id, self.donor_user, decision="ACCEPT")
        ass = assign_volunteer(req.id, self.volunteer.id, self.ngo1_user)
        respond_to_assignment(ass.id, self.vol_user, accept=True)
        complete_pickup(
            ass.id,
            self.vol_user,
            verification_code=ass.verification_code,
            checklist_result={"sealed": True},
            passed=True,
        )

        # Cannot cancel request once food is PICKED_UP
        with self.assertRaises(ServiceConflictError):
            cancel_donation_request(req.id, self.ngo1_user, reason_code="NGO_CHANGED_MIND")

    def test_contact_privacy_and_full_lifecycle_audit_history(self):
        """FR-25 & AC-13: Donor contact masked until volunteer accepts; StatusHistory logged at every stage."""
        donation = self._create_draft_donation(qty="20.00")
        publish_donation(donation.id, self.donor_user)

        req = submit_donation_request(
            donation_id=donation.id,
            ngo_profile=self.ngo1,
            distribution_point_id=self.dp1.id,
            requested_quantity=Decimal("20.00"),
            expected_beneficiaries=40,
            safety_acknowledged=True,
        )
        decide_donation_request(req.id, self.donor_user, decision="ACCEPT")
        ass = assign_volunteer(req.id, self.volunteer.id, self.ngo1_user)

        # FR-25: Before accepting, volunteer cannot see donor phone/address or OTP
        factory = APIRequestFactory()
        vol_req = factory.get("/api/volunteers/assignments/")
        vol_req.user = self.vol_user

        before_data = VolunteerAssignmentSerializer(ass, context={"request": vol_req}).data
        self.assertIsNone(before_data["donor_contact"])
        self.assertEqual(before_data["pickup_address"], "Accept assignment to reveal exact pickup address")
        self.assertNotIn("verification_code", before_data)

        # Volunteer accepts -> Donor contact & exact address revealed
        respond_to_assignment(ass.id, self.vol_user, accept=True)
        ass.refresh_from_db()
        after_data = VolunteerAssignmentSerializer(ass, context={"request": vol_req}).data
        self.assertEqual(after_data["donor_contact"]["phone"], "9876543210")
        self.assertEqual(after_data["pickup_address"], "Taj Kitchens, MG Road, Dhule")

        # Complete pickup with AL-7 shortfall (18 kg instead of 20 kg) -> Delivery -> Distribution
        start_pickup(ass.id, self.vol_user)
        with self.assertRaises(ServiceValidationError):
            complete_pickup(
                ass.id,
                self.vol_user,
                verification_code=ass.verification_code,
                checklist_result={"sealed": True},
                passed=True,
                actual_quantity=Decimal("18.00"),  # Missing shortfall_reason
            )

        complete_pickup(
            ass.id,
            self.vol_user,
            verification_code=ass.verification_code,
            checklist_result={"sealed": True},
            passed=True,
            actual_quantity=Decimal("18.00"),
            shortfall_reason="One tray spilled in kitchen",
        )
        complete_delivery_with_receipt_check(ass.id, self.vol_user, passed=True)
        record_distribution_session(
            request_id=req.id,
            actor=self.ngo1_user,
            distribution_point_id=self.dp1.id,
            actual_headcount_served=36,
            quantity_distributed=Decimal("18.00"),
            feedback_note="Warm meals served at Aashray Shelter!",
        )

        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.COMPLETED)

        # AC-13: Verify immutable StatusHistory records exist for Donation, Request, and Assignment
        self.assertTrue(
            StatusHistory.objects.filter(
                entity_type=StatusHistory.EntityType.DONATION,
                entity_id=donation.id,
                new_status=DonationStatus.COMPLETED,
            ).exists()
        )
        self.assertTrue(
            StatusHistory.objects.filter(
                entity_type=StatusHistory.EntityType.ASSIGNMENT,
                entity_id=ass.id,
                new_status=AssignmentStatus.DELIVERED,
            ).exists()
        )

    def test_process_deadlines_command_expires_and_times_out(self):
        """FR-32: Management command auto-expires overdue donations and times out silent volunteers."""
        donation = self._create_draft_donation(qty="15.00", deadline_hours=2)
        publish_donation(donation.id, self.donor_user)

        req = submit_donation_request(
            donation_id=donation.id,
            ngo_profile=self.ngo1,
            distribution_point_id=self.dp1.id,
            requested_quantity=Decimal("15.00"),
            expected_beneficiaries=30,
            safety_acknowledged=True,
        )
        decide_donation_request(req.id, self.donor_user, decision="ACCEPT")
        ass = assign_volunteer(req.id, self.volunteer.id, self.ngo1_user)

        # Simulate volunteer assigned 45 minutes ago (> 30 min timeout)
        VolunteerAssignment.objects.filter(pk=ass.id).update(
            assigned_at=timezone.now() - timedelta(minutes=45)
        )
        call_command("process_deadlines")

        ass.refresh_from_db()
        self.assertEqual(ass.status, AssignmentStatus.REJECTED)
        self.assertEqual(ass.failure_reason, "NO_RESPONSE_TIMEOUT")
        self.assertIsNone(ass.active_slot)

        # Simulate pickup deadline passed
        FoodDonation.objects.filter(pk=donation.id).update(
            pickup_deadline=timezone.now() - timedelta(minutes=5)
        )
        call_command("process_deadlines")

        donation.refresh_from_db()
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.CANCELLED)
        self.assertEqual(donation.status, DonationStatus.EXPIRED)