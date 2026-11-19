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
} from 'lucide-react';

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* HEADER BANNER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border-b-4 border-[#f1c40f] mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-[#2c3e50] text-[#f1c40f] text-xs font-semibold px-3 py-1 rounded-full uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              {user?.role} Dashboard
            </span>

            {isVerified ? (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Account
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                Pending Admin Verification
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-[#2c3e50]">
            Welcome back, {user?.username}
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Manage your SmartFood redistribution workflow and track live meal rescue impact.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/reports"
            className="bg-slate-100 hover:bg-[#f1c40f] text-[#2c3e50] text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Impact Reports</span>
          </Link>
          <Link
            to="/profile"
            className="bg-slate-100 hover:bg-[#f1c40f] text-[#2c3e50] text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
          >
            <UserCircle className="w-4 h-4" />
            <span>Profile &amp; Settings</span>
          </Link>
        </div>
      </div>

      {/* LIVE IMPACT STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-[#2c3e50] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#666666]">
              {user?.role === 'NGO'
                ? 'Total Food Claims'
                : user?.role === 'VOLUNTEER'
                ? 'Assigned Deliveries'
                : 'Total Food Posts'}
            </p>
            <p className="text-2xl font-bold text-[#2c3e50] mt-1">
              {loadingStats ? '...' : stats.primaryCount}
            </p>
          </div>
          <Utensils className="w-8 h-8 text-[#2c3e50]/70" />
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#666666]">
              {user?.role === 'VOLUNTEER'
                ? 'Completed Drop-offs'
                : 'Completed Rescues'}
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {loadingStats ? '...' : stats.completedCount}
            </p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-600/80" />
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-[#f1c40f] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#666666]">
              {user?.role === 'VOLUNTEER'
                ? 'Verified Pickups'
                : 'Beneficiaries Fed'}
            </p>
            <p className="text-2xl font-bold text-[#2c3e50] mt-1">
              {loadingStats ? '...' : stats.mealsServed}
            </p>
          </div>
          <Users className="w-8 h-8 text-[#f1c40f]" />
        </div>
      </div>

      {/* DONOR CARDS */}
      {user?.role === 'DONOR' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/create-donation"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <PlusCircle className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">Post Surplus Food</h3>
            <p className="text-xs text-[#666666] mt-1">
              List freshly prepared surplus meals with AI summary &amp; safety details.
            </p>
          </Link>

          <Link
            to="/my-donations"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <Package className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">My Food Listings</h3>
            <p className="text-xs text-[#666666] mt-1">
              Monitor T/R/A/D quantity pools, AI priority alerts, or close remainders.
            </p>
          </Link>

          <Link
            to="/incoming-requests"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <Inbox className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">Incoming NGO Requests</h3>
            <p className="text-xs text-[#666666] mt-1">
              Accept full or partial claims and share the 6-digit pickup OTP.
            </p>
          </Link>
        </div>
      )}

      {/* NGO CARDS */}
      {user?.role === 'NGO' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/browse-donations"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <Search className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">Browse Available Food</h3>
            <p className="text-xs text-[#666666] mt-1">
              Filter live surplus meals with AI relevance match &amp; claim quantities.
            </p>
          </Link>

          <Link
            to="/my-requests"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <ClipboardList className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">
              My Requests &amp; Riders
            </h3>
            <p className="text-xs text-[#666666] mt-1">
              Assign approved NGO volunteers, verify receipt, and track OTPs.
            </p>
          </Link>

          <Link
            to="/distributions"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <HeartHandshake className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">
              Beneficiary Distributions
            </h3>
            <p className="text-xs text-[#666666] mt-1">
              Log multi-session meals served, discarded quantities &amp; donor feedback.
            </p>
          </Link>
        </div>
      )}

      {/* VOLUNTEER CARDS */}
      {user?.role === 'VOLUNTEER' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/volunteer-tasks"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <Truck className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">My Delivery Tasks</h3>
            <p className="text-xs text-[#666666] mt-1">
              Respond to assignments, verify pickup checklists &amp; 6-digit OTPs, and deliver.
            </p>
          </Link>

          <Link
            to="/profile"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <UserCircle className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">
              Availability &amp; NGO Affiliation
            </h3>
            <p className="text-xs text-[#666666] mt-1">
              Toggle AVAILABLE / BUSY / OFFLINE status and manage your NGO profile.
            </p>
          </Link>
        </div>
      )}

      {/* ADMIN CARDS */}
      {user?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/admin-panel"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <ShieldAlert className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">
              Administrator Governance Console
            </h3>
            <p className="text-xs text-[#666666] mt-1">
              Verify user accounts, resolve food safety reports, and update system timeouts.
            </p>
          </Link>

          <Link
            to="/reports"
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-b-4 border-transparent hover:border-[#f1c40f] transition"
          >
            <BarChart3 className="w-8 h-8 text-[#2c3e50] mb-3" />
            <h3 className="text-lg font-semibold text-[#2c3e50]">
              System-Wide Reports &amp; Audit Log
            </h3>
            <p className="text-xs text-[#666666] mt-1">
              Export redistribution CSVs and inspect immutable status transitions.
            </p>
          </Link>
        </div>
      )}

      {/* RECENT DISTRIBUTION LOGS (NGO) */}
      {user?.role === 'NGO' && recentDistributions.length > 0 && (
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
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
                  <p className="text-[#666666]">
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