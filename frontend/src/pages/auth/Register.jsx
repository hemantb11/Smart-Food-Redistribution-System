import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../../services/axios';
import {
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  Utensils,
  Truck,
  MapPin,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function Register() {
  const [ngos, setNgos] = useState([]);
  const [formData, setFormData] = useState({
    role: 'DONOR',
    username: '',
    email: '',
    phone: '',
    organisation_name: '',
    address: '',
    service_area: '',
    ngo: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    API.get('auth/ngos/')
      .then((res) => setNgos(Array.isArray(res.data) ? res.data : res.data.results || []))
      .catch(() => {});
  }, []);

  const roles = [
    { id: 'DONOR', label: 'Food Donor', sub: 'Hotels / Caterers', icon: Utensils },
    { id: 'NGO', label: 'Verified NGO', sub: 'Shelters & Trusts', icon: Building2 },
    { id: 'VOLUNTEER', label: 'Volunteer', sub: 'Delivery Rider', icon: Truck },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        password: formData.password,
        password2: formData.confirmPassword,
      };

      if (formData.role === 'DONOR') {
        payload.organisation_name = formData.organisation_name;
        payload.address = formData.address;
      } else if (formData.role === 'NGO') {
        payload.organisation_name = formData.organisation_name;
        payload.address = formData.address;
        payload.service_area = formData.service_area;
      } else if (formData.role === 'VOLUNTEER') {
        payload.service_area = formData.service_area;
        if (formData.ngo) payload.ngo = Number(formData.ngo);
      }

      await API.post('auth/register/', payload);
      navigate('/login');
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const msg = Array.isArray(errData[firstKey])
          ? errData[firstKey][0]
          : errData[firstKey];
        setError(`${firstKey.toUpperCase()}: ${msg}`);
      } else {
        setError('Registration failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200/80 border-b-4 border-b-[#f1c40f]">
        {/* Top Navy Header Strip */}
        <div className="bg-[#2c3e50] text-white px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-linear-to-br from-[#f1c40f] to-amber-500 text-[#2c3e50] flex items-center justify-center shadow-md shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12c2.5-4.5 6.2-6.5 9-6.5s6.5 2 9 6.5" />
                <path d="M6 12v-2.5M12 12V6M18 12v-2.5" />
                <path d="M4 13h16a8 8 0 0 1-16 0Z" fill="currentColor" fillOpacity="0.2" />
                <path d="M8 20h8" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Join <span className="text-[#f1c40f]">FoodBridge</span> Network
              </h1>
              <p className="text-xs text-slate-300">
                Create your Donor, NGO, or Volunteer account
              </p>
            </div>
          </div>

          <span className="bg-white/10 border border-white/15 text-[#f1c40f] text-[11px] font-bold px-3 py-1 rounded-full self-start sm:self-auto">
            Role: {formData.role}
          </span>
        </div>

        <div className="p-8 sm:p-9">
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Select Your Stakeholder Role
              </label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((r) => {
                  const Icon = r.icon;
                  const active = formData.role === r.id;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setFormData({ ...formData, role: r.id })}
                      className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                        active
                          ? 'bg-[#2c3e50] text-white border-[#f1c40f] border-2 shadow-md'
                          : 'bg-slate-50 text-[#2c3e50] border-slate-200 hover:border-[#f1c40f] hover:bg-white'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 mx-auto mb-1.5 ${
                          active ? 'text-[#f1c40f]' : 'text-[#2c3e50]'
                        }`}
                      />
                      <p className="text-xs font-bold">{r.label}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          active ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {r.sub}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Username & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Username"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@org.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                  />
                </div>
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                />
              </div>
            </div>

            {/* Role-Specific Organisation / NGO Affiliation Fields */}
            {(formData.role === 'DONOR' || formData.role === 'NGO') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Organisation Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.organisation_name}
                      onChange={(e) =>
                        setFormData({ ...formData, organisation_name: e.target.value })
                      }
                      placeholder={formData.role === 'DONOR' ? 'Hotel / Kitchen Name' : 'NGO Name'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street & City"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'VOLUNTEER' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Affiliated Verified NGO
                </label>
                <select
                  required
                  value={formData.ngo}
                  onChange={(e) => setFormData({ ...formData, ngo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                >
                  <option value="">-- Select Verified NGO to Volunteer With --</option>
                  {ngos.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.organisation_name} ({n.service_area || 'General Area'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(formData.role === 'NGO' || formData.role === 'VOLUNTEER') && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Service Area / Locality
                </label>
                <input
                  type="text"
                  required
                  value={formData.service_area}
                  onChange={(e) => setFormData({ ...formData, service_area: e.target.value })}
                  placeholder="e.g. Deopur, Sakri Road, Dhule"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#2c3e50] focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                />
              </div>
            )}

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] disabled:opacity-50 font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all duration-300 mt-2 cursor-pointer"
            >
              <span>
                {loading ? 'Creating Account...' : `Register as ${formData.role}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-[#2c3e50] font-bold underline decoration-[#f1c40f] decoration-2 underline-offset-4 hover:text-amber-600"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}