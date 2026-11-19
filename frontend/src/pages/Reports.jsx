import { useState, useEffect } from 'react';
import API from '../services/axios';
import { BarChart3, Download, History } from 'lucide-react';

export default function Reports() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', status: '' });

  const fetchReports = async () => {
    try {
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.status) params.status = filters.status;

      const [repRes, histRes] = await Promise.all([
        API.get('core/reports/', { params }),
        API.get('core/status-history/'),
      ]);
      setReport(repRes.data);
      setHistory(histRes.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportCSV = async () => {
    try {
      const res = await API.get('core/reports/export-csv/', {
        params: filters,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'smartfood_impact_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {}
  };

  const s = report?.summary || {};

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2c3e50] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#f1c40f]" /> Impact Reports & Status Audit Log
          </h1>
          <p className="text-sm text-gray-500">
            Count-based food redistribution metrics, CSV export, and immutable transition logs.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="bg-[#2c3e50] text-[#f1c40f] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#1a252f] cursor-pointer"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Donation Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white"
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
          onClick={fetchReports}
          className="bg-[#f1c40f] text-[#2c3e50] font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer"
        >
          Apply Filters
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500">Total Listings</p>
          <p className="text-2xl font-bold text-[#2c3e50] mt-1">{s.total_listings ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500">Qty Redistributed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{s.total_quantity_redistributed ?? '0.00'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500">Beneficiaries Served (Est.)</p>
          <p className="text-2xl font-bold text-[#2c3e50] mt-1">{s.beneficiaries_served_estimate ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500">Share Distributed</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{s.share_distributed_percent ?? 0}%</p>
        </div>
      </div>

      {/* Status History Audit Trail */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-semibold text-[#2c3e50] flex items-center gap-2">
          <History className="w-5 h-5 text-[#f1c40f]" /> Recent Status Transition Audit Trail
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Transition</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Reason / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.slice(0, 25).map((h) => (
                <tr key={h.id}>
                  <td className="p-3 text-gray-500">{new Date(h.changed_at).toLocaleString()}</td>
                  <td className="p-3 font-semibold text-[#2c3e50]">{h.entity_type} #{h.entity_id}</td>
                  <td className="p-3">
                    <span className="text-gray-400">{h.old_status || 'NEW'}</span> →{' '}
                    <span className="font-semibold text-emerald-700">{h.new_status}</span>
                  </td>
                  <td className="p-3">{h.actor_label}</td>
                  <td className="p-3 text-gray-600">{h.reason_code || h.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}