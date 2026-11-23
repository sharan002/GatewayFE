import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/api';
import { Icons } from './Icons';

// ── Types (local — mirrors backend check-in format) ──
interface ReviewMeetingMessage {
  role: 'manager' | 'counsellor';
  text: string;
  timestamp?: string;
}

interface ReviewMeetingCheckIn {
  _id: string;
  counsellorUsername: string;
  counsellorNumber?: string;
  date: string;
  status: 'in_progress' | 'completed' | 'no_response';
  verdict?: 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | null;
  verdictReason?: string;
  adminSummaryReport?: string;
  questionCount?: number;
  escalatedToAdmin?: boolean;
  messages: ReviewMeetingMessage[];
  startedAt?: string;
  completedAt?: string | null;
}

interface DateSummary {
  date: string;
  total: number;
  completed: number;
  inProgress: number;
  noResponse: number;
  needsImprovement: number;
}

const fmtDateFormatted = (d: string): { dayNum: string; monthYear: string; weekday: string } => {
  const parsed = new Date(`${d}T00:00:00`);
  if (isNaN(parsed.getTime())) return { dayNum: '', monthYear: d, weekday: '' };
  const dayNum = parsed.toLocaleDateString('en-IN', { day: '2-digit' });
  const monthYear = parsed.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const weekday = parsed.toLocaleDateString('en-IN', { weekday: 'long' });
  return { dayNum, monthYear, weekday };
};

const fmtDisplayDate = (d: string): string => {
  const parsed = new Date(`${d}T00:00:00`);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const fmtTime = (v?: string): string => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const statusBadge = (status: ReviewMeetingCheckIn['status']) => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800',
    in_progress: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800',
    no_response: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800',
  };
  const label: Record<string, string> = {
    completed: 'Completed',
    in_progress: 'InProgress',
    no_response: 'No Response',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs ${map[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
      {label[status] || status}
    </span>
  );
};

const verdictBadge = (verdict?: ReviewMeetingCheckIn['verdict']) => {
  if (!verdict) return null;
  const cls = verdict === 'SATISFACTORY' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800' : 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800';
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-2xs ${cls}`}>{verdict.replace('_', ' ')}</span>;
};

// Avatar color helper (unified matching color for all counsellors)
const getInitialColor = (_name?: string) => {
  return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800';
};

const ReviewMeetingView: React.FC = () => {
  const [dates, setDates] = useState<DateSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [checkIns, setCheckIns] = useState<ReviewMeetingCheckIn[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'no_response'>('all');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const loadDates = useCallback(async () => {
    setLoadingDates(true);
    try {
      const rows = await apiService.getReviewMeetingDates();
      setDates(rows);
      if (rows.length > 0) setSelectedDate((prev) => prev || rows[0].date);
    } catch (err: any) {
      setError(err.message || 'Failed to load review meeting dates');
    } finally {
      setLoadingDates(false);
    }
  }, []);

  const loadDay = useCallback(async (date: string) => {
    setLoadingDay(true);
    setError('');
    setExpandedCardIds({}); // always start minimized on newly loaded date
    try {
      const result = await apiService.getReviewMeetingsForDate(date);
      setCheckIns(result.checkIns);
    } catch (err: any) {
      setError(err.message || 'Failed to load review meeting');
      setCheckIns([]);
    } finally {
      setLoadingDay(false);
    }
  }, []);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  useEffect(() => {
    if (selectedDate) loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  const handleTriggerNow = useCallback(async () => {
    setTriggering(true);
    setTriggerMsg('');
    setError('');
    try {
      const result = await apiService.triggerReviewMeeting();
      setTriggerMsg(
        result.started > 0
          ? `Started ${result.started} check-in${result.started === 1 ? '' : 's'}` +
            (result.alreadyStarted > 0 ? ` (${result.alreadyStarted} already started today)` : '') +
            (result.failed > 0 ? ` — ${result.failed} failed` : '')
          : `Nothing to start — ${result.alreadyStarted} counsellor${result.alreadyStarted === 1 ? '' : 's'} already have today's check-in`
      );
      await loadDates();
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      await loadDay(selectedDate || todayIST);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger review meeting');
    } finally {
      setTriggering(false);
    }
  }, [loadDates, loadDay, selectedDate]);

  const selectedSummary = dates.find((d) => d.date === selectedDate);

  const filteredCheckIns = useMemo(() => {
    if (statusFilter === 'all') return checkIns;
    return checkIns.filter((c) => c.status === statusFilter);
  }, [checkIns, statusFilter]);

  const toggleMinimize = (id: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allMinimized = filteredCheckIns.length > 0 && filteredCheckIns.every((c) => !expandedCardIds[c._id]);

  const toggleAllMinimize = () => {
    if (allMinimized) {
      const next: Record<string, boolean> = {};
      filteredCheckIns.forEach((c) => {
        next[c._id] = true;
      });
      setExpandedCardIds(next);
    } else {
      setExpandedCardIds({});
    }
  };

  const scrollDates = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -240 : 240,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Top Header Section ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#9d174d] dark:text-pink-400 tracking-tight">Review Meeting</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Daily 5 PM manager check-in conversations with each counsellor, plus the AI-generated summary for each.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto w-full md:w-auto">
            {/* Date Input Box */}
            <div
              onClick={() => dateInputRef.current?.showPicker()}
              className="relative flex items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-pink-400 dark:hover:border-pink-600 transition-colors flex-1 md:flex-initial"
            >
              <div className="flex items-center gap-2">
                <Icons.Calendar className="w-4 h-4 text-[#be185d] dark:text-pink-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {selectedDate ? fmtDisplayDate(selectedDate) : 'Select date'}
                </span>
              </div>
              <Icons.ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>

            {/* Start Now Button (Matching Review Meeting sidebar color & crisp Send icon) */}
            <button
              type="button"
              onClick={handleTriggerNow}
              disabled={triggering}
              title="Start today's manager check-ins right now, instead of waiting for 5 PM"
              className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-[#be185d] hover:bg-[#9d174d] active:bg-[#831843] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow disabled:opacity-50 transition-all cursor-pointer"
            >
              {triggering ? (
                <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icons.Send className="w-3.5 h-3.5" />
              )}
              <span>Start Now</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {triggerMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-4 py-3 rounded-xl shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {triggerMsg}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold px-4 py-3 rounded-xl shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {error}
          </div>
        )}

        {/* ── Date Carousel Filter Bar ── */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => scrollDates('left')}
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center flex-shrink-0 z-10 mr-2 transition-colors cursor-pointer"
            title="Previous dates"
          >
            <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {loadingDates ? (
            <div className="py-3 text-xs text-slate-400 flex items-center gap-2 mx-auto">
              <Icons.RefreshCcw className="w-4 h-4 animate-spin text-blue-500" /> Loading review dates…
            </div>
          ) : dates.length === 0 ? (
            <div className="py-3 text-xs text-slate-400 mx-auto">No review meetings recorded yet.</div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex items-center gap-3 overflow-x-auto py-1.5 flex-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {dates.map((d) => {
                const isSelected = selectedDate === d.date;
                const { dayNum, monthYear, weekday } = fmtDateFormatted(d.date);

                return (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-left transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-lime-50 dark:bg-lime-950/40 text-lime-900 dark:text-lime-200 border-lime-800 dark:border-lime-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-lime-800 dark:text-lime-700 border-lime-200/80 dark:border-lime-800 hover:border-lime-700'
                    }`}
                  >
                    <p className="text-xs font-bold whitespace-nowrap">{dayNum} {monthYear}, {weekday}</p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-lime-900 dark:text-lime-300 font-semibold' : 'text-lime-800/80 dark:text-lime-700'}`}>
                      {d.total} Counsellor{d.total === 1 ? '' : 's'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => scrollDates('right')}
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center flex-shrink-0 z-10 ml-2 transition-colors cursor-pointer"
            title="Next dates"
          >
            <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

     {/* ── Summary Metric Cards (Compact CRM UI) ── */}
        {selectedSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              {
                key: 'all',
                label: 'Total',
                unit: 'Total Counsellors',
                value: selectedSummary.total,
                icon: (
                  <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                ),
                iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400',
                activeBorder: 'border-emerald-400 dark:border-emerald-500',
                hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
                activeBadge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
              },
              {
                key: 'completed',
                label: 'Completed',
                unit: 'Counsellors',
                value: selectedSummary.completed,
                icon: (
                  <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ),
                iconBg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900/40 text-purple-600 dark:text-purple-400',
                activeBorder: 'border-purple-400 dark:border-purple-500',
                hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-700',
                activeBadge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800',
              },
              {
                key: 'in_progress',
                label: 'InProgress',
                unit: 'Counsellors',
                value: selectedSummary.inProgress,
                icon: (
                  <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400',
                activeBorder: 'border-amber-400 dark:border-amber-500',
                hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
                activeBadge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
              },
              {
                key: 'no_response',
                label: 'No Response',
                unit: 'Counsellors',
                value: selectedSummary.noResponse,
                icon: (
                  <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
                iconBg: 'bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900/40 text-sky-600 dark:text-sky-400',
                activeBorder: 'border-sky-400 dark:border-sky-500',
                hoverBorder: 'hover:border-sky-300 dark:hover:border-sky-700',
                activeBadge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800',
              },
            ].map((c) => {
              const isSelected = statusFilter === c.key;
              return (
                <div
                  key={c.key}
                  onClick={() => setStatusFilter(isSelected && c.key !== 'all' ? 'all' : (c.key as any))}
                  className={`bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isSelected
                      ? `${c.activeBorder} shadow-xs`
                      : `border-slate-200/80 dark:border-slate-800 ${c.hoverBorder}`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg sm:rounded-xl flex items-center justify-center shadow-2xs ${c.iconBg}`}>
                      {c.icon}
                    </div>
                    {isSelected && (
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full border ${c.activeBadge}`}>
                        Active
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{c.value}</span>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500">{c.unit}</span>
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{c.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Counsellors List Container ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-[#be185d] dark:text-pink-400 border border-pink-100 dark:border-pink-900/40">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 20c0-1.657-2.239-3-5-3s-5 1.343-5 3m14-3c0-1.23-1.234-2.287-3-2.75M3 17c0-1.23 1.234-2.287 3-2.75m12-4.014a3 3 0 1 0-4-4.472m-8 4.472a3 3 0 0 1 4-4.472M12 14a3 3 0 1 1 0-6a3 3 0 0 1 0 6" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  Counsellors Training Session
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {filteredCheckIns.length} counsellor{filteredCheckIns.length === 1 ? '' : 's'} recorded
                  {statusFilter !== 'all' && ` (${statusFilter.replace('_', ' ')})`}
                </p>
              </div>
            </div>

            {filteredCheckIns.length > 0 && (
              <button
                type="button"
                onClick={toggleAllMinimize}
                className="text-xs font-bold text-slate-500 hover:text-[#9d174d] dark:text-slate-400 dark:hover:text-pink-300 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-pink-300 dark:hover:border-pink-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title={allMinimized ? "Expand all counsellor tabs" : "Minimize all counsellor tabs"}
              >
                {allMinimized ? (
                  <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                )}
                <span>{allMinimized ? 'Expand All' : 'Minimize All'}</span>
              </button>
            )}
          </div>

          {loadingDay ? (
            <div className="py-16 text-center text-slate-400">
              <Icons.RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#be185d]" />
              <p className="text-xs font-semibold">Loading counsellors data...</p>
            </div>
          ) : filteredCheckIns.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Icons.Chat className="w-10 h-10 mx-auto mb-3 opacity-20 text-slate-500" />
              <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                {checkIns.length === 0 ? 'No review meeting for this date' : `No ${statusFilter.replace('_', ' ')} counsellors for this date`}
              </p>
              <p className="text-[10px] opacity-70 mt-0.5">Check-ins run Monday–Saturday from 5 PM IST.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCheckIns.map((c) => {
                const expanded = expandedId === c._id;
                const isMinimized = !expandedCardIds[c._id];
                const initial = c.counsellorUsername ? c.counsellorUsername.charAt(0).toUpperCase() : '?';
                const avatarBg = getInitialColor(c.counsellorUsername || '');

                return (
                  <div
                    key={c._id}
                    className={`rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all ${
                      isMinimized ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5 space-y-3'
                    }`}
                  >
                    {/* Top row: Avatar, Info, Badges, View transcript action & Minimize button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Avatar & Counsellor Name */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center flex-shrink-0 shadow-2xs border ${avatarBg}`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight truncate">
                              {c.counsellorUsername}
                            </h3>
                            {c.counsellorNumber && (
                              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                {c.counsellorNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                            Daily Review Meeting Check-in
                          </p>
                        </div>
                      </div>

                      {/* Right: Badges, View transcript Button & Minimize Button */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {statusBadge(c.status)}
                          {verdictBadge(c.verdict)}
                          {c.escalatedToAdmin && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shadow-2xs flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Escalated
                            </span>
                          )}
                        </div>

                        {!isMinimized && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : c._id)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex-shrink-0 ${
                              expanded
                                ? 'bg-[#be185d] text-white shadow-xs'
                                : 'bg-pink-50 dark:bg-pink-950/60 text-[#be185d] dark:text-pink-400 border border-pink-200/80 dark:border-pink-900/60 hover:bg-[#be185d] hover:text-white dark:hover:bg-[#be185d] dark:hover:text-white'
                            }`}
                          >
                            <Icons.FileText className="w-3.5 h-3.5" />
                            <span>{expanded ? 'Hide transcript' : 'View transcript'}</span>
                            <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {/* Minimize / Expand Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleMinimize(c._id)}
                          className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 hover:bg-pink-50/60 dark:hover:bg-pink-950/40 text-slate-500 dark:text-slate-400 hover:text-[#be185d] dark:hover:text-pink-300 flex items-center justify-center transition-all shadow-2xs cursor-pointer flex-shrink-0 border border-slate-200/80 dark:border-slate-800 hover:border-pink-300 dark:hover:border-pink-800"
                          title={isMinimized ? 'Expand tab' : 'Minimize tab'}
                          aria-label={isMinimized ? 'Expand tab' : 'Minimize tab'}
                        >
                          {isMinimized ? (
                            <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Content (shown when NOT minimized) */}
                    {!isMinimized && (
                      <>
                        {/* Summary Report Box */}
                        {c.adminSummaryReport ? (
                          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 text-xs leading-relaxed space-y-1 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              <Icons.Bot className="w-3.5 h-3.5 text-blue-500" />
                              <span>Summary Report</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">
                              {c.adminSummaryReport}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white/50 dark:bg-slate-900/40 border border-dashed border-slate-200/70 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 italic">
                            Summary not generated yet.
                          </div>
                        )}

                        {/* Verdict Reason */}
                        {c.verdictReason && (
                          <div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 rounded-xl px-3 py-2">
                            <span className="font-bold flex-shrink-0">Reason:</span>
                            <span className="font-medium">{c.verdictReason}</span>
                          </div>
                        )}

                        {/* Bottom Metadata Badges */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] shadow-2xs">
                              <Icons.Chat className="w-3.5 h-3.5 text-blue-500" />
                              {c.messages?.length || 0} Messages
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] shadow-2xs">
                              <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              {c.questionCount || 0} Questions
                            </span>
                            {c.startedAt && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] shadow-2xs">
                                <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 6v6l4 2" />
                                </svg>
                                Started {fmtTime(c.startedAt)}
                              </span>
                            )}
                            {c.completedAt && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] shadow-2xs">
                                <Icons.Check className="w-3.5 h-3.5 text-emerald-600" />
                                Completed {fmtTime(c.completedAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Expandable Transcript Box ── */}
                        {expanded && (
                          <div className="mt-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 space-y-3 max-h-96 overflow-y-auto shadow-xs">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Icons.Chat className="w-4 h-4 text-blue-500" />
                                Conversation Transcript
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {c.messages?.length || 0} messages
                              </span>
                            </div>
                            {(c.messages || []).length === 0 ? (
                              <p className="text-xs text-slate-400 italic py-2">No messages recorded for this check-in.</p>
                            ) : (
                              c.messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'manager' ? 'justify-start' : 'justify-end'}`}>
                                  <div
                                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-2xs ${
                                      m.role === 'manager'
                                        ? 'bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                                        : 'bg-blue-600 text-white rounded-br-sm'
                                    }`}
                                  >
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70">
                                      {m.role === 'manager' ? 'Manager (AI)' : c.counsellorUsername}
                                    </div>
                                    <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                                    {m.timestamp && (
                                      <p
                                        className={`text-[10px] mt-1 text-right ${
                                          m.role === 'manager' ? 'text-slate-400' : 'text-blue-100'
                                        }`}
                                      >
                                        {fmtTime(m.timestamp)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReviewMeetingView;