import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface DisclaimerBannerProps {
  compact?: boolean;
}

export function DisclaimerBanner({ compact = false }: DisclaimerBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>Proof-of-Concept: AI diagnoses should not replace certified agricultural advice.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs md:text-sm text-amber-900">
        <div className="flex items-center gap-2.5">
          <span className="p-1 rounded bg-amber-100/90 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
          </span>
          <p>
            <strong className="font-semibold text-amber-950">Proof-of-Concept Agricultural Advisory:</strong> This application uses AI vision and statistical data for educational guidance. Always verify field treatments with local Krishi Vigyan Kendra (KVK) or certified agronomists.
          </p>
        </div>
        <div className="flex items-center gap-1 text-emerald-800 font-medium text-xs shrink-0 self-end sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Firestore Synced & Gemini Powered</span>
        </div>
      </div>
    </div>
  );
}
