import { useState, useEffect, useCallback, useRef } from 'react';
import type { Tracker, LogEntry, AppData } from './types';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fmt = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

function usePersistedState<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
  return [state, setState];
}

/* ─── sub-components ─── */

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const done = current >= target;
  return (
    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${done ? 'bg-emerald-500' : 'bg-indigo-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LogList({ logs, max }: { logs: LogEntry[]; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? logs : logs.slice(0, max ?? 5);
  const iconMap: Record<LogEntry['action'], string> = {
    created: '🔵', increment: '🟢', decrement: '🟡', completed: '🟣', archived: '⚪',
  };
  return (
    <div className="space-y-1">
      {shown.map(l => (
        <div key={l.id} className="flex items-start gap-2 text-xs text-zinc-400">
          <span>{iconMap[l.action]}</span>
          <span className="shrink-0 text-zinc-500">{fmt(l.timestamp)}</span>
          <span className="text-zinc-300">{l.detail}</span>
        </div>
      ))}
      {logs.length > (max ?? 5) && (
        <button onClick={() => setExpanded(e => !e)} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1">
          {expanded ? 'Show less' : `Show all ${logs.length} entries`}
        </button>
      )}
    </div>
  );
}

function LogModal({ tracker, onClose }: { tracker: Tracker; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{tracker.label || 'Tracker'} — Logs</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <LogList logs={tracker.logs} max={999} />
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose }: { onImport: (data: AppData) => void; onClose: () => void }) {
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as AppData;
        if (!parsed.version || (!parsed.activeTracker && !parsed.history)) {
          throw new Error('Invalid file format');
        }
        onImport(parsed);
      } catch {
        setError('Invalid file. Please select a valid Progress Tracker export (.json).');
      }
    };
    reader.readAsText(file);
  }, [onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Import Data</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Import a previously exported <code className="text-indigo-400">.json</code> file. This will <span className="text-amber-400 font-medium">replace</span> all your current data.</p>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}
        >
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          <svg className="w-10 h-10 mx-auto mb-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-zinc-400">Drop your file here or <span className="text-indigo-400">browse</span></p>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>
    </div>
  );
}

/* ─── main app ─── */

export function App() {
  const [activeTracker, setActiveTracker] = usePersistedState<Tracker | null>('pt_active', null);
  const [history, setHistory] = usePersistedState<Tracker[]>('pt_history', []);
  const [tab, setTab] = useState<'tracker' | 'history'>('tracker');
  const [logModal, setLogModal] = useState<Tracker | null>(null);
  const [showImport, setShowImport] = useState(false);

  // create form
  const [label, setLabel] = useState('');
  const [targetStr, setTargetStr] = useState('');

  const addLog = useCallback((tracker: Tracker, action: LogEntry['action'], detail: string): Tracker => {
    return { ...tracker, logs: [...tracker.logs, { id: uid(), timestamp: Date.now(), action, detail }] };
  }, []);

  const handleCreate = () => {
    const target = parseInt(targetStr);
    if (!target || target < 1) return;
    let t: Tracker = { id: uid(), label: label.trim() || 'Tracker', target, current: 0, createdAt: Date.now(), completedAt: null, archivedAt: null, logs: [] };
    t = addLog(t, 'created', `Created "${t.label}" with target ${target}`);
    setActiveTracker(t);
    setLabel(''); setTargetStr('');
  };

  const handleIncrement = () => {
    if (!activeTracker || activeTracker.current >= activeTracker.target) return;
    let t = { ...activeTracker, current: activeTracker.current + 1 };
    t = addLog(t, 'increment', `Progress: ${t.current}/${t.target}`);
    if (t.current >= t.target) {
      t.completedAt = Date.now();
      t = addLog(t, 'completed', `Completed! 🎉`);
    }
    setActiveTracker(t);
  };

  const handleDecrement = () => {
    if (!activeTracker || activeTracker.current <= 0) return;
    const wasComplete = activeTracker.current >= activeTracker.target;
    let t = { ...activeTracker, current: activeTracker.current - 1, completedAt: wasComplete ? null : activeTracker.completedAt };
    t = addLog(t, 'decrement', `Progress: ${t.current}/${t.target}`);
    setActiveTracker(t);
  };

  const handleArchive = () => {
    if (!activeTracker) return;
    let t: Tracker = { ...activeTracker, archivedAt: Date.now() };
    t = addLog(t, 'archived', 'Tracker archived');
    setHistory(h => [t, ...h]);
    setActiveTracker(null);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(h => h.filter(t => t.id !== id));
  };

  /* ─── export / import ─── */

  const handleExport = () => {
    const data: AppData = { version: 1, activeTracker, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (data: AppData) => {
    setActiveTracker(data.activeTracker);
    setHistory(data.history ?? []);
    setShowImport(false);
    setTab('tracker');
  };

  const pct = activeTracker ? (activeTracker.target > 0 ? Math.round((activeTracker.current / activeTracker.target) * 100) : 0) : 0;
  const isDone = activeTracker ? activeTracker.current >= activeTracker.target : false;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* header */}
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Progress Tracker</h1>
          <div className="flex items-center gap-2">
            {/* export */}
            <button onClick={handleExport} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors" title="Export all data">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
              Export
            </button>
            {/* import */}
            <button onClick={() => setShowImport(true)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors" title="Import data">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5m0 0L7 8m5-5v13" /></svg>
              Import
            </button>
          </div>
        </div>
      </header>

      {/* tabs */}
      <nav className="border-b border-zinc-800 px-4">
        <div className="max-w-xl mx-auto flex gap-1">
          <button
            onClick={() => setTab('tracker')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'tracker' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            Tracker
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === 'history' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            History
            {history.length > 0 && (
              <span className="text-[10px] bg-zinc-700 text-zinc-300 rounded-full px-1.5 py-0.5 leading-none">{history.length}</span>
            )}
          </button>
        </div>
      </nav>

      {/* content */}
      <main className="flex-1 px-4 py-8">
        <div className="max-w-xl mx-auto">

          {/* ── TRACKER TAB ── */}
          {tab === 'tracker' && (
            <>
              {!activeTracker ? (
                /* create form */
                <div className="space-y-6">
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-semibold">Start a new tracker</h2>
                    <p className="text-sm text-zinc-500">Set a goal and track your progress one step at a time.</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Label <span className="text-zinc-600">(optional)</span></label>
                      <input
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="e.g. Push-ups, Chapters, Laps"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Target number</label>
                      <input
                        value={targetStr}
                        onChange={e => setTargetStr(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 28"
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      />
                    </div>
                    <button
                      onClick={handleCreate}
                      disabled={!targetStr || parseInt(targetStr) < 1}
                      className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      Start Tracking
                    </button>
                  </div>
                </div>
              ) : (
                /* active tracker */
                <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{activeTracker.label}</h2>
                        <p className="text-xs text-zinc-500 mt-0.5">Started {fmt(activeTracker.createdAt)}</p>
                      </div>
                      {isDone && (
                        <span className="text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full px-2.5 py-1">Done!</span>
                      )}
                    </div>

                    {/* big number */}
                    <div className="text-center py-4">
                      <div className="text-5xl font-bold tabular-nums">
                        <span className={isDone ? 'text-emerald-400' : 'text-white'}>{activeTracker.current}</span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-zinc-500">{activeTracker.target}</span>
                      </div>
                      <p className="text-sm text-zinc-500 mt-2">{pct}% complete</p>
                    </div>

                    <ProgressBar current={activeTracker.current} target={activeTracker.target} />

                    {/* controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleDecrement}
                        disabled={activeTracker.current <= 0}
                        className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        −
                      </button>
                      <button
                        onClick={handleIncrement}
                        disabled={isDone}
                        className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        + Add one
                      </button>
                    </div>

                    <button
                      onClick={handleArchive}
                      className="w-full py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                    >
                      Archive &amp; start new
                    </button>
                  </div>

                  {/* inline logs */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-medium text-zinc-400">Activity Log</h3>
                    <LogList logs={[...activeTracker.logs].reverse()} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <p className="text-zinc-500">No archived trackers yet.</p>
                  <p className="text-xs text-zinc-600">Trackers will appear here once you archive them.</p>
                </div>
              ) : (
                history.map(t => {
                  const hPct = t.target > 0 ? Math.round((t.current / t.target) * 100) : 0;
                  const hDone = t.current >= t.target;
                  return (
                    <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{t.label}</h3>
                          <p className="text-xs text-zinc-500 mt-0.5">{fmt(t.createdAt)}{t.archivedAt ? ` → ${fmt(t.archivedAt)}` : ''}</p>
                        </div>
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${hDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {hDone ? 'Completed' : `${hPct}%`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <ProgressBar current={t.current} target={t.target} />
                        <span className="text-sm text-zinc-400 tabular-nums shrink-0">{t.current}/{t.target}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setLogModal(t)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">View logs</button>
                        <span className="text-zinc-700">·</span>
                        <button onClick={() => handleDeleteHistory(t.id)} className="text-xs text-red-400/70 hover:text-red-400 transition-colors">Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </main>

      {/* modals */}
      {logModal && <LogModal tracker={logModal} onClose={() => setLogModal(null)} />}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
    </div>
  );
}
