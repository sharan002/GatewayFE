import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { User } from '../types';
import { downloadWeeklyReportPdf, downloadMonthlyReportPdf } from '../utils/aiReportPdf';

export interface WeeklyReportMetrics {
  newLeads: number;
  enrolledThisWeek: number;
  noContactCount: number;
  notContactedPct: number;
  avgResponseMins: number | null;
  avgOffHoursResponseMins: number | null;
  offHoursLeadsCount: number;
  offHoursContactedCount: number;
  slowResponses: number;
  slowBuckets: Record<string, number>;
  thisWeekFees: { totalBilled: number; totalPaid: number };
  prevWeekFees: { totalBilled: number; totalPaid: number };
  billedPct: number | null;
  paidPct: number | null;
  upcomingPayments: { totalAmount: number; count: number };
}

export interface MonthlyReportMetrics {
  newLeads: number;
  enrolledThisMonth: number;
  noContactCount: number;
  notContactedPct: number;
  avgResponseMins: number | null;
  avgOffHoursResponseMins: number | null;
  offHoursLeadsCount: number;
  offHoursContactedCount: number;
  slowResponses: number;
  slowBuckets: Record<string, number>;
  thisMonthFees: { totalBilled: number; totalPaid: number };
  prevMonthFees: { totalBilled: number; totalPaid: number };
  billedPct: number | null;
  paidPct: number | null;
}

export interface HotLead {
  userName: string;
  course: string;
  status: string;
  lastRemark: string;
}

export interface RespondedLead {
  userName: string;
  course: string;
  status: string;
}

export interface UpcomingInstallment {
  userName: string;
  course: string;
  amount: number;
  dueDate: string;
}

export interface WeeklyReport {
  _id: string;
  counsellor: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  metrics: WeeklyReportMetrics;
  aiSummary: string;
  likelyToConfirm: string;
  hotNotEnrolled: HotLead[];
  respondedAfterFollowUp: RespondedLead[];
  upcomingInstallments: UpcomingInstallment[];
}

export interface MonthlyReport {
  _id: string;
  counsellor: string;
  monthStart: string;
  monthEnd: string;
  generatedAt: string;
  metrics: MonthlyReportMetrics;
  aiSummary: string;
  likelyToConfirm: string;
  hotNotEnrolled: HotLead[];
  respondedAfterFollowUp: RespondedLead[];
}

interface MinminiSummary {
  weekStart?: string;
  weekEnd?: string;
  monthStart?: string;
  monthEnd?: string;
  activeLeads: number;
  enrolledAfterWA: number;
  totalMessages: number;
  avgMessagesPerLead: number;
  avgDurationMins: number;
  peakHour: number | null;
  peakHours: Record<string, number>;
  topCourses: { course: string; count: number }[];
  followUpsSent: number;
  followUpResponded: number;
  followUpResponsePct: number;
  aiSummary: string;
}

interface Props {
  currentUser: User | null;
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Safe SVG Icons to prevent undefined component crashes
const SvgIcons = {
  Bot: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
  ),
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  WhatsApp: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  ),
  Download: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="6 9 12 15 18 9"/></svg>
  ),
  RefreshCcw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
  ),
  UserPlus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12"/></svg>
  ),
  X: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  Clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Bell: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  ),
  IndianRupee: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3" />
      <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
  ),
  User: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Crown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>
  ),
  Phone: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  ),
  Chat: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ),
};

function TrendBadge({ pct, prev, vsLabel = 'vs last week' }: { pct: number | null; prev: number; vsLabel?: string }) {
  if (pct === null && prev === 0) return <span className="text-xs text-slate-400 dark:text-slate-500">No data</span>;
  if (pct === null) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-bold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% {vsLabel}
    </span>
  );
}

function MinminiSummarySection({
  minmini,
  loading,
  error,
  onLoad,
  reports,
}: {
  minmini: MinminiSummary | null;
  loading: boolean;
  error: string | null;
  onLoad: (weekStart?: string, weekEnd?: string, refresh?: boolean) => void;
  reports: WeeklyReport[];
}) {
  const latestReport = reports[0] ?? null;

  const handleGenerate = () => {
    if (latestReport) {
      onLoad(latestReport.weekStart, latestReport.weekEnd, true);
    } else {
      onLoad(undefined, undefined, true);
    }
  };

  const weekLabel = latestReport
    ? `${fmt(latestReport.weekStart)} – ${fmt(latestReport.weekEnd)}`
    : 'Last 7 days';

  const maxCourseCount = minmini?.topCourses?.[0]?.count ?? 1;

  const topPeakHours = minmini
    ? Object.entries(minmini.peakHours)
        .map(([h, c]) => ({ hour: Number(h), count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : [];
  const maxPeakCount = topPeakHours[0]?.count ?? 1;

  const formatHour = (h: number) => {
    const suffix = h < 12 ? 'AM' : 'PM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}${suffix}`;
  };

  const conversionPct = minmini && minmini.activeLeads > 0
    ? Math.round((minmini.enrolledAfterWA / minmini.activeLeads) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/60 rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-4 bg-green-50 dark:bg-green-950/40 border-b border-green-100 dark:border-green-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800 flex-shrink-0">
            <SvgIcons.WhatsApp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-green-900 dark:text-green-300">Minmini Summary</h3>
            <p className="text-[11px] text-green-700 dark:text-green-400 opacity-70">WhatsApp AI Engagement · New Leads This Week · {weekLabel}</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading
            ? <SvgIcons.RefreshCcw className="w-3.5 h-3.5 animate-spin" />
            : <SvgIcons.Bot className="w-3.5 h-3.5" />}
          {loading ? 'Analysing…' : minmini ? 'Refresh' : 'Generate'}
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!minmini && !loading && !error && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            <SvgIcons.Chat className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Click Generate to analyse this week's WhatsApp activity</p>
            <p className="text-xs mt-1 opacity-70">Analyses new leads, conversations, peak hours, course enquiries & follow-up suggestions</p>
          </div>
        )}

        {loading && !minmini && (
          <div className="space-y-3 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        )}

        {error && !loading && (
          <p className="text-center text-sm text-red-500 py-6">{error}</p>
        )}

        {minmini && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { label: 'New WA Leads', value: minmini.activeLeads, color: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/50' },
                { label: 'Enrolled After WA', value: minmini.enrolledAfterWA, sub: `${conversionPct}% conv.`, color: minmini.enrolledAfterWA > 0 ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/50' : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
                { label: 'Total Exchanges', value: minmini.totalMessages, color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50' },
                { label: 'Avg per Lead', value: minmini.avgMessagesPerLead, color: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/50' },
                { label: 'Avg Duration', value: minmini.avgDurationMins > 0 ? `${minmini.avgDurationMins}m` : '< 1m', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
                { label: 'Peak Hour', value: minmini.peakHour !== null ? formatHour(minmini.peakHour) : 'N/A', sub: 'excl. 8 AM', color: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50' },
              ].map(({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) => (
                <div key={label} className={`rounded-xl border p-3 ${color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1 leading-none">{label}</p>
                  <p className="text-[14px] font-bold leading-tight">{value}</p>
                  {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <SvgIcons.Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Follow-up Performance This Week</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-950 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-1">Sent</p>
                  <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">{minmini.followUpsSent}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">leads</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-950 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-500 dark:text-teal-400 mb-1">Responded</p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{minmini.followUpResponded}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">leads</p>
                </div>
                <div className={`bg-white dark:bg-slate-900 rounded-lg border p-3 text-center ${
                  minmini.followUpResponsePct >= 30
                    ? 'border-green-200 dark:border-green-900'
                    : minmini.followUpResponsePct >= 10
                    ? 'border-amber-200 dark:border-amber-900'
                    : 'border-red-200 dark:border-red-900'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Response Rate</p>
                  <p className={`text-2xl font-bold ${
                    minmini.followUpResponsePct >= 30
                      ? 'text-green-700 dark:text-green-400'
                      : minmini.followUpResponsePct >= 10
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    {minmini.followUpsSent > 0 ? `${minmini.followUpResponsePct}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {minmini.followUpsSent === 0 ? 'no follow-ups' : minmini.followUpResponsePct >= 30 ? 'good' : minmini.followUpResponsePct >= 10 ? 'moderate' : 'low'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-100 dark:border-green-900/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-3">Course Enquiries This Week</p>
                {minmini.topCourses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No course data</p>
                ) : (
                  <div className="space-y-2">
                    {minmini.topCourses.map(({ course, count }, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[70%]">{course}</span>
                          <span className="text-[11px] font-bold text-green-700 dark:text-green-400">{count}</span>
                        </div>
                        <div className="h-1.5 bg-green-100 dark:bg-green-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.round((count / maxCourseCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Peak Activity Hours</p>
                  <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">8 AM excluded</span>
                </div>
                {topPeakHours.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hourly data</p>
                ) : (
                  <div className="space-y-2">
                    {topPeakHours.map(({ hour, count }) => (
                      <div key={hour}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                            {formatHour(hour)} – {formatHour(hour + 1)}
                          </span>
                          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{count} msgs</span>
                        </div>
                        <div className="h-1.5 bg-blue-100 dark:bg-blue-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.round((count / maxPeakCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {minmini.aiSummary && minmini.aiSummary !== 'AI analysis unavailable.' && (
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <SvgIcons.Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <p className="text-sm font-bold text-purple-800 dark:text-purple-300">WhatsApp Engagement Analysis</p>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{minmini.aiSummary}</p>
              </div>
            )}

            {minmini.activeLeads === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No new leads with WhatsApp conversations found for this week.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MonthlyMinminiSection({
  minmini,
  loading,
  error,
  onLoad,
  latestMonthStart,
  latestMonthEnd,
}: {
  minmini: MinminiSummary | null;
  loading: boolean;
  error: string | null;
  onLoad: (monthStart?: string, monthEnd?: string, refresh?: boolean) => void;
  latestMonthStart?: string;
  latestMonthEnd?: string;
}) {
  const handleGenerate = () => {
    onLoad(latestMonthStart, latestMonthEnd, true);
  };

  const monthLabel = latestMonthStart && latestMonthEnd
    ? `${fmt(latestMonthStart)} – ${fmt(latestMonthEnd)}`
    : 'Last Month';

  const maxCourseCount = minmini?.topCourses?.[0]?.count ?? 1;

  const topPeakHours = minmini
    ? Object.entries(minmini.peakHours)
        .map(([h, c]) => ({ hour: Number(h), count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : [];
  const maxPeakCount = topPeakHours[0]?.count ?? 1;

  const formatHour = (h: number) => {
    const suffix = h < 12 ? 'AM' : 'PM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}${suffix}`;
  };

  const conversionPct = minmini && minmini.activeLeads > 0
    ? Math.round((minmini.enrolledAfterWA / minmini.activeLeads) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/60 rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-4 bg-green-50 dark:bg-green-950/40 border-b border-green-100 dark:border-green-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800 flex-shrink-0">
            <SvgIcons.WhatsApp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-green-900 dark:text-green-300">Monthly Minmini Summary</h3>
            <p className="text-[11px] text-green-700 dark:text-green-400 opacity-70">WhatsApp AI Engagement · New Leads This Month · {monthLabel}</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading
            ? <SvgIcons.RefreshCcw className="w-3.5 h-3.5 animate-spin" />
            : <SvgIcons.Bot className="w-3.5 h-3.5" />}
          {loading ? 'Analysing…' : minmini ? 'Refresh' : 'Generate'}
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!minmini && !loading && !error && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            <SvgIcons.Chat className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Click Generate to analyse this month's WhatsApp activity</p>
            <p className="text-xs mt-1 opacity-70">Analyses new leads, conversations, peak hours, course enquiries & follow-up suggestions</p>
          </div>
        )}

        {loading && !minmini && (
          <div className="space-y-3 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        )}

        {error && !loading && (
          <p className="text-center text-sm text-red-500 py-6">{error}</p>
        )}

        {minmini && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { label: 'New WA Leads', value: minmini.activeLeads, color: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/50' },
                { label: 'Enrolled After WA', value: minmini.enrolledAfterWA, sub: `${conversionPct}% conv.`, color: minmini.enrolledAfterWA > 0 ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/50' : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
                { label: 'Total Exchanges', value: minmini.totalMessages, color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50' },
                { label: 'Avg per Lead', value: minmini.avgMessagesPerLead, color: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/50' },
                { label: 'Avg Duration', value: minmini.avgDurationMins > 0 ? `${minmini.avgDurationMins}m` : '< 1m', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
                { label: 'Peak Hour', value: minmini.peakHour !== null ? formatHour(minmini.peakHour) : 'N/A', sub: 'excl. 8 AM', color: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50' },
              ].map(({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) => (
                <div key={label} className={`rounded-xl border p-3 ${color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1 leading-none">{label}</p>
                  <p className="text-base font-bold leading-tight">{value}</p>
                  {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <SvgIcons.Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Follow-up Performance This Month</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-950 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-1">Sent</p>
                  <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">{minmini.followUpsSent}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">leads</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-950 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-500 dark:text-teal-400 mb-1">Responded</p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{minmini.followUpResponded}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">leads</p>
                </div>
                <div className={`bg-white dark:bg-slate-900 rounded-lg border p-3 text-center ${
                  minmini.followUpResponsePct >= 30
                    ? 'border-green-200 dark:border-green-900'
                    : minmini.followUpResponsePct >= 10
                    ? 'border-amber-200 dark:border-amber-900'
                    : 'border-red-200 dark:border-red-900'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Response Rate</p>
                  <p className={`text-2xl font-bold ${
                    minmini.followUpResponsePct >= 30
                      ? 'text-green-700 dark:text-green-400'
                      : minmini.followUpResponsePct >= 10
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    {minmini.followUpsSent > 0 ? `${minmini.followUpResponsePct}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {minmini.followUpsSent === 0 ? 'no follow-ups' : minmini.followUpResponsePct >= 30 ? 'good' : minmini.followUpResponsePct >= 10 ? 'moderate' : 'low'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-100 dark:border-green-900/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-3">Course Enquiries This Month</p>
                {minmini.topCourses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No course data</p>
                ) : (
                  <div className="space-y-2">
                    {minmini.topCourses.map(({ course, count }, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[70%]">{course}</span>
                          <span className="text-[11px] font-bold text-green-700 dark:text-green-400">{count}</span>
                        </div>
                        <div className="h-1.5 bg-green-100 dark:bg-green-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.round((count / maxCourseCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Peak Activity Hours</p>
                  <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">8 AM excluded</span>
                </div>
                {topPeakHours.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hourly data</p>
                ) : (
                  <div className="space-y-2">
                    {topPeakHours.map(({ hour, count }) => (
                      <div key={hour}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                            {formatHour(hour)} – {formatHour(hour + 1)}
                          </span>
                          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{count} msgs</span>
                        </div>
                        <div className="h-1.5 bg-blue-100 dark:bg-blue-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.round((count / maxPeakCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {minmini.aiSummary && minmini.aiSummary !== 'AI analysis unavailable.' && (
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <SvgIcons.Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <p className="text-sm font-bold text-purple-800 dark:text-purple-300">WhatsApp Engagement Analysis</p>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{minmini.aiSummary}</p>
              </div>
            )}

            {minmini.activeLeads === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No new leads with WhatsApp conversations found for this month.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const MINMINI_CACHE_KEY = 'crm_minmini_summary';
const MONTHLY_MINMINI_CACHE_KEY = 'crm_monthly_minmini_summary';
const WEEKLY_REPORTS_PAGE_SIZE = 5;

export default function WeeklyAIReportView({ currentUser }: Props) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  // ── Weekly state ──────────────────────────────────────────────────────────
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCounsellor, setSelectedCounsellor] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [minmini, setMinmini] = useState<MinminiSummary | null>(null);
  const [minminiLoading, setMinminiLoading] = useState(true);
  const [minminiError, setMinminiError] = useState<string | null>(null);
  const [weeklyView, setWeeklyView] = useState<'reports' | 'summary'>('reports');
  const [showAllWeekly, setShowAllWeekly] = useState(false);
  const [weeklyPage, setWeeklyPage] = useState(1);

  // ── Monthly state ─────────────────────────────────────────────────────────
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [monthlySelectedCounsellor, setMonthlySelectedCounsellor] = useState<string>('all');
  const [monthlyExpandedId, setMonthlyExpandedId] = useState<string | null>(null);
  const [monthlyMinmini, setMonthlyMinmini] = useState<MinminiSummary | null>(null);
  const [monthlyMinminiLoading, setMonthlyMinminiLoading] = useState(false);
  const [monthlyMinminiError, setMonthlyMinminiError] = useState<string | null>(null);
  const [monthlyDataLoaded, setMonthlyDataLoaded] = useState(false);
  const [monthlyView, setMonthlyView] = useState<'reports' | 'summary'>('reports');
  const [showAllMonthly, setShowAllMonthly] = useState(false);
  const [monthlyPage, setMonthlyPage] = useState(1);

  const isAdmin = currentUser?.role === 'admin';

  // Load weekly reports on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiService.fetchWeeklyAIReports();
        setReports(res.reports || []);
        if (res.reports?.length) setExpandedId(res.reports[0]._id);
      } catch {
        setError('Failed to load weekly AI reports. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadMinmini = async (weekStart?: string, weekEnd?: string, refresh?: boolean) => {
    try {
      setMinminiLoading(true);
      setMinminiError(null);
      const res = await apiService.fetchMinminiSummary(weekStart, weekEnd, refresh);
      setMinmini(res);
      try { localStorage.setItem(MINMINI_CACHE_KEY, JSON.stringify(res)); } catch {}
    } catch {
      setMinminiError('Failed to load WhatsApp summary.');
    } finally {
      setMinminiLoading(false);
    }
  };

  // Auto-load weekly Minmini on mount (cache then background refresh)
  useEffect(() => {
    const cached = localStorage.getItem(MINMINI_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.followUpsSent != null) setMinmini(parsed);
      } catch {}
    }
    loadMinmini();
  }, []);

  // Load monthly data lazily when Monthly tab is first opened
  const loadMonthlyData = async () => {
    if (monthlyDataLoaded) return;
    setMonthlyDataLoaded(true);

    try {
      setMonthlyLoading(true);
      const res = await apiService.fetchMonthlyAIReports();
      setMonthlyReports(res.reports || []);
      if (res.reports?.length) setMonthlyExpandedId(res.reports[0]._id);
    } catch {
      setMonthlyError('Failed to load monthly AI reports. Please try again.');
    } finally {
      setMonthlyLoading(false);
    }

    const cached = localStorage.getItem(MONTHLY_MINMINI_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.followUpsSent != null) setMonthlyMinmini(parsed);
      } catch {}
    }
    loadMonthlyMinmini();
  };

  const loadMonthlyMinmini = async (monthStart?: string, monthEnd?: string, refresh?: boolean) => {
    try {
      setMonthlyMinminiLoading(true);
      setMonthlyMinminiError(null);
      const res = await apiService.fetchMonthlyMinminiSummary(monthStart, monthEnd, refresh);
      setMonthlyMinmini(res);
      try { localStorage.setItem(MONTHLY_MINMINI_CACHE_KEY, JSON.stringify(res)); } catch {}
    } catch {
      setMonthlyMinminiError('Failed to load monthly WhatsApp summary.');
    } finally {
      setMonthlyMinminiLoading(false);
    }
  };

  const handleTabChange = (tab: 'weekly' | 'monthly') => {
    setActiveTab(tab);
    if (tab === 'monthly') loadMonthlyData();
  };

  // Reset weekly pagination whenever the counsellor filter changes
  useEffect(() => {
    setShowAllWeekly(false);
    setWeeklyPage(1);
  }, [selectedCounsellor]);

  // Reset monthly pagination whenever the counsellor filter changes
  useEffect(() => {
    setShowAllMonthly(false);
    setMonthlyPage(1);
  }, [monthlySelectedCounsellor]);

  // ── Weekly derived values ─────────────────────────────────────────────────
  const counsellors = isAdmin
    ? ['all', ...Array.from(new Set(reports.map(r => r.counsellor))).sort()]
    : [];

  const visible = isAdmin && selectedCounsellor !== 'all'
    ? reports.filter(r => r.counsellor === selectedCounsellor)
    : reports;

  const latestWeekStart = visible[0]?.weekStart ?? null;
  const latestWeekReports = latestWeekStart ? visible.filter(r => r.weekStart === latestWeekStart) : [];
  const olderWeeklyReports = latestWeekStart ? visible.filter(r => r.weekStart !== latestWeekStart) : [];
  const weeklyTotalPages = Math.max(1, Math.ceil(olderWeeklyReports.length / WEEKLY_REPORTS_PAGE_SIZE));
  const pagedOlderWeeklyReports = olderWeeklyReports.slice(
    (weeklyPage - 1) * WEEKLY_REPORTS_PAGE_SIZE,
    weeklyPage * WEEKLY_REPORTS_PAGE_SIZE
  );
  const displayedWeeklyReports = showAllWeekly
    ? [...latestWeekReports, ...pagedOlderWeeklyReports]
    : latestWeekReports;

  // ── Monthly derived values ────────────────────────────────────────────────
  const monthlyCounsellors = isAdmin
    ? ['all', ...Array.from(new Set(monthlyReports.map(r => r.counsellor))).sort()]
    : [];

  const monthlyVisible = isAdmin && monthlySelectedCounsellor !== 'all'
    ? monthlyReports.filter(r => r.counsellor === monthlySelectedCounsellor)
    : monthlyReports;

  const latestMonthStartKey = monthlyVisible[0]?.monthStart ?? null;
  const latestMonthReports = latestMonthStartKey ? monthlyVisible.filter(r => r.monthStart === latestMonthStartKey) : [];
  const olderMonthlyReports = latestMonthStartKey ? monthlyVisible.filter(r => r.monthStart !== latestMonthStartKey) : [];
  const monthlyTotalPages = Math.max(1, Math.ceil(olderMonthlyReports.length / WEEKLY_REPORTS_PAGE_SIZE));
  const pagedOlderMonthlyReports = olderMonthlyReports.slice(
    (monthlyPage - 1) * WEEKLY_REPORTS_PAGE_SIZE,
    monthlyPage * WEEKLY_REPORTS_PAGE_SIZE
  );
  const displayedMonthlyReports = showAllMonthly
    ? [...latestMonthReports, ...pagedOlderMonthlyReports]
    : latestMonthReports;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
        <SvgIcons.RefreshCcw className="w-7 h-7 animate-spin" />
        <p className="text-sm">Loading AI reports…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-500">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 transition-colors">

      {/* Top Header & Toggle Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-xl bg-blue-500 text-white flex-shrink-0">
              <SvgIcons.Bot className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">AI Reports</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">AI-generated counsellor performance analysis</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Weekly / Monthly pill toggle */}
          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              onClick={() => handleTabChange('weekly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'weekly'
                  ? 'bg-violet-100 text-violet-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => handleTabChange('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'monthly'
                  ? 'bg-violet-100 text-violet-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {/* ── WEEKLY TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'weekly' && (
        <>
          {/* Generation Info Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <SvgIcons.Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Generated every Monday at 9.00 Am</span>
            </div>

            <button
              onClick={() => setWeeklyView(weeklyView === 'summary' ? 'reports' : 'summary')}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <SvgIcons.WhatsApp className="w-4 h-4" />
              Whatsapp Summary
            </button>
          </div>

          {/* Counsellor Filter Pills */}
          {isAdmin && counsellors.length > 1 && weeklyView === 'reports' && (
            <div className="flex flex-wrap items-center gap-2">
              {counsellors.map(c => (
                <button
                  key={c}
                  onClick={() => { setSelectedCounsellor(c); setWeeklyView('reports'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                    selectedCounsellor === c
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {c === 'all' ? 'All Counsellors' : c}
                </button>
              ))}
            </div>
          )}

          {weeklyView === 'summary' && (
            <MinminiSummarySection
              minmini={minmini}
              loading={minminiLoading}
              error={minminiError}
              onLoad={loadMinmini}
              reports={reports}
            />
          )}

          {weeklyView === 'reports' && visible.length === 0 && (
            <div className="text-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <SvgIcons.Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-base font-semibold text-slate-500 dark:text-slate-400">No weekly reports yet</p>
              <p className="text-xs mt-1">Reports are generated every Monday at 9 AM</p>
            </div>
          )}

          {weeklyView === 'reports' && displayedWeeklyReports.map(report => {
            const isOpen = expandedId === report._id;
            const m = report.metrics ?? {} as WeeklyReportMetrics;
            const thisWeekFees = m.thisWeekFees ?? { totalBilled: 0, totalPaid: 0 };
            const prevWeekFees = m.prevWeekFees ?? { totalBilled: 0, totalPaid: 0 };
            const upcomingPayments = m.upcomingPayments ?? { totalAmount: 0, count: 0 };
            const slowBuckets = m.slowBuckets ?? {};
            const hotLeads = report.hotNotEnrolled ?? [];
            const responded = report.respondedAfterFollowUp ?? [];
            const upcomingInstallments = report.upcomingInstallments ?? [];
            const likelyLines = (report.likelyToConfirm || '')
              .split('\n')
              .map(l => l.trim())
              .filter(l => l && l !== 'No active leads to analyse.' && l !== 'No strong conversion signals found.');

            return (
              <div key={report._id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-4">
                {/* Counselor Bar Header */}
                <div
                  className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800"
                  onClick={() => setExpandedId(isOpen ? null : report._id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm uppercase">
                      {report.counsellor.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{report.counsellor}</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{fmt(report.weekStart)} – {fmt(report.weekEnd)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 font-extrabold text-xs px-3 py-1 rounded-full">
                        {m.newLeads ?? 0} Leads
                      </span>
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs px-3 py-1 rounded-full">
                        {m.enrolledThisWeek ?? 0} Enrollment
                      </span>
                      <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold text-xs px-3 py-1 rounded-full">
                        {Math.max(0, 100 - (m.notContactedPct ?? 0))}% Billed
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); downloadWeeklyReportPdf(report); }}
                      title="Download PDF"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs"
                    >
                      <SvgIcons.Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <SvgIcons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>

{/* Summary Stat Cards Grid - shown when the report is expanded */}
                 {isOpen && (
  <div className="p-5 pt-0">
    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Summary</div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      
      {/* Card 1: New Leads */}
      <div className="bg-rose-50/30 dark:bg-rose-950/40 border border-rose-100/60 dark:border-rose-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
        <div className="w-7 h-7 rounded-xl bg-rose-400 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.UserPlus className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.newLeads ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Leads</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">New Leads</p>
        </div>
      </div>

      {/* Card 2: Enrolled */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Check className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.enrolledThisWeek ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Remarks</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Enrolled</p>
        </div>
      </div>

      {/* Card 3: Not Collected */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-slate-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.X className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.noContactCount ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">{m.notContactedPct ?? 0}% of leads</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Not Collected</p>
        </div>
      </div>

      {/* Card 4: Avg Response */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.avgResponseMins ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Minutes</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Avg Response <span className="text-[10px] text-slate-400 font-normal">&lt;60m</span></p>
        </div>
      </div>

      {/* Card 5: Slow Time */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Bell className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.slowResponses ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Slow Time</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Slow &gt;1 hr</p>
        </div>
      </div>

      {/* Card 6: Billed */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.IndianRupee className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{currency(thisWeekFees.totalBilled)}</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Billed</p>
        </div>
      </div>

      {/* Card 7: Off Hours Effort */}
      <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.avgOffHoursResponseMins ?? 0}</span>
            <span className="text-[11px] font-bold text-slate-400">Minutes</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Off Hours Effort</p>
        </div>
      </div>

    </div>
  </div>
)}

                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    {/* Weekly Fees Report & Upcoming Installments */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Weekly Fees Report Card */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Weekly Fees Report</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="border border-emerald-500/40 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Billed</p>
                            <p className="text-base font-bold text-slate-800 dark:text-slate-100">{currency(thisWeekFees.totalBilled)}</p>
                            <div className="mt-2 text-[10px]">
                              <TrendBadge pct={m.billedPct ?? null} prev={prevWeekFees.totalBilled} />
                              <p className="text-slate-400 mt-0.5">({currency(prevWeekFees.totalBilled)} per week)</p>
                            </div>
                          </div>
                          <div className="border border-emerald-500/40 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Collected</p>
                            <p className="text-base font-bold text-slate-800 dark:text-slate-100">{currency(thisWeekFees.totalPaid)}</p>
                            <div className="mt-2 text-[10px]">
                              <TrendBadge pct={m.paidPct ?? null} prev={prevWeekFees.totalPaid} />
                              <p className="text-slate-400 mt-0.5">({currency(prevWeekFees.totalPaid)} per week)</p>
                            </div>
                          </div>
                          <div className="border border-emerald-500/40 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Upcoming</p>
                            <p className="text-base font-bold text-slate-800 dark:text-slate-100">{currency(upcomingPayments.totalAmount)}</p>
                            <p className="text-[10px] text-slate-400 mt-2">{upcomingPayments.count} Installment Due</p>
                          </div>
                        </div>
                      </div>

                      {/* Upcoming Installments - Next Week */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">
                          Upcoming Installments – Next Week ({upcomingInstallments.length})
                        </p>
                        {upcomingInstallments.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-4 text-center">No upcoming installments next week.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {upcomingInstallments.map((inst, idx) => (
                              <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex flex-col justify-between text-[11px]">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-bold truncate">
                                    <SvgIcons.User className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{inst.userName}</span>
                                  </div>
                                  <p className="text-slate-400 text-[10px] truncate">{inst.course || 'N/A'}</p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-300 dark:border-slate-800 flex items-center justify-between">
                                  <span className="font-extrabold text-blue-600 dark:text-blue-400">{currency(inst.amount)}</span>
                                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <SvgIcons.Calendar className="w-3 h-3" />
                                    {new Date(inst.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {report.aiSummary && report.aiSummary !== 'AI analysis unavailable.' && (
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <SvgIcons.Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">AI Performance Summary</p>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{report.aiSummary}</p>
                      </div>
                    )}

                    {likelyLines.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <SvgIcons.Crown className="w-4 h-4 text-green-700 dark:text-green-400" />
                          <p className="text-sm font-bold text-green-800 dark:text-green-300">Likely to Confirm</p>
                        </div>
                        <ul className="space-y-1.5">
                          {likelyLines.map((line, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <span className="text-green-600 dark:text-green-400 font-bold flex-shrink-0 w-4">{i + 1}.</span>
                              <span>{line.replace(/^\d+[\.\)]\s*/, '')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {hotLeads.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <SvgIcons.Phone className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <p className="text-sm font-bold text-red-800 dark:text-red-300">Pipeline Not Updated</p>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Hot/Warm leads not moved to Enrolled ({hotLeads.length})</span>
                        </div>
                        <div className="space-y-2">
                          {hotLeads.map((lead, i) => (
                            <div key={i} className="py-2 border-b border-red-100 dark:border-red-900/40 last:border-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  lead.status === 'Hot'
                                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {lead.status}
                                </span>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{lead.userName}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">({lead.course})</span>
                              </div>
                              {lead.lastRemark && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 ml-1">"{lead.lastRemark}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {responded.length > 0 && (
                      <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <SvgIcons.Chat className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <p className="text-sm font-bold text-teal-800 dark:text-teal-300">Responded After Follow-Up ({responded.length})</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {responded.map((lead, i) => (
                            <span key={i} className="text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                              {lead.userName}
                              {lead.course && <span className="text-slate-400 ml-1">· {lead.course}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 text-right">
                      Generated {new Date(report.generatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {weeklyView === 'reports' && olderWeeklyReports.length > 0 && !showAllWeekly && (
            <button
              onClick={() => setShowAllWeekly(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs"
            >
              <SvgIcons.ChevronDown className="w-3.5 h-3.5" />
              View older reports ({olderWeeklyReports.length})
            </button>
          )}

          {weeklyView === 'reports' && showAllWeekly && olderWeeklyReports.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setShowAllWeekly(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Show only latest
              </button>
              {weeklyTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWeeklyPage(p => Math.max(1, p - 1))}
                    disabled={weeklyPage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-700 transition-all"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-slate-400 font-semibold">
                    Page {weeklyPage} of {weeklyTotalPages}
                  </span>
                  <button
                    onClick={() => setWeeklyPage(p => Math.min(weeklyTotalPages, p + 1))}
                    disabled={weeklyPage === weeklyTotalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-700 transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MONTHLY TAB ────────────────────────────────────────────────── */}
      {activeTab === 'monthly' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <SvgIcons.Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Generated on the 1st of every month at 9.00 Am</span>
            </div>

            <button
              onClick={() => setMonthlyView(monthlyView === 'summary' ? 'reports' : 'summary')}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <SvgIcons.WhatsApp className="w-4 h-4" />
              Whatsapp Summary
            </button>
          </div>

          {monthlyLoading && (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-20">
              <SvgIcons.RefreshCcw className="w-7 h-7 animate-spin" />
              <p className="text-sm">Loading monthly reports…</p>
            </div>
          )}

          {monthlyError && !monthlyLoading && (
            <div className="flex flex-col items-center justify-center gap-3 text-red-500 py-10">
              <p className="text-sm">{monthlyError}</p>
            </div>
          )}

          {!monthlyLoading && !monthlyError && (
            <>
              {isAdmin && monthlyCounsellors.length > 1 && monthlyView === 'reports' && (
                <div className="flex flex-wrap items-center gap-2">
                  {monthlyCounsellors.map(c => (
                    <button
                      key={c}
                      onClick={() => { setMonthlySelectedCounsellor(c); setMonthlyView('reports'); }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                        monthlySelectedCounsellor === c
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      {c === 'all' ? 'All Counsellors' : c}
                    </button>
                  ))}
                </div>
              )}

              {monthlyView === 'summary' && (
                <MonthlyMinminiSection
                  minmini={monthlyMinmini}
                  loading={monthlyMinminiLoading}
                  error={monthlyMinminiError}
                  onLoad={loadMonthlyMinmini}
                  latestMonthStart={monthlyReports[0]?.monthStart}
                  latestMonthEnd={monthlyReports[0]?.monthEnd}
                />
              )}

              {monthlyView === 'reports' && monthlyVisible.length === 0 && (
                <div className="text-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <SvgIcons.Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-base font-semibold text-slate-500 dark:text-slate-400">No monthly reports yet</p>
                  <p className="text-xs mt-1">Reports are generated on the 1st of every month at 9 AM</p>
                </div>
              )}

              {monthlyView === 'reports' && displayedMonthlyReports.map(report => {
                const isOpen = monthlyExpandedId === report._id;
                const m = report.metrics ?? {} as MonthlyReportMetrics;
                const thisMonthFees = m.thisMonthFees ?? { totalBilled: 0, totalPaid: 0 };
                const prevMonthFees = m.prevMonthFees ?? { totalBilled: 0, totalPaid: 0 };
                const slowBuckets = m.slowBuckets ?? {};
                const hotLeads = report.hotNotEnrolled ?? [];
                const responded = report.respondedAfterFollowUp ?? [];
                const likelyLines = (report.likelyToConfirm || '')
                  .split('\n')
                  .map(l => l.trim())
                  .filter(l => l && l !== 'No active leads to analyse.' && l !== 'No strong conversion signals found.');

                return (
                  <div key={report._id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-4">
                    <div
                      className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800"
                      onClick={() => setMonthlyExpandedId(isOpen ? null : report._id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm uppercase">
                          {report.counsellor.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{report.counsellor}</h4>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{fmt(report.monthStart)} – {fmt(report.monthEnd)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2">
                          <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 font-extrabold text-xs px-3 py-1 rounded-full">
                            {m.newLeads ?? 0} Leads
                          </span>
                          <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs px-3 py-1 rounded-full">
                            {m.enrolledThisMonth ?? 0} Enrollment
                          </span>
                          <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold text-xs px-3 py-1 rounded-full">
                            {Math.max(0, 100 - (m.notContactedPct ?? 0))}% Billed
                          </span>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); downloadMonthlyReportPdf(report); }}
                          title="Download PDF"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs"
                        >
                          <SvgIcons.Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <SvgIcons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                  {isOpen && (
  <div className="p-5 pt-0">
    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Summary</div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      
      {/* Card 1: New Leads */}
      <div className="bg-rose-50/30 dark:bg-rose-950/40 border border-rose-100/60 dark:border-rose-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
        <div className="w-7 h-7 rounded-xl bg-rose-400 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.UserPlus className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.newLeads ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Leads</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">New Leads</p>
        </div>
      </div>

      {/* Card 2: Enrolled */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Check className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.enrolledThisMonth ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Remarks</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Enrolled</p>
        </div>
      </div>

      {/* Card 3: Not Collected */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-slate-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.X className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.noContactCount ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">{m.notContactedPct ?? 0}% of leads</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Not Collected</p>
        </div>
      </div>

      {/* Card 4: Avg Response */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.avgResponseMins ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Minutes</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Avg Response <span className="text-[10px] text-slate-400 font-normal">&lt;60m</span></p>
        </div>
      </div>

      {/* Card 5: Slow Time */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Bell className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.slowResponses ?? 0}</span>
            <span className="text-[12px] font-bold text-slate-400">Slow Time</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Slow &gt;1 hr</p>
        </div>
      </div>

      {/* Card 6: Billed */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.IndianRupee className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{currency(thisMonthFees.totalBilled)}</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Billed</p>
        </div>
      </div>

      {/* Card 7: Off Hours Effort */}
      <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-3 flex flex-col justify-between">
        <div className="w-7 h-7 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-2 shadow-2xs">
          <SvgIcons.Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.avgOffHoursResponseMins ?? 0}</span>
            <span className="text-[11px] font-bold text-slate-400">Minutes</span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5">Off Hours Effort</p>
        </div>
      </div>

    </div>
  </div>
)}

                    {isOpen && (
                      <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Monthly Fees Report</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="border border-emerald-500/40 rounded-2xl p-4 text-center">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Billed</p>
                                <p className="text-base font-bold text-slate-800 dark:text-slate-100">{currency(thisMonthFees.totalBilled)}</p>
                                <div className="mt-2 text-[10px]">
                                  <TrendBadge pct={m.billedPct ?? null} prev={prevMonthFees.totalBilled} vsLabel="vs last month" />
                                  <p className="text-slate-400 mt-0.5">({currency(prevMonthFees.totalBilled)} prev month)</p>
                                </div>
                              </div>
                              <div className="border border-emerald-500/40 rounded-2xl p-4 text-center">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Collected</p>
                                <p className="text-base font-bold text-slate-800 dark:text-slate-100">{currency(thisMonthFees.totalPaid)}</p>
                                <div className="mt-2 text-[10px]">
                                  <TrendBadge pct={m.paidPct ?? null} prev={prevMonthFees.totalPaid} vsLabel="vs last month" />
                                  <p className="text-slate-400 mt-0.5">({currency(prevMonthFees.totalPaid)} prev month)</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {report.aiSummary && report.aiSummary !== 'AI analysis unavailable.' && (
                          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <SvgIcons.Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <p className="text-sm font-bold text-blue-800 dark:text-blue-300">AI Monthly Performance Summary</p>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{report.aiSummary}</p>
                          </div>
                        )}

                        {likelyLines.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <SvgIcons.Crown className="w-4 h-4 text-green-700 dark:text-green-400" />
                              <p className="text-sm font-bold text-green-800 dark:text-green-300">Likely to Confirm</p>
                            </div>
                            <ul className="space-y-1.5">
                              {likelyLines.map((line, i) => (
                                <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                                  <span className="text-green-600 dark:text-green-400 font-bold flex-shrink-0 w-4">{i + 1}.</span>
                                  <span>{line.replace(/^\d+[\.\)]\s*/, '')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {hotLeads.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <SvgIcons.Phone className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <p className="text-sm font-bold text-red-800 dark:text-red-300">Pipeline Not Updated</p>
                              <span className="text-xs text-slate-500 dark:text-slate-400">Hot/Warm leads not moved to Enrolled ({hotLeads.length})</span>
                            </div>
                            <div className="space-y-2">
                              {hotLeads.map((lead, i) => (
                                <div key={i} className="py-2 border-b border-red-100 dark:border-red-900/40 last:border-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                      lead.status === 'Hot'
                                        ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    }`}>
                                      {lead.status}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{lead.userName}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">({lead.course})</span>
                                  </div>
                                  {lead.lastRemark && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 ml-1">"{lead.lastRemark}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 text-right">
                          Generated {new Date(report.generatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

    </div>
  );
}