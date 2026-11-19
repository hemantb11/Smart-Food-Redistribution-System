import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../services/axios';
import { Utensils, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

export default function CreateDonation() {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    category: '',
    food_name: '',
    unit: 'kg',
    total_quantity: '',
    food_type: 'VEGETARIAN',
    food_state: 'COOKED_MEAL',
    prepared_at: '',
    consume_by: '',
    best_before: '',
    pickup_deadline: '',
    earliest_pickup: '',
    storage_condition: 'HOT_HELD',
    packaging: 'SEALED_CONTAINER',
    temperature_c: '',
    allergens: 'None declared',
    ingredients_notes: '',
    location: '',
    donor_declaration: false,
  });

  const [aiLogId, setAiLogId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('donations/categories/')
      .then((res) => {
        setCategories(res.data);
        if (res.data.length > 0) {
          setFormData((prev) => ({ ...prev, category: res.data[0].id }));
        }
      })
      .catch(() =>
        setError('Failed to load food categories. Add categories in Django Admin first.')
      );
  }, []);

  const handleGenerateDescription = async () => {
    setAiLoading(true);
    try {
      const res = await API.post('core/ai/description/', formData);
      setFormData((prev) => ({
        ...prev,
        ingredients_notes: res.data.suggested_description,
      }));
      setAiLogId(res.data.log_id);
    } catch {
      setError('Could not generate description.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.donor_declaration) {
      setError('You must confirm the food safety declaration before publishing.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (!payload.prepared_at) delete payload.prepared_at;
      if (!payload.consume_by) delete payload.consume_by;
      if (!payload.best_before) delete payload.best_before;
      if (!payload.earliest_pickup) delete payload.earliest_pickup;
      if (!payload.temperature_c) delete payload.temperature_c;

      const res = await API.post('donations/', payload);
      const donationId = res.data.id;
      await API.post(`donations/${donationId}/publish/`, { donor_declaration: true });

      if (aiLogId) {
        await API.post(`core/ai/logs/${aiLogId}/action/`, { user_action: 'ACCEPTED' }).catch(
          () => {}
        );
      }

      navigate('/my-donations');
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === 'object') {
        const firstKey = Object.keys(errData)[0];
        const msg = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        setError(`${firstKey.toUpperCase()}: ${msg}`);
      } else {
        setError('Failed to create donation listing.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isPackaged = formData.food_state === 'PACKAGED';

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl p-6 sm:p-10 shadow-[0_8px_25px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
          <div className="p-3 bg-[#2c3e50] text-[#f1c40f] rounded-xl">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#2c3e50] border-b-3 border-[#f1c40f] inline-block pb-1">
              Post Surplus Food Donation
            </h1>
            <p className="text-xs text-[#666666] mt-1">
              Declare food safety, storage conditions, allergens & pickup window
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-[#e74c3c]/10 border border-[#e74c3c]/30 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#e74c3c] shrink-0 mt-0.5" />
            <p className="text-xs text-[#e74c3c] font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Food Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Food Name *
              </label>
              <input
                type="text"
                required
                value={formData.food_name}
                onChange={(e) => setFormData({ ...formData, food_name: e.target.value })}
                placeholder="e.g. Steamed Rice & Dal Tadka"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Food Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name} (Max {c.max_age_hours_policy}h)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity, Unit, Diet Type */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Total Quantity *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.total_quantity}
                onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
                placeholder="50"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Unit *
              </label>
              <input
                type="text"
                required
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="kg / portions / litres"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Diet Type *
              </label>
              <select
                value={formData.food_type}
                onChange={(e) => setFormData({ ...formData, food_type: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              >
                <option value="VEGETARIAN">Vegetarian</option>
                <option value="NON_VEGETARIAN">Non-Vegetarian</option>
                <option value="EGG">Egg</option>
                <option value="VEGAN">Vegan</option>
              </select>
            </div>
          </div>

          {/* Food State, Storage Condition & Packaging (SRS Section 6.2) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Food State *
              </label>
              <select
                value={formData.food_state}
                onChange={(e) => setFormData({ ...formData, food_state: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              >
                <option value="COOKED_MEAL">Cooked Meal</option>
                <option value="PACKAGED">Packaged</option>
                <option value="RAW_PRODUCE">Raw Produce</option>
                <option value="BAKERY">Bakery</option>
                <option value="BEVERAGE">Beverage</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Storage Condition *
              </label>
              <select
                value={formData.storage_condition}
                onChange={(e) =>
                  setFormData({ ...formData, storage_condition: e.target.value })
                }
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              >
                <option value="HOT_HELD">Hot-held</option>
                <option value="AMBIENT">Ambient (Room Temp)</option>
                <option value="REFRIGERATED">Refrigerated</option>
                <option value="FROZEN">Frozen</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Packaging Type *
              </label>
              <select
                value={formData.packaging}
                onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              >
                <option value="SEALED_CONTAINER">Sealed Container</option>
                <option value="COVERED_TRAY">Covered Tray</option>
                <option value="FOIL_WRAP">Foil / Wrap</option>
                <option value="ORIGINAL_SEALED">Original Sealed Pack</option>
                <option value="OPEN">Open</option>
              </select>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Prepared At {!isPackaged && '*'}
              </label>
              <input
                type="datetime-local"
                required={!isPackaged}
                value={formData.prepared_at}
                onChange={(e) => setFormData({ ...formData, prepared_at: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>

            {isPackaged ? (
              <div>
                <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                  Best Before Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.best_before}
                  onChange={(e) => setFormData({ ...formData, best_before: e.target.value })}
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                  Consume By Deadline *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.consume_by}
                  onChange={(e) => setFormData({ ...formData, consume_by: e.target.value })}
                  className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Pickup Deadline *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.pickup_deadline}
                onChange={(e) => setFormData({ ...formData, pickup_deadline: e.target.value })}
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>
          </div>

          {/* Address & Allergens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Pickup Address / Location *
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Full Hotel / Kitchen Address"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#333333] mb-1.5">
                Allergen Declarations *
              </label>
              <input
                type="text"
                required
                value={formData.allergens}
                onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                placeholder="e.g. Contains Nuts, Dairy or 'None declared'"
                className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2.5 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
              />
            </div>
          </div>

          {/* AI Description Generator Helper (SRS Section 11.2) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase text-[#333333]">
                Handling & Ingredients Notes
              </label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={aiLoading || !formData.food_name}
                className="text-xs font-semibold text-[#2c3e50] bg-[#f1c40f]/30 hover:bg-[#f1c40f] px-3 py-1 rounded-full flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiLoading ? 'Generating...' : 'AI Suggest Summary'}</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={formData.ingredients_notes}
              onChange={(e) =>
                setFormData({ ...formData, ingredients_notes: e.target.value })
              }
              placeholder="Optional ingredients, spice level, or serving notes..."
              className="w-full bg-[#f9f9f9] border border-[#dddddd] rounded-md px-3.5 py-2 text-xs text-[#333333] focus:bg-white focus:outline-none focus:border-[#f1c40f] transition"
            />
            {aiLogId && (
              <p className="text-[11px] text-amber-700 mt-1">
                Advisory AI summary generated — please review and edit if needed before publishing.
              </p>
            )}
          </div>

          {/* Safety Guarantee */}
          <div className="bg-[#f8f9fa] border-l-4 border-[#f1c40f] rounded-r-lg p-4 mt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.donor_declaration}
                onChange={(e) =>
                  setFormData({ ...formData, donor_declaration: e.target.checked })
                }
                className="mt-0.5 rounded border-[#dddddd] accent-[#2c3e50]"
              />
              <span className="text-xs text-[#555555] leading-relaxed">
                <strong className="text-[#2c3e50] flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-[#2c3e50]" /> Food Safety Guarantee:
                </strong>
                I hereby declare that this food has been prepared and stored under hygienic conditions and is fit for human consumption prior to the specified deadline.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#2c3e50] hover:bg-[#f1c40f] text-white hover:text-[#2c3e50] disabled:opacity-50 font-semibold py-3.5 rounded-md flex items-center justify-center gap-2 shadow-md transition-all duration-300 cursor-pointer"
          >
            {submitting ? 'Publishing Food Listing...' : 'Publish Food Donation'}
          </button>
        </form>
      </div>
    </div>
  );
}