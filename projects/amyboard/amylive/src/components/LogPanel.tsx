// ─── AMY Live Realtime Event Log Panel ───────────────────────────────
// Collapsible log viewer in the sidebar / bottom of the Dashboard.
// Features: kind badges, timestamps, search, filter, auto-scroll,
// pause/resume, clear, expandable details, copy-to-clipboard.

import { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Search,
  Filter,
  Pause,
  Play,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { useLogStore, type LogKind } from '../stores/log-store';

// ─── Kind Badge Colors ────────────────────────────────────────────────
const BADGE: Record<LogKind, { label: string; color: string }> = {
  connection: { label: 'CONN', color: 'bg-blue-500/20 text-blue-400' },
  error:      { label: 'ERR',  color: 'bg-red-500/20 text-red-400' },
  midi:       { label: 'MIDI', color: 'bg-purple-500/20 text-purple-400' },
  sysex:      { label: 'SYSX', color: 'bg-cyan-500/20 text-cyan-400' },
  wire:       { label: 'WIRE', color: 'bg-green-500/20 text-green-400' },
  ping:       { label: 'PING', color: 'bg-yellow-500/20 text-yellow-400' },
  dump:       { label: 'DUMP', color: 'bg-orange-500/20 text-orange-400' },
  debug:      { label: 'DBG',  color: 'bg-gray-500/20 text-gray-400' },
  user:       { label: 'USER', color: 'bg-indigo-500/20 text-indigo-400' },
};

const ALL_KINDS: (LogKind | 'all')[] = [
  'all', 'connection', 'error', 'wire', 'midi', 'sysex',
  'ping', 'dump', 'debug', 'user',
];

// ─── Time Formatter ───────────────────────────────────────────────────
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', { hour12: false });
}

// ─── Component ────────────────────────────────────────────────────────
export function LogPanel() {
  const {
    entries,
    filter,
    searchQuery,
    paused,
    clear,
    setFilter,
    setSearch,
    setPaused,
  } = useLogStore();

  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new entries arrive (unless paused).
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, paused]);

  const filtered = entries.filter((e) => {
    if (filter !== 'all' && e.kind !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.message.toLowerCase().includes(q) ||
        (e.detail ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const copyEntry = (e: typeof entries[0]) => {
    const text = `[${fmtTime(e.ts)}] [${e.kind}] ${e.message}${e.detail ? '\n' + e.detail : ''}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(e.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--color-primary)]" />
          <span className="text-xs font-semibold">Event Log</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {entries.length} entries
          </span>
          {paused && (
            <span className="text-[10px] text-yellow-500 font-mono">(PAUSED)</span>
          )}
        </div>
        {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {!collapsed && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
            {/* Kind Filter */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              <Filter size={12} className="text-[var(--color-text-muted)] shrink-0" />
              {ALL_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                    filter === k
                      ? 'bg-[var(--color-primary-dim)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {k === 'all' ? 'ALL' : BADGE[k as LogKind].label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 ml-auto">
              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-24 text-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded pl-5 pr-1.5 py-0.5 outline-none focus:border-[var(--color-primary)]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2"
                  >
                    <X size={10} className="text-[var(--color-text-muted)]" />
                  </button>
                )}
              </div>

              {/* Buttons */}
              <button
                onClick={() => setPaused(!paused)}
                className={`p-0.5 rounded transition-colors ${
                  paused ? 'text-yellow-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
                title={paused ? 'Resume' : 'Pause'}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />}
              </button>
              <button
                onClick={clear}
                className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                title="Clear log"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Log Entries */}
          <div
            ref={scrollRef}
            className="overflow-y-auto max-h-80 space-y-0.5 px-2 pb-2"
            style={{ scrollBehavior: 'smooth' }}
          >
            {filtered.length === 0 ? (
              <p className="text-[10px] text-[var(--color-text-muted)] text-center py-4">
                {entries.length === 0 ? 'No log entries yet' : 'No matching entries'}
              </p>
            ) : (
              filtered.map((entry) => (
                <div key={entry.id} className="group">
                  <div
                    className="flex items-start gap-1.5 py-0.5 px-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    onClick={() =>
                      setExpanded(expanded === entry.id ? null : entry.id)
                    }
                  >
                    {/* Kind Badge */}
                    <span
                      className={`text-[9px] font-mono font-semibold px-1 rounded shrink-0 mt-px ${
                        BADGE[entry.kind]?.color ?? 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {BADGE[entry.kind]?.label ?? entry.kind.toUpperCase()}
                    </span>

                    {/* Timestamp */}
                    <span className="text-[10px] font-mono text-[var(--color-text-dim)] shrink-0 w-14">
                      {fmtTime(entry.ts)}
                    </span>

                    {/* Message */}
                    <span className="text-[10px] text-[var(--color-text)] flex-1 break-all leading-relaxed min-w-0">
                      {entry.message}
                    </span>

                    {/* Copy button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyEntry(entry);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all shrink-0"
                      title="Copy"
                    >
                      {copiedId === entry.id ? (
                        <span className="text-[8px] text-green-500">OK</span>
                      ) : (
                        <Copy size={10} />
                      )}
                    </button>

                    {/* Expand indicator */}
                    {entry.detail && (
                      <span className="text-[9px] text-[var(--color-text-dim)] mt-px">
                        {expanded === entry.id ? '▼' : '▶'}
                      </span>
                    )}
                  </div>

                  {/* Expanded Detail */}
                  {expanded === entry.id && entry.detail && (
                    <pre className="text-[9px] font-mono text-[var(--color-text-dim)] bg-[var(--color-bg)] rounded ml-10 mr-6 mb-1 p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                      {entry.detail}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}