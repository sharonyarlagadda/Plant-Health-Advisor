import { useState } from 'react';
import { ChecklistItem, ChecklistResult } from '../types';
import { logQueryToFirestore } from '../lib/firebase';
import { DisclaimerBanner } from './DisclaimerBanner';
import {
  ClipboardCheck,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Database,
  Info
} from 'lucide-react';

interface PreventiveChecklistViewProps {
  onLogUpdated?: () => void;
}

const POPULAR_PLANTS = [
  'Tomato',
  'Rice (Paddy)',
  'Wheat',
  'Cotton',
  'Chilli',
  'Potato',
  'Rose',
  'Sugarcane',
  'Brinjal (Eggplant)',
  'Onion',
  'Banana',
  'Mango',
];

export function PreventiveChecklistView({ onLogUpdated }: PreventiveChecklistViewProps) {
  const [plantInput, setPlantInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [firestoreLogId, setFirestoreLogId] = useState<string | null>(null);

  const fetchChecklist = async (targetPlant?: string) => {
    const queryPlant = (targetPlant || plantInput).trim();
    if (!queryPlant) {
      setError('Please enter a plant or crop name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/preventive-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantName: queryPlant }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to generate checklist');
      }

      const data: ChecklistResult = await res.json();
      setResult(data);
      setCheckedItems({});

      // Log to Firestore as required by Feature 4
      const inputSummary = `Plant: ${queryPlant}`;
      const checklistSummary = data.checklist
        .map((c, i) => `${i + 1}. ${c.title}`)
        .join('; ');
      const resultSummary = `Generated ${data.checklist.length} early warning checks for ${queryPlant}: ${checklistSummary}`;

      const logId = await logQueryToFirestore({
        timestamp: new Date().toISOString(),
        feature: 'Preventive Checklist',
        inputSummary,
        resultSummary,
        crop: queryPlant,
      });

      setFirestoreLogId(logId);
      if (onLogUpdated) onLogUpdated();
    } catch (err: any) {
      console.error('Checklist error:', err);
      setError(err?.message || 'Failed to retrieve preventive checklist. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getCriticalityBadge = (criticality: ChecklistItem['criticality']) => {
    switch (criticality) {
      case 'High':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Low':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  const totalChecks = result?.checklist.length || 0;
  const inspectedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit'] tracking-tight">
          Preventive Plant Care Checklist
        </h1>
        <p className="text-sm text-stone-600">
          Search any plant or crop to generate a customized early warning signs checklist powered by Gemini Flash, helping you prevent infestations before they spread.
        </p>
      </div>

      <DisclaimerBanner compact />

      {/* Input Box Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchChecklist();
          }}
          className="space-y-3"
        >
          <label htmlFor="plant-name-input" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Plant or Crop Name
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="plant-name-input"
                type="text"
                value={plantInput}
                onChange={(e) => setPlantInput(e.target.value)}
                placeholder="e.g., Tomato, Cotton, Rice, Rose, Chilli, Potato..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
            </div>
            <button
              type="submit"
              id="btn-generate-checklist"
              disabled={loading || !plantInput.trim()}
              className={`py-2.5 px-6 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                loading || !plantInput.trim()
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
              }`}
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>Consulting Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>Get Checklist</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggestion Chips */}
        <div className="space-y-1.5 pt-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Common Suggestions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_PLANTS.map((plant) => (
              <button
                key={plant}
                type="button"
                onClick={() => {
                  setPlantInput(plant);
                  fetchChecklist(plant);
                }}
                className="px-2.5 py-1 text-xs rounded-lg border border-stone-200 bg-stone-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-stone-700 transition-colors cursor-pointer"
              >
                {plant}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Checklist Display */}
      {result && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 space-y-6">
          {/* Header of Checklist */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Early Warning Signs
                </span>
                <span className="text-xs text-stone-500">5-6 Key Field Indicators</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 font-['Outfit']">
                {result.plantName} Vigilance Checklist
              </h2>
              <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
                {result.overview}
              </p>
            </div>

            {/* Inspection Progress Meter */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 shrink-0 text-center sm:text-right w-full sm:w-auto">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
                Field Inspection
              </span>
              <div className="flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span className="text-sm font-bold text-stone-900">
                  {inspectedCount} / {totalChecks} Checked
                </span>
              </div>
              <div className="w-32 bg-stone-200 h-1.5 rounded-full mt-2 overflow-hidden mx-auto sm:ml-auto sm:mr-0">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${totalChecks > 0 ? (inspectedCount / totalChecks) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Checklist Cards */}
          <div className="space-y-3">
            {result.checklist.map((item, idx) => {
              const isChecked = Boolean(checkedItems[item.id || `item-${idx}`]);
              const id = item.id || `item-${idx}`;

              return (
                <div
                  key={id}
                  onClick={() => toggleItem(id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                      : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Custom Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition-all shrink-0 ${
                        isChecked
                          ? 'bg-emerald-600 text-white'
                          : 'border-2 border-stone-300 bg-white'
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-4 h-4" />}
                    </div>

                    {/* Content */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isChecked ? 'text-emerald-950 line-through opacity-80' : 'text-stone-900'
                          }`}
                        >
                          {idx + 1}. {item.title}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getCriticalityBadge(
                            item.criticality
                          )}`}
                        >
                          {item.criticality} Risk Indicator
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        <strong className="text-stone-700">What to look for:</strong> {item.description}
                      </p>

                      <div className="pt-1 flex items-start gap-1.5 text-xs text-emerald-900 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-semibold text-emerald-950">Early Action:</strong> {item.action}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Footer Info */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
            <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Logged to Firestore ({firestoreLogId ? `ID: ${firestoreLogId.slice(0, 8)}...` : 'Saved'})</span>
            </div>
            <button
              onClick={() => {
                setResult(null);
                setPlantInput('');
                setCheckedItems({});
              }}
              className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Check another plant</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
