import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { DiagnosisResult } from '../types';
import { SAMPLE_LEAVES, SampleLeaf } from '../data/sampleLeaves';
import {
  logQueryToFirestore,
  compressImageForTraining,
  createTrainingDataRecord,
  updateTrainingDataRecord
} from '../lib/firebase';
import { DisclaimerBanner } from './DisclaimerBanner';
import {
  Upload,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Leaf,
  Droplets,
  RotateCcw,
  Check,
  ShieldAlert,
  HelpCircle,
  Database,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  CheckCheck
} from 'lucide-react';

interface PhotoDiagnosisViewProps {
  onLogUpdated?: () => void;
}

export function PhotoDiagnosisView({ onLogUpdated }: PhotoDiagnosisViewProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [plantHint, setPlantHint] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [firestoreLogId, setFirestoreLogId] = useState<string | null>(null);

  // Training data collection states
  const [trainingDocId, setTrainingDocId] = useState<string | null>(null);
  const [trainingImageBase64, setTrainingImageBase64] = useState<string | null>(null);
  const [geminiDiagnosisText, setGeminiDiagnosisText] = useState<string>('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'confirmed' | 'editing_correction' | 'corrected'>('idle');
  const [correctionCategory, setCorrectionCategory] = useState<string>('Healthy');
  const [correctionDetails, setCorrectionDetails] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [confirmedLabel, setConfirmedLabel] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image file is too large. Please upload an image under 15MB.');
      return;
    }

    setError(null);
    setImageFileName(file.name);
    setImageMimeType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }

    setError(null);
    setImageFileName(file.name);
    setImageMimeType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample: SampleLeaf) => {
    setImageFileName(`${sample.name} (${sample.condition})`);
    setPlantHint(sample.name);
    setError(null);
    setResult(null);

    // Rasterize SVG onto canvas as PNG for Gemini multimodal vision API compatibility
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 0, 0, 400, 400);
        const pngUrl = canvas.toDataURL('image/png');
        setSelectedImage(pngUrl);
        setImageMimeType('image/png');
      } else {
        setSelectedImage(sample.dataUrl);
        setImageMimeType('image/jpeg');
      }
    };
    img.src = sample.dataUrl;
  };

  const runDiagnosis = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);
    setLoadingStep('Analyzing leaf symptoms with multimodal vision...');

    try {
      // 1. Prepare compressed version client-side (max 400px, 60% JPEG) for ML dataset storage
      const compressedImageBase64 = await compressImageForTraining(selectedImage);
      setTrainingImageBase64(compressedImageBase64);

      const res = await fetch('/api/diagnose-leaf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType: imageMimeType,
          plantHint: plantHint.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Server responded with status ${res.status}`);
      }

      setLoadingStep('Synthesizing natural & standard treatments...');
      const data: DiagnosisResult = await res.json();
      setResult(data);

      // 2. Format gemini_diagnosis (health status and pathogen detected)
      const geminiDiag = data.isHealthy
        ? 'Healthy'
        : `${data.status}: ${data.diseaseName}${data.plantName && data.plantName !== 'Unidentified' ? ` (${data.plantName})` : ''}`;
      setGeminiDiagnosisText(geminiDiag);

      // 3. Store record in Firestore collection "training_data" with image_base64 and verified: false
      const tDocId = await createTrainingDataRecord({
        image_base64: compressedImageBase64,
        gemini_diagnosis: geminiDiag,
        timestamp: new Date().toISOString(),
        verified: false,
        plant_name: data.plantName,
        confidence: data.confidence,
      });
      setTrainingDocId(tDocId);
      setFeedbackStatus('idle');

      // Log to existing query_logs collection in Firestore
      const inputSummary = `Image: ${imageFileName || 'Uploaded leaf'} | Plant hint: ${plantHint || 'None specified'}`;
      const resultSummary = `Status: ${data.status} | Disease: ${data.diseaseName} | Confidence: ${data.confidence} | Treatments: ${data.treatments?.naturalOrganic?.length || 0} organic remedies recommended`;

      const logId = await logQueryToFirestore({
        timestamp: new Date().toISOString(),
        feature: 'Photo Diagnosis',
        inputSummary,
        resultSummary,
        diseaseName: data.diseaseName,
        crop: data.plantName,
        isHealthy: data.isHealthy,
      });

      setFirestoreLogId(logId);
      if (onLogUpdated) onLogUpdated();
    } catch (err: any) {
      console.error('Diagnosis failed:', err);
      setError(err?.message || 'Failed to analyze plant leaf. Please verify connection and try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleConfirmDiagnosis = async () => {
    if (!trainingDocId) return;
    setSubmittingFeedback(true);
    try {
      const success = await updateTrainingDataRecord(trainingDocId, {
        verified: true,
        confirmed_label: geminiDiagnosisText,
      });
      if (success) {
        setConfirmedLabel(geminiDiagnosisText);
        setFeedbackStatus('confirmed');
      }
    } catch (err) {
      console.error('Failed to confirm diagnosis:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSubmitCorrection = async () => {
    if (!trainingDocId) return;
    setSubmittingFeedback(true);
    const finalLabel = correctionDetails.trim()
      ? `${correctionCategory}: ${correctionDetails.trim()}`
      : correctionCategory;

    try {
      const success = await updateTrainingDataRecord(trainingDocId, {
        verified: true,
        confirmed_label: finalLabel,
        details: correctionDetails.trim() || undefined,
      });
      if (success) {
        setConfirmedLabel(finalLabel);
        setFeedbackStatus('corrected');
      }
    } catch (err) {
      console.error('Failed to submit correction:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setResult(null);
    setImageFileName('');
    setPlantHint('');
    setError(null);
    setFirestoreLogId(null);
    setTrainingDocId(null);
    setTrainingImageBase64(null);
    setGeminiDiagnosisText('');
    setFeedbackStatus('idle');
    setCorrectionCategory('Healthy');
    setCorrectionDetails('');
    setConfirmedLabel('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header Info */}
      <div className="space-y-1 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit'] tracking-tight">
          Plant Leaf Photo Diagnosis
        </h1>
        <p className="text-sm text-stone-600">
          Upload a photo of a leaf to identify diseases or pest issues with Gemini Flash multimodal vision, and receive organic and standard care remedies.
        </p>
      </div>

      <DisclaimerBanner compact />

      {/* Main Upload / Selection Card */}
      {!result && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6 space-y-6">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              selectedImage
                ? 'border-emerald-500 bg-emerald-50/20'
                : 'border-stone-300 hover:border-emerald-600 hover:bg-stone-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedImage ? (
              <div className="space-y-4">
                <div className="w-48 h-48 mx-auto rounded-lg overflow-hidden border border-stone-200 shadow-xs bg-stone-100 flex items-center justify-center">
                  <img
                    src={selectedImage}
                    alt="Selected plant leaf"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {imageFileName || 'Leaf photo ready for analysis'}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">Click or drag a new image to replace</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Click to upload leaf photo or drag & drop
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    Supports JPG, PNG, WebP (up to 15MB). Clear photos of affected leaves yield best results.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Non-intrusive note near image upload area */}
          <p className="text-xs text-stone-500 text-center flex items-center justify-center gap-1.5 -mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0" />
            <span>Uploaded images may be used to improve future diagnosis accuracy.</span>
          </p>

          {/* Quick Test Sample Leaves */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Or Test With Instant Sample Leaves:
              </span>
              <span className="text-xs text-emerald-700 font-medium">1-Click Test</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SAMPLE_LEAVES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className={`p-2 rounded-xl border text-left transition-all flex flex-col items-center gap-2 cursor-pointer ${
                    imageFileName.includes(sample.name)
                      ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/80 bg-white'
                  }`}
                >
                  <img
                    src={sample.dataUrl}
                    alt={sample.name}
                    className="w-14 h-14 rounded-lg object-contain bg-stone-100 p-1 border border-stone-200/60"
                  />
                  <div className="text-center w-full">
                    <p className="text-xs font-semibold text-stone-800 truncate">{sample.name}</p>
                    <p className="text-[10px] text-stone-500 truncate">{sample.condition}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Plant Hint */}
          <div className="space-y-1.5 pt-2 border-t border-stone-100">
            <label htmlFor="plant-hint-input" className="block text-xs font-medium text-stone-700">
              Plant / Crop Name Hint (Optional)
            </label>
            <input
              id="plant-hint-input"
              type="text"
              value={plantHint}
              onChange={(e) => setPlantHint(e.target.value)}
              placeholder="e.g., Tomato, Cotton, Rice, Basil, Rose, Potato..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Analysis Notice</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            id="btn-run-diagnosis"
            disabled={!selectedImage || loading}
            onClick={runDiagnosis}
            className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !selectedImage || loading
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-900/10'
            }`}
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-emerald-200" />
                <span>{loadingStep || 'Analyzing with Gemini Flash...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Diagnose Plant Leaf</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Diagnosis Results Card */}
      {result && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden space-y-6 p-6">
          {/* Top Result Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  result.isHealthy
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {result.isHealthy ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertOctagon className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      result.isHealthy
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {result.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-stone-500 font-medium">
                    Confidence: {result.confidence}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 font-['Outfit']">
                  {result.diseaseName || (result.isHealthy ? 'Healthy Plant Foliage' : 'Disease Identified')}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Host Plant: <span className="font-semibold text-stone-700">{result.plantName}</span>
                </p>
              </div>
            </div>

            <button
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors self-end sm:self-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Diagnose Another</span>
            </button>
          </div>

          {/* Simple Explanation */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-700" />
              <span>What It Means (Simple Explanation)</span>
            </h3>
            <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-200/60">
              {result.explanation}
            </p>
          </div>

          {/* Symptoms List */}
          {result.symptoms && result.symptoms.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Key Symptoms Observed:
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.symptoms.map((symptom, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-stone-700 bg-white p-2.5 rounded-lg border border-stone-200"
                  >
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{symptom}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Treatment Options: Natural & Organic vs Standard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Natural / Organic Treatments */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <div className="w-6 h-6 rounded-md bg-emerald-200 text-emerald-800 flex items-center justify-center">
                  <Leaf className="w-3.5 h-3.5" />
                </div>
                <span>Natural & Organic Treatments</span>
              </div>
              <ul className="space-y-2">
                {result.treatments?.naturalOrganic?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-emerald-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
                {(!result.treatments?.naturalOrganic || result.treatments.naturalOrganic.length === 0) && (
                  <li className="text-xs text-stone-500 italic">No specific organic intervention needed.</li>
                )}
              </ul>
            </div>

            {/* Standard / Chemical Management */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <div className="w-6 h-6 rounded-md bg-stone-200 text-stone-800 flex items-center justify-center">
                  <Droplets className="w-3.5 h-3.5" />
                </div>
                <span>Standard Management Practices</span>
              </div>
              <ul className="space-y-2">
                {result.treatments?.chemicalOrStandard?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-stone-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-500 mt-1.5 shrink-0" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
                {(!result.treatments?.chemicalOrStandard || result.treatments.chemicalOrStandard.length === 0) && (
                  <li className="text-xs text-stone-500 italic">Standard care practices sufficient.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Preventive Measures */}
          {result.preventiveMeasures && result.preventiveMeasures.length > 0 && (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Future Prevention & Cultural Practices:
              </h4>
              <ul className="space-y-1.5">
                {result.preventiveMeasures.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-stone-600">
                    <ArrowRight className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ML Model Training Feedback Section */}
          <div id="feedback-section" className="rounded-xl border border-stone-200/90 bg-stone-50/80 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCheck className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Model Training Feedback
                </h4>
              </div>
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200/80">
                Firestore ML Dataset
              </span>
            </div>

            <p className="text-xs text-stone-600">
              Help train our future custom ML model by validating this diagnosis:
            </p>

            {feedbackStatus === 'idle' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  id="btn-confirm-diagnosis"
                  type="button"
                  onClick={handleConfirmDiagnosis}
                  disabled={submittingFeedback}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {submittingFeedback ? 'Saving Verification...' : 'Confirm diagnosis is accurate'}
                </button>

                <button
                  id="btn-diagnosis-wrong"
                  type="button"
                  onClick={() => setFeedbackStatus('editing_correction')}
                  disabled={submittingFeedback}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-700 border border-stone-300 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-amber-600" />
                  Diagnosis looks wrong
                </button>
              </div>
            )}

            {feedbackStatus === 'editing_correction' && (
              <div className="bg-white p-3.5 rounded-lg border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-800">Specify Correct Plant Health Status:</span>
                  <button
                    type="button"
                    onClick={() => setFeedbackStatus('idle')}
                    className="text-xs text-stone-400 hover:text-stone-600 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1">
                  <label htmlFor="select-correction-category" className="text-[11px] font-medium text-stone-600">
                    Select Diagnosis:
                  </label>
                  <select
                    id="select-correction-category"
                    value={correctionCategory}
                    onChange={(e) => setCorrectionCategory(e.target.value)}
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-lg p-2 text-stone-800 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                  >
                    <option value="Healthy">Healthy</option>
                    <option value="Fungal disease">Fungal disease</option>
                    <option value="Pest damage">Pest damage</option>
                    <option value="Viral disease">Viral disease</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="input-correction-details" className="text-[11px] font-medium text-stone-600">
                    Optional Details:
                  </label>
                  <input
                    id="input-correction-details"
                    type="text"
                    value={correctionDetails}
                    onChange={(e) => setCorrectionDetails(e.target.value)}
                    placeholder="e.g., observed pest, suspected bacterial wilt, sunburn..."
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-lg p-2 text-stone-800 placeholder-stone-400 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                  />
                </div>

                <button
                  id="btn-submit-correction"
                  type="button"
                  onClick={handleSubmitCorrection}
                  disabled={submittingFeedback}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingFeedback ? 'Saving Correction...' : 'Submit Correction'}
                </button>
              </div>
            )}

            {feedbackStatus === 'confirmed' && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Diagnosis confirmed as accurate</p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Saved to Firestore <span className="font-mono">training_data</span> with <span className="font-mono">verified: true</span> and confirmed label <span className="font-semibold">"{confirmedLabel}"</span>.
                  </p>
                </div>
              </div>
            )}

            {feedbackStatus === 'corrected' && (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-950">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Correction recorded successfully</p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    Saved to Firestore <span className="font-mono">training_data</span> with <span className="font-mono">verified: true</span> and updated label <span className="font-semibold">"{confirmedLabel}"</span>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Firestore Logging Confirmation Badge */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
            <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Query logged to Firestore ({firestoreLogId ? `ID: ${firestoreLogId.slice(0, 8)}...` : 'Synced'})</span>
            </div>
            <span className="text-[11px] text-stone-400">Gemini Flash Multimodal Model</span>
          </div>
        </div>
      )}
    </div>
  );
}
