import { useState, useEffect } from 'react';
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
  Building2,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Sparkles,
} from 'lucide-react';

const HERO_SLIDES = [
  {
    image:
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1400&q=80',
    badge: 'Zero-Waste Food Rescue',
    title: 'Rescue Surplus Meals & Serve Local Communities',
    subtitle:
      'FoodBridge connects restaurants, caterers, and event donors directly with verified NGOs before nutritious food goes to waste.',
  },
  {
    image:
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80',
    badge: 'Community Impact & Shelters',
    title: 'Nutritious Meals Delivered to Those Who Need Them Most',
    subtitle:
      'Every donation is tracked from kitchen to community shelter with full beneficiary headcount transparency.',
  },
  {
    image:
      'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1400&q=80',
    badge: '4-Point Hygiene & OTP Security',
    title: 'Safe, Verified & Fast Volunteer Dispatch Network',
    subtitle:
      'Mandatory food safety declarations, pickup inspection checklists, and 6-digit OTP verification at every step.',
  },
];

export default function Home() {
  const { user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Auto-scroll hero images every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setMsg('');
    setError('');
    try {
      await API.post('auth/contact/', contactForm);
      setMsg('Thank you! Your message has been sent to the FoodBridge team.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setMsg(''), 5000);
    } catch {
      setError('Failed to send message. Please check if the backend server is running.');
    } finally {
      setSending(false);
    }
  };

  const activeHero = HERO_SLIDES[currentSlide];

  return (
    <div className="min-h-screen bg-slate-50 text-[#2c3e50] flex flex-col">
      {/* Hero Section with Auto-Scrolling Website Images */}
      <section className="relative h-110 sm:h-122.5 w-full overflow-hidden bg-[#2c3e50]">
        {HERO_SLIDES.map((slide, index) => (
          <img
            key={slide.title}
            src={slide.image}
            alt={slide.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}

        {/* Dark Gradient Overlay for Readable Text */}
        <div className="absolute inset-0 bg-linear-to-r from-[#2c3e50]/95 via-[#2c3e50]/80 to-[#2c3e50]/45" />

        {/* Hero Content */}
        <div className="relative z-10 max-w-6xl mx-auto h-full px-6 flex flex-col justify-center">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3.5 py-1 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              {activeHero.badge}
            </span>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              {activeHero.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {activeHero.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {user ? (
                <Link
                  to="/dashboard"
                  className="bg-[#f1c40f] hover:bg-yellow-400 text-[#2c3e50] text-xs sm:text-sm font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2 transition hover:-translate-y-0.5"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="bg-[#f1c40f] hover:bg-yellow-400 text-[#2c3e50] text-xs sm:text-sm font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2 transition hover:-translate-y-0.5"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs sm:text-sm font-semibold px-6 py-3 rounded-full transition"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Left / Right Scroll Arrows */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous slide"
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] p-2 rounded-full transition cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] p-2 rounded-full transition cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Bottom Slide Indicator Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {HERO_SLIDES.map((slide, idx) => (
            <button
              key={slide.badge}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                idx === currentSlide ? 'w-7 bg-[#f1c40f]' : 'w-2.5 bg-white/60 hover:bg-white'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Platform Roles & Capabilities with Role Images & Gradient Icon Badges */}
      <section id="about" className="max-w-6xl mx-auto w-full px-6 py-14">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#2c3e50] border-b-4 border-[#f1c40f] inline-block pb-1">
            Platform Roles &amp; Capabilities
          </h2>
          <p className="text-xs text-[#666666] mt-2">
            Dedicated dashboards and safety workflows for every FoodBridge stakeholder.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Food Donors */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all border-b-4 border-[#f1c40f] flex flex-col justify-between group">
            <div>
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80"
                  alt="Surplus Catering & Restaurant Food"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#2c3e50]/70 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 bg-amber-400 text-[#2c3e50] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Hotels &amp; Caterers
                </span>
              </div>

              <div className="p-6 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-100 to-amber-200 text-amber-700 flex items-center justify-center shadow-xs">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#2c3e50]">Food Donors</h3>
                </div>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Publish surplus meals with allergen tags, storage conditions, and pickup deadlines,
                  and approve NGO requests with OTP security.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                to={user?.role === 'DONOR' ? '/create-donation' : '/register'}
                className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <span>{user?.role === 'DONOR' ? 'Post Surplus Food' : 'Join as Donor'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Verified NGOs */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all border-b-4 border-[#f1c40f] flex flex-col justify-between group">
            <div>
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80"
                  alt="NGO Shelter Food Distribution"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#2c3e50]/70 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 bg-emerald-400 text-[#2c3e50] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Shelters &amp; Relief Trusts
                </span>
              </div>

              <div className="p-6 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#2c3e50]">Verified NGOs</h3>
                </div>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Browse AI-matched food listings, assign approved riders, verify receipt hygiene,
                  and record community meal distributions.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                to={user?.role === 'NGO' ? '/browse-donations' : '/register'}
                className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <span>{user?.role === 'NGO' ? 'Browse Surplus Food' : 'Join as NGO'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Delivery Volunteers */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all border-b-4 border-[#f1c40f] flex flex-col justify-between group">
            <div>
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&w=800&q=80"
                  alt="Volunteer Food Pickup & Delivery"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#2c3e50]/70 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 bg-sky-400 text-[#2c3e50] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Rapid Logistics Fleet
                </span>
              </div>

              <div className="p-6 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-sky-100 to-sky-200 text-sky-700 flex items-center justify-center shadow-xs">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#2c3e50]">Delivery Volunteers</h3>
                </div>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Accept pickup tasks, complete mandatory food inspection checklists with 6-digit
                  OTPs, and deliver safely to shelter points.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                to={user?.role === 'VOLUNTEER' ? '/volunteer-tasks' : '/register'}
                className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <span>
                  {user?.role === 'VOLUNTEER' ? 'My Delivery Tasks' : 'Join as Volunteer'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Workflow Highlights with Gradient Icon Badges */}
      <section className="max-w-6xl mx-auto w-full px-6 pb-14">
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2c3e50]">Live Expiry Alerts</h4>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                AI priority flags urgent donations nearing pickup deadlines.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2c3e50]">4-Stage Hygiene Audit</h4>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Verified checks from donor listing to NGO shelter receipt.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2c3e50]">OTP Handover</h4>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                6-digit verification code ensures authorized volunteer pickup.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2c3e50]">Impact Reporting</h4>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Full audit trail of meals served and zero-waste metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="max-w-3xl mx-auto w-full px-6 pb-16 flex-1">
        <div className="bg-white rounded-2xl p-8 shadow-sm border-b-4 border-[#f1c40f]">
          <h2 className="text-xl font-bold text-[#2c3e50] border-b-4 border-[#f1c40f] inline-block pb-1">
            Contact Us
          </h2>
          <p className="text-xs text-[#666666] mt-2 mb-6">
            Have questions about food donations, NGO onboarding, or support? Send us a message.
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
                  className="w-full bg-gray-50 border border-[#dddddd] rounded-md px-3 py-2 text-sm"
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
                  className="w-full bg-gray-50 border border-[#dddddd] rounded-md px-3 py-2 text-sm"
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
                className="w-full bg-gray-50 border border-[#dddddd] rounded-md px-3 py-2 text-sm"
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
                className="w-full bg-gray-50 border border-[#dddddd] rounded-md px-3 py-2 text-sm"
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

      {/* Professional Footer */}
      <footer className="bg-[#2c3e50] text-white border-t-4 border-[#f1c40f]">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand Info */}
          <div className="space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-linear-to-br from-[#f1c40f] to-amber-500 text-[#2c3e50] flex items-center justify-center shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5"
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
              <span className="text-lg font-bold tracking-tight text-[#f1c40f]">
                Food<span className="text-white">Bridge</span>
              </span>
            </Link>
            <p className="text-xs text-slate-300 leading-relaxed">
              An AI-assisted surplus food redistribution network connecting verified donors,
              NGOs, and volunteers for safe, zero-waste community meal rescue.
            </p>
          </div>

          {/* Column 2: Quick Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#f1c40f] mb-3">
              Platform Navigation
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link to="/" className="hover:text-[#f1c40f] transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to={user ? '/dashboard' : '/login'} className="hover:text-[#f1c40f] transition">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to={user ? '/reports' : '/login'} className="hover:text-[#f1c40f] transition">
                  Reports &amp; Audit
                </Link>
              </li>
              <li>
                <Link to={user ? '/profile' : '/login'} className="hover:text-[#f1c40f] transition">
                  Profile &amp; Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Stakeholder Portals */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#f1c40f] mb-3">
              Stakeholder Portals
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link
                  to={user?.role === 'DONOR' ? '/create-donation' : '/register'}
                  className="hover:text-[#f1c40f] transition"
                >
                  Donate Surplus Food
                </Link>
              </li>
              <li>
                <Link
                  to={user?.role === 'NGO' ? '/browse-donations' : '/register'}
                  className="hover:text-[#f1c40f] transition"
                >
                  NGO Food Claims
                </Link>
              </li>
              <li>
                <Link
                  to={user?.role === 'VOLUNTEER' ? '/volunteer-tasks' : '/register'}
                  className="hover:text-[#f1c40f] transition"
                >
                  Volunteer Delivery Tasks
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-[#f1c40f] transition">
                  Register New Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Compliance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#f1c40f] mb-3">
              Support &amp; Compliance
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#f1c40f] shrink-0 mt-0.5" />
                <span>Dhule, Maharashtra, India</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#f1c40f] shrink-0" />
                <span>support@foodbridge.org</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#f1c40f] shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2 text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>4-Stage Hygiene &amp; OTP Verified</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <p>© {new Date().getFullYear()} FoodBridge Redistribution System. All rights reserved.</p>
            <p>Zero-Waste Surplus Food Rescue &amp; Community Nutrition Network</p>
          </div>
        </div>
      </footer>
    </div>
  );
}