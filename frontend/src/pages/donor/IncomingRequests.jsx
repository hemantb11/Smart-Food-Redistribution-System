import { useState, useEffect } from 'react';
import API from '../../services/axios';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Users,
  KeyRound,
  AlertCircle,
  Clock,
  Inbox,
} from 'lucide-react';

export default function IncomingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Full or partial accepted quantity & reject reason per request
  const [acceptQty, setAcceptQty] = useState({});
  const [rejectReason, setRejectReason] = useState({});

  const extractApiError = (err, fallback) => {
    const data = err.response?.data;
    if (!data) return `${fallback} (${err.message || 'Network Error'})`;
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    if (data.detail) return data.detail;
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
      return `${firstKey}: ${val}`;
    }
    return `${fallback} (HTTP ${err.response?.status})`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqRes, assRes] = await Promise.all([
        API.get('requests/'),
        API.get('volunteers/assignments/'),
      ]);
      const reqList = Array.isArray(reqRes.data) ? reqRes.data : reqRes.data.results || [];
      setRequests(reqList);
      setAssignments(Array.isArray(assRes.data) ? assRes.data : assRes.data.results || []);

      const initialQty = {};
      const initialReason = {};
      reqList.forEach((r) => {
        initialQty[r.id] = r.requested_quantity;
        initialReason[r.id] = 'INSUFFICIENT_QUANTITY';
      });
      setAcceptQty(initialQty);
      setRejectReason(initialReason);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load incoming requests.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAccept = async (req) => {
    setError('');
    const qtyToAccept = Number(acceptQty[req.id] ?? req.requested_quantity);
    try {
      const payload = {
        decision: 'ACCEPT',
        accepted_quantity: qtyToAccept,
      };
      if (req.version !== undefined && req.version !== null) {
        payload.version = req.version;
      }

      const res = await API.post(`requests/${req.id}/accept/`, payload);
      setMsg(res.data.message || `Accepted request from ${req.ngo_name}!`);
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(extractApiError(err, 'Failed to accept request.'));
      if (err.response?.status === 409) loadData();
    }
  };

  const handleReject = async (req) => {
    setError('');
    const reason_code = rejectReason[req.id] || 'OTHER';
    try {
      const payload = { reason_code };
      if (req.version !== undefined && req.version !== null) {
        payload.version = req.version;
      }

      await API.post(`requests/${req.id}/reject/`, payload);
      setMsg(`Request rejected (${reason_code}).`);
      loadData();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(extractApiError(err, 'Failed to reject request.'));
      if (err.response?.status === 409) loadData();
    }
  };

  const getAssignmentForRequest = (reqId) =>
    assignments.find(
      (a) => a.request === reqId && !['REJECTED', 'FAILED'].includes(a.status)
    );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1400&q=80"
          alt="Incoming NGO Requests"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            <Inbox className="w-3.5 h-3.5" />
            Allocation &amp; OTP Dispatch
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Incoming NGO Requests</h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
            Accept full or partial quantities, reject with a reason code, and share the 6-digit Pickup OTP with the NGO&apos;s volunteer.
          </p>
        </div>
      </div>

      {user && user.role !== 'DONOR' && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            You are currently logged in as <strong>{user.role} ({user.username})</strong>. Please log in with a <strong>DONOR</strong> account to accept requests.
          </span>
        </div>
      )}

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <p className="text-base font-bold text-[#2c3e50]">No NGO Requests Yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Verified NGOs will appear here once they claim your active food listings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const assignment = getAssignmentForRequest(req.id);
            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 border-l-4 border-l-[#f1c40f] flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-lg font-bold text-[#2c3e50]">{req.food_name}</h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#2c3e50]">
                      {req.status}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Available in pool:{' '}
                      <strong className="text-emerald-700">
                        {req.donation_available_quantity} {req.donation_unit}
                      </strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    NGO: <strong className="text-[#2c3e50]">{req.ngo_name}</strong> (
                    {req.distribution_point_name}) • Requested:{' '}
                    <strong>
                      {req.requested_quantity} {req.donation_unit}
                    </strong>
                    {req.min_acceptable_quantity && (
                      <span className="text-amber-700 font-medium">
                        {' '}
                        (Min acceptable: {req.min_acceptable_quantity} {req.donation_unit})
                      </span>
                    )}
                  </p>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#2c3e50]" />
                    <span>Expected Beneficiaries: {req.expected_beneficiaries}</span>
                  </p>

                  {req.message && (
                    <p className="text-xs italic text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
                      &quot;{req.message}&quot;
                    </p>
                  )}
                </div>

                {/* Right Decision / Pickup OTP Box */}
                <div className="flex flex-col gap-2.5">
                  {req.status === 'PENDING' && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Accept Qty:
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min={req.min_acceptable_quantity || 0.01}
                            max={req.requested_quantity}
                            value={acceptQty[req.id] ?? req.requested_quantity}
                            onChange={(e) =>
                              setAcceptQty({ ...acceptQty, [req.id]: e.target.value })
                            }
                            className="w-20 text-xs font-bold text-[#2c3e50] bg-white border border-slate-200 rounded-lg px-2 py-1"
                          />
                        </div>
                        <button
                          onClick={() => handleAccept(req)}
                          className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Accept</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={rejectReason[req.id] || 'INSUFFICIENT_QUANTITY'}
                          onChange={(e) =>
                            setRejectReason({ ...rejectReason, [req.id]: e.target.value })
                          }
                          className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-slate-50 text-[#2c3e50]"
                        >
                          <option value="INSUFFICIENT_QUANTITY">Insufficient Quantity</option>
                          <option value="TIMING_MISMATCH">Pickup Timing Mismatch</option>
                          <option value="LOGISTICS_ISSUE">Logistics / Packaging Issue</option>
                          <option value="OTHER">Other Reason</option>
                        </select>
                        <button
                          onClick={() => handleReject(req)}
                          className="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </>
                  )}

                  {['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(req.status) &&
                    (assignment ? (
                      <div className="bg-[#2c3e50] text-white px-4 py-3.5 rounded-xl text-xs space-y-1 shadow-sm">
                        <p className="flex items-center gap-1.5 text-[#f1c40f] font-bold text-sm">
                          <KeyRound className="w-4 h-4" />
                          <span>Pickup OTP: {assignment.verification_code}</span>
                        </p>
                        <p className="text-slate-200">
                          Volunteer: <strong>{assignment.volunteer_name}</strong> ({assignment.status})
                        </p>
                        <p className="text-slate-300 text-[11px]">
                          Allocated: {req.accepted_quantity} {req.donation_unit}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          Allocated{' '}
                          <strong>
                            {req.accepted_quantity} {req.donation_unit}
                          </strong>{' '}
                          — waiting for NGO to assign volunteer.
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}