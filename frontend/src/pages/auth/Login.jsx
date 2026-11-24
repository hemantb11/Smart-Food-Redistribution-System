import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Lock, ArrowRight, AlertCircle, ShieldCheck, HeartHandshake } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Invalid username or password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-12">
        {/* Left Visual Brand Panel */}
        <div className="md:col-span-5 relative bg-[#2c3e50] text-white p-8 flex flex-col justify-between overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=80"
            alt="FoodBridge Community Relief"
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-linear-to-br from-[#f1c40f] to-amber-500 text-[#2c3e50] flex items-center justify-center shadow-md">
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
                <span className="text-xl font-bold tracking-tight text-[#f1c40f]">
                  Food<span className="text-white">Bridge</span>
                </span>
                <p className="text-[10px] uppercase tracking-widest text-slate-300">
                  Surplus to Shelter
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold leading-snug pt-2">
              Turning Surplus Meals Into Community Hope.
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sign in to coordinate verified food pickups, monitor live shelter distributions, and
              maintain 4-stage hygiene compliance.
            </p>
          </div>

          <div className="relative z-10 space-y-2.5 pt-8 border-t border-white/15 text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#f1c40f] shrink-0" />
              <span>6-Digit OTP &amp; Hygiene Verified Handovers</span>
            </div>
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-Time Donor, NGO &amp; Rider Dispatch</span>
            </div>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-[#2c3e50] inline-block border-b-4 border-[#f1c40f] pb-1">
              Welcome Back
            </h1>
            <p className="text-xs text-slate-500 mt-2">
              Sign in to your FoodBridge Redistribution Portal
            </p>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-[#2c3e50] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#2c3e50] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] disabled:opacity-50 font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all duration-300 cursor-pointer"
            >
              <span>{loading ? 'Signing In...' : 'Sign In to FoodBridge'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account yet?{' '}
              <Link
                to="/register"
                className="text-[#2c3e50] font-bold underline decoration-[#f1c40f] decoration-2 underline-offset-4 hover:text-amber-600"
              >
                Create a FoodBridge Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}