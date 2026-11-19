import { useState, useEffect } from 'react';
import API from '../../services/axios';
import { HeartHandshake, CheckCircle } from 'lucide-react';

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
    } catch (error) {
      setErr(
        error.response?.data?.error ||
          JSON.stringify(error.response?.data) ||
          'Failed to record distribution.'
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#2c3e50] flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-[#f1c40f]" /> Beneficiary Distribution Records
        </h1>
        <p className="text-sm text-gray-500">
          Record community meals served, any discarded quantity, and send an impact note to the donor.
        </p>
      </div>

      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{msg}</div>}
      {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{err}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-semibold text-[#2c3e50]">Record Distribution Session</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Delivered Request *</label>
            <select
              required
              value={form.request}
              onChange={(e) => setForm({ ...form, request: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">-- Select Delivered Food Request --</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} — {r.food_name} ({r.accepted_quantity} {r.donation_unit} • {r.distribution_point_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Beneficiaries Served (Headcount) *</label>
            <input
              type="number"
              min="0"
              required
              value={form.actual_headcount_served}
              onChange={(e) => setForm({ ...form, actual_headcount_served: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity Distributed *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.quantity_distributed}
              onChange={(e) => setForm({ ...form, quantity_distributed: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Discarded Quantity (if any)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.discarded_quantity}
              onChange={(e) => setForm({ ...form, discarded_quantity: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {Number(form.discarded_quantity) > 0 && (
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-red-600 mb-1">Discard Reason (Mandatory) *</label>
              <input
                required
                placeholder="e.g., Passed consume-by window before final serving"
                value={form.discard_reason}
                onChange={(e) => setForm({ ...form, discard_reason: e.target.value })}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Session Notes</label>
            <input
              placeholder="Distribution notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Thank-You / Feedback Note for Donor</label>
            <input
              placeholder="e.g., Served hot dinner to 85 shelter residents!"
              value={form.feedback_note}
              onChange={(e) => setForm({ ...form, feedback_note: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button type="submit" className="bg-[#2c3e50] text-[#f1c40f] px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1a252f] cursor-pointer">
          Save & Confirm Distribution
        </button>
      </form>

      {/* Past Records */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-3">
        <h2 className="text-lg font-semibold text-[#2c3e50]">Recorded Sessions</h2>
        {records.length === 0 ? (
          <p className="text-sm text-gray-500">No distribution sessions logged yet.</p>
        ) : (
          <div className="divide-y">
            {records.map((rec) => (
              <div key={rec.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-[#2c3e50]">
                    {rec.food_name} — {rec.quantity_distributed} {rec.donation_unit} distributed ({rec.actual_headcount_served} people served)
                  </p>
                  <p className="text-xs text-gray-500">
                    Point: {rec.point_name} • Discarded: {rec.discarded_quantity} {rec.donation_unit}
                    {rec.feedback_note ? ` • Note: "${rec.feedback_note}"` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
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