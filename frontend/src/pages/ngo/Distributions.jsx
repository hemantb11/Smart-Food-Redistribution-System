import { useState, useEffect } from 'react';
import API from '../../services/axios';
import {
  HeartHandshake,
  CheckCircle,
  ClipboardList,
  AlertCircle,
  Save,
} from 'lucide-react';

export default function Distributions() {
  const [requests, setRequests] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    request: '',
    actual_headcount_served: '',
    quantity_distributed: '',
    discarded_quantity: '0.00',
    discard_reason: '',
    notes: '',
    feedback_note: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadData = async () => {
    try {
      const [reqRes, distRes] = await Promise.all([
        API.get('requests/'),
        API.get('distributions/'),
      ]);
      const accepted = (reqRes.data || []).filter((r) =>
        ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(r.status)
      );
      setRequests(accepted);
      setRecords(distRes.data || []);
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await API.post('distributions/', form);
      setMsg('Beneficiary distribution session recorded and donor impact updated.');
      setForm({
        request: '',
        actual_headcount_served: '',
        quantity_distributed: '',
        discarded_quantity: '0.00',
        discard_reason: '',
        notes: '',
        feedback_note: '',
      });
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (error) {
      setErr(
        error.response?.data?.error ||
          JSON.stringify(error.response?.data) ||
          'Failed to record distribution.'
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80"
          alt="Beneficiary Distributions"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            <HeartHandshake className="w-3.5 h-3.5" />
            Shelter Impact Accounting
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Beneficiary Distribution Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
            Record community meals served, log any discarded quantity, and send an impact note to the donor.
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2c3e50]">Record Distribution Session</h2>
            <p className="text-xs text-slate-500">
              Account for every portion delivered to shelter residents.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Delivered Request *
            </label>
            <select
              required
              value={form.request}
              onChange={(e) => setForm({ ...form, request: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
            >
              <option value="">-- Select Delivered Food Request --</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} — {r.food_name} ({r.accepted_quantity} {r.donation_unit} •{' '}
                  {r.distribution_point_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Beneficiaries Served (Headcount) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={form.actual_headcount_served}
              onChange={(e) => setForm({ ...form, actual_headcount_served: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Quantity Distributed *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.quantity_distributed}
              onChange={(e) => setForm({ ...form, quantity_distributed: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Discarded Quantity (if any)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.discarded_quantity}
              onChange={(e) => setForm({ ...form, discarded_quantity: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          {Number(form.discarded_quantity) > 0 && (
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1.5">
                Discard Reason (Mandatory) *
              </label>
              <input
                required
                placeholder="e.g., Passed consume-by window before final serving"
                value={form.discard_reason}
                onChange={(e) => setForm({ ...form, discard_reason: e.target.value })}
                className="w-full bg-rose-50/40 border border-rose-300 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Session Notes
            </label>
            <input
              placeholder="Distribution notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Thank-You / Feedback Note for Donor
            </label>
            <input
              placeholder="e.g., Served hot dinner to 85 shelter residents!"
              value={form.feedback_note}
              onChange={(e) => setForm({ ...form, feedback_note: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] px-6 py-3 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Save &amp; Confirm Distribution</span>
        </button>
      </form>

      {/* PAST RECORDS */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <h2 className="text-lg font-bold text-[#2c3e50]">Recorded Sessions</h2>
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">No distribution sessions logged yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-sm text-[#2c3e50]">
                    {rec.food_name} — {rec.quantity_distributed} {rec.donation_unit} distributed (
                    {rec.actual_headcount_served} people served)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Point: {rec.point_name} • Discarded: {rec.discarded_quantity}{' '}
                    {rec.donation_unit}
                    {rec.feedback_note ? ` • Note: "${rec.feedback_note}"` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> Confirmed
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}