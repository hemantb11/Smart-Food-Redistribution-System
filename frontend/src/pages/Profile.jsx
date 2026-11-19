import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../services/axios';
import { UserCheck, MapPin, Plus, CheckCircle2, XCircle, Activity } from 'lucide-react';

export default function Profile() {
  const { user, fetchUser } = useAuth();
  const [form, setForm] = useState({
    phone: '',
    organisation_name: '',
    address: '',
    location: '',
    service_area: '',
    ngo: '',
  });
  const [ngos, setNgos] = useState([]);
  const [points, setPoints] = useState([]);
  const [newPoint, setNewPoint] = useState({
    name: '',
    type: 'SHELTER',
    address: '',
    usual_headcount: 50,
    dietary_notes: '',
  });
  const [volunteers, setVolunteers] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    const p = user.donor_profile || user.ngo_profile || user.volunteer_profile || {};
    setForm({
      phone: user.phone || '',
      organisation_name: p.organisation_name || '',
      address: p.address || '',
      location: p.location || '',
      service_area: p.service_area || '',
      ngo: p.ngo || '',
    });

    if (user.role === 'VOLUNTEER') {
      API.get('auth/ngos/').then((res) => setNgos(res.data)).catch(() => {});
    }
    if (user.role === 'NGO') {
      API.get('auth/distribution-points/').then((res) => setPoints(res.data)).catch(() => {});
      API.get('auth/ngo/volunteers/').then((res) => setVolunteers(res.data)).catch(() => {});
    }
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await API.put('auth/profile/', form);
      await fetchUser();
      setMsg('Profile updated successfully.');
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to update profile.');
    }
  };

  const handleAddPoint = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('auth/distribution-points/', newPoint);
      setPoints([res.data, ...points]);
      setNewPoint({ name: '', type: 'SHELTER', address: '', usual_headcount: 50, dietary_notes: '' });
      setMsg('Distribution point added.');
    } catch (error) {
      setErr('Could not add distribution point.');
    }
  };

  const togglePointActive = async (pt) => {
    try {
      const res = await API.patch(`auth/distribution-points/${pt.id}/`, { is_active: !pt.is_active });
      setPoints(points.map((p) => (p.id === pt.id ? res.data : p)));
    } catch {}
  };

  const handleApproveVolunteer = async (volId, approve) => {
    try {
      const res = await API.post(`auth/ngo/volunteers/${volId}/approve/`, { approve });
      setVolunteers(volunteers.map((v) => (v.id === volId ? res.data.volunteer : v)));
      setMsg(res.data.message);
    } catch (error) {
      setErr(error.response?.data?.error || 'Action failed.');
    }
  };

  const handleAvailabilityChange = async (newStatus) => {
    try {
      await API.patch('auth/volunteer/availability/', { availability_status: newStatus });
      await fetchUser();
      setMsg(`Availability updated to ${newStatus}`);
    } catch {
      setErr('Failed to update availability.');
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2c3e50]">Account & Role Profile</h1>
          <p className="text-sm text-gray-500">
            Status: <span className="font-semibold text-amber-600">{user.account_status}</span> • Role: {user.role}
          </p>
        </div>

        {user.role === 'VOLUNTEER' && user.volunteer_profile && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border">
            <Activity className="w-4 h-4 text-[#2c3e50]" />
            <span className="text-xs font-semibold text-gray-600">Availability:</span>
            {['AVAILABLE', 'BUSY', 'OFFLINE'].map((st) => (
              <button
                key={st}
                onClick={() => handleAvailabilityChange(st)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                  user.volunteer_profile.availability_status === st
                    ? 'bg-[#2c3e50] text-[#f1c40f]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{msg}</div>}
      {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{err}</div>}

      {/* Main Profile Form */}
      <form onSubmit={handleProfileSave} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-semibold text-[#2c3e50]">General & Organisation Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {(user.role === 'DONOR' || user.role === 'NGO') && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Organisation Name</label>
              <input
                type="text"
                value={form.organisation_name}
                onChange={(e) => setForm({ ...form, organisation_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {(user.role === 'DONOR' || user.role === 'NGO') && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Street Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {user.role === 'DONOR' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">City / Pickup Area</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {(user.role === 'NGO' || user.role === 'VOLUNTEER') && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Service Area</label>
              <input
                type="text"
                value={form.service_area}
                onChange={(e) => setForm({ ...form, service_area: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {user.role === 'VOLUNTEER' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Affiliated NGO</label>
              <select
                value={form.ngo || ''}
                onChange={(e) => setForm({ ...form, ngo: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Select Verified NGO --</option>
                {ngos.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.organisation_name} ({n.service_area || 'General'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Approval status: {user.volunteer_profile?.ngo_approved ? 'Approved by NGO' : 'Pending NGO approval'}
              </p>
            </div>
          )}
        </div>
        <button type="submit" className="bg-[#2c3e50] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a252f] cursor-pointer">
          Save Profile
        </button>
      </form>

      {/* NGO Section: Distribution Points + Volunteer Approvals */}
      {user.role === 'NGO' && (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-semibold text-[#2c3e50] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#f1c40f]" /> NGO Distribution Points
            </h2>

            <form onSubmit={handleAddPoint} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-xl">
              <input
                required
                placeholder="Point Name (e.g. Asha Shelter)"
                value={newPoint.name}
                onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              />
              <select
                value={newPoint.type}
                onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="SHELTER">Shelter</option>
                <option value="COMMUNITY_KITCHEN">Community Kitchen</option>
                <option value="ORPHANAGE">Orphanage</option>
                <option value="OLD_AGE_HOME">Old Age Home</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                required
                placeholder="Full Address"
                value={newPoint.address}
                onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              />
              <input
                type="number"
                min="1"
                placeholder="Headcount"
                value={newPoint.usual_headcount}
                onChange={(e) => setNewPoint({ ...newPoint, usual_headcount: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              />
              <button type="submit" className="bg-[#2c3e50] text-[#f1c40f] font-semibold text-sm rounded-lg px-4 py-2 flex items-center justify-center gap-1 cursor-pointer">
                <Plus className="w-4 h-4" /> Add Point
              </button>
            </form>

            <div className="divide-y">
              {points.map((pt) => (
                <div key={pt.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-[#2c3e50]">
                      {pt.name} <span className="text-xs text-gray-500">({pt.type} • ~{pt.usual_headcount} people)</span>
                    </p>
                    <p className="text-xs text-gray-500">{pt.address}</p>
                  </div>
                  <button
                    onClick={() => togglePointActive(pt)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                      pt.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {pt.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-semibold text-[#2c3e50] flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#f1c40f]" /> Affiliated Volunteers
            </h2>
            {volunteers.length === 0 ? (
              <p className="text-sm text-gray-500">No volunteers registered under your NGO yet.</p>
            ) : (
              <div className="divide-y">
                {volunteers.map((v) => (
                  <div key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-[#2c3e50]">
                        {v.username} <span className="text-xs font-normal text-gray-500">({v.phone || v.email})</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Area: {v.service_area || 'N/A'} • Status: <span className="font-semibold">{v.availability_status}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.ngo_approved ? (
                        <button
                          onClick={() => handleApproveVolunteer(v.id, false)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApproveVolunteer(v.id, true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve Volunteer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}