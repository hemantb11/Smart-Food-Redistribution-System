import { useState, useEffect } from 'react';
import API from '../../services/axios';
import { ShieldAlert, Users, AlertTriangle, Settings, Clock } from 'lucide-react';

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
    } catch {}
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await API.put('core/config/', config);
      setConfig(res.data);
      setMsg('System configuration updated.');
    } catch {}
  };

  const runScheduler = async () => {
    try {
      const res = await API.post('core/run-scheduler/');
      setMsg(res.data.message);
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2c3e50] flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#f1c40f]" /> Administrator Governance Console
          </h1>
          <p className="text-sm text-gray-500">
            Verify accounts, resolve food safety concerns, and manage operational thresholds.
          </p>
        </div>
        <button
          onClick={runScheduler}
          className="bg-[#2c3e50] text-[#f1c40f] px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Clock className="w-4 h-4" /> Run Deadline & Timeout Job
        </button>
      </div>

      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{msg}</div>}

      {/* Account Verification Queue */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-semibold text-[#2c3e50] flex items-center gap-2">
          <Users className="w-5 h-5 text-[#f1c40f]" /> User Accounts & Verification
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Organisation / Details</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-semibold">{u.username}<br /><span className="text-gray-400 font-normal">{u.email}</span></td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">
                    {u.donor_profile?.organisation_name ||
                      u.ngo_profile?.organisation_name ||
                      u.volunteer_profile?.ngo_name ||
                      '-'}
                  </td>
                  <td className="p-3 font-semibold">{u.account_status}</td>
                  <td className="p-3 flex flex-wrap gap-1.5">
                    <button onClick={() => updateUserStatus(u.id, 'VERIFIED')} className="px-2.5 py-1 bg-emerald-600 text-white rounded cursor-pointer">Verify</button>
                    <button onClick={() => updateUserStatus(u.id, 'REJECTED')} className="px-2.5 py-1 bg-amber-600 text-white rounded cursor-pointer">Reject</button>
                    <button onClick={() => updateUserStatus(u.id, 'SUSPENDED')} className="px-2.5 py-1 bg-red-600 text-white rounded cursor-pointer">Suspend</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Reports */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-semibold text-[#2c3e50] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Food Safety Concern Reports
        </h2>
        {safetyReports.length === 0 ? (
          <p className="text-sm text-gray-500">No safety concern reports logged.</p>
        ) : (
          <div className="divide-y">
            {safetyReports.map((r) => (
              <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-[#2c3e50]">
                    {r.food_name} <span className="text-xs text-gray-500">(Donor: {r.donor_name} • Listing: {r.donation_status})</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{r.description}</p>
                  <p className="text-[11px] text-gray-400">Reported by {r.reported_by_name}</p>
                </div>
                {r.is_resolved ? (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    Resolved
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveReport(r.id, true)}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Withdraw Listing & Resolve
                    </button>
                    <button
                      onClick={() => resolveReport(r.id, false)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg cursor-pointer"
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

      {/* System Configuration */}
      {config && (
        <form onSubmit={saveConfig} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h2 className="text-lg font-semibold text-[#2c3e50] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#f1c40f]" /> Operational Thresholds & Timeouts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Volunteer Response Timeout (mins)</label>
              <input
                type="number"
                value={config.volunteer_response_timeout_minutes}
                onChange={(e) => setConfig({ ...config, volunteer_response_timeout_minutes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Late Cancellation Window (mins)</label>
              <input
                type="number"
                value={config.late_cancellation_window_minutes}
                onChange={(e) => setConfig({ ...config, late_cancellation_window_minutes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">High Priority Threshold (hours)</label>
              <input
                type="number"
                value={config.high_priority_hours_threshold}
                onChange={(e) => setConfig({ ...config, high_priority_hours_threshold: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button type="submit" className="bg-[#2c3e50] text-white px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer">
            Save Configuration
          </button>
        </form>
      )}
    </div>
  );
}