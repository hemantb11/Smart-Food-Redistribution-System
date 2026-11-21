import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../services/axios';
import {
  UserCheck,
  MapPin,
  Plus,
  CheckCircle2,
  XCircle,
  Activity,
  ShieldCheck,
  Clock,
  Utensils,
  Building2,
  Truck,
  Mail,
  Phone,
  Save,
} from 'lucide-react';

const PROFILE_BANNERS = {
  DONOR: {
    label: 'Verified Food Donor',
    badge: 'bg-amber-400 text-[#2c3e50]',
    Icon: Utensils,
    banner: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1400&q=80',
  },
  NGO: {
    label: 'Food Relief Partner NGO',
    badge: 'bg-emerald-400 text-[#2c3e50]',
    Icon: Building2,
    banner: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1400&q=80',
  },
  VOLUNTEER: {
    label: 'Logistics & Delivery Volunteer',
    badge: 'bg-sky-400 text-[#2c3e50]',
    Icon: Truck,
    banner: 'https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&w=1400&q=80',
  },
  ADMIN: {
    label: 'FoodBridge Administrator',
    badge: 'bg-[#f1c40f] text-[#2c3e50]',
    Icon: ShieldCheck,
    banner: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80',
  },
};

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
    } catch {
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

  const meta = PROFILE_BANNERS[user.role] || PROFILE_BANNERS.DONOR;
  const RoleIcon = meta.Icon;
  const displayName =
    user.donor_profile?.organisation_name ||
    user.ngo_profile?.organisation_name ||
    user.username;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* PROFESSIONAL IDENTITY HEADER CARD */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src={meta.banner}
          alt={meta.label}
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-[#f1c40f] to-amber-500 text-[#2c3e50] flex items-center justify-center shadow-lg shrink-0">
              <RoleIcon className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold px-3 py-0.5 rounded-full uppercase ${meta.badge}`}>
                  {meta.label}
                </span>
                {user.account_status === 'VERIFIED' ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    <Clock className="w-3.5 h-3.5" /> {user.account_status}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-white">{displayName}</h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#f1c40f]" /> {user.email}
                </span>
                {user.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#f1c40f]" /> {user.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {user.role === 'VOLUNTEER' && user.volunteer_profile && (
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 p-3 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Activity className="w-4 h-4 text-[#f1c40f]" />
                <span>Live Dispatch Availability</span>
              </div>
              <div className="flex items-center gap-1.5">
                {['AVAILABLE', 'BUSY', 'OFFLINE'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleAvailabilityChange(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      user.volunteer_profile.availability_status === st
                        ? st === 'AVAILABLE'
                          ? 'bg-emerald-500 text-white shadow'
                          : st === 'BUSY'
                          ? 'bg-amber-400 text-[#2c3e50] shadow'
                          : 'bg-slate-600 text-white shadow'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* MAIN PROFILE FORM */}
      <form
        onSubmit={handleProfileSave}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <RoleIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2c3e50]">General &amp; Organisation Details</h2>
            <p className="text-xs text-slate-500">Keep your FoodBridge contact and location details updated.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
            />
          </div>

          {(user.role === 'DONOR' || user.role === 'NGO') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Organisation Name
              </label>
              <input
                type="text"
                value={form.organisation_name}
                onChange={(e) => setForm({ ...form, organisation_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
          )}

          {(user.role === 'DONOR' || user.role === 'NGO') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
          )}

          {user.role === 'DONOR' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                City / Pickup Area
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
          )}

          {(user.role === 'NGO' || user.role === 'VOLUNTEER') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Service Area
              </label>
              <input
                type="text"
                value={form.service_area}
                onChange={(e) => setForm({ ...form, service_area: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              />
            </div>
          )}

          {user.role === 'VOLUNTEER' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Affiliated NGO
              </label>
              <select
                value={form.ngo || ''}
                onChange={(e) => setForm({ ...form, ngo: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#2c3e50] outline-none"
              >
                <option value="">-- Select Verified NGO --</option>
                {ngos.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.organisation_name} ({n.service_area || 'General'})
                  </option>
                ))}
              </select>
              <p className="text-xs mt-1.5">
                Approval status:{' '}
                <span
                  className={`font-semibold ${
                    user.volunteer_profile?.ngo_approved ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {user.volunteer_profile?.ngo_approved ? 'Approved by NGO' : 'Pending NGO approval'}
                </span>
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer shadow-xs"
        >
          <Save className="w-4 h-4" />
          <span>Save Profile Changes</span>
        </button>
      </form>

      {/* NGO SECTION: DISTRIBUTION POINTS + VOLUNTEER APPROVALS */}
      {user.role === 'NGO' && (
        <>
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2c3e50]">NGO Distribution Points</h2>
                <p className="text-xs text-slate-500">Shelters and community kitchens where volunteers drop off rescued food.</p>
              </div>
            </div>

            <form
              onSubmit={handleAddPoint}
              className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70"
            >
              <input
                required
                placeholder="Point Name (e.g. Aashray Shelter)"
                value={newPoint.name}
                onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
              <select
                value={newPoint.type}
                onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value })}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
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
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
              <input
                type="number"
                min="1"
                placeholder="Headcount"
                value={newPoint.usual_headcount}
                onChange={(e) => setNewPoint({ ...newPoint, usual_headcount: e.target.value })}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
              <button
                type="submit"
                className="bg-[#2c3e50] hover:bg-[#f1c40f] text-[#f1c40f] hover:text-[#2c3e50] font-bold text-xs rounded-xl px-4 py-2 flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Point
              </button>
            </form>

            <div className="divide-y divide-slate-100">
              {points.map((pt) => (
                <div key={pt.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-[#2c3e50]">
                      {pt.name}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({pt.type} • ~{pt.usual_headcount} people)
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{pt.address}</p>
                  </div>
                  <button
                    onClick={() => togglePointActive(pt)}
                    className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition ${
                      pt.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {pt.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2c3e50]">Affiliated Volunteers</h2>
                <p className="text-xs text-slate-500">Approve riders linked to your organization for food pickups.</p>
              </div>
            </div>

            {volunteers.length === 0 ? (
              <p className="text-sm text-slate-500">No volunteers registered under your NGO yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {volunteers.map((v) => (
                  <div key={v.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-[#2c3e50]">
                        {v.username}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({v.phone || v.email})
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Area: {v.service_area || 'N/A'} • Status:{' '}
                        <span
                          className={`font-bold ${
                            v.availability_status === 'AVAILABLE'
                              ? 'text-emerald-600'
                              : v.availability_status === 'BUSY'
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {v.availability_status}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.ngo_approved ? (
                        <button
                          onClick={() => handleApproveVolunteer(v.id, false)}
                          className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApproveVolunteer(v.id, true)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
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