import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { GA4AcquisitionRow, GA4SessionSourceRow, GA4OrganicLandingPageRow, GA4EngagementRow } from '../types';

// ─── Local Safe SVG Icons ──────────────────────────────────────────────────
const SvgIcons = {
  Analytics: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  RefreshCcw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
  ),
  Users: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  UserPlus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
  ),
  Globe: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  ),
  Activity: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  BarChart: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
  ),
  Eye: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ),
  GoogleAnalytics: (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="0.91em" height="1em" viewBox="0 0 256 284" {...props}>
      <path d="M0 0h256v284H0z" fill="none" />
      <path fill="#f9ab00" d="M256.003 247.933a35.224 35.224 0 0 1-39.376 35.161c-18.044-2.67-31.266-18.371-30.826-36.606V36.845C185.365 18.591 198.62 2.881 216.687.24a35.22 35.22 0 0 1 39.316 35.16z" />
      <path fill="#e37400" d="M35.101 213.193c19.386 0 35.101 15.716 35.101 35.101c0 19.386-15.715 35.101-35.101 35.101S0 267.68 0 248.295s15.715-35.102 35.101-35.102m92.358-106.387c-19.477 1.068-34.59 17.406-34.137 36.908v94.285c0 25.588 11.259 41.122 27.755 44.433a35.16 35.16 0 0 0 42.146-34.56V142.089a35.22 35.22 0 0 0-35.764-35.282" />
    </svg>
  )
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];
const daysAgoStr = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const formatDuration = (seconds: number) => {
  const s = Math.round(seconds || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0);

interface CountCardProps {
  icon: React.ReactNode;
  iconBg: string;
  value: React.ReactNode;
  unit?: string;
  label: string;
  subLabel?: string;
}

const CountCard: React.FC<CountCardProps> = ({
  icon,
  iconBg,
  value,
  unit,
  label,
  subLabel,
}) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
    <div className={`w-9 h-9 rounded-xl ${iconBg} text-white flex items-center justify-center mb-3 shadow-xs`}>
      {icon}
    </div>
    <div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate block">
          {subLabel || label}
        </span>
      </div>
    </div>
  </div>
);

const LINE_COLORS = { activeUsers: '#3b82f6', engagedSessions: '#22c55e', sessions: '#f97316' } as const;

const EngagementLineChart = ({ data }: { data: GA4EngagementRow[] }) => {
  if (!data.length) return null;
  const metrics: (keyof typeof LINE_COLORS)[] = ['activeUsers', 'engagedSessions', 'sessions'];
  const maxVal = Math.max(1, ...data.flatMap(d => metrics.map(m => d[m] as number)));
  const svgW = 760, svgH = 320;
  const ml = 44, mr = 16, mt = 20, mb = 56;
  const chartW = svgW - ml - mr;
  const chartH = svgH - mt - mb;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(maxVal * t), y: chartH - t * chartH }));

  const pointsFor = (metric: keyof typeof LINE_COLORS) =>
    data.map((d, i) => `${i * stepX},${chartH - ((d[metric] as number) / maxVal) * chartH}`).join(' ');

  const xLabelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
      <g transform={`translate(${ml},${mt})`}>
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={0} y1={y} x2={chartW} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth={1} />
            <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor" className="text-slate-400">{v}</text>
          </g>
        ))}
        {metrics.map(m => (
          <polyline key={m} points={pointsFor(m)} fill="none" stroke={LINE_COLORS[m]} strokeWidth={2} />
        ))}
        {data.map((d, i) => (
          i % xLabelEvery === 0 ? (
            <text key={d.date} x={i * stepX} y={chartH + 16} textAnchor="middle" fontSize={10} fill="currentColor" className="text-slate-500 dark:text-slate-400">
              {d.date.slice(5)}
            </text>
          ) : null
        ))}
        <line x1={0} y1={0} x2={0} y2={chartH} stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth={1} />
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth={1} />
      </g>
      <g transform={`translate(${ml},${svgH - 18})`}>
        {metrics.map((m, i) => (
          <g key={m} transform={`translate(${i * 150},0)`}>
            <rect x={0} y={-9} width={12} height={12} fill={LINE_COLORS[m]} rx={2} />
            <text x={16} y={2} fontSize={11} fill="currentColor" className="text-slate-500 dark:text-slate-400">
              {m === 'activeUsers' ? 'Active Users' : m === 'engagedSessions' ? 'Engaged Sessions' : 'Sessions'}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
};

type Tab = 'acquisition' | 'session-source' | 'organic-landing' | 'engagement';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'acquisition', label: 'Acquisition', icon: <SvgIcons.Users className="w-3.5 h-3.5" /> },
  { key: 'session-source', label: 'Session Source', icon: <SvgIcons.Globe className="w-3.5 h-3.5" /> },
  { key: 'organic-landing', label: 'Organic Landing Page', icon: <SvgIcons.BarChart className="w-3.5 h-3.5" /> },
  { key: 'engagement', label: 'Engagement', icon: <SvgIcons.Activity className="w-3.5 h-3.5" /> },
];

const GoogleAnalyticsView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('acquisition');
  const [startDate, setStartDate] = useState(daysAgoStr(28));
  const [endDate, setEndDate] = useState(todayStr());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [acquisitionRows, setAcquisitionRows] = useState<GA4AcquisitionRow[]>([]);
  const [acquisitionTotals, setAcquisitionTotals] = useState({ sessions: 0, newUsers: 0, totalUsers: 0 });

  const [sourceRows, setSourceRows] = useState<GA4SessionSourceRow[]>([]);
  const [sourceTotals, setSourceTotals] = useState({ sessions: 0, newUsers: 0, totalUsers: 0 });

  const [landingRows, setLandingRows] = useState<GA4OrganicLandingPageRow[]>([]);
  const [landingTotals, setLandingTotals] = useState({ sessions: 0, views: 0, engagedSessions: 0, conversions: 0 });

  const [engagementRows, setEngagementRows] = useState<GA4EngagementRow[]>([]);
  const [engagementSummary, setEngagementSummary] = useState({ avgEngagementTimePerActiveUser: 0, engagedSessionsPerActiveUser: 0, avgEngagementTimePerSession: 0 });

  const loadReport = async (activeTab: Tab) => {
    try {
      setLoading(true);
      setError('');
      if (activeTab === 'acquisition') {
        const data = await apiService.fetchGA4Acquisition(startDate, endDate);
        if (!data.success) throw new Error('Unable to load acquisition report');
        setAcquisitionRows(data.rows || []);
        setAcquisitionTotals(data.totals || { sessions: 0, newUsers: 0, totalUsers: 0 });
      } else if (activeTab === 'session-source') {
        const data = await apiService.fetchGA4SessionSource(startDate, endDate);
        if (!data.success) throw new Error('Unable to load session source report');
        setSourceRows(data.rows || []);
        setSourceTotals(data.totals || { sessions: 0, newUsers: 0, totalUsers: 0 });
      } else if (activeTab === 'organic-landing') {
        const data = await apiService.fetchGA4OrganicLandingPages(startDate, endDate);
        if (!data.success) throw new Error('Unable to load organic landing pages report');
        setLandingRows(data.rows || []);
        setLandingTotals(data.totals || { sessions: 0, views: 0, engagedSessions: 0, conversions: 0 });
      } else {
        const data = await apiService.fetchGA4EngagementOverview(startDate, endDate);
        if (!data.success) throw new Error('Unable to load engagement overview');
        setEngagementRows(data.rows || []);
        setEngagementSummary(data.summary || { avgEngagementTimePerActiveUser: 0, engagedSessionsPerActiveUser: 0, avgEngagementTimePerSession: 0 });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Google Analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleTabChange = (next: Tab) => setTab(next);

  const handleApplyDateRange = () => loadReport(tab);

  const acquisitionTotalsCards = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <CountCard
        icon={<SvgIcons.Analytics className="w-4 h-4" />}
        iconBg="bg-blue-600"
        value={formatNumber(acquisitionTotals.sessions)}
        unit="Sessions"
        label="Sessions"
        subLabel="Total Traffic"
      />
      <CountCard
        icon={<SvgIcons.UserPlus className="w-4 h-4" />}
        iconBg="bg-emerald-600"
        value={formatNumber(acquisitionTotals.newUsers)}
        unit="Users"
        label="New Users"
        subLabel="First-Time Visitors"
      />
      <CountCard
        icon={<SvgIcons.Users className="w-4 h-4" />}
        iconBg="bg-purple-600"
        value={formatNumber(acquisitionTotals.totalUsers)}
        unit="Users"
        label="Total Users"
        subLabel="Total Audience"
      />
    </div>
  ), [acquisitionTotals]);

  const sourceTotalsCards = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <CountCard
        icon={<SvgIcons.Analytics className="w-4 h-4" />}
        iconBg="bg-blue-600"
        value={formatNumber(sourceTotals.sessions)}
        unit="Sessions"
        label="Sessions"
        subLabel="Total Source Sessions"
      />
      <CountCard
        icon={<SvgIcons.UserPlus className="w-4 h-4" />}
        iconBg="bg-emerald-600"
        value={formatNumber(sourceTotals.newUsers)}
        unit="Users"
        label="New Users"
        subLabel="Acquired Users"
      />
      <CountCard
        icon={<SvgIcons.Users className="w-4 h-4" />}
        iconBg="bg-purple-600"
        value={formatNumber(sourceTotals.totalUsers)}
        unit="Users"
        label="Total Users"
        subLabel="Total Source Users"
      />
    </div>
  ), [sourceTotals]);

  const landingTotalsCards = useMemo(() => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <CountCard
        icon={<SvgIcons.Analytics className="w-4 h-4" />}
        iconBg="bg-blue-600"
        value={formatNumber(landingTotals.sessions)}
        unit="Sessions"
        label="Sessions"
        subLabel="Organic Visits"
      />
      <CountCard
        icon={<SvgIcons.Eye className="w-4 h-4" />}
        iconBg="bg-indigo-600"
        value={formatNumber(landingTotals.views)}
        unit="Views"
        label="Views"
        subLabel="Page Impressions"
      />
      <CountCard
        icon={<SvgIcons.CheckCircle className="w-4 h-4" />}
        iconBg="bg-emerald-600"
        value={formatNumber(landingTotals.engagedSessions)}
        unit="Sessions"
        label="Engaged"
        subLabel="Engaged Visits"
      />
      <CountCard
        icon={<SvgIcons.BarChart className="w-4 h-4" />}
        iconBg="bg-amber-500"
        value={formatNumber(landingTotals.conversions)}
        unit="Goals"
        label="Conversions"
        subLabel="Goal Completions"
      />
    </div>
  ), [landingTotals]);

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 transition-colors">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#fffbeb] dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center">
              <SvgIcons.GoogleAnalytics className="w-5 h-5 flex-shrink-0" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Google Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{startDate} to {endDate}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-bold shadow-2xs">
            <SvgIcons.Calendar className="w-4 h-4 text-[#f59e0b] dark:text-amber-400" />
            <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer" />
          </div>
          <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">to</span>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-bold shadow-2xs">
            <SvgIcons.Calendar className="w-4 h-4 text-[#f59e0b] dark:text-amber-400" />
            <input type="date" value={endDate} min={startDate} max={todayStr()} onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer" />
          </div>
          <button onClick={handleApplyDateRange} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-bold transition shadow-xs disabled:opacity-60">
            <SvgIcons.RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 gap-1.5 shadow-2xs">
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all border ${
                isActive
                  ? 'bg-[#fffbeb] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 border-amber-200/90 dark:border-amber-800/80 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent'
              }`}
            >
              <span className={isActive ? 'text-[#f59e0b] dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}>
                {t.icon}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <SvgIcons.RefreshCcw className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Loading analytics...</span>
        </div>
      )}

      {!loading && !error && tab === 'acquisition' && (
        <div className="space-y-4">
          {acquisitionTotalsCards}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-[#fffbeb] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 border-b border-amber-200/70 dark:border-amber-800/60 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-3.5 text-left">Channel</th>
                    <th className="px-6 py-3.5 text-right">Sessions</th>
                    <th className="px-6 py-3.5 text-right">New Users</th>
                    <th className="px-6 py-3.5 text-right">Total Users</th>
                    <th className="px-6 py-3.5 text-right">Engagement Rate</th>
                    <th className="px-6 py-3.5 text-right">AVG. Session Duration</th>
                    <th className="px-6 py-3.5 text-right">Bounce Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {acquisitionRows.map(row => (
                    <tr key={row.channel} className="hover:bg-slate-50/60 dark:hover:bg-slate-200 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{row.channel}</td>
                      <td className="px-8 py-4 text-right tabular-nums text-slate-900 dark:text-slate-900 font-medium">{formatNumber(row.sessions)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.newUsers)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.totalUsers)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.engagementRate}%</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatDuration(row.avgSessionDuration)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.bounceRate}%</td>
                    </tr>
                  ))}
                  {acquisitionRows.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic">No data for the selected date range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'session-source' && (
        <div className="space-y-4">
          {sourceTotalsCards}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-[#fffbeb] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 border-b border-amber-200/70 dark:border-amber-800/60 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-3.5 text-left">Source</th>
                    <th className="px-6 py-3.5 text-right">Sessions</th>
                    <th className="px-6 py-3.5 text-right">New Users</th>
                    <th className="px-6 py-3.5 text-right">Total Users</th>
                    <th className="px-6 py-3.5 text-right">Engagement Rate</th>
                    <th className="px-6 py-3.5 text-right">AVG. Session Duration</th>
                    <th className="px-6 py-3.5 text-right">Bounce Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sourceRows.map((row, idx) => (
                    <tr key={`${row.source}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-200 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{row.source || '(not set)'}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.sessions)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.newUsers)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.totalUsers)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.engagementRate}%</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatDuration(row.avgSessionDuration)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.bounceRate}%</td>
                    </tr>
                  ))}
                  {sourceRows.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic">No data for the selected date range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'organic-landing' && (
        <div className="space-y-4">
          {landingTotalsCards}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white :bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-[#fffbeb] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 border-b border-amber-200/70 dark:border-amber-800/60 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-3.5 text-left">Landing Page</th>
                    <th className="px-6 py-3.5 text-right">Sessions</th>
                    <th className="px-6 py-3.5 text-right">Views</th>
                    <th className="px-6 py-3.5 text-right">Bounce Rate</th>
                    <th className="px-6 py-3.5 text-right">Events / Session</th>
                    <th className="px-6 py-3.5 text-right">Engaged Sessions</th>
                    <th className="px-6 py-3.5 text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {landingRows.map((row, idx) => (
                    <tr key={`${row.landingPage}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 max-w-xs truncate" title={row.landingPage}>{row.landingPage}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.sessions)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.views)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.bounceRate}%</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.eventsPerSession}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.engagedSessions)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.conversions)}</td>
                    </tr>
                  ))}
                  {landingRows.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic">No organic search landing pages for the selected date range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'engagement' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            <CountCard
              icon={<SvgIcons.Activity className="w-4 h-4" />}
              iconBg="bg-blue-600"
              value={formatDuration(engagementSummary.avgEngagementTimePerActiveUser)}
              label="Avg. Time"
              subLabel="Per Active User"
            />
            <CountCard
              icon={<SvgIcons.CheckCircle className="w-4 h-4" />}
              iconBg="bg-emerald-600"
              value={engagementSummary.engagedSessionsPerActiveUser}
              label="Engaged Sessions"
              subLabel="Per Active User"
            />
            <CountCard
              icon={<SvgIcons.Analytics className="w-4 h-4" />}
              iconBg="bg-indigo-600"
              value={formatDuration(engagementSummary.avgEngagementTimePerSession)}
              label="Avg. Time"
              subLabel="Per Session"
            />
          </div>
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Daily Trend</p>
            {engagementRows.length === 0
              ? <p className="text-center text-xs italic text-slate-400 py-6">No data for the selected date range.</p>
              : <EngagementLineChart data={engagementRows} />}
          </div>
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-[#fffbeb] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 border-b border-amber-200/70 dark:border-amber-800/60 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-3.5 text-left">Date</th>
                    <th className="px-6 py-3.5 text-right">Active Users</th>
                    <th className="px-6 py-3.5 text-right">Engaged Sessions</th>
                    <th className="px-6 py-3.5 text-right">Sessions</th>
                    <th className="px-6 py-3.5 text-right">Avg. Engagement Time / Active User</th>
                    <th className="px-6 py-3.5 text-right">Engaged Sessions / Active User</th>
                    <th className="px-6 py-3.5 text-right">Avg. Engagement Time / Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {engagementRows.map(row => (
                    <tr key={row.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-200 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{row.date}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.activeUsers)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.engagedSessions)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatNumber(row.sessions)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatDuration(row.avgEngagementTimePerActiveUser)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{row.engagedSessionsPerActiveUser}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">{formatDuration(row.avgEngagementTimePerSession)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleAnalyticsView;
