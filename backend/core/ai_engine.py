from decimal import Decimal
from django.utils import timezone
from core.models import AIRecommendationLog, SystemConfiguration


def _get_thresholds():
    cfg = SystemConfiguration.objects.first()
    if not cfg:
        return 2, 6
    return cfg.high_priority_hours_threshold, cfg.medium_priority_hours_threshold


def compute_donation_priority(donation, log_result=False):
    """SRS Section 11.3: Advisory operational priority suggestion (High / Medium / Low)."""
    now = timezone.now()
    high_hrs, med_hrs = _get_thresholds()
    hours_left = (donation.pickup_deadline - now).total_seconds() / 3600.0

    has_pending = donation.requests.filter(status='PENDING').exists()
    has_unassigned_accepted = donation.requests.filter(
        status__in=['ACCEPTED', 'PARTIALLY_ACCEPTED'],
        assignments__isnull=True,
    ).exists()

    if hours_left <= 0:
        level = 'HIGH'
        reason = 'Pickup deadline has passed or is expiring immediately'
    elif hours_left < high_hrs and (
        Decimal(str(donation.reserved_quantity)) == Decimal('0.00') or has_unassigned_accepted
    ):
        level = 'HIGH'
        reason = f'Less than {high_hrs}h to pickup deadline and volunteer/allocation is pending'
    elif hours_left < med_hrs or has_pending:
        level = 'MEDIUM'
        reason = (
            'Requests are waiting for donor decision'
            if has_pending
            else f'Less than {med_hrs}h remaining before pickup deadline'
        )
    else:
        level = 'LOW'
        reason = 'Enough time remaining before pickup deadline'

    result = {
        'donation_id': donation.id,
        'priority_level': level,
        'hours_to_deadline': round(max(0.0, hours_left), 2),
        'reason': reason,
        'advisory_note': 'Operational reminder only; not a food-safety assessment.',
    }

    if log_result:
        AIRecommendationLog.objects.create(
            feature_type=AIRecommendationLog.FeatureType.PRIORITY,
            related_record_id=donation.id,
            input_summary={'hours_left': result['hours_to_deadline'], 'status': donation.status},
            output_summary=result,
        )
    return result


def score_donation_for_ngo(donation, ngo_profile, preferred_category_id=None, desired_qty=None, distribution_point=None):
    """SRS Section 11.1: Transparent rule-based matching score (0–100) with explainable reasons."""
    score = 0
    reasons = []
    now = timezone.now()

    cat_diet_pts = 0
    if preferred_category_id and str(donation.category_id) == str(preferred_category_id):
        cat_diet_pts += 15
        reasons.append("Matches your preferred category")
    dp_diet = (distribution_point.dietary_notes or '').lower() if distribution_point else ''
    if not dp_diet or donation.food_type.lower() in dp_diet or (
        'veg' in dp_diet and donation.food_type in ('VEGETARIAN', 'VEGAN')
    ):
        cat_diet_pts += 15
        reasons.append(f"Compatible with {donation.get_food_type_display()} diet")
    score += cat_diet_pts

    avail = Decimal(str(donation.available_quantity))
    target_qty = Decimal(str(desired_qty)) if desired_qty else (
        Decimal(str(distribution_point.usual_headcount))
        if distribution_point and distribution_point.usual_headcount > 0
        else avail
    )
    if target_qty > 0 and avail > 0:
        ratio = float(min(avail, target_qty) / max(avail, target_qty))
        qty_pts = round(25 * ratio)
        score += qty_pts
        if qty_pts >= 18:
            reasons.append(f"Available quantity ({avail} {donation.unit}) suits your need")

    hours_left = (donation.pickup_deadline - now).total_seconds() / 3600.0
    if hours_left >= 3:
        score += 20
        reasons.append("Comfortable pickup window available")
    elif hours_left >= 1:
        score += 12
        reasons.append("Pickup window fits urgent collection")
    elif hours_left > 0:
        score += 5

    ngo_area = (ngo_profile.service_area or '').lower().strip()
    don_loc = (donation.location or '').lower().strip()
    if ngo_area and don_loc and (ngo_area in don_loc or don_loc in ngo_area):
        score += 15
        reasons.append("In your NGO service area")

    if distribution_point and distribution_point.usual_headcount > 0:
        score += 10
        reasons.append(f"Suitable for about {distribution_point.usual_headcount} people")
    else:
        score += 5

    return {
        'score': min(100, score),
        'reasons': reasons or ["Available from verified donor"],
        'advisory_note': 'Advisory match score only; verify allergens and storage before requesting.',
    }


def generate_listing_description(data):
    """SRS Section 11.2: Deterministic template description helper."""
    food_name = data.get('food_name') or 'Surplus Food'
    food_type = data.get('food_type', '').replace('_', ' ').title()
    food_state = data.get('food_state', '').replace('_', ' ').title()
    qty = data.get('total_quantity') or ''
    unit = data.get('unit') or ''
    storage = data.get('storage_condition', '').replace('_', ' ').title()
    packaging = data.get('packaging', '').replace('_', ' ').title()
    allergens = data.get('allergens') or 'Unknown'
    notes = (data.get('ingredients_notes') or '').strip()

    parts = [
        f"Freshly listed {food_type} ({food_state}): {food_name} — {qty} {unit} available for community redistribution.".strip(),
        f"Stored under {storage} conditions in {packaging} packaging." if storage and packaging else "",
        f"Declared allergens: {allergens}.",
        f"Handling notes: {notes}" if notes else "",
    ]
    suggested = " ".join(p for p in parts if p)

    log = AIRecommendationLog.objects.create(
        feature_type=AIRecommendationLog.FeatureType.DESCRIPTION,
        input_summary={'food_name': food_name, 'food_type': food_type, 'qty': str(qty)},
        output_summary={'suggested_description': suggested},
    )
    return {
        'log_id': log.id,
        'suggested_description': suggested,
        'advisory_note': 'Review and edit before publishing.',
    }