import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/axios';
import {
  PlusCircle,
  Package,
  Inbox,
  Search,
  ClipboardList,
  Truck,
  ShieldCheck,
  Clock,
  Utensils,
  CheckCircle2,
  Users,
  HeartHandshake,
  BarChart3,
  ShieldAlert,
  UserCircle,
  ArrowRight,
  Building2,
} from 'lucide-react';

const ROLE_THEMES = {
  DONOR: {
    title: 'Donor Kitchen & Surplus Hub',
    subtitle: 'Publish surplus meals, manage NGO claims, and track zero-waste impact on FoodBridge.',
    bannerImg: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1400&q=80',
    badgeColor: 'bg-amber-400 text-[#2c3e50]',
    RoleIcon: Utensils,
  },
  NGO: {
    title: 'NGO Food Relief & Shelter Operations',
    subtitle: 'Claim verified surplus meals, assign approved riders, and log community distributions.',
    bannerImg: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1400&q=80',
    badgeColor: 'bg-emerald-400 text-[#2c3e50]',
    RoleIcon: Building2,
  },
  VOLUNTEER: {
    title: 'Volunteer Pickup & Dispatch Console',
    subtitle: 'Manage active shelter deliveries, verify 6-digit pickup OTPs, and update availability.',
    bannerImg: 'https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&w=1400&q=80',
    badgeColor: 'bg-sky-400 text-[#2c3e50]',
    RoleIcon: Truck,
  },
  ADMIN: {
    title: 'FoodBridge Governance & Audit Center',
    subtitle: 'Verify organizations, monitor hygiene compliance, and oversee platform-wide rescue logs.',
    bannerImg: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80',
    badgeColor: 'bg-[#f1c40f] text-[#2c3e50]',
    RoleIcon: ShieldAlert,
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    primaryCount: 0,
    completedCount: 0,
    mealsServed: 0,
  });
  const [recentDistributions, setRecentDistributions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const isVerified =
    user?.account_status === 'VERIFIED' || Boolean(user?.is_verified);

  const theme = ROLE_THEMES[user?.role] || ROLE_THEMES.DONOR;
  const RoleIcon = theme.RoleIcon;

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoadingStats(true);
        const [donRes, reqRes, distRes, assRes] = await Promise.allSettled([
          API.get('donations/'),
          API.get('requests/'),
          API.get('distributions/'),
          API.get('volunteers/assignments/'),
        ]);

        const extract = (res) => {
          if (res.status !== 'fulfilled') return [];
          const data = res.value.data;
          return Array.isArray(data) ? data : data?.results || [];
        };

        const donations = extract(donRes);
        const requests = extract(reqRes);
        const distributions = extract(distRes);
        const assignments = extract(assRes);

        setRecentDistributions(distributions.slice(0, 5));

        const deliveredAssignments = assignments.filter(
          (a) => a.status === 'DELIVERED'
        );
        const deliveredReqIds = new Set(
          deliveredAssignments.map((a) => a.request)
        );
        const myReqIds = new Set(requests.map((r) => r.id));

        if (user?.role === 'DONOR' || user?.role === 'ADMIN') {
          const relevantDistributions =
            user?.role === 'ADMIN'
              ? distributions
              : distributions.filter((d) => myReqIds.has(d.request));

          const completedReqs = requests.filter(
            (r) =>
              ['COMPLETED', 'FULFILLED', 'DISTRIBUTED'].includes(r.status) ||
              ['COMPLETED', 'FULFILLED', 'DISTRIBUTED'].includes(
                r.donation_status
              ) ||
              deliveredReqIds.has(r.id)
          );
          const completedDonations = donations.filter((d) =>
            ['COMPLETED', 'FULFILLED', 'DISTRIBUTED'].includes(d.status)
          );
          const completedTotal = Math.max(
            completedReqs.length,
            relevantDistributions.length,
            completedDonations.length
          );
          const totalMeals =
            relevantDistributions.length > 0
              ? relevantDistributions.reduce(
                  (sum, d) => sum + Number(d.actual_headcount_served || 0),
                  0
                )
              : completedReqs.reduce(
                  (sum, r) =>
                    sum +
                    Number(
                      r.expected_beneficiaries ||
                        r.accepted_quantity ||
                        r.approved_quantity ||
                        r.requested_quantity ||
                        0
                    ),
                  0
                );
          setStats({
            primaryCount: donations.length,
            completedCount: completedTotal,
            mealsServed: totalMeals,
          });
        } else if (user?.role === 'NGO') {
          const completedReqs = requests.filter(
            (r) =>
              ['COMPLETED', 'FULFILLED', 'DISTRIBUTED'].includes(r.status) ||
              ['COMPLETED', 'FULFILLED', 'DISTRIBUTED'].includes(
                r.donation_status
              ) ||
              deliveredReqIds.has(r.id)
          );
          const completedTotal = Math.max(
            completedReqs.length,
            distributions.length,
            deliveredAssignments.length
          );
          const totalMeals =
            distributions.length > 0
              ? distributions.reduce(
                  (sum, d) => sum + Number(d.actual_headcount_served || 0),
                  0
                )
              : completedReqs.reduce(
                  (sum, r) => sum + Number(r.expected_beneficiaries || 0),
                  0
                );
          setStats({
            primaryCount: requests.length,
            completedCount: completedTotal,
            mealsServed: totalMeals,
          });
        } else if (user?.role === 'VOLUNTEER') {
          const verifiedPickups = assignments.filter((a) =>
            ['PICKED_UP', 'DELIVERED'].includes(a.status)
          ).length;
          setStats({
            primaryCount: assignments.length,
            completedCount: deliveredAssignments.length,
            mealsServed: verifiedPickups,
          });
        }
      } catch (err) {
        console.warn('Dashboard stats load warning:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const orgTitle =
    user?.donor_profile?.organisation_name ||
    user?.ngo_profile?.organisation_name ||
    user?.username;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* VISUAL ROLE BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src={theme.bannerImg}
          alt={theme.title}
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${theme.badgeColor}`}
              >
                <RoleIcon className="w-3.5 h-3.5" />
                {user?.role} Portal
              </span>

              {isVerified ? (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold px-3 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  Verified Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold px-3 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  Pending Admin Verification
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Welcome back, {orgTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {theme.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            <Link
              to="/reports"
              className="bg-white/15 hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] border border-white/25 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Impact Reports</span>
            </Link>
            <Link
              to="/profile"
              className="bg-[#f1c40f] hover:bg-white text-[#2c3e50] text-xs font-bold px-4 py-2.5 rounded-xl shadow flex items-center gap-2 transition"
            >
              <UserCircle className="w-4 h-4" />
              <span>Profile &amp; Settings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* LIVE IMPACT STATS WITH GRADIENT ICON BADGES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {user?.role === 'NGO'
                ? 'Total Food Claims'
                : user?.role === 'VOLUNTEER'
                ? 'Assigned Deliveries'
                : 'Total Food Posts'}
            </p>
            <p className="text-3xl font-bold text-[#2c3e50] mt-1.5">
              {loadingStats ? '...' : stats.primaryCount}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#2c3e50] flex items-center justify-center">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {user?.role === 'VOLUNTEER'
                ? 'Completed Drop-offs'
                : 'Completed Rescues'}
            </p>
            <p className="text-3xl font-bold text-emerald-700 mt-1.5">
              {loadingStats ? '...' : stats.completedCount}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {user?.role === 'VOLUNTEER'
                ? 'Verified Pickups'
                : 'Beneficiaries Fed'}
            </p>
            <p className="text-3xl font-bold text-amber-600 mt-1.5">
              {loadingStats ? '...' : stats.mealsServed}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* DONOR CARDS */}
      {user?.role === 'DONOR' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/create-donation"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-100 to-amber-200 text-amber-700 flex items-center justify-center mb-4">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">Post Surplus Food</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                List freshly prepared surplus meals with AI summary &amp; safety details.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-amber-600 inline-flex items-center gap-1">
              Create Listing <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/my-donations"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-sky-100 to-sky-200 text-sky-700 flex items-center justify-center mb-4">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">My Food Listings</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Monitor T/R/A/D quantity pools, AI priority alerts, or close remainders.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-sky-600 inline-flex items-center gap-1">
              Manage Listings <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/incoming-requests"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center mb-4">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">Incoming NGO Requests</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Accept full or partial claims and share the 6-digit pickup OTP.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-emerald-600 inline-flex items-center gap-1">
              Review Claims <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      )}

      {/* NGO CARDS */}
      {user?.role === 'NGO' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/browse-donations"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-100 to-amber-200 text-amber-700 flex items-center justify-center mb-4">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">Browse Available Food</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Filter live surplus meals with AI relevance match &amp; claim quantities.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-amber-600 inline-flex items-center gap-1">
              Find Meals <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/my-requests"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-sky-100 to-sky-200 text-sky-700 flex items-center justify-center mb-4">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">
                My Requests &amp; Riders
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Assign approved NGO volunteers, verify receipt, and track OTPs.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-sky-600 inline-flex items-center gap-1">
              Dispatch Riders <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/distributions"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center mb-4">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">
                Beneficiary Distributions
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Log multi-session meals served, discarded quantities &amp; donor feedback.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-emerald-600 inline-flex items-center gap-1">
              Open Logs <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      )}

      {/* VOLUNTEER CARDS */}
      {user?.role === 'VOLUNTEER' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/volunteer-tasks"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-sky-100 to-sky-200 text-sky-700 flex items-center justify-center mb-4">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">My Delivery Tasks</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Respond to assignments, verify pickup checklists &amp; 6-digit OTPs, and deliver.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-sky-600 inline-flex items-center gap-1">
              View Active Tasks <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/profile"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center mb-4">
                <UserCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">
                Availability &amp; NGO Affiliation
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Toggle AVAILABLE / BUSY / OFFLINE status and manage your NGO profile.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-emerald-600 inline-flex items-center gap-1">
              Update Status <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      )}

      {/* ADMIN CARDS */}
      {user?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/admin-panel"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-100 to-amber-200 text-amber-700 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">
                Administrator Governance Console
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Verify user accounts, resolve food safety reports, and update system timeouts.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-amber-600 inline-flex items-center gap-1">
              Open Console <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/reports"
            className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition group flex flex-col justify-between gap-4"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-100 to-indigo-200 text-indigo-700 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2c3e50]">
                System-Wide Reports &amp; Audit Log
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Export redistribution CSVs and inspect immutable status transitions.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2c3e50] group-hover:text-indigo-600 inline-flex items-center gap-1">
              View Audit Logs <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      )}

      {/* RECENT DISTRIBUTION LOGS (NGO) */}
      {user?.role === 'NGO' && recentDistributions.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-base font-bold text-[#2c3e50] mb-3">
            Recent Beneficiary Distribution Logs
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {recentDistributions.map((dist) => (
              <div
                key={dist.id}
                className="py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-[#2c3e50]">
                    {dist.notes || `Distribution Record #${dist.id}`}
                  </p>
                  <p className="text-slate-500">
                    Quantity Distributed: <strong>{dist.quantity_distributed}</strong> •
                    People Fed: <strong>{dist.actual_headcount_served}</strong>
                  </p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full">
                  VERIFIED LOG
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}