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
    { bg: 'bg-violet-100 dark:bg-violet-950/40', border: 'border-violet-300 dark:border-violet-700/60', text: 'text-violet-800 dark:text-violet-200' },
    { bg: 'bg-sky-100 dark:bg-sky-950/40', border: 'border-sky-300 dark:border-sky-700/60', text: 'text-sky-800 dark:text-sky-200' },
    { bg: 'bg-amber-100 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700/60', text: 'text-amber-800 dark:text-amber-200' },
    { bg: 'bg-rose-100 dark:bg-rose-950/40', border: 'border-rose-300 dark:border-rose-700/60', text: 'text-rose-800 dark:text-rose-200' },
    { bg: 'bg-teal-100 dark:bg-teal-950/40', border: 'border-teal-300 dark:border-teal-700/60', text: 'text-teal-800 dark:text-teal-200' },
    { bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40', border: 'border-fuchsia-300 dark:border-fuchsia-700/60', text: 'text-fuchsia-800 dark:text-fuchsia-200' },
    { bg: 'bg-lime-100 dark:bg-lime-950/40', border: 'border-lime-300 dark:border-lime-700/60', text: 'text-lime-800 dark:text-lime-200' },
    { bg: 'bg-orange-100 dark:bg-orange-950/40', border: 'border-orange-300 dark:border-orange-700/60', text: 'text-orange-800 dark:text-orange-200' },
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
 const [selectedType, setSelectedType] = useState<'all' | '8' | '2'>('all');
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
 try {
 const res = await apiService.getBatchTimetable();
 if (res.success) setBatches(res.batches);
 } catch (err) {
 console.error('Failed to load batch timetable', err);
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

 // Trainer and duration filters are applied before splitting by status.
 const searchFiltered = useMemo(() => batches.filter(b => {
 if (selectedTrainer !== 'all' && b.Trainer !== selectedTrainer) return false;
 if (selectedType !== 'all') {
 const typeText = `${b.programType || ''} ${b.batchId || ''} ${b.course || ''}`.toLowerCase();
 const isEightHour = /8\s*(hour|hr|hours|hrs)|\b8h\b/.test(typeText);
 const isTwoHour = /2\s*(hour|hr|hours|hrs)|\b2h\b/.test(typeText);
 if (selectedType === '8' && !isEightHour) return false;
 if (selectedType === '2' && !isTwoHour) return false;
 }
 return true;
 }), [batches, selectedTrainer, selectedType]);

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
 <div className="p-3 sm:p-6 h-full flex flex-col overflow-y-auto lg:overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
 <div className="flex items-center justify-between mb-3 flex-wrap gap-3 shrink-0">
 <div>
 <h2 className="text-xl font-bold text-slate-800 dark:text-white">Batch Timetable</h2>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
 Toggle a day chip (or drag a batch onto the grid) to schedule it — each day is independent, so a Saturday-only weekend batch stays on Saturday and never spills onto weekdays.
 </p>
 </div>
 </div>

 <div className="flex flex-col xl:flex-row xl:items-center gap-2.5 mb-4 shrink-0">
 <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-800 rounded-xl w-full xl:w-fit min-w-0 overflow-x-auto">
 {isAdmin && <>
 <button onClick={() => setViewMode('schedule')}
 className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${viewMode === 'schedule' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}>
 <span aria-hidden="true" className="text-sm leading-none">◷</span> Schedule Batches
 </button>
 <button onClick={() => setViewMode('completed')}
 className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${viewMode === 'completed' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}>
 <span aria-hidden="true" className="text-sm leading-none">☑</span> Completed Batches
 </button>
 </>}
 <button onClick={() => { setViewMode('schedule'); setScheduleTab('ongoing'); }}
 className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${viewMode === 'schedule' && scheduleTab === 'ongoing' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}>
 <span aria-hidden="true" className="text-sm leading-none">▤</span> Ongoing ({scheduleTabCounts.ongoing})
 </button>
 <button onClick={() => { setViewMode('schedule'); setScheduleTab('upcoming'); }}
 className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${viewMode === 'schedule' && scheduleTab === 'upcoming' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800'}`}>
 <span aria-hidden="true" className="text-sm leading-none">⇧</span> Upcoming ({scheduleTabCounts.upcoming})
 </button>
 </div>
 {viewMode === 'schedule' && <div className="flex items-center gap-2 justify-end xl:ml-auto shrink-0">
 <label className="relative inline-flex items-center">
 <span className="absolute left-2 w-3.5 h-3.5 rounded-full bg-gradient-to-r from-emerald-300 to-amber-200 pointer-events-none" aria-hidden="true" />
 <select value={selectedType} onChange={e => setSelectedType(e.target.value as 'all' | '8' | '2')}
 className="appearance-auto rounded-xl border border-blue-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 pl-8 pr-3 py-2.5 text-xs min-w-[112px] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900" aria-label="Filter by batch type">
 <option value="all">All Types</option><option value="8">8 Hours</option><option value="2">2 Hours</option>
 </select>
 </label>
 <label className="relative inline-flex items-center">
 <span className="absolute left-2.5 text-blue-500 pointer-events-none" aria-hidden="true">♙</span>
 <select value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)}
 className="appearance-auto rounded-xl border border-blue-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 pl-8 pr-3 py-2.5 text-xs min-w-[135px] max-w-[42vw] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900" aria-label="Filter by trainer">
 <option value="all">All Trainers</option>
 {trainerTabs.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
 </select>
 </label>
 </div>}
 </div>

 {viewMode === 'completed' ? (
 <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 transition-colors">
 <div className="flex items-center justify-between gap-3 mb-4">
 <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-slate-700 px-3 py-2 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 ">
 <span className="w-2 h-2 rounded-full bg-rose-500" />
 COMPLETED BATCHES: <span className="font-bold tabular-nums">{String(completedBatches.length).padStart(2, '0')}</span>
 </div>
 </div>
 {completedLoading ? (
 <p className="text-xs text-slate-400 italic text-center py-10">Loading completed batches…</p>
 ) : completedBatches.length === 0 ? (
 <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center py-12 px-4">
 <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No completed batches</p>
 <p className="text-xs text-slate-400 mt-1">Completed batches will appear here when available.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-start">
 {completedBatches.map(b => (
 <article key={b.batchId} className="min-w-0 overflow-hidden rounded-xl border border-blue-200 dark:border-slate-800 bg-white dark:bg-slate-850 dark:bg-slate-900 shadow-sm">
 <div className="px-3 py-3 bg-rose-100 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 ">
 <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">{b.batchId}</h3>
 <div className="mt-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 ">
 <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
 <span>Completed</span>
 <span className="ml-auto truncate max-w-[55%] font-medium normal-case">{b.programType || 'Batch'}</span>
 </div>
 </div>
 <div className="p-3 space-y-3">
 <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 dark:bg-slate-800/80 px-2.5 py-2">
 <div className="min-w-0">
 <p className="text-[9px] uppercase tracking-wide text-slate-500 ">Course</p>
 <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={b.course || ''}>{b.course || '—'}</p>
 </div>
 <div className="shrink-0 text-right">
 <p className="text-[9px] uppercase tracking-wide text-slate-500 ">Students</p>
 <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{b.studentCount ?? 0}</p>
 </div>
 </div>
 <div className="space-y-2 text-xs">
 <div className="flex items-center justify-between gap-3">
 <span className="text-slate-500 ">Trainer</span>
 <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate">{b.Trainer || '—'}</span>
 </div>
 <div className="flex items-center justify-between gap-3">
 <span className="text-slate-500 ">Completed on</span>
 <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{b.completedAt ? new Date(b.completedAt).toLocaleDateString() : '—'}</span>
 </div>
 {b.reopenedBy && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Previously reopened by {b.reopenedBy}</p>}
 </div>
 <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
 <button onClick={() => handleReopen(b.batchId)} disabled={reopeningId === b.batchId}
 className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[10px] sm:text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
 <span aria-hidden="true" className="text-sm leading-none">↻</span>
 {reopeningId === b.batchId ? 'Reopening…' : 'Reopen Access'}
 </button>
 </div>
 </div>
 </article>
 ))}
 </div>
 )}
 </div> ) : (
 <>
 <div className="flex-1 flex flex-col gap-4 overflow-visible lg:overflow-hidden">
 {/* Batch cards — horizontal strip matching the reference design */}
 <div className="shrink-0 rounded-2xl">
 <div className="flex items-center justify-between gap-3 mb-1.5">
 <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">Active Batches ({filtered.length})</p>
 </div>
 <div className="flex gap-2 overflow-x-auto pb-1.5 snap-x">
 {filtered.length === 0 && <p className="text-xs text-slate-400 italic py-6">No batches found.</p>}
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
 className={`snap-start shrink-0 w-44 sm:w-48 p-2 rounded-lg border ${accent.bg} ${endingSoon ? 'border-red-400 dark:border-red-500/70 ring-1 ring-red-300 dark:ring-red-900/50' : accent.border} ${placeable ? 'cursor-grab active:cursor-grabbing' : 'opacity-70'}`}
 title={placeable ? 'Drag onto a day, or use the day chips below' : 'Set start & end time on this batch first (Course Enrolled → Batch tab)'}
 >
 <div className="flex items-center justify-between gap-1">
 <div className={`text-[10px] font-bold truncate ${accent.text}`} title={b.batchId}>{b.batchId}</div>
 <button onClick={e => { e.stopPropagation(); copyBatchCode(b.batchId); }} title="Copy batch code"
 className={`p-1 rounded flex-shrink-0 ${copiedBatchId === b.batchId ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40' : 'text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}>
 {copiedBatchId === b.batchId ? <Icons.Check className="w-3 h-3" /> : <Icons.Copy className="w-3 h-3" />}
 </button>
 </div>
 <div className="text-[10px] text-slate-700 dark:text-slate-200 mt-0.5 truncate">{getTrainerShortCode(b.Trainer)} · {getCourseShortCode(b.course)} · {b.batch_start_time ? formatTime12h(b.batch_start_time) : 'Time not set'}{b.batch_end_time ? `–${formatTime12h(b.batch_end_time)}` : ''}</div>
 <div className={`text-[9px] mt-0.5 font-medium ${endingSoon ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>{getBatchRemainingLabel(b.batch_date, b.programType) || `${b.leadCount} students`}</div>
 <button onClick={() => setStudentsModalBatchId(b.batchId)} className="text-[9px] text-slate-700 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 hover:underline mt-0.5 font-semibold">
 {b.leadCount} student{b.leadCount === 1 ? '' : 's'} →
 </button>
 <label className="flex items-center gap-1 mt-1 cursor-pointer select-none">
 <input type="checkbox" checked={days.size === WEEKDAYS.length}
 ref={el => { if (el) el.indeterminate = days.size > 0 && days.size < WEEKDAYS.length; }}
 disabled={!placeable || isBatchPending(b.batchId)}
 onChange={() => updateAllDays(b.batchId, days.size !== WEEKDAYS.length)}
 className="w-3 h-3 accent-blue-600 disabled:cursor-not-allowed" />
 <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200">ALL DAYS</span>
 </label>
 <div className="flex items-center gap-1 mt-0.5">
 {WEEKDAYS.map(d => {
 const active = days.has(d);
 const key = `${b.batchId}-${d}`;
 return <button key={d} disabled={!placeable || pendingKey === key || isBatchPending(b.batchId)}
 onClick={() => updateDay(b.batchId, d, active ? 'remove' : 'add')}
 title={`${active ? 'Remove from' : 'Add to'} ${FULL_DAY[d]}`}
 className={`flex-1 min-w-0 h-5 rounded text-[8px] font-bold disabled:opacity-40 ${active ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
 {DAY_TOGGLE_LABEL[d]}
 </button>;
 })}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Timetable: weekdays are columns and times are rows, matching the original timetable sheet */}
 <div className="flex-1 min-h-[360px] overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
   <div className="min-w-[860px]">
     <div className="grid sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" style={{ gridTemplateColumns: '78px repeat(6, minmax(125px, 1fr))' }}>
       <div className="py-3" />
       {WEEKDAYS.map(day => (
         <div key={day} className="py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-l border-slate-100 dark:border-slate-800">
           {FULL_DAY[day]}
         </div>
       ))}
     </div>
     <div className="grid" style={{ gridTemplateColumns: '78px repeat(6, minmax(125px, 1fr))' }}>
       <div className="relative" style={{ height: GRID_HEIGHT }}>
         {Array.from({ length: TOTAL_ROWS + 1 }).map((_, i) => {
           const min = GRID_START_MIN + i * SLOT_MIN;
           if (min % 60 !== 0) return null;
           const label = formatTime12h(`${String(Math.floor(min / 60)).padStart(2, '0')}:00`);
           return <div key={i} className="absolute left-0 right-0 text-right pr-2 text-[10px] text-slate-400" style={{ top: i * ROW_HEIGHT - 6 }}>{label}</div>;
         })}
       </div>
       {WEEKDAYS.map(day => (
         <div key={day}
           className={`relative border-l border-slate-100 dark:border-slate-800 transition-colors ${dragOverDay === day ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
           style={{ height: GRID_HEIGHT }}
           onDragOver={e => { e.preventDefault(); setDragOverDay(day); }}
           onDragLeave={() => setDragOverDay(prev => (prev === day ? null : prev))}
           onDrop={handleDrop(day)}>
           {Array.from({ length: TOTAL_ROWS + 1 }).map((_, i) => (
             <div key={i} className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-slate-100 dark:border-slate-800/80' : 'border-slate-50 dark:border-slate-800/40'}`} style={{ top: i * ROW_HEIGHT }} />
           ))}
           {packDayEvents(scheduledOnDay[day]).map(pe => {
             const start = Math.max(pe.startMin, GRID_START_MIN);
             const end = Math.min(pe.endMin, GRID_END_MIN);
             if (end <= start) return null;
             const top = ((start - GRID_START_MIN) / SLOT_MIN) * ROW_HEIGHT;
             const height = Math.max(((end - start) / SLOT_MIN) * ROW_HEIGHT, 30);
             const widthPct = 100 / pe.totalCols;
             const leftPct = pe.col * widthPct;
             const accent = batchAccent(pe.batch.batchId);
             const key = `${pe.batch.batchId}-${day}`;
             const endingSoon = isBatchEndingSoon(pe.batch.batch_date, pe.batch.programType, 10);
             return (
               <div key={key} onClick={() => setStudentsModalBatchId(pe.batch.batchId)}
                 className={`absolute rounded-lg border px-1.5 py-1 overflow-hidden cursor-pointer ${accent.bg} ${endingSoon ? 'border-red-400 dark:border-red-500/70 ring-1 ring-red-300 dark:ring-red-900/50' : accent.border} shadow-sm hover:shadow-md transition-shadow`}
                 style={{ top: top + 2, height: Math.max(height - 2, 28), left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                 title={`${pe.batch.batchId} · ${pe.batch.Trainer || ''} · ${pe.batch.course || ''} · click to view students`}>
                 <div className="flex items-start justify-between gap-1">
                   <span className={`text-[10px] font-bold truncate ${accent.text}`}>{getTrainerShortCode(pe.batch.Trainer)}-{getCourseShortCode(pe.batch.course)}</span>
                   <button onClick={e => { e.stopPropagation(); updateDay(pe.batch.batchId, day, 'remove'); }}
                     disabled={pendingKey === key} className="text-slate-400 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 leading-none flex-shrink-0 disabled:opacity-40" title="Remove from this day">
                     <Icons.X className="w-3 h-3" />
                   </button>
                 </div>
                 <div className="text-[9px] truncate text-slate-700 dark:text-slate-200 font-medium">{formatTime12h(pe.batch.batch_start_time)}-{formatTime12h(pe.batch.batch_end_time)}</div>
                 <div className="text-[9px] truncate opacity-90 text-slate-600 dark:text-slate-300">{pe.batch.leadCount} student{pe.batch.leadCount === 1 ? '' : 's'}</div>
                 <div className={`text-[9px] truncate font-bold ${endingSoon ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-emerald-300'}`}>{getBatchRemainingLabel(pe.batch.batch_date, pe.batch.programType)}</div>
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
 <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setStudentsModalBatchId(null)}>
 <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
 <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-bold text-slate-800 dark:text-white">{studentsModalBatch.batchId}</p>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 {studentsModalBatch.Trainer || 'No trainer'} · {studentsModalBatch.course || 'No course'}
 {studentsModalBatch.batch_start_time && studentsModalBatch.batch_end_time && (
 <> · {formatTime12h(studentsModalBatch.batch_start_time)}-{formatTime12h(studentsModalBatch.batch_end_time)}</>
 )}
 </p>
 {getBatchRemainingLabel(studentsModalBatch.batch_date, studentsModalBatch.programType) && (
 <p className="text-xs font-bold text-green-700 dark:text-emerald-400 mt-1">
 {getBatchRemainingLabel(studentsModalBatch.batch_date, studentsModalBatch.programType)}
 </p>
 )}
 {(studentsModalBatch.batch_days || []).length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1.5">
 {studentsModalBatch.batch_days.map(d => (
 <span key={d} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{d}</span>
 ))}
 </div>
 )}
 </div>
 <button onClick={() => setStudentsModalBatchId(null)} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 flex-shrink-0">
 <Icons.X className="w-4 h-4" />
 </button>
 </div>
 <div className="flex-1 overflow-y-auto p-3 space-y-1">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1">
 {studentsModalBatch.students.length} Student{studentsModalBatch.students.length === 1 ? '' : 's'}
 </p>
 {studentsModalBatch.students.length === 0 ? (
 <p className="text-xs text-slate-400 italic text-center py-6">No students in this batch.</p>
 ) : (
 studentsModalBatch.students.map(s => (
 <div key={s._id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
 <div className="flex items-center gap-2 min-w-0">
 <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-emerald-950/60 text-green-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-transparent dark:border-emerald-800/40">
 {(s.userName || '?').charAt(0).toUpperCase()}
 </div>
 <span className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate">{s.userName || 'Unknown'}</span>
 </div>
 <button
 onClick={() => { const n = (s.userNumber || '').replace(/\D/g, ''); if (n) window.open(`https://wa.me/${n}`, '_blank', 'noopener'); }}
 className="text-xs text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-emerald-400 flex items-center gap-1.5 flex-shrink-0 transition-colors"
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
