import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/axios';
import { useAuth } from '../context/AuthContext';
import {
  Utensils,
  Truck,
  ShieldCheck,
  HeartHandshake,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setMsg('');
    setError('');
    try {
      await API.post('auth/contact/', contactForm);
      setMsg('Thank you! Your message has been sent to the SmartFood team.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setMsg(''), 5000);
    } catch {
      setError('Failed to send message. Please check if the backend server is running.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slateDark-950 text-[#2c3e50]">
      {/* Hero Section */}
      <section className="bg-[#2c3e50] text-white py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 bg-white/10 text-[#f1c40f] text-xs font-semibold px-3.5 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Assisted Surplus Food Rescue Network</span>
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
              Turn Surplus Meals Into <span className="text-[#f1c40f]">Community Hope</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              SmartFood connects restaurants, caterers, and event donors with verified NGOs and
              trained volunteers—ensuring safe, traceable, zero-waste meal redistribution before
              expiry.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {user ? (
                <Link
                  to="/dashboard"
                  className="bg-[#f1c40f] hover:bg-yellow-400 text-[#2c3e50] text-xs sm:text-sm font-bold px-6 py-3 rounded-full flex items-center gap-2 transition"
                >
                  <span>Go to My Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="bg-[#f1c40f] hover:bg-yellow-400 text-[#2c3e50] text-xs sm:text-sm font-bold px-6 py-3 rounded-full flex items-center gap-2 transition"
                  >
                    <span>Join as Donor / NGO / Volunteer</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="border border-white/30 hover:border-[#f1c40f] text-white hover:text-[#f1c40f] text-xs sm:text-sm font-semibold px-6 py-3 rounded-full transition"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/10 space-y-2">
              <Utensils className="w-7 h-7 text-[#f1c40f]" />
              <h3 className="font-semibold text-base">Real-Time T/R/A Pools</h3>
              <p className="text-xs text-slate-300">
                Track total, reserved, available, and distributed meal quantities with live
                conflict protection.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/10 space-y-2">
              <ShieldCheck className="w-7 h-7 text-[#f1c40f]" />
              <h3 className="font-semibold text-base">4-Point Hygiene Checks</h3>
              <p className="text-xs text-slate-300">
                Mandatory donor declarations, pickup safety checklists, 6-digit OTPs, and NGO
                receipt verification.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/10 space-y-2">
              <Truck className="w-7 h-7 text-[#f1c40f]" />
              <h3 className="font-semibold text-base">Verified Volunteer Dispatch</h3>
              <p className="text-xs text-slate-300">
                NGO-approved riders receive instant pickup tasks with step-by-step status
                tracking.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/10 space-y-2">
              <HeartHandshake className="w-7 h-7 text-[#f1c40f]" />
              <h3 className="font-semibold text-base">Transparent Impact Audit</h3>
              <p className="text-xs text-slate-300">
                Every portion served or discarded is logged for complete donor and shelter
                accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-[#2c3e50] border-b-4 border-[#f1c40f] inline-block pb-1">
            How SmartFood Works
          </h2>
          <p className="text-xs text-[#666666] mt-2">
            A structured three-role rescue workflow built for food safety and speed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-[#f1c40f]">
            <span className="text-xs font-bold text-[#f1c40f] bg-[#2c3e50] px-2.5 py-1 rounded-full">
              Step 1 • Donor
            </span>
            <h3 className="text-lg font-semibold mt-3 mb-2">List Surplus Food</h3>
            <p className="text-xs text-[#555555] leading-relaxed">
              Post cooked meals, produce, or packaged items with storage conditions, allergens, and
              pickup deadlines.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-[#f1c40f]">
            <span className="text-xs font-bold text-[#f1c40f] bg-[#2c3e50] px-2.5 py-1 rounded-full">
              Step 2 • NGO
            </span>
            <h3 className="text-lg font-semibold mt-3 mb-2">Claim &amp; Assign Rider</h3>
            <p className="text-xs text-[#555555] leading-relaxed">
              Verified NGOs claim matched donations, assign an available volunteer, and generate a
              6-digit Pickup OTP.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-[#f1c40f]">
            <span className="text-xs font-bold text-[#f1c40f] bg-[#2c3e50] px-2.5 py-1 rounded-full">
              Step 3 • Volunteer &amp; Shelter
            </span>
            <h3 className="text-lg font-semibold mt-3 mb-2">Verify, Deliver &amp; Serve</h3>
            <p className="text-xs text-[#555555] leading-relaxed">
              Volunteers verify hygiene with the OTP, deliver to shelter points, and NGOs log
              final beneficiary counts.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-white rounded-xl p-8 shadow-sm border-b-4 border-[#f1c40f]">
          <h2 className="text-xl font-bold text-[#2c3e50] mb-1">Contact SmartFood Support</h2>
          <p className="text-xs text-[#666666] mb-6">
            Have questions about NGO verification, donor onboarding, or food safety guidelines?
          </p>

          {msg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-3.5 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{msg}</span>
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3.5 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase mb-1">Subject</label>
              <input
                type="text"
                required
                value={contactForm.subject}
                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="How can we help?"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase mb-1">Message</label>
              <textarea
                rows="3"
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Write your message here..."
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold px-6 py-2.5 rounded-md flex items-center gap-2 transition cursor-pointer"
            >
              <span>{sending ? 'Sending...' : 'Send Message'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}