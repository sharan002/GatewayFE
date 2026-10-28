import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { Icons } from './Icons';
import { BatchTimetableEntry, CompletedBatchEntry, User } from '../types';
import { getTrainerShortCode, getCourseShortCode, formatTime12h, timeToMinutes, getBatchRemainingLabel, getBatchStatus, isBatchEndingSoon, WEEKDAYS, Weekday, BatchStatus } from '../utils/batchCode';

const FULL_DAY: Record<Weekday, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

const GRID_START_MIN = 9 * 60 + 30; // 9:30 AM
const GRID_END_MIN = 19 * 60; // 7:00 PM
const SLOT_MIN = 30;
const ROW_HEIGHT = 44; // px per 30-min row
const TOTAL_ROWS = (GRID_END_MIN - GRID_START_MIN) / SLOT_MIN;
const GRID_HEIGHT = TOTAL_ROWS * ROW_HEIGHT;

/** Deterministic pastel accent for a batch code, mirrors CourseEnrolledView's batchColor() */
function batchAccent(code: string): { bg: string; border: string; text: string } {
  const palette = [
    { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800' },
    { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-800' },
    { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' },
    { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800' },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800' },
    { bg: 'bg-fuchsia-100', border: 'border-fuchsia-300', text: 'text-fuchsia-800' },
    { bg: 'bg-lime-100', border: 'border-lime-300', text: 'text-lime-800' },
    { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
  ];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) & 0xffff;
  return palette[hash % palette.length];
}

interface PositionedEvent {
  batch: BatchTimetableEntry;
  startMin: number;
  endMin: number;
  col: number;
  totalCols: number;
}

/** Lays out same-day batches into side-by-side split columns for any that overlap in time (Meet/Teams style). */
function packDayEvents(entries: BatchTimetableEntry[]): PositionedEvent[] {
  type Ev = { batch: BatchTimetableEntry; start: number; end: number; col: number };
  const events: Ev[] = entries
    .map(b => ({ batch: b, start: timeToMinutes(b.batch_start_time), end: timeToMinutes(b.batch_end_time), col: 0 }))
    .filter((e): e is Ev => e.start !== null && e.end !== null && e.end > e.start);

  events.sort((a, b) => a.start - b.start || a.end - b.end);

  const result: PositionedEvent[] = [];
  let i = 0;
  while (i < events.length) {
    let clusterEnd = events[i].end;
    let j = i + 1;
    while (j < events.length && events[j].start < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, events[j].end);
      j++;
    }
    const cluster = events.slice(i, j);
    const columns: Ev[][] = [];
    cluster.forEach(ev => {
      let placedCol = columns.findIndex(col => col[col.length - 1].end <= ev.start);
      if (placedCol === -1) { placedCol = columns.length; columns.push([]); }
      ev.col = placedCol;
      columns[placedCol].push(ev);
    });
    const totalCols = columns.length;
    cluster.forEach(ev => result.push({ batch: ev.batch, startMin: ev.start, endMin: ev.end, col: ev.col, totalCols }));
    i = j;
  }
  return result;
}

const DAY_TOGGLE_LABEL: Record<Weekday, string> = { Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa' };

const SCHEDULE_TABS: { key: BatchStatus; label: string }[] = [
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'upcoming', label: 'Upcoming' },
  // { key: 'completed', label: 'Completed' },
];

interface BatchTimetableViewProps {
  currentUser?: User | null;
}

const BatchTimetableView: React.FC<BatchTimetableViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';
  const [batches, setBatches] = useState<BatchTimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<string>('all');
  const [dragOverDay, setDragOverDay] = useState<Weekday | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [studentsModalBatchId, setStudentsModalBatchId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'completed'>('schedule');
  const [completedBatches, setCompletedBatches] = useState<CompletedBatchEntry[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [scheduleTab, setScheduleTab] = useState<BatchStatus>('ongoing');
  const [copiedBatchId, setCopiedBatchId] = useState<string | null>(null);

  const copyBatchCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBatchId(code);
    setTimeout(() => setCopiedBatchId(prev => (prev === code ? null : prev)), 1500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getBatchTimetable();
      if (res.success) setBatches(res.batches);
    } catch (err) {
      console.error('Failed to load batch timetable', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCompleted = useCallback(async () => {
    setCompletedLoading(true);
    try {
      const res = await apiService.getCompletedBatches();
      if (res.success) setCompletedBatches(res.batches);
    } catch (err) {
      console.error('Failed to load completed batches', err);
    } finally {
      setCompletedLoading(false);
    }
  }, []);

  useEffect(() => { if (viewMode === 'completed') loadCompleted(); }, [viewMode, loadCompleted]);

  const handleReopen = async (batchId: string) => {
    if (!window.confirm(`Reopen ${batchId}? The trainer will be able to record topics/attendance for it again.`)) return;
    setReopeningId(batchId);
    try {
      await apiService.reopenBatch(batchId);
      setCompletedBatches(prev => prev.filter(b => b.batchId !== batchId));
    } catch (err: any) {
      alert(err.message || 'Failed to reopen batch');
    } finally {
      setReopeningId(null);
    }
  };

  // Distinct trainers, for the tab bar
  const trainerTabs = useMemo(() => {
    const names = Array.from(new Set(batches.map(b => b.Trainer).filter((t): t is string => !!t))).sort();
    return names.map(name => ({ name, count: batches.filter(b => b.Trainer === name).length }));
  }, [batches]);

  // Trainer + search filter, before splitting by Ongoing/Upcoming/Completed.
  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter(b => {
      if (selectedTrainer !== 'all' && b.Trainer !== selectedTrainer) return false;
      if (!q) return true;
      return (
        b.batchId.toLowerCase().includes(q) ||
        (b.Trainer || '').toLowerCase().includes(q) ||
        (b.course || '').toLowerCase().includes(q)
      );
    });
  }, [batches, search, selectedTrainer]);

  // Counts per status tab, computed from searchFiltered so switching tabs doesn't reset search/trainer filters.
  const scheduleTabCounts = useMemo(() => {
    const counts: Record<BatchStatus, number> = { ongoing: 0, upcoming: 0, completed: 0 };
    searchFiltered.forEach(b => { counts[getBatchStatus(b.batch_date, b.programType)]++; });
    return counts;
  }, [searchFiltered]);

  const filtered = useMemo(
    () => searchFiltered.filter(b => getBatchStatus(b.batch_date, b.programType) === scheduleTab),
    [searchFiltered, scheduleTab]
  );

  const scheduledOnDay = useMemo(() => {
    const map: Record<Weekday, BatchTimetableEntry[]> = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
    filtered.forEach(b => {
      (b.batch_days || []).forEach(d => {
        if (map[d as Weekday]) map[d as Weekday].push(b);
      });
    });
    return map;
  }, [filtered]);

  const studentsModalBatch = useMemo(
    () => (studentsModalBatchId ? batches.find(b => b.batchId === studentsModalBatchId) || null : null),
    [studentsModalBatchId, batches]
  );

  const canPlace = (b: BatchTimetableEntry) => !!b.batch_start_time && !!b.batch_end_time;

  const updateDay = async (batchId: string, day: Weekday, action: 'add' | 'remove') => {
    const key = `${batchId}-${day}`;
    setPendingKey(key);
    setBatches(prev => prev.map(b => {
      if (b.batchId !== batchId) return b;
      const days = new Set(b.batch_days || []);
      if (action === 'add') days.add(day); else days.delete(day);
      return { ...b, batch_days: Array.from(days) };
    }));
    try {
      await apiService.updateBatchDay(batchId, day, action);
    } catch (err) {
      console.error('Failed to update batch schedule', err);
      load();
    } finally {
      setPendingKey(null);
    }
  };

  // "Select all" checkbox: adds every missing day (or clears every set day), one PUT per day in parallel.
  const updateAllDays = async (batchId: string, selectAll: boolean) => {
    const batch = batches.find(b => b.batchId === batchId);
    if (!batch) return;
    const currentDays = new Set(batch.batch_days || []);
    const daysToChange = selectAll
      ? WEEKDAYS.filter(d => !currentDays.has(d))
      : WEEKDAYS.filter(d => currentDays.has(d));
    if (daysToChange.length === 0) return;

    const key = `${batchId}-all`;
    setPendingKey(key);
    setBatches(prev => prev.map(b => (b.batchId === batchId ? { ...b, batch_days: selectAll ? [...WEEKDAYS] : [] } : b)));
    try {
      await Promise.all(daysToChange.map(d => apiService.updateBatchDay(batchId, d, selectAll ? 'add' : 'remove')));
    } catch (err) {
      console.error('Failed to update all days', err);
      load();
    } finally {
      setPendingKey(null);
    }
  };

  const isBatchPending = (batchId: string) => pendingKey === `${batchId}-all`;

  const handleDrop = (day: Weekday) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDay(null);
    const batchId = e.dataTransfer.getData('text/plain');
    if (!batchId) return;
    const batch = batches.find(b => b.batchId === batchId);
    if (!batch || !canPlace(batch)) return;
    if ((batch.batch_days || []).includes(day)) return;
    updateDay(batchId, day, 'add');
  };

  return (
    <div className="p-3 sm:p-6 h-full flex flex-col overflow-y-auto lg:overflow-hidden">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-black text-slate-800">Batch Timetable</h2>
          <p className="text-xs text-slate-400 mt-1">
            Toggle a day chip (or drag a batch onto the grid) to schedule it — each day is independent, so a Saturday-only weekend batch stays on Saturday and never spills onto weekdays.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Icons.Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search batch, trainer, course"
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>
          <button onClick={load} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 flex-shrink-0" title="Refresh">
            <Icons.RefreshCcw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1 mb-4 p-1 bg-slate-100 rounded-xl w-fit shrink-0">
          <button
            onClick={() => setViewMode('schedule')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors ${viewMode === 'schedule' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Schedule
          </button>
          <button
            onClick={() => setViewMode('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors ${viewMode === 'completed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Completed Batches
          </button>
        </div>
      )}

      {viewMode === 'completed' ? (
        <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-2xl">
          {completedLoading ? (
            <p className="text-xs text-slate-400 italic text-center py-10">Loading completed batches…</p>
          ) : completedBatches.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-10">No completed batches.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Batch</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Trainer</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Course</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Students</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {completedBatches.map(b => (
                  <tr key={b.batchId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-black text-slate-700">{b.batchId}</td>
                    <td className="px-4 py-3 text-slate-500">{b.Trainer || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{b.course || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{b.studentCount}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {b.completedAt ? new Date(b.completedAt).toLocaleDateString() : '—'}
                      {b.reopenedBy && (
                        <div className="text-[10px] text-amber-600 font-bold mt-0.5">Previously reopened by {b.reopenedBy}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleReopen(b.batchId)}
                        disabled={reopeningId === b.batchId}
                        className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reopeningId === b.batchId ? 'Reopening…' : 'Reopen Access'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <>
      {/* Ongoing / Upcoming / Completed split, based on each batch's start date & expected end date */}
      <div className="flex items-center gap-1 mb-3 p-1 bg-slate-100 rounded-xl w-fit shrink-0">
        {SCHEDULE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setScheduleTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-colors ${scheduleTab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label} ({scheduleTabCounts[t.key]})
          </button>
        ))}
      </div>

      {/* Trainer-wise tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 shrink-0">
        <button
          onClick={() => setSelectedTrainer('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border whitespace-nowrap transition-colors ${selectedTrainer === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          All Trainers ({batches.length})
        </button>
        {trainerTabs.map(t => (
          <button
            key={t.name}
            onClick={() => setSelectedTrainer(t.name)}
            title={t.name}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border whitespace-nowrap transition-colors ${selectedTrainer === t.name ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            {getTrainerShortCode(t.name)} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-visible lg:overflow-hidden">
        {/* Sidebar: batches for the selected trainer, draggable + toggleable */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-72 lg:max-h-none">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Batches ({filtered.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">No batches found.</p>
            )}
            {filtered.map(b => {
              const accent = batchAccent(b.batchId);
              const placeable = canPlace(b);
              const days = new Set(b.batch_days || []);
              const endingSoon = isBatchEndingSoon(b.batch_date, b.programType, 10);
              return (
                <div
                  key={b.batchId}
                  draggable={placeable}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', b.batchId); e.dataTransfer.effectAllowed = 'copy'; }}
                  className={`p-2.5 rounded-xl border ${accent.bg} ${endingSoon ? 'border-red-400 ring-1 ring-red-300' : accent.border} ${placeable ? 'cursor-grab active:cursor-grabbing' : 'opacity-60'}`}
                  title={placeable ? 'Drag onto a day, or use the day chips below' : 'Set start & end time on this batch first (Course Enrolled → Batch tab)'}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className={`text-xs font-black uppercase ${accent.text}`}>{b.batchId}</div>
                    <button
                      onClick={e => { e.stopPropagation(); copyBatchCode(b.batchId); }}
                      title="Copy batch code"
                      className={`p-1 rounded transition-colors flex-shrink-0 ${copiedBatchId === b.batchId ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}
                    >
                      {copiedBatchId === b.batchId ? <Icons.Check className="w-3 h-3" /> : <Icons.Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                    <span>{getTrainerShortCode(b.Trainer)}</span>
                    <span>·</span>
                    <span>{getCourseShortCode(b.course)}</span>
                    {placeable && (
                      <>
                        <span>·</span>
                        <span>{formatTime12h(b.batch_start_time)}-{formatTime12h(b.batch_end_time)}</span>
                      </>
                    )}
                  </div>
                  {(() => {
                    const remaining = getBatchRemainingLabel(b.batch_date, b.programType);
                    return remaining ? (
                      <div className={`text-[10px] mt-0.5 font-bold ${endingSoon ? 'text-red-600' : 'text-slate-500'}`}>
                        {remaining}
                      </div>
                    ) : null;
                  })()}

                  <button
                    onClick={() => setStudentsModalBatchId(b.batchId)}
                    className="text-[10px] text-slate-500 hover:text-green-700 hover:underline mt-1 font-bold"
                  >
                    {b.leadCount} student{b.leadCount === 1 ? '' : 's'} &rarr;
                  </button>

                  {/* Select all/none — fires one PUT per changed day, independent of the individual chips below */}
                  <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={days.size === WEEKDAYS.length}
                      ref={el => { if (el) el.indeterminate = days.size > 0 && days.size < WEEKDAYS.length; }}
                      disabled={!placeable || isBatchPending(b.batchId)}
                      onChange={() => updateAllDays(b.batchId, days.size !== WEEKDAYS.length)}
                      className="w-3.5 h-3.5 accent-green-600 disabled:cursor-not-allowed"
                    />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">All days</span>
                  </label>

                  {/* Explicit per-day toggles — independent of drag-drop, so e.g. a weekend batch can be Sat-only */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {WEEKDAYS.map(d => {
                      const active = days.has(d);
                      const key = `${b.batchId}-${d}`;
                      return (
                        <button
                          key={d}
                          disabled={!placeable || pendingKey === key || isBatchPending(b.batchId)}
                          onClick={() => updateDay(b.batchId, d, active ? 'remove' : 'add')}
                          title={`${active ? 'Remove from' : 'Add to'} ${FULL_DAY[d]}`}
                          className={`w-7 h-6 rounded-md text-[9px] font-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-green-600 text-white' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                        >
                          {DAY_TOGGLE_LABEL[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl">
          <div className="min-w-[860px]">
            {/* Header row */}
            <div className="grid sticky top-0 z-10 bg-white border-b border-slate-200" style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}>
              <div className="py-3" />
              {WEEKDAYS.map(d => (
                <div key={d} className="py-3 text-center text-xs font-black text-slate-600 uppercase tracking-wider border-l border-slate-100">
                  {FULL_DAY[d]}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="grid" style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}>
              {/* Time labels */}
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {Array.from({ length: TOTAL_ROWS + 1 }).map((_, i) => {
                  const min = GRID_START_MIN + i * SLOT_MIN;
                  const h = Math.floor(min / 60);
                  const m = min % 60;
                  if (m !== 0) return null;
                  const label = formatTime12h(`${String(h).padStart(2, '0')}:00`);
                  return (
                    <div key={i} className="absolute left-0 right-0 text-right pr-2 text-[10px] text-slate-400" style={{ top: i * ROW_HEIGHT - 6 }}>
                      {label}
                    </div>
                  );
                })}
              </div>

              {WEEKDAYS.map(day => (
                <div
                  key={day}
                  className={`relative border-l border-slate-100 transition-colors ${dragOverDay === day ? 'bg-green-50' : ''}`}
                  style={{ height: GRID_HEIGHT }}
                  onDragOver={e => { e.preventDefault(); setDragOverDay(day); }}
                  onDragLeave={() => setDragOverDay(prev => (prev === day ? null : prev))}
                  onDrop={handleDrop(day)}
                >
                  {Array.from({ length: TOTAL_ROWS + 1 }).map((_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: i * ROW_HEIGHT }} />
                  ))}

                  {packDayEvents(scheduledOnDay[day]).map(pe => {
                    const top = ((pe.startMin - GRID_START_MIN) / SLOT_MIN) * ROW_HEIGHT;
                    const height = Math.max(((pe.endMin - pe.startMin) / SLOT_MIN) * ROW_HEIGHT, 30);
                    const widthPct = 100 / pe.totalCols;
                    const leftPct = pe.col * widthPct;
                    const accent = batchAccent(pe.batch.batchId);
                    const key = `${pe.batch.batchId}-${day}`;
                    const endingSoon = isBatchEndingSoon(pe.batch.batch_date, pe.batch.programType, 10);
                    return (
                      <div
                        key={key}
                        onClick={() => setStudentsModalBatchId(pe.batch.batchId)}
                        className={`absolute rounded-lg border px-1.5 py-1 overflow-hidden cursor-pointer ${accent.bg} ${endingSoon ? 'border-red-400 ring-1 ring-red-300' : accent.border} ${accent.text} shadow-sm hover:shadow-md transition-shadow`}
                        style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)` }}
                        title={`${pe.batch.batchId} · ${pe.batch.Trainer || ''} · ${pe.batch.course || ''} · click to view students`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[10px] font-black truncate">{getTrainerShortCode(pe.batch.Trainer)}-{getCourseShortCode(pe.batch.course)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); updateDay(pe.batch.batchId, day, 'remove'); }}
                            disabled={pendingKey === key}
                            className="text-slate-500 hover:text-red-600 leading-none flex-shrink-0 disabled:opacity-40"
                            title="Remove from this day"
                          >
                            <Icons.X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[9px] truncate">{formatTime12h(pe.batch.batch_start_time)}-{formatTime12h(pe.batch.batch_end_time)}</div>
                        <div className="text-[9px] truncate opacity-80">{pe.batch.leadCount} student{pe.batch.leadCount === 1 ? '' : 's'}</div>
                        {endingSoon && (
                          <div className="text-[9px] truncate font-black text-red-600">
                            {getBatchRemainingLabel(pe.batch.batch_date, pe.batch.programType)}
                          </div>
                        )}
                        {!endingSoon && getBatchRemainingLabel(pe.batch.batch_date, pe.batch.programType) && (
                          <div className="text-[9px] truncate font-bold">{getBatchRemainingLabel(pe.batch.batch_date, pe.batch.programType)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Students roster modal */}
      {studentsModalBatch && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4" onClick={() => setStudentsModalBatchId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-800">{studentsModalBatch.batchId}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {studentsModalBatch.Trainer || 'No trainer'} · {studentsModalBatch.course || 'No course'}
                  {studentsModalBatch.batch_start_time && studentsModalBatch.batch_end_time && (
                    <> · {formatTime12h(studentsModalBatch.batch_start_time)}-{formatTime12h(studentsModalBatch.batch_end_time)}</>
                  )}
                </p>
                {getBatchRemainingLabel(studentsModalBatch.batch_date, studentsModalBatch.programType) && (
                  <p className="text-xs font-bold text-green-700 mt-1">
                    {getBatchRemainingLabel(studentsModalBatch.batch_date, studentsModalBatch.programType)}
                  </p>
                )}
                {(studentsModalBatch.batch_days || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {studentsModalBatch.batch_days.map(d => (
                      <span key={d} className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-600 border border-slate-200">{d}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setStudentsModalBatchId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 pb-1">
                {studentsModalBatch.students.length} Student{studentsModalBatch.students.length === 1 ? '' : 's'}
              </p>
              {studentsModalBatch.students.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">No students in this batch.</p>
              ) : (
                studentsModalBatch.students.map(s => (
                  <div key={s._id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {(s.userName || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700 font-medium truncate">{s.userName || 'Unknown'}</span>
                    </div>
                    <button
                      onClick={() => { const n = (s.userNumber || '').replace(/\D/g, ''); if (n) window.open(`https://wa.me/${n}`, '_blank', 'noopener'); }}
                      className="text-xs text-slate-500 hover:text-green-600 flex items-center gap-1 flex-shrink-0"
                      title="Open in WhatsApp"
                    >
                      {s.userNumber}
                      <Icons.WhatsApp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchTimetableView;
