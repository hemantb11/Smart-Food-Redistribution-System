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
  PackageCheck,
  Sparkles,
} from 'lucide-react';

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [points, setPoints] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [aiVolunteerRecs, setAiVolunteerRecs] = useState({});
  const [aiLoadingId, setAiLoadingId] = useState(null);
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

  const handleRecommendVolunteer = async (reqId) => {
    setError('');
    setAiLoadingId(reqId);
    try {
      const res = await API.get(`core/ai/recommend-volunteers/${reqId}/`);
      const recs = res.data?.recommendations || [];
      setAiVolunteerRecs((prev) => ({ ...prev, [reqId]: res.data }));
      const best = recs.find((r) => r.eligible) || recs[0];
      if (best) {
        setVolunteerInputs((prev) => ({ ...prev, [reqId]: String(best.volunteer_id) }));
        if (res.data?.log_id) {
          API.post(`core/ai/logs/${res.data.log_id}/action/`, { user_action: 'ACCEPTED' }).catch(() => {});
        }
      } else {
        setError('No approved NGO volunteers available for AI ranking.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not compute AI volunteer recommendation.');
    } finally {
      setAiLoadingId(null);
    }
  };

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1400&q=80"
          alt="NGO Requests & Distributions"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              <PackageCheck className="w-3.5 h-3.5" />
              NGO Dispatch &amp; Handover
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              My Food Requests &amp; Distributions
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
              Assign approved NGO volunteers using AI Rider Matching, verify food receipt, and record community meal distribution.
            </p>
          </div>

          <Link
            to="/distributions"
            className="bg-[#f1c40f] hover:bg-white text-[#2c3e50] text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-1.5 shadow-lg transition self-start sm:self-auto"
          >
            <span>Multi-Session &amp; Discard Log</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading your requests...</p>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <p className="text-base font-bold text-[#2c3e50]">No Food Requests Sent Yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Browse available food listings to submit your first claim.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const assignment = assignments.find(
              (a) => a.request === req.id && !['REJECTED', 'FAILED'].includes(a.status)
            );
            const defaultQty =
              req.accepted_quantity ?? req.approved_quantity ?? req.requested_quantity;
            const recData = aiVolunteerRecs[req.id];
            const topRec = recData?.recommendations?.[0];

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 border-l-4 border-l-[#f1c40f] flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-lg font-bold text-[#2c3e50]">{req.food_name}</h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#2c3e50]">
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Requested:{' '}
                    <strong>
                      {req.requested_quantity} {req.donation_unit}
                    </strong>
                    {req.accepted_quantity && (
                      <>
                        {' '}
                        • Accepted:{' '}
                        <strong className="text-emerald-700">
                          {req.accepted_quantity} {req.donation_unit}
                        </strong>
                      </>
                    )}{' '}
                    • Expected Beneficiaries: <strong>{req.expected_beneficiaries}</strong>
                  </p>
                  {req.reject_reason_code && (
                    <p className="text-xs text-rose-600 font-medium">
                      Donor Reject Reason: {req.reject_reason_code}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start lg:items-end gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {['PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(req.status) &&
                      (!assignment || assignment.status === 'ASSIGNED') && (
                        <button
                          onClick={() => handleCancelRequest(req)}
                          className="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}

                    {['ACCEPTED', 'PARTIALLY_ACCEPTED', 'COMPLETED'].includes(req.status) &&
                      (assignment ? (
                        <div className="bg-[#2c3e50] text-white px-4 py-3 rounded-xl text-xs shadow-sm">
                          <p className="text-[#f1c40f] font-bold flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Pickup OTP: {assignment.verification_code}</span>
                          </p>
                          <p className="text-slate-200 mt-0.5">
                            Rider: <strong>{assignment.volunteer_name}</strong> — {assignment.status}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRecommendVolunteer(req.id)}
                            disabled={aiLoadingId === req.id}
                            className="bg-amber-100 hover:bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 border border-amber-300 transition cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                            <span>{aiLoadingId === req.id ? 'Scoring...' : 'AI Best Rider'}</span>
                          </button>

                          {volunteers.length > 0 ? (
                            <select
                              value={volunteerInputs[req.id] || ''}
                              onChange={(e) =>
                                setVolunteerInputs({
                                  ...volunteerInputs,
                                  [req.id]: e.target.value,
                                })
                              }
                              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50]"
                            >
                              <option value="">-- Select Approved Volunteer --</option>
                              {(recData?.recommendations || volunteers).map((v) => {
                                const id = v.volunteer_id ?? v.id;
                                const label = v.score
                                  ? `${v.username} — ${v.score}% AI Match (${v.availability_status})`
                                  : `${v.username} (${v.availability_status})`;
                                return (
                                  <option key={id} value={id}>
                                    {label}
                                  </option>
                                );
                              })}
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
                              className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                            />
                          )}

                          <button
                            onClick={() => handleAssignVolunteer(req.id)}
                            className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Assign Volunteer</span>
                          </button>
                        </div>
                      ))}

                    {assignment?.status === 'DELIVERED' &&
                      req.status !== 'COMPLETED' &&
                      req.donation_status !== 'COMPLETED' && (
                        <div className="flex flex-wrap items-end gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
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
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-[#2c3e50]"
                              >
                                <option value="GOOD">Hygiene OK (Good)</option>
                                <option value="PARTIAL_SPOILAGE">Partial Spoilage</option>
                                <option value="REJECTED">Unsafe / Rejected</option>
                              </select>
                              <button
                                onClick={() => handleReceiptCheck(req)}
                                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verify Receipt</span>
                              </button>
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">
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
                              className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">
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
                              className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                            />
                          </div>
                          <button
                            onClick={() => handleLogDistribution(req)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>Log Distribution</span>
                          </button>
                        </div>
                      )}

                    {(req.status === 'COMPLETED' || req.donation_status === 'COMPLETED') && (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Distribution Completed</span>
                      </span>
                    )}
                  </div>

                  {!assignment && topRec && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 text-[11px] text-[#2c3e50] flex flex-wrap items-center gap-2">
                      <span className="font-bold text-amber-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Top Pick: {topRec.username} ({topRec.score}% Match)
                      </span>
                      <span className="text-slate-600">• {topRec.reasons.join(' • ')}</span>
                    </div>
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