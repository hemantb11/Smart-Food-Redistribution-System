import { useState, useEffect } from 'react';
import API from '../../services/axios';
import {
  Utensils,
  MapPin,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  Sparkles,
  ShieldAlert,
  Filter,
  Search,
} from 'lucide-react';

export default function BrowseDonations() {
  const [donations, setDonations] = useState([]);
  const [aiMatches, setAiMatches] = useState({});
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFood, setSelectedFood] = useState(null);
  const [reportFood, setReportFood] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [dietFilter, setDietFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Request modal form state
  const [reqForm, setReqForm] = useState({
    requested_quantity: '',
    min_acceptable_quantity: '',
    expected_beneficiaries: '',
    distribution_point: '',
    message: '',
    safetyAck: false,
  });

  // Quick distribution point creation
  const [newPoint, setNewPoint] = useState({
    name: '',
    type: 'SHELTER',
    address: '',
    usual_headcount: 50,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [donRes, matchRes] = await Promise.all([
        API.get('donations/'),
        API.get('core/ai/match/').catch(() => ({ data: { matches: [] } })),
      ]);

      const allDonations = Array.isArray(donRes.data)
        ? donRes.data
        : donRes.data.results || [];
      setDonations(
        allDonations.filter(
          (d) =>
            ['AVAILABLE', 'PARTIALLY_RESERVED'].includes(d.status) &&
            Number(d.available_quantity ?? d.total_quantity) > 0
        )
      );

      const matchMap = {};
      const matchList = matchRes.data?.matches || matchRes.data?.recommendations || [];
      matchList.forEach((m) => {
        matchMap[m.donation_id || m.id] = m;
      });
      setAiMatches(matchMap);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setErrorMsg(`Failed to load available food listings: ${detail}`);
    } finally {
      setLoading(false);
    }

    try {
      const ptRes = await API.get('auth/distribution-points/');
      const ptList = Array.isArray(ptRes.data) ? ptRes.data : ptRes.data.results || [];
      setPoints(ptList);
      if (ptList.length > 0) {
        setReqForm((prev) => ({ ...prev, distribution_point: ptList[0].id }));
      }
    } catch (err) {
      console.warn('Distribution points load warning:', err.response?.status);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openClaimModal = (food) => {
    setErrorMsg('');
    setSelectedFood(food);
    const maxQty = food.available_quantity ?? food.total_quantity;
    setReqForm((prev) => ({
      ...prev,
      requested_quantity: maxQty,
      min_acceptable_quantity: Math.max(1, Math.floor(Number(maxQty) / 2)),
      expected_beneficiaries: Math.max(1, Math.round(Number(maxQty))),
      message: '',
      safetyAck: false,
    }));
  };

  const handleCreatePoint = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await API.post('auth/distribution-points/', {
        name: newPoint.name,
        type: newPoint.type,
        address: newPoint.address,
        usual_headcount: Number(newPoint.usual_headcount) || 0,
      });
      const created = res.data;
      setPoints([...points, created]);
      setReqForm((prev) => ({ ...prev, distribution_point: created.id }));
      setNewPoint({ name: '', type: 'SHELTER', address: '', usual_headcount: 50 });
    } catch (err) {
      const data = err.response?.data;
      setErrorMsg(
        typeof data === 'string'
          ? data
          : JSON.stringify(data || 'Failed to add distribution point.')
      );
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqForm.safetyAck) {
      setErrorMsg('Please confirm food hygiene & shelf-life acknowledgement.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');

    try {
      await API.post('requests/', {
        donation: selectedFood.id,
        distribution_point: reqForm.distribution_point
          ? Number(reqForm.distribution_point)
          : null,
        requested_quantity: Number(reqForm.requested_quantity),
        min_acceptable_quantity: Number(
          reqForm.min_acceptable_quantity || reqForm.requested_quantity
        ),
        expected_beneficiaries: Number(reqForm.expected_beneficiaries),
        ngo_safety_ack_at: new Date().toISOString(),
        message: reqForm.message,
      });

      setSuccessMsg(`Request sent for "${selectedFood.food_name}"!`);
      setSelectedFood(null);
      loadData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      const data = err.response?.data;
      setErrorMsg(
        typeof data === 'string'
          ? data
          : data?.error ||
              data?.non_field_errors?.[0] ||
              data?.requested_quantity?.[0] ||
              JSON.stringify(data || 'Failed to submit food request.')
      );
      if (err.response?.status === 409) loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSafetyReport = async (e) => {
    e.preventDefault();
    if (!reportFood || !reportReason.trim()) return;
    setSubmitting(true);
    try {
      await API.post('safety-reports/', {
        donation: reportFood.id,
        description: reportReason,
      });
      setSuccessMsg(`Safety report submitted for "${reportFood.food_name}". Admin notified.`);
      setReportFood(null);
      setReportReason('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not submit safety report.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDonations = donations.filter((food) => {
    if (dietFilter && food.food_type !== dietFilter) return false;
    if (stateFilter && food.food_state !== stateFilter) return false;
    if (
      searchTerm &&
      !`${food.food_name} ${food.location} ${food.allergens || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#2c3e50] border-b-4 border-[#f1c40f]">
        <img
          src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80"
          alt="Browse Available Food"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 p-6 sm:p-8 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 bg-[#f1c40f] text-[#2c3e50] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Matched Surplus Feed
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Browse Available Surplus Food
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
            Filter by diet, storage state &amp; AI relevance match to claim verified surplus meals for your shelters.
          </p>
        </div>
      </div>

      {/* SEARCH & SAFETY FILTERS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2c3e50]">
          <Filter className="w-4 h-4 text-[#f1c40f]" />
          <span>Filters:</span>
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search food, area, or allergen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
          />
        </div>
        <select
          value={dietFilter}
          onChange={(e) => setDietFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
        >
          <option value="">All Diet Types</option>
          <option value="VEGETARIAN">Vegetarian</option>
          <option value="VEGAN">Vegan</option>
          <option value="EGG">Egg</option>
          <option value="NON_VEGETARIAN">Non-Vegetarian</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50] focus:bg-white focus:border-[#2c3e50] outline-none"
        >
          <option value="">All Food States</option>
          <option value="COOKED_MEAL">Cooked Meal</option>
          <option value="PACKAGED">Packaged</option>
          <option value="RAW_PRODUCE">Raw Produce</option>
          <option value="BAKERY">Bakery</option>
          <option value="BEVERAGE">Beverage</option>
        </select>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && !selectedFood && !reportFood && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading active food donations...</p>
      ) : filteredDonations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <Utensils className="w-11 h-11 text-[#2c3e50] mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-[#2c3e50]">
            No Matching Food Listings Right Now
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Adjust filters or check back shortly as donors publish new surplus meals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDonations.map((food) => {
            const match = aiMatches[food.id];
            return (
              <div
                key={food.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 border-b-4 border-b-[#f1c40f] flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <h3 className="text-lg font-bold text-[#2c3e50]">{food.food_name}</h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                      {food.status === 'PARTIALLY_RESERVED' ? 'PARTIAL POOL' : 'LIVE'}
                    </span>
                  </div>

                  {/* AI Match Badge */}
                  {match && (
                    <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        <strong>{match.match_score ?? match.score}% Match:</strong>{' '}
                        {match.reason || 'Aligned with your NGO service area & capacity'}
                      </span>
                    </div>
                  )}

                  {/* Diet, State & Storage Pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3.5 text-[10px] font-bold">
                    <span className="bg-slate-100 text-[#2c3e50] px-2.5 py-0.5 rounded-md">
                      {food.food_type}
                    </span>
                    {food.food_state && (
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">
                        {food.food_state}
                      </span>
                    )}
                    {food.storage_condition && (
                      <span className="bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-md">
                        {food.storage_condition}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#2c3e50] shrink-0" />
                      <span>
                        Available:{' '}
                        <strong className="text-emerald-700">
                          {food.available_quantity ?? food.total_quantity} {food.unit}
                        </strong>
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#2c3e50] shrink-0" />
                      <span>{food.location}</span>
                    </p>
                    {(food.consume_by || food.best_before) && (
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#2c3e50] shrink-0" />
                        <span>
                          {food.consume_by
                            ? `Consume by: ${new Date(food.consume_by).toLocaleString()}`
                            : `Best before: ${food.best_before}`}
                        </span>
                      </p>
                    )}
                    {food.allergens && (
                      <p className="text-[11px] text-amber-800 bg-amber-50/70 px-2.5 py-1 rounded-lg mt-1">
                        <strong>Allergens:</strong> {food.allergens}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => openClaimModal(food)}
                    className="flex-1 bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
                  >
                    Request Food
                  </button>
                  <button
                    onClick={() => {
                      setReportFood(food);
                      setReportReason('');
                    }}
                    title="Report Food Safety Concern"
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLAIM MODAL */}
      {selectedFood && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-b-4 border-[#f1c40f] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#2c3e50]">
                Claim: {selectedFood.food_name}
              </h3>
              <button
                onClick={() => setSelectedFood(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                {errorMsg}
              </div>
            )}

            {points.length === 0 ? (
              <form
                onSubmit={handleCreatePoint}
                className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200"
              >
                <p className="text-xs font-bold text-[#2c3e50]">
                  First, add an NGO Distribution Point / Shelter Address:
                </p>
                <input
                  type="text"
                  required
                  placeholder="Shelter / Center Name (e.g. Aashray Seva Shelter)"
                  value={newPoint.name}
                  onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    required
                    value={newPoint.type}
                    onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="SHELTER">Shelter Home</option>
                    <option value="ORPHANAGE">Orphanage</option>
                    <option value="OLD_AGE_HOME">Old Age Home</option>
                    <option value="COMMUNITY_KITCHEN">Community Kitchen</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Usual Headcount"
                    value={newPoint.usual_headcount}
                    onChange={(e) =>
                      setNewPoint({ ...newPoint, usual_headcount: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Full Delivery Address"
                  value={newPoint.address}
                  onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                />
                <button
                  type="submit"
                  className="bg-[#2c3e50] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Save Delivery Point
                </button>
              </form>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Delivery Distribution Point
                  </label>
                  <select
                    required
                    value={reqForm.distribution_point}
                    onChange={(e) =>
                      setReqForm({ ...reqForm, distribution_point: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-[#2c3e50]"
                  >
                    {points.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name} ({pt.type}) — {pt.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Requested ({selectedFood.unit})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max={selectedFood.available_quantity ?? selectedFood.total_quantity}
                      required
                      value={reqForm.requested_quantity}
                      onChange={(e) =>
                        setReqForm({ ...reqForm, requested_quantity: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Min Acceptable
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max={reqForm.requested_quantity}
                      value={reqForm.min_acceptable_quantity}
                      onChange={(e) =>
                        setReqForm({
                          ...reqForm,
                          min_acceptable_quantity: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Beneficiaries
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={reqForm.expected_beneficiaries}
                      onChange={(e) =>
                        setReqForm({
                          ...reqForm,
                          expected_beneficiaries: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Note to Donor
                  </label>
                  <textarea
                    rows="2"
                    value={reqForm.message}
                    onChange={(e) => setReqForm({ ...reqForm, message: e.target.value })}
                    placeholder="Pickup timing or container requirements..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#2c3e50]"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-600 bg-amber-50/70 p-3 rounded-xl border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqForm.safetyAck}
                    onChange={(e) =>
                      setReqForm({ ...reqForm, safetyAck: e.target.checked })
                    }
                    className="mt-0.5 accent-[#2c3e50]"
                  />
                  <span>
                    We acknowledge food shelf-life limits ({selectedFood.allergens || 'checked allergens'}) and will inspect hygiene before beneficiary distribution.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>{submitting ? 'Sending Request...' : 'Confirm Food Request'}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SAFETY REPORT MODAL */}
      {reportFood && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-b-4 border-rose-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#2c3e50] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Report Safety Concern</span>
              </h3>
              <button
                onClick={() => setReportFood(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Flagging <strong>{reportFood.food_name}</strong> for FoodBridge Administrator review.
            </p>
            <form onSubmit={handleSafetyReport} className="space-y-3">
              <textarea
                required
                rows="3"
                placeholder="Describe hygiene, packaging, or expiry concern..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#2c3e50]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Safety Report'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}