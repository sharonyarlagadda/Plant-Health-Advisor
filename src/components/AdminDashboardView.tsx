import { useState, useEffect } from 'react';
import { QueryLogEntry, TrainingDataEntry } from '../types';
import { fetchQueryLogs, fetchTrainingDataRecords } from '../lib/firebase';
import {
  BarChart3,
  RefreshCw,
  ScanEye,
  ClipboardCheck,
  MapPin,
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  Database,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Image as ImageIcon
} from 'lucide-react';

export function AdminDashboardView() {
  const [logs, setLogs] = useState<QueryLogEntry[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingDataEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'training_data'>('logs');
  const [filterFeature, setFilterFeature] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<QueryLogEntry | null>(null);
  const [selectedTrainingRecord, setSelectedTrainingRecord] = useState<TrainingDataEntry | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, trainingData] = await Promise.all([
        fetchQueryLogs(),
        fetchTrainingDataRecords()
      ]);
      setLogs(logsData);
      setTrainingRecords(trainingData);
    } catch (err) {
      console.error('Error fetching data for dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Aggregations
  const totalQueries = logs.length;
  const photoQueries = logs.filter((l) => l.feature === 'Photo Diagnosis').length;
  const checklistQueries = logs.filter((l) => l.feature === 'Preventive Checklist').length;
  const advisoryQueries = logs.filter((l) => l.feature === 'Regional Advisory').length;

  const totalTraining = trainingRecords.length;
  const verifiedTraining = trainingRecords.filter((r) => r.verified).length;
  const pendingTraining = totalTraining - verifiedTraining;

  // Breakdown by feature type percentages
  const photoPct = totalQueries > 0 ? Math.round((photoQueries / totalQueries) * 100) : 0;
  const checklistPct = totalQueries > 0 ? Math.round((checklistQueries / totalQueries) * 100) : 0;
  const advisoryPct = totalQueries > 0 ? Math.round((advisoryQueries / totalQueries) * 100) : 0;

  // Most commonly diagnosed issues
  const diseaseCounts: Record<string, number> = {};
  logs
    .filter((l) => l.feature === 'Photo Diagnosis' && l.diseaseName)
    .forEach((l) => {
      const name = l.diseaseName!.trim();
      diseaseCounts[name] = (diseaseCounts[name] || 0) + 1;
    });

  const topDiseases = Object.entries(diseaseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Most queried states
  const stateCounts: Record<string, number> = {};
  logs
    .filter((l) => l.feature === 'Regional Advisory' && l.state)
    .forEach((l) => {
      const st = l.state!.trim();
      stateCounts[st] = (stateCounts[st] || 0) + 1;
    });

  const topStates = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Filtered log list
  const filteredLogs = logs.filter((l) => {
    const matchesFeature = filterFeature === 'All' || l.feature === filterFeature;
    const matchesSearch =
      !searchTerm ||
      l.inputSummary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.resultSummary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.crop && l.crop.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.state && l.state.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFeature && matchesSearch;
  });

  const exportLogsToCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Feature', 'Crop', 'State', 'Disease', 'InputSummary', 'ResultSummary'];
    const rows = logs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.feature}"`,
      `"${l.crop || ''}"`,
      `"${l.state || ''}"`,
      `"${l.diseaseName || ''}"`,
      `"${l.inputSummary.replace(/"/g, '""')}"`,
      `"${l.resultSummary.replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `plant_health_advisor_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Admin & Usage Analytics
            </span>
            <span className="text-xs text-stone-500">Firestore Query Logs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 font-['Outfit'] tracking-tight">
            System Usage Dashboard
          </h1>
          <p className="text-sm text-stone-600">
            Real-time analytics and telemetry recorded in Firestore across leaf photo diagnoses, preventive checklists, and regional crop advisories.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-700' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportLogsToCSV}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 5 Stat Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Total Queries</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit']">{totalQueries}</div>
          <p className="text-[11px] text-stone-500">Logged in Firestore</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Photo Diagnosis</span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <ScanEye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit']">{photoQueries}</div>
          <p className="text-[11px] text-teal-700 font-medium">{photoPct}% of queries</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Checklists</span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit']">{checklistQueries}</div>
          <p className="text-[11px] text-sky-700 font-medium">{checklistPct}% of queries</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Advisories</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-['Outfit']">{advisoryQueries}</div>
          <p className="text-[11px] text-amber-700 font-medium">{advisoryPct}% of queries</p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4 sm:p-5 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">ML Training Data</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-200/80 text-emerald-900 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-950 font-['Outfit']">{totalTraining}</div>
          <p className="text-[11px] text-emerald-700 font-medium">{verifiedTraining} verified / {pendingTraining} pending</p>
        </div>
      </div>

      {/* Feature Breakdown & Aggregates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Breakdown by Feature Type */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 font-['Outfit']">Queries by Feature Type</h3>
            <BarChart3 className="w-4 h-4 text-stone-400" />
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-stone-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                  Photo Diagnosis
                </span>
                <span className="text-stone-900 font-bold">{photoQueries} ({photoPct}%)</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div className="bg-teal-600 h-full rounded-full transition-all duration-500" style={{ width: `${photoPct}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-stone-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                  Preventive Checklist
                </span>
                <span className="text-stone-900 font-bold">{checklistQueries} ({checklistPct}%)</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div className="bg-sky-600 h-full rounded-full transition-all duration-500" style={{ width: `${checklistPct}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-stone-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  Regional Crop Advisory
                </span>
                <span className="text-stone-900 font-bold">{advisoryQueries} ({advisoryPct}%)</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full rounded-full transition-all duration-500" style={{ width: `${advisoryPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Most Commonly Diagnosed Issues */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 font-['Outfit']">Top Diagnosed Issues</h3>
            <span className="text-[11px] text-stone-500 font-medium">From Photos</span>
          </div>

          {topDiseases.length > 0 ? (
            <ul className="space-y-2.5">
              {topDiseases.map(([disease, count], idx) => (
                <li key={disease} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-stone-800 truncate" title={disease}>
                      {disease}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[11px] shrink-0">
                    {count} {count === 1 ? 'case' : 'cases'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-500 italic py-4 text-center">
              No leaf diagnoses logged yet. Test photo diagnosis to populate statistics.
            </p>
          )}
        </div>

        {/* Most Queried States */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 font-['Outfit']">Most Queried States</h3>
            <span className="text-[11px] text-stone-500 font-medium">Regional Queries</span>
          </div>

          {topStates.length > 0 ? (
            <ul className="space-y-2.5">
              {topStates.map(([state, count], idx) => (
                <li key={state} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-stone-800">{state}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-bold text-[11px]">
                    {count} {count === 1 ? 'query' : 'queries'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-500 italic py-4 text-center">
              No regional state advisories queried yet. Try the Regional Advisory section.
            </p>
          )}
        </div>
      </div>

      {/* Activity Tables Section */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-4">
        {/* Tab Headers */}
        <div className="flex border-b border-stone-200 pb-3 gap-3 items-center justify-between">
          <div className="inline-flex rounded-xl border border-stone-200 p-1 bg-stone-100 text-xs font-semibold">
            <button
              id="tab-view-logs"
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Firestore Query Logs ({totalQueries})
            </button>
            <button
              id="tab-view-training"
              type="button"
              onClick={() => setActiveTab('training_data')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'training_data'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>ML Training Dataset ({totalTraining})</span>
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tab 1: Standard Query Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 font-['Outfit']">Live Firestore Query Logs</h3>
                <p className="text-xs text-stone-500">
                  Showing {filteredLogs.length} of {totalQueries} stored query records
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50 text-xs">
                  {['All', 'Photo Diagnosis', 'Preventive Checklist', 'Regional Advisory'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterFeature(f)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        filterFeature === f ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {f === 'Preventive Checklist' ? 'Checklist' : f === 'Regional Advisory' ? 'Advisory' : f === 'Photo Diagnosis' ? 'Photo' : f}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search logs..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-700" />
                <span>Fetching latest logs from Firestore...</span>
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Feature</th>
                      <th className="py-2.5 px-3">Input Summary</th>
                      <th className="py-2.5 px-3">Result Summary</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    {filteredLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <span className="block text-[10px] text-stone-400">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                              log.feature === 'Photo Diagnosis'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : log.feature === 'Preventive Checklist'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : 'bg-amber-50 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {log.feature}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate" title={log.inputSummary}>
                          {log.inputSummary}
                        </td>
                        <td className="py-2.5 px-3 max-w-[320px] truncate font-medium text-stone-700" title={log.resultSummary}>
                          {log.resultSummary}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-stone-200/60">
                No queries matching filters found.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: ML Training Dataset */}
        {activeTab === 'training_data' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 font-['Outfit']">
                  ML Training Dataset (Firestore collection: "training_data")
                </h3>
                <p className="text-xs text-stone-500">
                  {totalTraining} leaf samples client-compressed (&le;400px JPEG) and stored directly in Firestore documents with user verification status
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-700" />
                <span>Loading training dataset...</span>
              </div>
            ) : trainingRecords.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Image Preview</th>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Initial Gemini Diagnosis</th>
                      <th className="py-2.5 px-3">Verification Status</th>
                      <th className="py-2.5 px-3">Confirmed / Corrected Label</th>
                      <th className="py-2.5 px-3">User Notes</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    {trainingRecords.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap">
                          {item.image_base64 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedTrainingRecord(item)}
                              className="relative group block rounded-lg overflow-hidden border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                              title="Click to inspect sample"
                            >
                              <img
                                src={item.image_base64.startsWith('data:') ? item.image_base64 : `data:image/jpeg;base64,${item.image_base64}`}
                                alt={item.plant_name || 'Leaf sample'}
                                className="w-12 h-12 object-cover group-hover:scale-105 transition-transform duration-150 bg-stone-100"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 text-[10px]">
                              <ImageIcon className="w-5 h-5 text-stone-300" />
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <span className="block text-[10px] text-stone-400">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate font-medium text-stone-800" title={item.gemini_diagnosis}>
                          {item.gemini_diagnosis}
                          {item.plant_name && (
                            <span className="block text-[10px] text-stone-500 font-normal">
                              Crop: {item.plant_name}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {item.verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] bg-stone-100 text-stone-600 border border-stone-200">
                              <Clock className="w-3 h-3 text-stone-400" />
                              Unverified (Default)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-stone-900">
                          {item.confirmed_label || (
                            <span className="text-stone-400 italic text-[11px]">Pending validation</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-stone-500 italic max-w-[160px] truncate" title={item.details || ''}>
                          {item.details || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedTrainingRecord(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-stone-200/60 space-y-2">
                <p className="font-semibold text-stone-700">No training data collected yet.</p>
                <p className="text-[11px]">Run a Photo Diagnosis on any leaf photo to automatically compress and store images directly in the <span className="font-mono font-medium">training_data</span> Firestore collection.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {selectedLog.feature}
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-stone-700 block uppercase tracking-wider text-[10px] mb-1">
                  User Inputs
                </span>
                <p className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-800 leading-relaxed font-mono">
                  {selectedLog.inputSummary}
                </p>
              </div>

              <div>
                <span className="font-bold text-stone-700 block uppercase tracking-wider text-[10px] mb-1">
                  AI Output Result Summary
                </span>
                <p className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/70 text-emerald-950 leading-relaxed">
                  {selectedLog.resultSummary}
                </p>
              </div>

              {selectedLog.diseaseName && (
                <div className="flex items-center gap-2 pt-1 text-stone-600">
                  <span className="font-semibold">Diagnosed Issue:</span>
                  <span className="font-bold text-stone-900">{selectedLog.diseaseName}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training Sample Detail & Image Modal */}
      {selectedTrainingRecord && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  ML Training Sample
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  {new Date(selectedTrainingRecord.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedTrainingRecord(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rendered directly from base64 string data URI */}
            {selectedTrainingRecord.image_base64 && (
              <div className="flex flex-col items-center justify-center bg-stone-50 rounded-xl p-3 border border-stone-200 gap-2">
                <img
                  src={
                    selectedTrainingRecord.image_base64.startsWith('data:')
                      ? selectedTrainingRecord.image_base64
                      : `data:image/jpeg;base64,${selectedTrainingRecord.image_base64}`
                  }
                  alt={selectedTrainingRecord.plant_name || 'Leaf training sample'}
                  className="max-h-64 max-w-full object-contain rounded-lg border border-stone-200 shadow-xs"
                />
                <span className="text-[11px] font-mono text-stone-400">
                  Direct Firestore document base64 image (~{Math.round(selectedTrainingRecord.image_base64.length / 1024)} KB)
                </span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px] block">
                  Gemini Initial Diagnosis
                </span>
                <p className="font-medium text-stone-900">{selectedTrainingRecord.gemini_diagnosis}</p>
                {selectedTrainingRecord.plant_name && (
                  <p className="text-stone-500 text-[11px]">Identified Plant: {selectedTrainingRecord.plant_name}</p>
                )}
                {selectedTrainingRecord.confidence && (
                  <p className="text-stone-500 text-[11px]">Confidence: {selectedTrainingRecord.confidence}</p>
                )}
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-1.5">
                <span className="font-bold text-emerald-700 uppercase tracking-wider text-[10px] block">
                  Validation Status & Ground Truth Label
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 text-sm">
                    {selectedTrainingRecord.confirmed_label || 'Pending validation'}
                  </span>
                  {selectedTrainingRecord.verified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-stone-500 text-[11px] bg-stone-200/70 px-2 py-0.5 rounded-full">
                      <Clock className="w-3.5 h-3.5" /> Unverified
                    </span>
                  )}
                </div>
                {selectedTrainingRecord.details && (
                  <p className="text-stone-700 italic text-[11px] pt-1 border-t border-emerald-200/50">
                    User Notes: {selectedTrainingRecord.details}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTrainingRecord(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
