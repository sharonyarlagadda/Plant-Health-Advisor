import { useState, useEffect } from 'react';
import { AppSection } from './types';
import { Navbar } from './components/Navbar';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { PhotoDiagnosisView } from './components/PhotoDiagnosisView';
import { PreventiveChecklistView } from './components/PreventiveChecklistView';
import { RegionalAdvisoryView } from './components/RegionalAdvisoryView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { testConnection, ensureCropDatasetSeeded, fetchQueryLogs } from './lib/firebase';
import { Sprout, ShieldCheck, HeartHandshake } from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('diagnosis');
  const [logsCount, setLogsCount] = useState<number>(0);

  // Initialize Firebase connection and seed initial crop records
  useEffect(() => {
    let isMounted = true;
    async function initApp() {
      try {
        await testConnection();
        await ensureCropDatasetSeeded();
        const logs = await fetchQueryLogs();
        if (isMounted) {
          setLogsCount(logs.length);
        }
      } catch (err) {
        console.warn('Initialization note:', err);
      }
    }
    initApp();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshLogsCount = async () => {
    try {
      const logs = await fetchQueryLogs();
      setLogsCount(logs.length);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9] text-stone-900 font-['Plus_Jakarta_Sans'] antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Main Disclaimer */}
      <DisclaimerBanner />

      {/* Global Navigation */}
      <Navbar
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        logsCount={logsCount}
      />

      {/* Active Section Content */}
      <main className="flex-1">
        {activeSection === 'diagnosis' && (
          <PhotoDiagnosisView onLogUpdated={refreshLogsCount} />
        )}
        {activeSection === 'checklist' && (
          <PreventiveChecklistView onLogUpdated={refreshLogsCount} />
        )}
        {activeSection === 'advisory' && (
          <RegionalAdvisoryView onLogUpdated={refreshLogsCount} />
        )}
        {activeSection === 'dashboard' && (
          <AdminDashboardView />
        )}
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-stone-200/80 bg-white/80 py-8 px-4 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Sprout className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-stone-700">Plant Health Advisor</span>
            <span className="text-stone-300">|</span>
            <span>Gemini Flash Vision & Firestore Analytics</span>
          </div>

          <div className="flex items-center gap-4 text-stone-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Proof-of-Concept</span>
            </span>
            <span className="flex items-center gap-1">
              <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
              <span>Farmer & Gardener Support</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
