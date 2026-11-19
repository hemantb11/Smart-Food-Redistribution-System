import { useState, useEffect } from 'react';
import API from '../../services/axios';
import {
  Truck,
  MapPin,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Navigation,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  Clock,
} from 'lucide-react';

export default function VolunteerTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otpInputs, setOtpInputs] = useState({});
  const [checklists, setChecklists] = useState({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await API.get('volunteers/assignments/');
      const list = Array.isArray(res.data) ? res.data : res.data.results || [];
      setTasks(list);

      const initialChecks = {};
      list.forEach((t) => {
        initialChecks[t.id] = {
          hygiene_ok: true,
          packaging_intact: true,
          temperature_ok: true,
        };
      });
      setChecklists(initialChecks);
    } catch {
      setError('Failed to load assigned delivery tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleRespond = async (taskId, accept) => {
    setError('');
    setMsg('');
    let reject_reason = '';
    if (!accept) {
      reject_reason = window.prompt('Reason for declining this assignment:') || 'Unavailable';
    }
    try {
      const res = await API.post(`volunteers/assignments/${taskId}/respond/`, {
        accept,
        reject_reason,
      });
      setMsg(res.data.message || (accept ? 'Assignment accepted!' : 'Assignment declined.'));
      loadTasks();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not respond to assignment.');
    }
  };

  const updateStatus = async (taskId, newStatus, verificationCode = '') => {
    setError('');
    setMsg('');
    try {
      const payload = { status: newStatus };
      if (newStatus === 'PICKED_UP') {
        const checks = checklists[taskId] || {
          hygiene_ok: true,
          packaging_intact: true,
          temperature_ok: true,
        };
        if (!checks.hygiene_ok || !checks.packaging_intact || !checks.temperature_ok) {
          setError('All 3 pickup safety & hygiene checks must be confirmed before pickup.');
          return;
        }
        payload.verification_code = verificationCode;
        payload.pickup_checklist = checks;
      }
      const res = await API.patch(`volunteers/assignments/${taskId}/status/`, payload);
      setMsg(res.data.message || `Status updated to ${newStatus}`);
      loadTasks();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Failed to update status. Please verify the OTP and checklist.'
      );
    }
  };

  const toggleCheck = (taskId, field) => {
    setChecklists((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || { hygiene_ok: true, packaging_intact: true, temperature_ok: true }),
        [field]: !(prev[taskId]?.[field] ?? true),
      },
    }));
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2c3e50] border-b-4 border-[#f1c40f] inline-block pb-1">
          My Delivery Tasks
        </h1>
        <p className="text-xs text-[#666666] mt-2">
          Accept assignments within the response window, complete pickup safety checks with 6-digit OTP, and deliver to NGO shelters.
        </p>
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
        <p className="text-sm text-[#666666]">Loading your delivery tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-slate-200">
          <Truck className="w-10 h-10 text-[#2c3e50] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#2c3e50]">No Assigned Deliveries</h3>
          <p className="text-xs text-[#666666] mt-1">
            When your NGO assigns a food rescue delivery to you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tasks.map((task) => {
            const checks = checklists[task.id] || {
              hygiene_ok: true,
              packaging_intact: true,
              temperature_ok: true,
            };
            return (
              <div
                key={task.id}
                className="bg-white rounded-xl p-6 shadow-sm border-b-4 border-[#f1c40f] space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#2c3e50]">{task.food_name}</h3>
                    <p className="text-xs text-[#666666]">For NGO: {task.ngo_name}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[#2c3e50] text-[#f1c40f]">
                    {task.status}
                  </span>
                </div>

                {task.response_deadline && task.status === 'ASSIGNED' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Respond before: {new Date(task.response_deadline).toLocaleString()}
                    </span>
                  </p>
                )}

                <div className="bg-slateDark-950 p-4 rounded-lg space-y-2 text-xs text-[#444444]">
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Pickup:</strong> {task.pickup_address || 'Donor Location'}
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Drop-off:</strong> {task.delivery_address || 'NGO Shelter'}
                    </span>
                  </p>
                </div>

                {/* Step 1: Accept or Decline Assignment */}
                {task.status === 'ASSIGNED' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(task.id, true)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Accept Task</span>
                    </button>
                    <button
                      onClick={() => handleRespond(task.id, false)}
                      className="flex-1 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white text-xs font-semibold py-2.5 rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                )}

                {/* Step 2: Start En Route */}
                {task.status === 'ACCEPTED' && (
                  <button
                    onClick={() => updateStatus(task.id, 'EN_ROUTE')}
                    className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold py-2.5 rounded-md transition cursor-pointer"
                  >
                    Start Pickup (Mark En Route)
                  </button>
                )}

                {/* Step 3: Pickup Safety Checklist + 6-Digit OTP */}
                {['ACCEPTED', 'EN_ROUTE'].includes(task.status) && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1.5">
                      <p className="font-semibold text-[#2c3e50] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Mandatory Pickup Inspection Checklist:</span>
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checks.hygiene_ok}
                          onChange={() => toggleCheck(task.id, 'hygiene_ok')}
                        />
                        <span>Food appearance &amp; smell verified hygienic</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checks.packaging_intact}
                          onChange={() => toggleCheck(task.id, 'packaging_intact')}
                        />
                        <span>Containers sealed &amp; packaging intact</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checks.temperature_ok}
                          onChange={() => toggleCheck(task.id, 'temperature_ok')}
                        />
                        <span>Storage temperature &amp; consume-by deadline valid</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          maxLength="6"
                          placeholder="Enter 6-Digit Donor OTP"
                          value={otpInputs[task.id] || ''}
                          onChange={(e) =>
                            setOtpInputs({ ...otpInputs, [task.id]: e.target.value })
                          }
                          className="w-full pl-9 pr-3 py-2 border border-[#dddddd] rounded-md text-xs font-mono tracking-widest"
                        />
                      </div>
                      <button
                        onClick={() =>
                          updateStatus(task.id, 'PICKED_UP', otpInputs[task.id] || '')
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-md cursor-pointer"
                      >
                        Verify &amp; Pickup
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 4: Confirm Drop-off */}
                {task.status === 'PICKED_UP' && (
                  <button
                    onClick={() => updateStatus(task.id, 'DELIVERED')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Delivery at NGO</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}