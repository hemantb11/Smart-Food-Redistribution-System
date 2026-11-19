import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Utensils, User, Lock, ArrowRight, AlertCircle } from 'lucide-react';

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
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9fa] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-xl p-8 sm:p-10 shadow-[0_8px_25px_rgba(0,0,0,0.08)] border-b-4 border-[#f1c40f]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#2c3e50] text-[#f1c40f] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Utensils className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold text-[#2c3e50] inline-block border-b-3 border-[#f1c40f] pb-1">
            Welcome Back
          </h1>
          <p className="text-xs text-[#666666] mt-2">
            Sign in to your Smart Food Redistribution Portal
          </p>
        </div>

        {/* Error Box */}
        {error && (
          <div className="mb-5 bg-[#e74c3c]/10 border border-[#e74c3c]/30 rounded-lg p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#e74c3c] shrink-0 mt-0.5" />
            <p className="text-xs text-[#e74c3c] font-medium">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-10 pr-4 py-3 text-sm text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md pl-10 pr-4 py-3 text-sm text-[#333333] placeholder-[#888888] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] disabled:opacity-50 font-semibold py-3.5 rounded-md flex items-center justify-center gap-2 shadow-md transition-all duration-300 cursor-pointer"
          >
            <span>{loading ? 'Signing In...' : 'Sign In to Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-7 pt-5 border-t border-slate-200 text-center">
          <p className="text-xs text-[#666666]">
            Don&apos;t have an account yet?{' '}
            <Link
              to="/register"
              className="text-[#2c3e50] font-semibold underline decoration-[#f1c40f] decoration-2 underline-offset-4 hover:text-[#34495e]"
            >
              Create an Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}