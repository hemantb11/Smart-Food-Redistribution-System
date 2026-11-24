import { useState, useEffect } from 'react';
import API from '../../services/axios';
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  Settings,
  Clock,
  CheckCircle2,
  UserCheck,
  Save,
} from 'lucide-react';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [safetyReports, setSafetyReports] = useState([]);
  const [config, setConfig] = useState(null);
  const [msg, setMsg] = useState('');

  const loadAdminData = async () => {
    try {
      const [uRes, sRes, cRes] = await Promise.all([
        API.get('auth/admin/users/'),
        API.get('safety-reports/'),
        API.get('core/config/'),
      ]);
      setUsers(uRes.data || []);
      setSafetyReports(sRes.data || []);
      setConfig(cRes.data);
    } catch {}
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const updateUserStatus = async (userId, account_status) => {
    try {
      await API.patch(`auth/admin/verify-user/${userId}/`, { account_status });
      setMsg(`User #${userId} updated to ${account_status}`);
      loadAdminData();
      setTimeout(() => setMsg(''), 4000);
    } catch {}
  };

  const resolveReport = async (reportId, withdraw_listing) => {
    try {
      await API.post(`safety-reports/${reportId}/resolve/`, {
        resolution: withdraw_listing
          ? 'Unsafe listing withdrawn by Admin.'
          : 'Reviewed and resolved by Admin.',
        withdraw_listing,
      });
      setMsg(`Safety report #${reportId} resolved.`);
      loadAdminData();
      setTimeout(() => setMsg(''), 4000);
    } catch {}
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await API.put('core/config/', config);
      setConfig(res.data);
      setMsg('System configuration updated.');
      setTimeout(() => setMsg(''), 4000);
    } catch {}
  };

  const runScheduler = async () => {
    try {
      const res = await API.post('core/run-scheduler/');
      setMsg(res.data.message);
      setTimeout(() => setMsg(''), 4000);
    } catch {}
  };

  const pendingCount = users.filter((u) => u.account_status === 'PENDING').length;
  const openReportsCount = safetyReports.filter((r) => !r.is_resolved).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* PROFESSIONAL HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80"
          alt="FoodBridge Governance"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              <ShieldAlert className="w-3.5 h-3.5" />
              FoodBridge Governance Console
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Administrator Oversight &amp; Safety Control
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Verify organizations, resolve food safety escalations, and execute automated
              deadline &amp; timeout jobs.
            </p>
          </div>

          <button
            onClick={runScheduler}
            className="bg-[#f1c40f] hover:bg-white text-[#2c3e50] px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition cursor-pointer shrink-0 self-start md:self-auto"
          >
            <Clock className="w-4 h-4" />
            <span>Run Deadline &amp; Timeout Job</span>
          </button>
        </div>
      </div>

      {/* QUICK ADMIN KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Registered Users
            </p>
            <p className="text-3xl font-bold text-[#2c3e50] mt-1">{users.length}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 text-[#2c3e50] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Verifications
            </p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Open Safety Reports
            </p>
            <p className="text-3xl font-bold text-rose-600 mt-1">{openReportsCount}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* ACCOUNT VERIFICATION QUEUE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2c3e50]">User Accounts &amp; Verification</h2>
            <p className="text-xs text-slate-500">
              Approve, reject, or suspend FoodBridge Donors, NGOs, and Volunteers.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4 font-bold">User</th>
                <th className="py-3.5 px-4 font-bold">Role</th>
                <th className="py-3.5 px-4 font-bold">Organisation / Details</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4 font-bold text-[#2c3e50]">
                    {u.username}
                    <br />
                    <span className="text-slate-400 font-normal">{u.email}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="bg-slate-100 text-[#2c3e50] font-bold px-2.5 py-1 rounded-md">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {u.donor_profile?.organisation_name ||
                      u.ngo_profile?.organisation_name ||
                      u.volunteer_profile?.ngo_name ||
                      '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                        u.account_status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : u.account_status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {u.account_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => updateUserStatus(u.id, 'VERIFIED')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition cursor-pointer"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => updateUserStatus(u.id, 'REJECTED')}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => updateUserStatus(u.id, 'SUSPENDED')}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition cursor-pointer"
                      >
                        Suspend
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SAFETY REPORTS */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2c3e50]">Food Safety Concern Reports</h2>
            <p className="text-xs text-slate-500">
              Investigate reported food hygiene concerns and withdraw unsafe listings immediately.
            </p>
          </div>
        </div>

        {safetyReports.length === 0 ? (
          <p className="text-sm text-slate-500">No safety concern reports logged.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {safetyReports.map((r) => (
              <div key={r.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-[#2c3e50]">
                    {r.food_name}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (Donor: {r.donor_name} • Listing: {r.donation_status})
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{r.description}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Reported by {r.reported_by_name}
                  </p>
                </div>
                {r.is_resolved ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    Resolved
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveReport(r.id, true)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Withdraw Listing &amp; Resolve
                    </button>
                    <button
                      onClick={() => resolveReport(r.id, false)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SYSTEM CONFIGURATION */}
      {config && (
        <form
          onSubmit={saveConfig}
          className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2c3e50]">
                Operational Thresholds &amp; Timeouts
              </h2>
              <p className="text-xs text-slate-500">
                Configure volunteer response timers, late cancellation rules, and AI urgency windows.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Volunteer Response Timeout (mins)
              </label>
              <input
                type="number"
                value={config.volunteer_response_timeout_minutes}
                onChange={(e) =>
                  setConfig({ ...config, volunteer_response_timeout_minutes: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Late Cancellation Window (mins)
              </label>
              <input
                type="number"
                value={config.late_cancellation_window_minutes}
                onChange={(e) =>
                  setConfig({ ...config, late_cancellation_window_minutes: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                High Priority Threshold (hours)
              </label>
              <input
                type="number"
                value={config.high_priority_hours_threshold}
                onChange={(e) =>
                  setConfig({ ...config, high_priority_hours_threshold: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </form>
      )}
    </div>
  );
}