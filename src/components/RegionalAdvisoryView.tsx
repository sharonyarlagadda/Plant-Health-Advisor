import { useState, useEffect } from 'react';
import { AdvisoryResult, CropRecord, Season, UserRole } from '../types';
import { INDIAN_STATES, SEASONS, COMMON_CROPS } from '../data/indianCropsData';
import { getCropsByStateAndSeason, logQueryToFirestore } from '../lib/firebase';
import { DisclaimerBanner } from './DisclaimerBanner';
import {
  MapPin,
  Tractor,
  Flower2,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Droplet,
  Database,
  Award
} from 'lucide-react';

interface RegionalAdvisoryViewProps {
  onLogUpdated?: () => void;
}

export function RegionalAdvisoryView({ onLogUpdated }: RegionalAdvisoryViewProps) {
  const [selectedState, setSelectedState] = useState<string>('Punjab');
  const [selectedSeason, setSelectedSeason] = useState<Season>('Rabi');
  const [selectedCrop, setSelectedCrop] = useState<string>('Wheat');
  const [customCrop, setCustomCrop] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('Farmer');

  const [matchingRecords, setMatchingRecords] = useState<CropRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);

  const [advisoryLoading, setAdvisoryLoading] = useState<boolean>(false);
  const [advisoryResult, setAdvisoryResult] = useState<AdvisoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firestoreLogId, setFirestoreLogId] = useState<string | null>(null);

  // Load Firestore matching crop records whenever State or Season changes
  useEffect(() => {
    let isMounted = true;
    async function loadStateSeasonRecords() {
      setRecordsLoading(true);
      try {
        const records = await getCropsByStateAndSeason(selectedState, selectedSeason);
        if (isMounted) {
          setMatchingRecords(records);
          // If current crop is not in the list, leave selectedCrop as is or pick first top crop
          if (records.length > 0 && !records.some(r => r.Crop.toLowerCase() === selectedCrop.toLowerCase())) {
            // Keep default unless user wants
          }
        }
      } catch (err) {
        console.error('Error fetching crop records from Firestore:', err);
      } finally {
        if (isMounted) setRecordsLoading(false);
      }
    }

    loadStateSeasonRecords();
    return () => {
      isMounted = false;
    };
  }, [selectedState, selectedSeason]);

  const runRegionalAdvisory = async () => {
    const activeCrop = customCrop.trim() || selectedCrop;
    if (!activeCrop) {
      setError('Please select or specify a crop name.');
      return;
    }

    setAdvisoryLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/regional-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          season: selectedSeason,
          crop: activeCrop,
          userRole,
          matchingRecords,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to generate regional advisory');
      }

      const data: AdvisoryResult = await res.json();
      setAdvisoryResult(data);

      // Log to Firestore as required by Feature 4
      const inputSummary = `State: ${selectedState} | Season: ${selectedSeason} | Crop: ${activeCrop} | Role: ${userRole}`;
      const resultSummary = `Verdict: ${data.verdict} | Rank: ${data.productionRankText} | Summary: ${data.summary}`;

      const logId = await logQueryToFirestore({
        timestamp: new Date().toISOString(),
        feature: 'Regional Advisory',
        inputSummary,
        resultSummary,
        state: selectedState,
        crop: activeCrop,
        userRole,
      });

      setFirestoreLogId(logId);
      if (onLogUpdated) onLogUpdated();
    } catch (err: any) {
      console.error('Regional advisory error:', err);
      setError(err?.message || 'Failed to consult regional advisory. Please verify network and try again.');
    } finally {
      setAdvisoryLoading(false);
    }
  };

  const getVerdictStyle = (verdict: AdvisoryResult['verdict']) => {
    switch (verdict) {
      case 'Highly Recommended':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Recommended':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'Moderate / Conditional':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Challenging':
      default:
        return 'bg-rose-100 text-rose-900 border-rose-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit'] tracking-tight">
          Regional Indian Crop Advisory
        </h1>
        <p className="text-sm text-stone-600">
          Combines official state-level crop production data stored in Firestore with Gemini reasoning to evaluate regional viability for farmers and natural care tips for home gardeners.
        </p>
      </div>

      <DisclaimerBanner compact />

      {/* Inputs Form Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6 space-y-6">
        {/* User Role Toggle */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Select Your Agricultural Profile
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              id="role-farmer"
              onClick={() => setUserRole('Farmer')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                userRole === 'Farmer'
                  ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600 shadow-xs'
                  : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 hover:bg-stone-50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  userRole === 'Farmer' ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-600'
                }`}
              >
                <Tractor className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-stone-900 block font-['Outfit']">
                  Farmer / Commercial Cultivation
                </span>
                <span className="text-xs text-stone-500 mt-0.5 block leading-snug">
                  Evaluates yield rank, climatic feasibility, water needs, and market viability.
                </span>
              </div>
            </button>

            <button
              type="button"
              id="role-gardener"
              onClick={() => setUserRole('Home Gardener')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                userRole === 'Home Gardener'
                  ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600 shadow-xs'
                  : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 hover:bg-stone-50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  userRole === 'Home Gardener' ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-600'
                }`}
              >
                <Flower2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-stone-900 block font-['Outfit']">
                  Home Gardener
                </span>
                <span className="text-xs text-stone-500 mt-0.5 block leading-snug">
                  Provides container tips, potting mix, kitchen waste compost, and natural pest control.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Region & Season Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Indian State Dropdown */}
          <div className="space-y-1.5">
            <label htmlFor="select-state" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              <span>Indian State</span>
            </label>
            <select
              id="select-state"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-medium text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 cursor-pointer"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Season Dropdown */}
          <div className="space-y-1.5">
            <label htmlFor="select-season" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Agricultural Season</span>
            </label>
            <select
              id="select-season"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value as Season)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-medium text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 cursor-pointer"
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s} Season
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Crop Selector & Quick suggestions */}
        <div className="space-y-3">
          <label htmlFor="select-crop" className="block text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Target Crop</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              id="select-crop"
              value={selectedCrop}
              onChange={(e) => {
                setSelectedCrop(e.target.value);
                setCustomCrop('');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-medium text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 cursor-pointer"
            >
              {COMMON_CROPS.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>

            <input
              type="text"
              id="input-custom-crop"
              value={customCrop}
              onChange={(e) => setCustomCrop(e.target.value)}
              placeholder="Or type custom crop (e.g., Fenugreek, Millets)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Live Firestore Dataset Context Card */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>Firestore Dataset Records ({selectedState} - {selectedSeason})</span>
            </span>
            <span className="text-[11px] text-stone-500">
              {recordsLoading ? 'Querying Firestore...' : `${matchingRecords.length} records retrieved`}
            </span>
          </div>

          {matchingRecords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {matchingRecords.map((rec) => {
                const isSelected = (customCrop || selectedCrop).toLowerCase() === rec.Crop.toLowerCase();
                return (
                  <button
                    key={rec.Crop}
                    type="button"
                    onClick={() => {
                      setSelectedCrop(rec.Crop);
                      setCustomCrop('');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-stone-800 border-stone-200 hover:border-emerald-300'
                    }`}
                  >
                    <span className="font-bold">#{rec.rank}</span>
                    <span>{rec.Crop}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>
                      ({(rec.Production / 100000).toFixed(1)}L Tonnes)
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-500 italic">
              No registered high-yield commercial records for this season/state combination. AI will evaluate agro-climatic adaptability.
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Advisory Button */}
        <button
          type="button"
          id="btn-run-advisory"
          disabled={advisoryLoading}
          onClick={runRegionalAdvisory}
          className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            advisoryLoading
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
          }`}
        >
          {advisoryLoading ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin text-emerald-200" />
              <span>Analyzing Regional Suitability with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>
                Evaluate {customCrop.trim() || selectedCrop} in {selectedState} ({selectedSeason})
              </span>
            </>
          )}
        </button>
      </div>

      {/* Advisory Result Display */}
      {advisoryResult && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 space-y-6">
          {/* Header Verdict Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getVerdictStyle(
                    advisoryResult.verdict
                  )}`}
                >
                  {advisoryResult.verdict.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-semibold">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>{advisoryResult.productionRankText}</span>
                </span>
                <span className="text-xs text-emerald-700 font-semibold">
                  {advisoryResult.userRole} Advisory
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mt-2 font-['Outfit']">
                {advisoryResult.crop} in {advisoryResult.state} ({advisoryResult.season})
              </h2>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Executive Advisory Verdict</span>
            </h3>
            <p className="text-sm text-emerald-950 leading-relaxed font-medium">
              {advisoryResult.summary}
            </p>
          </div>

          {/* Detailed Guidance */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Agro-Climatic Analysis & Guidance:
            </h3>
            <div className="text-sm text-stone-700 leading-relaxed space-y-3 bg-stone-50/60 p-4 rounded-xl border border-stone-200/60">
              {advisoryResult.detailedAdvice.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          {/* Key Action Points */}
          {advisoryResult.keyActionTips && advisoryResult.keyActionTips.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Actionable Recommendations ({advisoryResult.userRole}):
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {advisoryResult.keyActionTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-stone-200 flex items-start gap-2.5 text-xs text-stone-800"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Water & Soil Notes */}
          {advisoryResult.waterAndSoilNotes && (
            <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-sky-900 font-bold text-xs uppercase tracking-wider">
                <Droplet className="w-4 h-4 text-sky-700" />
                <span>Watering & Soil / Substrate Guidance</span>
              </div>
              <p className="text-xs text-sky-950 leading-relaxed">
                {advisoryResult.waterAndSoilNotes}
              </p>
            </div>
          )}

          {/* Top Crops Table */}
          {advisoryResult.topCropsInRegion && advisoryResult.topCropsInRegion.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                <span>Top Ranked Crops in {advisoryResult.state} ({advisoryResult.season}):</span>
              </h4>
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Crop Name</th>
                      <th className="py-2.5 px-3">Annual Production (Tonnes)</th>
                      <th className="py-2.5 px-3">Suitability Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    {advisoryResult.topCropsInRegion.map((c, i) => (
                      <tr key={i} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-bold text-emerald-800">#{c.rank || i + 1}</td>
                        <td className="py-2.5 px-3 font-semibold">{c.crop}</td>
                        <td className="py-2.5 px-3">{c.production ? c.production.toLocaleString() : 'Registered'}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-medium">Top Regional Producer</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Firestore Logging Confirmation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
            <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Query logged to Firestore ({firestoreLogId ? `ID: ${firestoreLogId.slice(0, 8)}...` : 'Synced'})</span>
            </div>
            <span className="text-[11px] text-stone-400">Dataset Columns: State_Name, Season, Crop, Production, rank</span>
          </div>
        </div>
      )}
    </div>
  );
}
