import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/axios';
import {
  Utensils,
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  Bell,
  BarChart3,
  UserCircle,
  ShieldAlert,
  CheckCheck,
  Menu,
  X,
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await API.get('notifications/');
      setNotifications(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      // ignore background polling error
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const timer = setInterval(fetchNotifications, 20000);
      return () => clearInterval(timer);
    } else {
      setNotifications([]);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    try {
      await API.post(`notifications/${id}/read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await API.post('notifications/read-all/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/login');
  };

  const navLinkClass =
    "relative text-sm font-medium text-white hover:text-[#f1c40f] transition py-1 after:content-[''] after:block after:w-0 after:h-0.5 after:bg-[#f1c40f] after:transition-all after:duration-300 hover:after:w-full";

  return (
    <nav className="bg-[#2c3e50] sticky top-0 z-50 shadow-md px-6 sm:px-10 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 group transition-transform hover:scale-105"
        >
          <div className="p-2 bg-[#f1c40f] rounded-lg text-[#2c3e50]">
            <Utensils className="w-5 h-5" />
          </div>
          <span className="text-xl sm:text-2xl font-semibold tracking-wide text-[#f1c40f]">
            Smart<span className="text-white">Food</span>
          </span>
        </Link>

        {/* Center Navigation Links (Desktop) */}
        <div className="hidden lg:flex items-center gap-6">
          <Link to="/" className={navLinkClass}>
            Home
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className={navLinkClass}>
                Dashboard
              </Link>
              <Link to="/reports" className={navLinkClass}>
                Reports & Audit
              </Link>
              <Link to="/profile" className={navLinkClass}>
                Profile
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  to="/admin-panel"
                  className="text-sm font-semibold text-[#f1c40f] hover:text-white transition"
                >
                  Admin Console
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/#about" className={navLinkClass}>
                About
              </Link>
              <Link to="/#contact" className={navLinkClass}>
                Contact
              </Link>
            </>
          )}
        </div>

        {/* Right Auth / Dashboard / Notifications Actions */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => {
                    setNotifOpen(!notifOpen);
                    if (!notifOpen) fetchNotifications();
                  }}
                  className="relative p-2 rounded-full bg-[#34495e] text-white hover:text-[#f1c40f] transition cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 text-gray-800">
                    <div className="bg-[#2c3e50] text-white px-4 py-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Notifications ({unreadCount} unread)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-[#f1c40f] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-gray-500 text-center">
                          No notifications yet.
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => !n.is_read && markRead(n.id)}
                            className={`p-3.5 text-xs transition cursor-pointer ${
                              n.is_read
                                ? 'bg-white text-gray-600'
                                : 'bg-amber-50/70 text-gray-900 font-medium'
                            } hover:bg-gray-50`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-[#2c3e50]">{n.title}</p>
                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="mt-1 text-gray-600 leading-relaxed">{n.message}</p>
                            <p className="mt-1 text-[10px] text-gray-400">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 bg-[#34495e] border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-medium text-white">
                <ShieldCheck className="w-4 h-4 text-[#f1c40f]" />
                <span className="text-[#f1c40f] font-semibold uppercase">
                  {user.role}
                </span>
                <span className="text-white/40">|</span>
                <span>{user.username}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-[#f1c40f] transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-white hover:text-[#f1c40f] transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-[#f1c40f] hover:bg-white text-[#2c3e50] text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-full shadow-md transition-all hover:-translate-y-0.5"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle Menu"
          className="md:hidden text-white hover:text-[#f1c40f] p-1 cursor-pointer"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-white/15 flex flex-col gap-3">
          <Link to="/" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-white hover:text-[#f1c40f] py-1">
            Home
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-white hover:text-[#f1c40f] py-1 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-[#f1c40f]" /> Dashboard
              </Link>
              <Link to="/reports" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-white hover:text-[#f1c40f] py-1 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#f1c40f]" /> Reports & Audit
              </Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-white hover:text-[#f1c40f] py-1 flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-[#f1c40f]" /> Profile & Settings
              </Link>
              {user.role === 'ADMIN' && (
                <Link to="/admin-panel" onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-[#f1c40f] py-1 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Admin Console
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="mt-2 text-xs font-medium text-red-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout ({user.username})</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-white hover:text-[#f1c40f]">
                Login
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="bg-[#f1c40f] text-[#2c3e50] text-xs font-semibold px-5 py-2 rounded-full">
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}