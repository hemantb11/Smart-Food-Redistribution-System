import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../../services/axios';
import {
  Utensils,
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  Heart,
  Users,
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
    { id: 'DONOR', label: 'Donor', sub: 'Hotels / Caterers', icon: Heart },
    { id: 'NGO', label: 'NGO', sub: 'Food Relief', icon: Building2 },
    { id: 'VOLUNTEER', label: 'Volunteer', sub: 'Logistics', icon: Users },
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
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9fa] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-xl p-8 sm:p-10 shadow-[0_8px_25px_rgba(0,0,0,0.08)] border-b-4 border-[#f1c40f]">
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-[#2c3e50] text-[#f1c40f] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Utensils className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold text-[#2c3e50] inline-block border-b-3 border-[#f1c40f] pb-1">
            Create an Account
          </h1>
          <p className="text-xs text-[#666666] mt-2">
            Join the Smart Food Redistribution Network
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-[#e74c3c]/10 border border-[#e74c3c]/30 rounded-lg p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#e74c3c] shrink-0 mt-0.5" />
            <p className="text-xs text-[#e74c3c] font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase text-[#333333] mb-2">
              Select Your Role
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
                    className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                      active
                        ? 'bg-[#2c3e50] text-white border-[#f1c40f] border-2 shadow-md'
                        : 'bg-[#f9f9f9] text-[#333333] border-[#dddddd] hover:border-[#f1c40f] hover:bg-white'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mx-auto mb-1.5 ${
                        active ? 'text-[#f1c40f]' : 'text-[#2c3e50]'
                      }`}
                    />
                    <p className="text-xs font-semibold">{r.label}</p>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        active ? 'text-slate-300' : 'text-[#666666]'
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
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Username"
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@org.com"
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                />
              </div>
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>
          </div>

          {/* Role-Specific Organisation / NGO Affiliation Fields */}
          {(formData.role === 'DONOR' || formData.role === 'NGO') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                  Organisation Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.organisation_name}
                    onChange={(e) =>
                      setFormData({ ...formData, organisation_name: e.target.value })
                    }
                    placeholder={formData.role === 'DONOR' ? 'Hotel / Kitchen Name' : 'NGO Name'}
                    className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street & City"
                    className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.role === 'VOLUNTEER' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Affiliated Verified NGO
              </label>
              <select
                required
                value={formData.ngo}
                onChange={(e) => setFormData({ ...formData, ngo: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
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
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Service Area / Locality
              </label>
              <input
                type="text"
                required
                value={formData.service_area}
                onChange={(e) => setFormData({ ...formData, service_area: e.target.value })}
                placeholder="e.g. Kothrud, Shivajinagar, Pune"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>
          )}

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-9 pr-3 py-2.5 text-xs text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] disabled:opacity-50 font-semibold py-3.5 rounded-md flex items-center justify-center gap-2 shadow-md transition-all duration-300 mt-2 cursor-pointer"
          >
            <span>
              {loading ? 'Creating Account...' : `Register as ${formData.role}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 text-center">
          <p className="text-xs text-[#666666]">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[#2c3e50] font-semibold underline decoration-[#f1c40f] decoration-2 underline-offset-4 hover:text-[#34495e]"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}