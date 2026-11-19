import csv
from decimal import Decimal
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from accounts.models import DonorProfile, DistributionPoint
from donations.models import FoodDonation, DonationStatus
from donations.serializers import FoodDonationSerializer
from distributions.models import DistributionRecord
from safety.models import SafetyReport
from core.permissions import IsAdminRole, IsNGO, IsVerified
from core.ai_engine import (
    compute_donation_priority,
    score_donation_for_ngo,
    generate_listing_description,
)
from .models import StatusHistory, AIRecommendationLog, SystemConfiguration
from .serializers import (
    StatusHistorySerializer,
    SystemConfigurationSerializer,
)


class StatusHistoryListView(generics.ListAPIView):
    serializer_class = StatusHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = StatusHistory.objects.all().order_by('-changed_at')
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        if entity_type:
            qs = qs.filter(entity_type=entity_type.upper())
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs[:200]


class SystemConfigurationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        cfg = SystemConfiguration.objects.first() or SystemConfiguration.objects.create()
        return Response(SystemConfigurationSerializer(cfg).data)

    def put(self, request):
        cfg = SystemConfiguration.objects.first() or SystemConfiguration.objects.create()
        serializer = SystemConfigurationSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class FilteredReportsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _filtered_querysets(self, request):
        user = request.user
        donations = FoodDonation.objects.select_related('donor', 'category').all()
        distributions = DistributionRecord.objects.select_related(
            'request__donation__donor', 'request__donation__category', 'ngo', 'distribution_point'
        ).all()

        if user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            donations = donations.filter(donor=user.donor_profile)
            distributions = distributions.filter(request__donation__donor=user.donor_profile)
        elif user.role == 'NGO' and hasattr(user, 'ngo_profile'):
            donations = donations.filter(requests__ngo=user.ngo_profile).distinct()
            distributions = distributions.filter(ngo=user.ngo_profile)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        donor_id = request.query_params.get('donor')
        ngo_id = request.query_params.get('ngo')
        category_id = request.query_params.get('category')
        status_filter = request.query_params.get('status')

        if date_from:
            donations = donations.filter(created_at__date__gte=date_from)
            distributions = distributions.filter(distributed_at__date__gte=date_from)
        if date_to:
            donations = donations.filter(created_at__date__lte=date_to)
            distributions = distributions.filter(distributed_at__date__lte=date_to)
        if donor_id:
            donations = donations.filter(donor_id=donor_id)
            distributions = distributions.filter(request__donation__donor_id=donor_id)
        if ngo_id:
            distributions = distributions.filter(ngo_id=ngo_id)
        if category_id:
            donations = donations.filter(category_id=category_id)
            distributions = distributions.filter(request__donation__category_id=category_id)
        if status_filter:
            donations = donations.filter(status=status_filter.upper())

        return donations, distributions

    def get(self, request):
        donations, distributions = self._filtered_querysets(request)

        total_listed = donations.aggregate(s=Sum('total_quantity'))['s'] or Decimal('0.00')
        dist_agg = distributions.aggregate(
            distributed=Sum('quantity_distributed'),
            discarded=Sum('discarded_quantity'),
            beneficiaries=Sum('actual_headcount_served'),
        )
        total_distributed = dist_agg['distributed'] or Decimal('0.00')
        total_discarded = dist_agg['discarded'] or Decimal('0.00')
        total_beneficiaries = dist_agg['beneficiaries'] or 0
        completed_donations = donations.filter(status=DonationStatus.COMPLETED).count()

        share_distributed_pct = (
            round(float(total_distributed / total_listed * 100), 1)
            if total_listed > 0
            else 0.0
        )

        flagged_donors = list(
            DonorProfile.objects.annotate(
                safety_rejections=Count(
                    'donations__requests__assignments',
                    filter=Q(
                        donations__requests__assignments__failure_reason__in=[
                            'FOOD_REJECTED_AT_PICKUP',
                            'FOOD_REJECTED_AT_DELIVERY',
                        ]
                    ),
                )
            )
            .filter(safety_rejections__gte=1)
            .values('id', 'organisation_name', 'safety_rejections')
        )

        return Response({
            'summary': {
                'total_listings': donations.count(),
                'completed_donations': completed_donations,
                'total_quantity_listed': str(total_listed),
                'total_quantity_redistributed': str(total_distributed),
                'total_quantity_discarded': str(total_discarded),
                'beneficiaries_served_estimate': total_beneficiaries,
                'share_distributed_percent': share_distributed_pct,
                'open_safety_reports': SafetyReport.objects.filter(is_resolved=False).count(),
            },
            'flagged_donors': flagged_donors,
            'donations': FoodDonationSerializer(donations[:50], many=True).data,
        })


class ExportReportsCSVView(FilteredReportsView):
    def get(self, request):
        _, distributions = self._filtered_querysets(request)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="smartfood_impact_report.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Record ID', 'Date', 'Donor', 'Food Item', 'Category',
            'NGO', 'Distribution Point', 'Quantity Distributed',
            'Quantity Discarded', 'Discard Reason', 'Beneficiaries Served (Est.)'
        ])
        for rec in distributions:
            writer.writerow([
                rec.id,
                rec.distributed_at.strftime('%Y-%m-%d %H:%M'),
                rec.request.donation.donor.organisation_name,
                rec.request.donation.food_name,
                rec.request.donation.category.category_name,
                rec.ngo.organisation_name,
                rec.distribution_point.name,
                rec.quantity_distributed,
                rec.discarded_quantity,
                rec.discard_reason or '',
                rec.actual_headcount_served,
            ])
        return response


class AIMatchingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNGO, IsVerified]

    def get(self, request):
        ngo = request.user.ngo_profile
        preferred_cat = request.query_params.get('category')
        desired_qty = request.query_params.get('quantity')
        dp_id = request.query_params.get('distribution_point')
        dp = DistributionPoint.objects.filter(pk=dp_id, ngo=ngo).first() if dp_id else None

        active_donations = FoodDonation.objects.select_related('donor', 'category').filter(
            status__in=[DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_RESERVED],
            donor__verification_status='VERIFIED',
            pickup_deadline__gt=timezone.now(),
        )

        ranked = []
        for don in active_donations:
            match_info = score_donation_for_ngo(
                don,
                ngo,
                preferred_category_id=preferred_cat,
                desired_qty=desired_qty,
                distribution_point=dp,
            )
            priority_info = compute_donation_priority(don, log_result=False)
            item = FoodDonationSerializer(don).data
            item['ai_match'] = match_info
            item['ai_priority'] = priority_info
            ranked.append(item)

        ranked.sort(key=lambda x: x['ai_match']['score'], reverse=True)

        log = AIRecommendationLog.objects.create(
            feature_type=AIRecommendationLog.FeatureType.MATCHING,
            related_record_id=ngo.id,
            input_summary={'ngo_id': ngo.id, 'category': preferred_cat, 'quantity': desired_qty},
            output_summary={'count': len(ranked)},
        )
        return Response({'log_id': log.id, 'results': ranked})


class AIDescriptionGeneratorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response(generate_listing_description(request.data))


class AIDonationPriorityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = FoodDonation.objects.filter(
            status__in=[DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_RESERVED, DonationStatus.FULLY_RESERVED]
        )
        if user.role == 'DONOR' and hasattr(user, 'donor_profile'):
            qs = qs.filter(donor=user.donor_profile)

        suggestions = [compute_donation_priority(d, log_result=False) for d in qs]
        return Response({'suggestions': suggestions})


class AILogActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, log_id):
        action = str(request.data.get('user_action', 'ACCEPTED')).upper()
        AIRecommendationLog.objects.filter(pk=log_id).update(user_action=action)
        return Response({'message': 'AI action logged.'})


class RunDeadlineSchedulerView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        from django.core.management import call_command
        call_command('process_deadlines')
        return Response({'message': 'Deadline & timeout scheduler executed successfully.'})