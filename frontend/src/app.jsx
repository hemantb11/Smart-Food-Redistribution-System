import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import CreateDonation from './pages/donor/CreateDonation';
import MyDonations from './pages/donor/MyDonations';
import IncomingRequests from './pages/donor/IncomingRequests';
import BrowseDonations from './pages/ngo/BrowseDonations';
import MyRequests from './pages/ngo/MyRequests';
import Distributions from './pages/ngo/Distributions';
import VolunteerTasks from './pages/volunteer/VolunteerTasks';
import AdminPanel from './pages/admin/AdminPanel';
import Profile from './pages/Profile';
import Reports from './pages/Reports';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center text-[#2c3e50] text-sm font-medium">
        Loading portal...
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#f8f9fa] text-[#333333]">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/create-donation" element={<ProtectedRoute><CreateDonation /></ProtectedRoute>} />
            <Route path="/my-donations" element={<ProtectedRoute><MyDonations /></ProtectedRoute>} />
            <Route path="/incoming-requests" element={<ProtectedRoute><IncomingRequests /></ProtectedRoute>} />
            <Route path="/browse-donations" element={<ProtectedRoute><BrowseDonations /></ProtectedRoute>} />
            <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
            <Route path="/distributions" element={<ProtectedRoute><Distributions /></ProtectedRoute>} />
            <Route path="/volunteer-tasks" element={<ProtectedRoute><VolunteerTasks /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/admin-panel" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}