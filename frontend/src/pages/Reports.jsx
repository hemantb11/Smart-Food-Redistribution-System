import { useState, useEffect } from 'react';
import API from '../services/axios';
import {
  BarChart3,
  Download,
  History,
  Filter,
  RotateCcw,
  Package,
  Utensils,
  Users,
  TrendingUp,
  ArrowRight,
  FileSpreadsheet,
  ShieldCheck,
  Clock,
} from 'lucide-react';

const getStatusBadgeStyle = (status) => {
  const st = (status || '').toUpperCase();
  if (['COMPLETED', 'DELIVERED', 'VERIFIED', 'APPROVED', 'ACCEPTED'].includes(st)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['AVAILABLE', 'PUBLISHED', 'PICKED_UP', 'ASSIGNED'].includes(st)) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  if (['PARTIALLY_RESERVED', 'PARTIALLY_ACCEPTED', 'PENDING'].includes(st)) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (['WITHDRAWN', 'EXPIRED', 'REJECTED', 'CANCELLED'].includes(st)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function Reports() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', status: '' });

  const fetchReports = async (activeFilters = filters) => {
    try {
      setLoading(true);
      const params = {};
      if (activeFilters.date_from) params.date_from = activeFilters.date_from;
      if (activeFilters.date_to) params.date_to = activeFilters.date_to;
      if (activeFilters.status) params.status = activeFilters.status;

      const [repRes, histRes] = await Promise.all([
        API.get('core/reports/', { params }),
        API.get('core/status-history/'),
      ]);
      setReport(repRes.data);
      setHistory(Array.isArray(histRes.data) ? histRes.data : histRes.data?.results || []);
    } catch {
      // keep previous state on network warning
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResetFilters = () => {
    const empty = { date_from: '', date_to: '', status: '' };
    setFilters(empty);
    fetchReports(empty);
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await API.get('core/reports/export-csv/', {
        params: filters,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'foodbridge_impact_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore export network error
    } finally {
      setExporting(false);
    }
  };

  const s = report?.summary || {};
  const sharePercent = Math.min(100, Math.max(0, Number(s.share_distributed_percent ?? 0)));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* PROFESSIONAL HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1400&q=80"
          alt="FoodBridge Impact & Compliance Analytics"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              Compliance &amp; Impact Analytics
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              Impact Reports &amp; Status Audit Log
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Real-time FoodBridge redistribution metrics, downloadable CSV records, and an
              immutable chain-of-custody transition trail.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="bg-[#f1c40f] hover:bg-white text-[#2c3e50] px-5 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition hover:-translate-y-0.5 cursor-pointer shrink-0 self-start md:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Exporting CSV...' : 'Export Impact CSV'}</span>
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          <Filter className="w-3.5 h-3.5 text-amber-500" />
          <span>Filter Redistribution Metrics</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Donation Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
            >
              <option value="">All Statuses</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="PARTIALLY_RESERVED">PARTIALLY_RESERVED</option>
              <option value="FULLY_RESERVED">FULLY_RESERVED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="WITHDRAWN">WITHDRAWN</option>
            </select>
          </div>

          <button
            onClick={() => fetchReports(filters)}
            className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>

          <button
            type="button"
            onClick={handleResetFilters}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Listings
            </p>
            <p className="text-3xl font-bold text-[#2c3e50] mt-1.5">
              {loading ? '...' : s.total_listings ?? 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Published surplus batches</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#2c3e50] flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Qty Redistributed
            </p>
            <p className="text-3xl font-bold text-emerald-700 mt-1.5">
              {loading ? '...' : s.total_quantity_redistributed ?? '0.00'}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Units rescued safely</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Beneficiaries Served
            </p>
            <p className="text-3xl font-bold text-[#2c3e50] mt-1.5">
              {loading ? '...' : s.beneficiaries_served_estimate ?? 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Estimated community meals</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Share Distributed
              </p>
              <p className="text-3xl font-bold text-amber-600 mt-1.5">
                {loading ? '...' : `${s.share_distributed_percent ?? 0}%`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-linear-to-r from-[#f1c40f] to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${sharePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* IMMUTABLE STATUS HISTORY AUDIT TRAIL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2c3e50]">
                Recent Status Transition Audit Trail
              </h2>
              <p className="text-xs text-slate-500">
                Chronological ledger of food listings, NGO claims, OTP pickups, and shelter deliveries.
              </p>
            </div>
          </div>

          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full">
            Showing {Math.min(25, history.length)} of {history.length} events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4 font-bold">Timestamp</th>
                <th className="py-3.5 px-4 font-bold">Entity</th>
                <th className="py-3.5 px-4 font-bold">Status Transition</th>
                <th className="py-3.5 px-4 font-bold">Actor</th>
                <th className="py-3.5 px-4 font-bold">Reason / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    No status transitions recorded yet.
                  </td>
                </tr>
              ) : (
                history.slice(0, 25).map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(h.changed_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-[#2c3e50] bg-slate-100 px-2.5 py-1 rounded-md">
                        {h.entity_type} #{h.entity_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                          {h.old_status || 'NEW'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-bold border ${getStatusBadgeStyle(
                            h.new_status
                          )}`}
                        >
                          {h.new_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                      {h.actor_label}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {h.reason_code || h.remarks || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}