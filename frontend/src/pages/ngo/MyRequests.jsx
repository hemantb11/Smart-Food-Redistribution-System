import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../services/axios';
import {
  Truck,
  KeyRound,
  CheckCircle2,
  ClipboardCheck,
  AlertCircle,
  XCircle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [points, setPoints] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [volunteerInputs, setVolunteerInputs] = useState({});
  const [beneficiaryInputs, setBeneficiaryInputs] = useState({});
  const [quantityInputs, setQuantityInputs] = useState({});
  const [receiptCondition, setReceiptCondition] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqRes, assRes, volRes] = await Promise.all([
        API.get('requests/'),
        API.get('volunteers/assignments/'),
        API.get('auth/ngo/volunteers/').catch(() => ({ data: [] })),
      ]);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : reqRes.data.results || []);
      setAssignments(Array.isArray(assRes.data) ? assRes.data : assRes.data.results || []);
      const volList = Array.isArray(volRes.data) ? volRes.data : volRes.data.results || [];
      setVolunteers(volList.filter((v) => v.ngo_approved));
    } catch {
      setError('Failed to load food requests.');
    } finally {
      setLoading(false);
    }

    try {
      const ptRes = await API.get('auth/distribution-points/');
      setPoints(Array.isArray(ptRes.data) ? ptRes.data : ptRes.data.results || []);
    } catch (err) {
      console.warn('Distribution points fallback warning:', err.response?.status);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignVolunteer = async (reqId) => {
    const volId = volunteerInputs[reqId];
    if (!volId) {
      setError('Select an approved NGO Volunteer first.');
      return;
    }
    setError('');
    try {
      await API.post('volunteers/assignments/', {
        request: reqId,
        volunteer: Number(volId),
        notes: 'Assigned by NGO',
      });
      setMsg('Volunteer assigned! 6-digit Pickup OTP generated.');
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          JSON.stringify(err.response?.data || 'Failed to assign volunteer.')
      );
    }
  };

  const handleCancelRequest = async (req) => {
    const reason = window.prompt('Enter cancellation reason (e.g., Logistics unavailable):');
    if (!reason) return;
    setError('');
    try {
      await API.post(`requests/${req.id}/cancel/`, {
        cancel_reason: reason,
        version: req.version,
      });
      setMsg('Request cancelled.');
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel request.');
      if (err.response?.status === 409) loadData();
    }
  };

  const handleReceiptCheck = async (req) => {
    const condition = receiptCondition[req.id] || 'GOOD';
    setError('');
    try {
      await API.post(`requests/${req.id}/receipt-check/`, {
        receipt_condition: condition,
        receipt_notes: `NGO inspection verified: ${condition}`,
      });
      setMsg(`Receipt hygiene inspection logged (${condition}).`);
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not log receipt check.');
    }
  };

  const handleLogDistribution = async (req) => {
    setError('');
    const headcount = beneficiaryInputs[req.id] ?? req.expected_beneficiaries;
    const defaultQty = req.accepted_quantity ?? req.approved_quantity ?? req.requested_quantity;
    const qtyDistributed = quantityInputs[req.id] ?? defaultQty;

    const distPointId =
      typeof req.distribution_point === 'object'
        ? req.distribution_point?.id
        : req.distribution_point || points[0]?.id;

    if (!distPointId) {
      setError('NGO distribution point not found.');
      return;
    }

    try {
      await API.post('distributions/', {
        request: req.id,
        distribution_point: Number(distPointId),
        quantity_distributed: Number(qtyDistributed),
        discarded_quantity: '0.00',
        actual_headcount_served: Number(headcount),
        notes: `Distributed ${req.food_name} to community beneficiaries.`,
      });
      setMsg(`Distribution logged for ${headcount} beneficiaries!`);
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          JSON.stringify(err.response?.data || 'Failed to save distribution record.')
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2c3e50] border-b-4 border-[#f1c40f] inline-block pb-1">
            My Food Requests &amp; Distributions
          </h1>
          <p className="text-xs text-[#666666] mt-2">
            Assign approved NGO volunteers, verify food receipt, and record community meal distribution.
          </p>
        </div>
        <Link
          to="/distributions"
          className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition"
        >
          <span>Multi-Session &amp; Discard Log</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {msg && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-3.5 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3.5 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#666666]">Loading your requests...</p>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-slate-200">
          <p className="text-sm font-semibold text-[#2c3e50]">No Food Requests Sent Yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const assignment = assignments.find(
              (a) => a.request === req.id && !['REJECTED', 'FAILED'].includes(a.status)
            );
            const defaultQty =
              req.accepted_quantity ?? req.approved_quantity ?? req.requested_quantity;

            return (
              <div
                key={req.id}
                className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-[#f1c40f] flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-lg font-semibold text-[#2c3e50]">{req.food_name}</h3>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#2c3e50]">
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#555555]">
                    Requested: <strong>{req.requested_quantity} {req.donation_unit}</strong>
                    {req.accepted_quantity && (
                      <>
                        {' '}
                        • Accepted: <strong className="text-emerald-700">{req.accepted_quantity} {req.donation_unit}</strong>
                      </>
                    )}{' '}
                    • Expected Beneficiaries: <strong>{req.expected_beneficiaries}</strong>
                  </p>
                  {req.reject_reason_code && (
                    <p className="text-xs text-red-600">
                      Donor Reject Reason: {req.reject_reason_code}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Cancel option while Pending or Accepted */}
                  {['PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(req.status) &&
                    (!assignment || assignment.status === 'ASSIGNED') && (
                      <button
                        onClick={() => handleCancelRequest(req)}
                        className="bg-red-50 hover:bg-red-600 text-red-700 hover:text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                  {/* Volunteer Assignment or OTP Display */}
                  {['ACCEPTED', 'PARTIALLY_ACCEPTED', 'COMPLETED'].includes(req.status) &&
                    (assignment ? (
                      <div className="bg-[#2c3e50] text-white px-4 py-2.5 rounded-lg text-xs">
                        <p className="text-[#f1c40f] font-semibold flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Pickup OTP: {assignment.verification_code}</span>
                        </p>
                        <p className="text-slate-200 mt-0.5">
                          Rider: {assignment.volunteer_name} — {assignment.status}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {volunteers.length > 0 ? (
                          <select
                            value={volunteerInputs[req.id] || ''}
                            onChange={(e) =>
                              setVolunteerInputs({
                                ...volunteerInputs,
                                [req.id]: e.target.value,
                              })
                            }
                            className="border border-[#dddddd] rounded px-3 py-2 text-xs bg-white"
                          >
                            <option value="">-- Select Approved Volunteer --</option>
                            {volunteers.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.username} ({v.availability_status})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            placeholder="Volunteer ID"
                            value={volunteerInputs[req.id] || ''}
                            onChange={(e) =>
                              setVolunteerInputs({
                                ...volunteerInputs,
                                [req.id]: e.target.value,
                              })
                            }
                            className="w-32 border border-[#dddddd] rounded px-3 py-2 text-xs"
                          />
                        )}
                        <button
                          onClick={() => handleAssignVolunteer(req.id)}
                          className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold px-4 py-2 rounded flex items-center gap-1.5 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Assign Volunteer</span>
                        </button>
                      </div>
                    ))}

                  {/* Receipt Inspection & Distribution Logging once Delivered */}
                  {assignment?.status === 'DELIVERED' && req.status !== 'COMPLETED' && req.donation_status !== 'COMPLETED' && (
                    <div className="flex flex-wrap items-end gap-2 bg-slate-50 p-3 rounded-lg border">
                      {!req.receipt_checked_at && (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={receiptCondition[req.id] || 'GOOD'}
                            onChange={(e) =>
                              setReceiptCondition({
                                ...receiptCondition,
                                [req.id]: e.target.value,
                              })
                            }
                            className="border rounded px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="GOOD">Hygiene OK (Good)</option>
                            <option value="PARTIAL_SPOILAGE">Partial Spoilage</option>
                            <option value="REJECTED">Unsafe / Rejected</option>
                          </select>
                          <button
                            onClick={() => handleReceiptCheck(req)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify Receipt</span>
                          </button>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-semibold text-[#666666] uppercase">
                          Qty Distributed
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={quantityInputs[req.id] ?? defaultQty}
                          onChange={(e) =>
                            setQuantityInputs({
                              ...quantityInputs,
                              [req.id]: e.target.value,
                            })
                          }
                          className="w-24 border border-[#dddddd] rounded px-2.5 py-1.5 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#666666] uppercase">
                          People Fed
                        </label>
                        <input
                          type="number"
                          value={beneficiaryInputs[req.id] ?? req.expected_beneficiaries}
                          onChange={(e) =>
                            setBeneficiaryInputs({
                              ...beneficiaryInputs,
                              [req.id]: e.target.value,
                            })
                          }
                          className="w-24 border border-[#dddddd] rounded px-2.5 py-1.5 text-xs bg-white"
                        />
                      </div>
                      <button
                        onClick={() => handleLogDistribution(req)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Log Distribution</span>
                      </button>
                    </div>
                  )}

                  {(req.status === 'COMPLETED' || req.donation_status === 'COMPLETED') && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Distribution Completed</span>
                    </span>
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