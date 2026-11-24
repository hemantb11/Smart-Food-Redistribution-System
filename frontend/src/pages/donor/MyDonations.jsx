import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../services/axios';
import {
  PlusCircle,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  Lock,
  Flame,
  Utensils,
} from 'lucide-react';

export default function MyDonations() {
  const [donations, setDonations] = useState([]);
  const [priorities, setPriorities] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const fetchDonations = async () => {
    try {
      setLoading(true);
      const [donRes, prioRes] = await Promise.all([
        API.get('donations/'),
        API.get('core/ai/priority/').catch(() => ({ data: { suggestions: [] } })),
      ]);
      setDonations(Array.isArray(donRes.data) ? donRes.data : donRes.data.results || []);
      const prioMap = {};
      (prioRes.data?.suggestions || []).forEach((p) => {
        prioMap[p.donation_id] = p;
      });
      setPriorities(prioMap);
    } catch {
      setError('Failed to load donations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  const handlePublish = async (id) => {
    setError('');
    try {
      await API.post(`donations/${id}/publish/`, { donor_declaration: true });
      setActionMsg('Donation published & now AVAILABLE to NGOs!');
      fetchDonations();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish donation.');
      if (err.response?.status === 409) fetchDonations();
    }
  };

  const handleCloseRemainder = async (item) => {
    if (!window.confirm('Close remaining unreserved quantity and mark listing FULLY_RESERVED?'))
      return;
    setError('');
    try {
      await API.post(`donations/${item.id}/close-remainder/`, { version: item.version });
      setActionMsg('Remainder closed — listing is now FULLY_RESERVED.');
      fetchDonations();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not close remainder.');
      if (err.response?.status === 409) fetchDonations();
    }
  };

  const handleWithdraw = async (item) => {
    if (!window.confirm('Are you sure you want to withdraw this food listing?')) return;
    setError('');
    try {
      await API.post(`donations/${item.id}/withdraw/`, {
        version: item.version,
        reason_code: 'DONOR_WITHDREW',
      });
      setActionMsg('Donation withdrawn.');
      fetchDonations();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to withdraw donation.');
      if (err.response?.status === 409) fetchDonations();
    }
  };

  const statusBadge = (status) => {
    const map = {
      DRAFT: 'bg-slate-100 text-slate-700',
      AVAILABLE: 'bg-emerald-100 text-emerald-800',
      PARTIALLY_RESERVED: 'bg-amber-100 text-amber-800',
      FULLY_RESERVED: 'bg-sky-100 text-sky-800',
      COMPLETED: 'bg-indigo-100 text-indigo-800',
      WITHDRAWN: 'bg-rose-100 text-rose-700',
      EXPIRED: 'bg-rose-100 text-rose-700',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  const priorityBadge = (level) => {
    if (level === 'HIGH') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (level === 'MEDIUM') return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80"
          alt="My Food Listings"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              <Utensils className="w-3.5 h-3.5" />
              Donor Inventory Pool
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">My Food Listings</h1>
            <p className="text-xs sm:text-sm text-slate-200">
              Monitor T/R/A quantity pools, AI deadline priority alerts, and incoming NGO claims.
            </p>
          </div>

          <Link
            to="/create-donation"
            className="bg-[#f1c40f] hover:bg-white text-[#2c3e50] text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post New Food</span>
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading your donations...</p>
      ) : donations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <Package className="w-11 h-11 text-[#2c3e50] mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-[#2c3e50]">No Food Listings Yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Start by posting surplus meals for verified local NGOs.
          </p>
          <Link
            to="/create-donation"
            className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-bold px-6 py-2.5 rounded-xl transition"
          >
            Create First Listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {donations.map((item) => {
            const prio = priorities[item.id];
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 border-b-4 border-b-[#f1c40f] flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold text-[#2c3e50]">{item.food_name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {/* AI Priority Badge */}
                  {prio && (
                    <div
                      className={`mb-3.5 px-3 py-2 rounded-xl border text-[11px] flex items-center gap-1.5 ${priorityBadge(
                        prio.priority_level
                      )}`}
                    >
                      <Flame className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        <strong>{prio.priority_level} Priority:</strong> {prio.reason}
                      </span>
                    </div>
                  )}

                  {/* T / R / A / D Quantity Pool */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-3 rounded-xl text-center mb-3.5 border border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Total
                      </p>
                      <p className="text-xs font-bold text-[#2c3e50] mt-0.5">
                        {item.total_quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Reserved
                      </p>
                      <p className="text-xs font-bold text-amber-600 mt-0.5">
                        {item.reserved_quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Avail
                      </p>
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        {item.available_quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Dist
                      </p>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5">
                        {item.distributed_quantity}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#2c3e50] shrink-0" />
                      <span>{item.location}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#2c3e50] shrink-0" />
                      <span>Pickup by: {new Date(item.pickup_deadline).toLocaleString()}</span>
                    </p>
                    {item.pending_requests_count > 0 && (
                      <Link
                        to="/incoming-requests"
                        className="inline-block mt-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full hover:bg-amber-200 transition"
                      >
                        {item.pending_requests_count} Pending NGO Request(s) →
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {item.status === 'DRAFT' && (
                    <button
                      onClick={() => handlePublish(item.id)}
                      className="flex-1 bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish Live</span>
                    </button>
                  )}

                  {item.status === 'PARTIALLY_RESERVED' && (
                    <button
                      onClick={() => handleCloseRemainder(item)}
                      className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Close Remainder</span>
                    </button>
                  )}

                  {['DRAFT', 'AVAILABLE'].includes(item.status) &&
                    Number(item.reserved_quantity) === 0 && (
                      <button
                        onClick={() => handleWithdraw(item)}
                        className="flex-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Withdraw</span>
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}