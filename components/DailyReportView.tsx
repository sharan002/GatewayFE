import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { DailyUserActivityReportItem, DailyReportFeeInstallment, MonthlyReportItem, PipelineDistributionItem, User, UserMonthlyTarget, normalizeLeadSource } from '../types';
import { Icons } from './Icons';

// ─── Helpers ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const getYearMonthFromDate = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const getMonthlyPaidAmount = (row: MonthlyReportItem) =>
  Number(row.totalPaid ?? row.feesPaid ?? row.totalCollected ?? 0) || 0;

const getAchievementPercent = (paid: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0;

const timeDiffLabel = (from: string, to: string): string => {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return '';
  const diffMs = toDate.getTime() - fromDate.getTime();
  if (diffMs < 0) return '';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (totalMinutes > 0) return `${totalMinutes}m`;
  return '< 1m';
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const getAvatarColor = (name: string) => {
  const colors = [
    { bg: 'bg-blue-100 dark:bg-blue-950/70', text: 'text-blue-700 dark:text-blue-300' },
    { bg: 'bg-teal-100 dark:bg-teal-950/70', text: 'text-teal-700 dark:text-teal-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-purple-100 dark:bg-purple-950/70', text: 'text-purple-700 dark:text-purple-300' },
    { bg: 'bg-indigo-100 dark:bg-indigo-950/70', text: 'text-indigo-700 dark:text-indigo-300' },
    { bg: 'bg-rose-100 dark:bg-rose-950/70', text: 'text-rose-700 dark:text-rose-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950/70', text: 'text-amber-700 dark:text-amber-300' },
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash + (name || '').charCodeAt(i)) % colors.length;
  return colors[hash];
};


// ─── Shared UI Cards (Adaptive Light/Dark Theme) ─────────────────────────────

const SummaryCard = ({
  icon,
  iconBg,
  value,
  label,
  subLabel,
  subIcon,
  subIconColor = "text-blue-500",
  cardBg = "bg-white dark:bg-slate-900"
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: React.ReactNode;
  label: string;
  subLabel: string;
  subIcon?: React.ReactNode;
  subIconColor?: string;
  cardBg?: string;
}) => (
  <div className={`${cardBg} backdrop-blur-sm rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between min-w-[150px] flex-1 transition-all`}>
    <div className={`w-9 h-9 rounded-xl ${iconBg} text-white flex items-center justify-center mb-3 shadow-xs`}>
      {icon}
    </div>
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{value}</span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{subLabel}</span>
        {subIcon && <span className={subIconColor}>{subIcon}</span>}
      </div>
    </div>
  </div>
);

// ─── SVG Chart Components ─────────────────────────────────────────────────────

const BAR_COLORS = { newLeads: '#3b82f6', totalRemarks: '#f97316', feesUpdated: '#22c55e' } as const;
const PIE_COLORS = ['#3b82f6','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#f59e0b','#6366f1','#ef4444','#84cc16'];

type BarMetric = keyof typeof BAR_COLORS;

const GroupedBarChart = ({ data }: { data: MonthlyReportItem[] }) => {
  if (!data.length) return null;
  const metrics: BarMetric[] = ['newLeads', 'totalRemarks', 'feesUpdated'];
  const maxVal = Math.max(1, ...data.flatMap(d => metrics.map(m => d[m] as number)));
  const svgW = 760, svgH = 360;
  const ml = 44, mr = 16, mt = 20, mb = 72;
  const chartW = svgW - ml - mr;
  const chartH = svgH - mt - mb;
  const groupW = chartW / data.length;
  const barW = Math.max(6, (groupW - 12) / metrics.length);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(maxVal * t), y: chartH - t * chartH }));
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
      <g transform={`translate(${ml},${mt})`}>
        {yTicks.map(({ v, y }) => (
          <g key={v}>
         <line x1={0} y1={y} x2={chartW} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{v}</text>
            </g>
        ))}
        {data.map((item, gi) => {
          const gx = gi * groupW + 6;
          return metrics.map((m, mi) => {
            const bx = gx + mi * barW;
            const bh = (item[m] / maxVal) * chartH;
            const by = chartH - bh;
            return (
              <g key={`${item.username}-${m}`}>
                <rect x={bx} y={by} width={Math.max(1, barW - 2)} height={Math.max(1, bh)} fill={BAR_COLORS[m]} rx={2} />
                {item[m] > 0 && <text x={bx + (barW - 2) / 2} y={by - 3} textAnchor="middle" fontSize={9} fill="#475569">{item[m]}</text>}
              </g>
            );
          });
        })}
        {data.map((item, gi) => (
          <text key={item.username} x={gi * groupW + groupW / 2} y={chartH + 16} textAnchor="end" fontSize={8} fill="#475569"
            transform={`rotate(-35,${gi * groupW + groupW / 2},${chartH + 16})`}>{item.username}</text>
        ))}
        <line x1={0} y1={0} x2={0} y2={chartH} stroke="#cbd5e1" strokeWidth={1} />
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#cbd5e1" strokeWidth={1} />
      </g>
      <g transform={`translate(${ml},${svgH - 18})`}>
        {metrics.map((m, i) => (
          <g key={m} transform={`translate(${i * 150},0)`}>
            <rect x={0} y={-9} width={12} height={12} fill={BAR_COLORS[m]} rx={2} />
            <text x={16} y={2} fontSize={11} fill="currentColor" className="text-slate-500 dark:text-slate-400">
              {m === 'newLeads' ? 'New Leads' : m === 'totalRemarks' ? 'Remarks' : 'Fees Updated'}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
};

type PieMetric = 'newLeads' | 'totalRemarks' | 'feesUpdated' | 'totalBilled' | 'totalPaid';

const DonutChart = ({ data, metric, label, formatter }: {
  data: MonthlyReportItem[];
  metric: PieMetric;
  label: string;
  formatter?: (v: number) => string;
}) => {
  const total = data.reduce((s, d) => s + (Number(d[metric]) || 0), 0);
  if (!total) return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <p className="text-center text-xs italic text-slate-400 dark:text-slate-500 py-6">No data</p>
    </div>
  );
  const cx = 100, cy = 100, r = 80, ir = 42;
  let angle = -Math.PI / 2;
  const slices = data.filter(d => (d[metric] as number) > 0).map((item, idx) => {
    const val = Number(item[metric]) || 0;
    const frac = val / total;
    const sweep = frac * 2 * Math.PI;
    const sa = angle, ea = angle + sweep;
    angle = ea;
    const lg = sweep > Math.PI ? 1 : 0;
    const cos = (a: number) => Math.cos(a), sin = (a: number) => Math.sin(a);
    const d = `M ${cx + ir * cos(sa)} ${cy + ir * sin(sa)} L ${cx + r * cos(sa)} ${cy + r * sin(sa)} A ${r} ${r} 0 ${lg} 1 ${cx + r * cos(ea)} ${cy + r * sin(ea)} L ${cx + ir * cos(ea)} ${cy + ir * sin(ea)} A ${ir} ${ir} 0 ${lg} 0 ${cx + ir * cos(sa)} ${cy + ir * sin(sa)} Z`;
    return { ...item, d, color: PIE_COLORS[idx % PIE_COLORS.length], pct: (frac * 100).toFixed(1), val };
  });
  const centerLabel = formatter ? formatter(total) : String(total);
  const centerFontSize = formatter ? 9 : 14;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <div className="flex items-center gap-4 flex-wrap">
        <svg viewBox="0 0 200 200" className="w-36 h-36 flex-shrink-0">
          {slices.map(s => <path key={s.username} d={s.d} fill={s.color} />)}
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize={centerFontSize} fill="currentColor" className="text-slate-700 dark:text-slate-200" fontWeight="bold">{centerLabel}</text>
          <text x={cx} y={cx + 10} textAnchor="middle" fontSize={9} fill="currentColor" className="text-slate-400">total</text>
        </svg>
        <ul className="text-xs space-y-1 min-w-0 flex-1">
          {slices.map(s => (
            <li key={s.username} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="truncate text-slate-600 dark:text-slate-300 flex-1">{s.username}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{formatter ? formatter(s.val) : s.val} ({s.pct}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const DistributionDonutChart = ({ data, label }: { data: PipelineDistributionItem[]; label: string }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <p className="text-center text-xs italic text-slate-400 dark:text-slate-500 py-6">No data</p>
    </div>
  );
  const cx = 100, cy = 100, r = 80, ir = 42;
  let angle = -Math.PI / 2;
  const slices = data.filter(d => d.count > 0).map((item, idx) => {
    const frac = item.count / total;
    const sweep = frac * 2 * Math.PI;
    const sa = angle, ea = angle + sweep;
    angle = ea;
    const lg = sweep > Math.PI ? 1 : 0;
    const cos = (a: number) => Math.cos(a), sin = (a: number) => Math.sin(a);
    const path = `M ${cx + ir * cos(sa)} ${cy + ir * sin(sa)} L ${cx + r * cos(sa)} ${cy + r * sin(sa)} A ${r} ${r} 0 ${lg} 1 ${cx + r * cos(ea)} ${cy + r * sin(ea)} L ${cx + ir * cos(ea)} ${cy + ir * sin(ea)} A ${ir} ${ir} 0 ${lg} 0 ${cx + ir * cos(sa)} ${cy + ir * sin(sa)} Z`;
    return { ...item, path, color: PIE_COLORS[idx % PIE_COLORS.length], pct: (frac * 100).toFixed(1) };
  });
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <div className="flex items-center gap-4 flex-wrap">
        <svg viewBox="0 0 200 200" className="w-36 h-36 flex-shrink-0">
          {slices.map(s => <path key={s.label} d={s.path} fill={s.color} />)}
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize={14} fill="currentColor" className="text-slate-700 dark:text-slate-200" fontWeight="bold">{total}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="currentColor" className="text-slate-400">enrolled</text>
        </svg>
        <ul className="text-xs space-y-1 min-w-0 flex-1">
          {slices.map(s => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="truncate text-slate-600 dark:text-slate-300 flex-1">{s.label}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{s.count} ({s.pct}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ─── Achievement Progress Bar ─────────────────────────────────────────────────

const AchievementBar = ({ paid, target }: { paid: number; target: number }) => {
  if (!target) return <span className="text-xs text-slate-400 dark:text-slate-500 italic">No target</span>;
  const pct = Math.min(100, Math.round((paid / target) * 100));
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400';
  const textColor = pct >= 100 ? 'text-emerald-700 dark:text-emerald-400' : pct >= 75 ? 'text-blue-700 dark:text-blue-400' : pct >= 50 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface DailyReportViewProps {
  currentUser: User | null;
}

const DailyReportView: React.FC<DailyReportViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';
  const now = new Date();

  // ── View mode ──
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const activeViewMode: 'daily' | 'monthly' = isAdmin ? viewMode : 'monthly';

  // ── Daily state ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [rows, setRows] = useState<DailyUserActivityReportItem[]>([]);
  const [activeUserPopup, setActiveUserPopup] = useState<DailyUserActivityReportItem | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [expandedReminders, setExpandedReminders] = useState<Record<string, boolean>>({});

  // ── Monthly state ──
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [monthlyRows, setMonthlyRows] = useState<MonthlyReportItem[]>([]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [pipelineBySource, setPipelineBySource] = useState<PipelineDistributionItem[]>([]);
  const [pipelineByCourse, setPipelineByCourse] = useState<PipelineDistributionItem[]>([]);
  const [pipelineQualifiedVsResponded, setPipelineQualifiedVsResponded] = useState<PipelineDistributionItem[]>([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState<string | null>(null);
  const [counsellorPipelineBySource, setCounsellorPipelineBySource] = useState<PipelineDistributionItem[]>([]);
  const [counsellorPipelineByCourse, setCounsellorPipelineByCourse] = useState<PipelineDistributionItem[]>([]);
  const [counsellorPipelineQualifiedVsResponded, setCounsellorPipelineQualifiedVsResponded] = useState<PipelineDistributionItem[]>([]);
  const [counsellorPipelineLoading, setCounsellorPipelineLoading] = useState(false);
  const [counsellorPipelineError, setCounsellorPipelineError] = useState('');

  // ── Target state ──
  const [targets, setTargets] = useState<UserMonthlyTarget[]>([]);
  const [editingTargetUsername, setEditingTargetUsername] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  const mergePipelineSources = (items: PipelineDistributionItem[] = []): PipelineDistributionItem[] => {
    const map = new Map<string, number>();
    items.forEach(item => {
      const norm = normalizeLeadSource(item.label);
      map.set(norm, (map.get(norm) || 0) + (item.count || 0));
    });
    return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };

  // ── Data loaders ──
  const loadDailyReport = async (date: string) => {
    try {
      setLoading(true);
      setError('');
      const { year, month } = getYearMonthFromDate(date);
      loadTargets(year, month);
      const data = await apiService.fetchUserActivityReport(date);
      if (!data.success) throw new Error('Unable to load report');
      setReportDate(data.date);
      setRows(data.report || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load daily report');
    } finally {
      setLoading(false);
    }
  };

  const loadTargets = async (year: number, month: number) => {
    try {
      const data = await apiService.fetchUserTargets(year, month);
      if (data.success) setTargets(data.targets || []);
    } catch {
      // non-critical
    }
  };

  const loadMonthlyReport = async (year: number, month: number) => {
    try {
      setMonthlyLoading(true);
      setMonthlyError('');
      if (isAdmin) {
        const [data, sourceData, courseData, qualifiedVsRespondedData] = await Promise.all([
          apiService.fetchMonthlyActivityReport(year, month),
          apiService.fetchMonthlyPipelineBySource(year, month),
          apiService.fetchMonthlyPipelineByCourse(year, month),
          apiService.fetchMonthlyPipelineQualifiedVsResponded(year, month),
        ]);
        if (!data.success) throw new Error('Unable to load monthly report');
        setMonthlyRows(data.report || []);
        setPipelineBySource(mergePipelineSources(sourceData.data || []));
        setPipelineByCourse(courseData.data || []);
        setPipelineQualifiedVsResponded(qualifiedVsRespondedData.data || []);
      } else {
        const data = await apiService.fetchMonthlyActivityReport(year, month);
        if (!data.success) throw new Error('Unable to load monthly report');
        setMonthlyRows(data.report || []);
        setPipelineBySource([]);
        setPipelineByCourse([]);
        setPipelineQualifiedVsResponded([]);
      }
      await loadTargets(year, month);
    } catch (err: any) {
      setMonthlyError(err?.message || 'Failed to load monthly report');
    } finally {
      setMonthlyLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      loadDailyReport(selectedDate);
    } else {
      loadMonthlyReport(selectedYear, selectedMonth);
    }
  }, []);

  // Counsellor-specific pipeline (admin only)
  useEffect(() => {
    if (!isAdmin || !selectedCounsellor) {
      setCounsellorPipelineBySource([]);
      setCounsellorPipelineByCourse([]);
      setCounsellorPipelineQualifiedVsResponded([]);
      setCounsellorPipelineLoading(false);
      setCounsellorPipelineError('');
      return;
    }
    let isActive = true;
    const fetch = async () => {
      try {
        setCounsellorPipelineLoading(true);
        setCounsellorPipelineError('');
        const [src, crs, qvr] = await Promise.all([
          apiService.fetchMonthlyPipelineBySource(selectedYear, selectedMonth, selectedCounsellor),
          apiService.fetchMonthlyPipelineByCourse(selectedYear, selectedMonth, selectedCounsellor),
          apiService.fetchMonthlyPipelineQualifiedVsResponded(selectedYear, selectedMonth, selectedCounsellor),
        ]);
        if (!isActive) return;
        if (!src.success || !crs.success || !qvr.success) throw new Error('Unable to load counsellor report');
        setCounsellorPipelineBySource(mergePipelineSources(src.data || []));
        setCounsellorPipelineByCourse(crs.data || []);
        setCounsellorPipelineQualifiedVsResponded(qvr.data || []);
      } catch (err: any) {
        if (!isActive) return;
        setCounsellorPipelineError(err?.message || 'Failed');
      } finally {
        if (isActive) setCounsellorPipelineLoading(false);
      }
    };
    fetch();
    return () => { isActive = false; };
  }, [selectedCounsellor, selectedYear, selectedMonth]);

  // ── Handlers ──
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value;
    setSelectedDate(d);
    const { year, month } = getYearMonthFromDate(d);
    loadTargets(year, month);
    loadDailyReport(d);
  };

  const handleViewChange = (mode: 'daily' | 'monthly') => {
    setViewMode(mode);
    if (mode === 'monthly') loadMonthlyReport(selectedYear, selectedMonth);
    else loadDailyReport(selectedDate);
  };

  const handleMonthYearChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedCounsellor(null);
    loadMonthlyReport(year, month);
  };

  const toggleUser = (key: string) => setExpandedUsers(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleReminder = (key: string) => setExpandedReminders(prev => ({ ...prev, [key]: !prev[key] }));
  const isUserExpanded = (key: string) => expandedUsers[key] === true;
  const isReminderExpanded = (key: string) => expandedReminders[key] === true;
  const toggleCounsellor = (username: string) => setSelectedCounsellor(prev => prev === username ? null : username);
  const normalize = (v: string | undefined) => (v || '').trim().toLowerCase();

  // ── Target helpers ──
  const getTarget = (username: string) => targets.find(t => normalize(t.username) === normalize(username))?.target ?? 0;

  const startEditTarget = (username: string) => {
    setEditingTargetUsername(username);
    setEditingTargetValue(String(getTarget(username) || ''));
  };
  const cancelEditTarget = () => { setEditingTargetUsername(null); setEditingTargetValue(''); };
  const saveTarget = async (username: string) => {
    const val = Number(editingTargetValue);
    if (isNaN(val) || val < 0) return;
    try {
      setSavingTarget(true);
      await apiService.setUserTarget(username, selectedYear, selectedMonth, val);
      setTargets(prev => {
        const existing = prev.find(t => t.username === username);
        if (existing) return prev.map(t => t.username === username ? { ...t, target: val } : t);
        return [...prev, { username, year: selectedYear, month: selectedMonth, target: val }];
      });
      setEditingTargetUsername(null);
    } catch { /* keep open */ } finally { setSavingTarget(false); }
  };

  // ── Derived data ──
  const monthlyRowsWithPaid = useMemo(
    () => monthlyRows.map(row => ({ ...row, totalPaid: getMonthlyPaidAmount(row) })),
    [monthlyRows]
  );

  const monthlyTotals = useMemo(() => monthlyRowsWithPaid.reduce(
    (acc, r) => ({ newLeads: acc.newLeads + r.newLeads, remarks: acc.remarks + r.totalRemarks, fees: acc.fees + r.feesUpdated, billed: acc.billed + r.totalBilled, paid: acc.paid + getMonthlyPaidAmount(r) }),
    { newLeads: 0, remarks: 0, fees: 0, billed: 0, paid: 0 }
  ), [monthlyRowsWithPaid]);

  const totals = useMemo(() => rows.reduce(
    (acc, item) => ({ users: acc.users + 1, newLeads: acc.newLeads + item.newLeadsToday, remarks: acc.remarks + item.remarksCount, fees: acc.fees + item.feesUpdatedToday, billed: acc.billed + (item.billedTodayTotal || 0), reminders: acc.reminders + (item.remindersTodayCount || 0) }),
    { users: 0, newLeads: 0, remarks: 0, fees: 0, billed: 0, reminders: 0 }
  ), [rows]);

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

  const visibleDailyRows = useMemo(
    () => isAdmin ? rows : rows.filter(r => normalize(r.username) === normalize(currentUser?.username)),
    [rows, isAdmin, currentUser]
  );
  const myDailyRow = visibleDailyRows[0] ?? null;
  const myDailyPaid = myDailyRow?.feesUpdatedToday || 0;

  // For non-admin: their row + their target
  const myRow = useMemo(() => monthlyRowsWithPaid.find(r => normalize(r.username) === normalize(currentUser?.username)) ?? null, [monthlyRowsWithPaid, currentUser]);
  const myTarget = currentUser ? getTarget(currentUser.username) : 0;
  const myPaid = myRow ? getMonthlyPaidAmount(myRow) : 0;
  const myDailyAchievement = getAchievementPercent(myDailyPaid, myTarget);
  const myMonthlyAchievement = getAchievementPercent(myPaid, myTarget);

  // ── Controls ──
  const monthYearControls = (
    <>
      <select value={selectedMonth} onChange={e => handleMonthYearChange(selectedYear, Number(e.target.value))}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
        {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select value={selectedYear} onChange={e => handleMonthYearChange(Number(e.target.value), selectedMonth)}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <button onClick={() => loadMonthlyReport(selectedYear, selectedMonth)} disabled={monthlyLoading}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
        <Icons.RefreshCcw className={`h-3.5 w-3.5 ${monthlyLoading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </>
  );

  // ── Tab switcher ──
const tabSwitcher = (
  <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
    <button onClick={() => handleViewChange('daily')}
      className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${viewMode === 'daily' ? 'bg-orange-50 text-orange-700 shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}>
      Daily
    </button>
    <button onClick={() => handleViewChange('monthly')}
      className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-orange-50 text-orange-700 shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}>
      Monthly
    </button>
  </div>
);
  const renderDailyCard = (item: DailyUserActivityReportItem) => {
    const totalReminderCount = item.remindersTodayDetails?.length > 0 ? item.remindersTodayDetails.length : item.remindersTodayCount || 0;
    const matchedReminderCount = (item.remindersTodayDetails || []).filter(r =>
      item.remarksDetails.some(e => normalize(e.userNumber) === normalize(r.userNumber) || normalize(e.userName) === normalize(r.userName))
    ).length;
    const isExpanded = isUserExpanded(item.username);
    const avatarColor = getAvatarColor(item.username);

    return (
      <div key={item.username} className={`rounded-2xl border ${isExpanded ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/40 shadow-md' : 'border-slate-200/90 dark:border-slate-800'} bg-white dark:bg-slate-900 shadow-xs hover:shadow-md hover:border-blue-200 transition-all overflow-hidden`}>
        <button
          type="button"
          onClick={() => toggleUser(item.username)}
          className="w-full flex flex-col gap-3 p-4 sm:p-5 text-left lg:flex-row lg:items-center lg:justify-between group transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-full ${avatarColor.bg} ${avatarColor.text} font-bold text-base flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}>
              {item.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 transition-colors">
                {item.username}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                Daily Snapshot
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-bold uppercase sm:justify-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 dark:bg-blue-950/40 dark:text-blue-300 px-3 py-1 font-bold shadow-2xs">
                NEW: {item.newLeadsToday}
              </span>
              <span className="rounded-full bg-orange-50 text-orange-700 border border-orange-200/70 dark:bg-orange-950/40 dark:text-orange-300 px-3 py-1 font-bold shadow-2xs">
                REMARKS: {item.remarksCount}
              </span>
              <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 dark:bg-indigo-950/40 dark:text-indigo-300 px-3 py-1 font-bold shadow-2xs">
                BILLED: {formatCurrency(item.billedTodayTotal || 0)}
              </span>
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 px-3 py-1 font-bold shadow-2xs">
                PAID: {formatCurrency(item.feesUpdatedToday)}
              </span>
              <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200/70 dark:bg-purple-950/40 dark:text-purple-300 px-3 py-1 font-bold shadow-2xs">
                REMINDERS: {totalReminderCount} | DONE: {matchedReminderCount}
              </span>
            </div>

            <div className={`w-8 h-8 rounded-full ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'} flex items-center justify-center transition-all shrink-0`}>
              {isExpanded ? <Icons.ChevronDown className="h-4 w-4" /> : <Icons.ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/50 space-y-5">
            {/* Top Grid: 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 1. New Leads */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Icons.User className="w-3.5 h-3.5 text-blue-600" /> New Leads ({item.newLeadsDetails.length})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">New</span>
                </div>
                {item.newLeadsDetails.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No new leads</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.newLeadsDetails.map((lead, idx) => (
                      <li key={`${lead.userNumber}-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60 hover:border-slate-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{lead.userName}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(lead.datecreated)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{lead.userNumber}</span>
                          <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer">
                            <Icons.WhatsApp className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. New Leads Remarks Today */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Icons.Chat className="w-3.5 h-3.5 text-orange-600" /> New Remarks ({item.newLeadsRemarksToday.length})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">Remarks</span>
                </div>
                {item.newLeadsRemarksToday.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No remarks on new leads</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.newLeadsRemarksToday.map((entry, idx) => {
                      const firstRemark = entry.remarks[0];
                      const diff = entry.datecreated && firstRemark ? timeDiffLabel(entry.datecreated, firstRemark.timestamp) : '';
                      return (
                        <li key={`${entry.userNumber}-new-remark-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60 flex gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.userName}</p>
                              {entry.datecreated && <span className="text-[10px] text-slate-400">{formatDateTime(entry.datecreated)}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{entry.userNumber}</span>
                              <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (entry.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer">
                                <Icons.WhatsApp className="w-3.5 h-3.5" />
                              </span>
                            </div>
                            {entry.remarks.map(remark => (
                              <div key={remark._id} className="mt-1.5 border-t border-slate-200 dark:border-slate-700 pt-1.5">
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{remark.remark}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDateTime(remark.timestamp)}</p>
                              </div>
                            ))}
                          </div>
                          {diff && (
                            <div className="shrink-0 flex flex-col items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 px-2 py-1 text-center min-w-[56px] self-start">
                              <p className="text-[9px] font-bold text-orange-500 uppercase tracking-wide leading-tight">Time<br/>Missed</p>
                              <p className="text-xs font-black text-orange-600 mt-0.5">{diff}</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* 3. New Leads Without Remarks */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Icons.Phone className="w-3.5 h-3.5 text-rose-600" /> Not Contacted ({item.newLeadsWithoutRemarks.length})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">Pending</span>
                </div>
                {item.newLeadsWithoutRemarks.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-3 text-center">None</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.newLeadsWithoutRemarks.map((lead, idx) => {
                      const waitDiff = timeDiffLabel(lead.datecreated, new Date().toISOString());
                      return (
                        <li key={`${lead.userNumber}-without-remark-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{lead.userName}</p>
                            {waitDiff && <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60">{waitDiff} wait</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{lead.userNumber}</span>
                            <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer">
                              <Icons.WhatsApp className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(lead.datecreated)}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Bottom Grid: 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 4. Old Leads Remarks Today */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Old Leads Remarks ({item.oldLeadsRemarksToday.length})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Follow-up</span>
                </div>
                {item.oldLeadsRemarksToday.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No remarks on old leads</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.oldLeadsRemarksToday.map((entry, idx) => (
                      <li key={`${entry.userNumber}-old-remark-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.userName}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{entry.userNumber}</span>
                            <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (entry.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer">
                              <Icons.WhatsApp className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                        {entry.remarks.map(remark => (
                          <div key={remark._id} className="mt-1.5 border-t border-slate-200 dark:border-slate-700 pt-1.5">
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{remark.remark}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDateTime(remark.timestamp)}</p>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 5. Remarks Details */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Remarks Details ({item.remarksDetails.length})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">All Remarks</span>
                </div>
                {item.remarksDetails.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No remarks today</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.remarksDetails.map((entry, idx) => (
                      <li key={`${entry.userNumber}-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.userName}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{entry.userNumber}</span>
                            <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (entry.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer">
                              <Icons.WhatsApp className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                        {entry.remarks.map(remark => (
                          <p key={remark._id} className="mt-1 text-xs text-slate-700 dark:text-slate-300">{remark.remark}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 6. Fees Billed & Paid Today */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Fees Activity ({item.feeDetails.length})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Finance</span>
                </div>
                {item.feeDetails.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No fee activity today</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {item.feeDetails.map((fee, idx) => (
                      <li key={`${fee.userNumber}-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{fee.userName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{fee.userNumber}</span>
                              <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (fee.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer">
                                <Icons.WhatsApp className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            {fee.billedAmount ? <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Billed: {formatCurrency(fee.billedAmount)}</span> : null}
                            {fee.paidAmount > 0 ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Paid: {formatCurrency(fee.paidAmount)}</span> : null}
                          </div>
                        </div>
                        {fee.installments.length > 0 && fee.installments.map((inst: DailyReportFeeInstallment, i: number) => (
                          <div key={i} className="mt-1.5 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Installment #{inst.number}</p>
                              {inst.dueDate && <p className="text-[10px] text-slate-400">Due: {new Date(`${inst.dueDate}`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                            </div>
                            <p className="font-bold text-emerald-600">{formatCurrency(inst.amount)}</p>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Reminders section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <button type="button" onClick={() => toggleReminder(item.username)} className="flex w-full items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Today's Reminders ({totalReminderCount})
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Schedule</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  {isReminderExpanded(item.username) ? <Icons.ChevronDown className="h-3.5 w-3.5" /> : <Icons.ChevronRight className="h-3.5 w-3.5" />}
                </div>
              </button>
              {isReminderExpanded(item.username) && (!item.remindersTodayDetails || item.remindersTodayDetails.length === 0) ? (
                <p className="text-xs italic text-slate-400 pt-3 text-center">No reminders today</p>
              ) : isReminderExpanded(item.username) ? (
                <ul className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {item.remindersTodayDetails.map((reminder, idx) => (
                    <li key={`${reminder.userNumber}-reminder-${idx}`} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{reminder.userName}</p>
                          <span className="text-xs text-slate-500 font-medium">{reminder.userNumber}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="rounded-md bg-purple-100 px-2 py-0.5 font-bold text-purple-700">{reminder.status}</span>
                          <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-bold text-indigo-700">{reminder.pipeline}</span>
                          <span className="text-slate-400 font-medium">{formatDateTime(reminder.reminder)}</span>
                        </div>
                      </div>
                      {item.remarksDetails.some(e => normalize(e.userNumber) === normalize(reminder.userNumber) || normalize(e.userName) === normalize(reminder.userName)) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-xs font-bold text-emerald-700 shrink-0">
                          <Icons.Check className="h-3 w-3" /> Completed
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 shrink-0">
                          Pending
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  };
return (
  <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 min-h-screen relative bg-slate-50 dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 transition-colors pb-36 sm:pb-48">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Report</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Overview of daily counselor activity, remarks, billed & collections</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && tabSwitcher}
          {activeViewMode === 'daily' ? (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <input
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={handleDateChange}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
              />
            </div>
          ) : monthYearControls}
        </div>
      </div>

      {/* ── DAILY VIEW ──────────────────────────────────────────────────────── */}
      {activeViewMode === 'daily' && (
        <>
          {/* Top Summary Cards */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>}
                iconBg="bg-blue-500"
                value={totals.users}
                label="Counselors"
                subLabel="Users Report"
                subIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>}
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>}
                iconBg="bg-rose-400"
                value={totals.newLeads}
                label="Leads"
                subLabel="New Leads"
                subIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                subIconColor="text-rose-400"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>}
                iconBg="bg-amber-400"
                value={totals.remarks}
                label="Remarks"
                subLabel="Remarks Today"
                subIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>}
                subIconColor="text-amber-500"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>}
                iconBg="bg-purple-500"
                value={totals.reminders}
                label="Reminder"
                subLabel="Reminder Today"
                subIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                subIconColor="text-purple-500"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M6 8h12m-12 5 8.5 8M6 13h3m0 0c6.667 0 6.667-10 0-10"></path></svg>}
                iconBg="bg-cyan-500"
                value={totals.billed}
                label="Billed"
                subLabel="Fees Billed Today"
                subIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>}
                subIconColor="text-cyan-500"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>}
                iconBg="bg-emerald-500"
                value={totals.fees}
                label="Paid"
                subLabel="Fees Paid Today"
                subIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                subIconColor="text-emerald-500"
              />
            </div>
          )}

          {!loading && !isAdmin && !error && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Today Achievement</p>
                  <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{myDailyAchievement}%</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-700 dark:text-emerald-300">
                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Amount Paid Today</p>
                    <p className="mt-1 text-xl font-bold">{formatCurrency(myDailyPaid)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-slate-700 dark:text-slate-300">
                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Target</p>
                    <p className="mt-1 text-xl font-bold">{myTarget > 0 ? formatCurrency(myTarget) : 'Not Set'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <AchievementBar paid={myDailyPaid} target={myTarget} />
              </div>
            </div>
          )}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>}

          <div className="space-y-4">
            {loading && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400 shadow-xs flex items-center justify-center gap-2">
                <Icons.RefreshCcw className="w-4 h-4 animate-spin text-blue-600" /> Loading daily report...
              </div>
            )}
            {isAdmin && rows.map(item => renderDailyCard(item))}
            {!loading && isAdmin && rows.length === 0 && !error && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No report data available for the selected date.</p>
              </div>
            )}
          </div>
          {/* Bottom spacer for generous breathing room */}
          <div className="h-20 sm:h-28 w-full" aria-hidden="true" />
        </>
      )}

      {/* ── RIGHT-SIDE SLIDE-OVER POPUP ───────────────────────────────────── */}
      {activeUserPopup && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end animate-fadeIn">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setActiveUserPopup(null)} />

          {/* Drawer Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 overflow-hidden border-l border-slate-100 dark:border-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center text-lg font-bold">
                  {activeUserPopup.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{activeUserPopup.username}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Counselor</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveUserPopup(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* Popup Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
              
              {/* Section Header */}
              <div>
                <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs py-2 px-4 rounded-xl text-center mb-4 tracking-wide shadow-2xs">
                  New Leads
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Leads Column */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Leads:</p>
                    <div className="space-y-2.5">
                      {activeUserPopup.newLeadsDetails.length === 0 ? (
                        <p className="text-xs italic text-slate-400">No leads</p>
                      ) : (
                        activeUserPopup.newLeadsDetails.map((lead, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-50 dark:border-slate-200 shadow-2xs">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{lead.userName}</p>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">{lead.userNumber}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(lead.datecreated)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Remarks Column */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Remarks:</p>
                    <div className="space-y-2.5">
                      {activeUserPopup.newLeadsRemarksToday.length === 0 ? (
                        <p className="text-xs italic text-slate-400">No remarks</p>
                      ) : (
                        activeUserPopup.newLeadsRemarksToday.map((entry, idx) => {
                          const firstRemark = entry.remarks[0];
                          const diff = entry.datecreated && firstRemark ? timeDiffLabel(entry.datecreated, firstRemark.timestamp) : '';
                          return (
                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-50 dark:border-slate-200 shadow-2xs flex gap-2 justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.userName}</p>
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">{entry.userNumber}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDateTime(entry.datecreated)}</p>
                                {entry.remarks.map(r => (
                                  <p key={r._id} className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-tight">
                                    {r.remark}
                                  </p>
                                ))}
                              </div>
                              {diff && (
                                <div className="shrink-0 bg-amber-100/70 dark:bg-amber-950/60 border border-amber-50 dark:border-amber-200 text-amber-700 dark:text-amber-300 rounded-xl px-2 py-2 flex flex-col items-center justify-center text-center min-w-[50px] h-fit">
                                  <span className="text-[9px] font-bold leading-tight uppercase">Time<br/>Missed</span>
                                  <span className="text-xs font-bold text-amber-800 dark:text-amber-200 mt-1">{diff}</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* No Remarks Column */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">No Remarks:</p>
                    <div className="space-y-2.5">
                      {activeUserPopup.newLeadsWithoutRemarks.length === 0 ? (
                        <p className="text-xs italic text-slate-400">None</p>
                      ) : (
                        activeUserPopup.newLeadsWithoutRemarks.map((lead, idx) => {
                          const waitDiff = timeDiffLabel(lead.datecreated, new Date().toISOString());
                          return (
                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-50 dark:border-slate-200 shadow-2xs space-y-1.5">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{lead.userName}</p>
                              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{lead.userNumber}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(lead.datecreated)}</p>
                              {waitDiff && (
                                <span className="inline-block bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 border border-rose-50 dark:border-rose-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                  {waitDiff} not contacted
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Old Leads Section */}
              <div className="pt-2">
                <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs py-2 px-4 rounded-xl text-center mb-4 tracking-wide shadow-2xs">
                  Old Leads / Reminders Activity
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Old Leads Remarks */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-50 dark:border-slate-200 shadow-2xs">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Old Leads Remarks:</p>
                    {activeUserPopup.oldLeadsRemarksToday.length === 0 ? (
                      <p className="text-xs italic text-slate-400">No remarks today</p>
                    ) : (
                      <div className="space-y-2">
                        {activeUserPopup.oldLeadsRemarksToday.map((entry, idx) => (
                          <div key={idx} className="border-b border-slate-50 dark:border-slate-200 last:border-0 pb-2 last:pb-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.userName}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{entry.userNumber}</p>
                            {entry.remarks.map(r => (
                              <p key={r._id} className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{r.remark}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fee Collections */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-50 dark:border-slate-200 shadow-2xs">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Fees Activity:</p>
                    {activeUserPopup.feeDetails.length === 0 ? (
                      <p className="text-xs italic text-slate-400">No fee updates</p>
                    ) : (
                      <div className="space-y-2">
                        {activeUserPopup.feeDetails.length > 0 && activeUserPopup.feeDetails.map((fee, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100">{fee.userName}</p>
                              <p className="text-[10px] text-slate-400">{fee.userNumber}</p>
                            </div>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                              {formatCurrency(fee.paidAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW ────────────────────────────────────────────────────── */}
      {activeViewMode === 'monthly' && (
        <>
          {isAdmin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>}
                iconBg="bg-blue-500"
                value={monthlyRowsWithPaid.length}
                label="Counsellors"
                subLabel="Total Active"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>}
                iconBg="bg-rose-400"
                value={monthlyTotals.newLeads}
                label="Leads"
                subLabel="New Leads"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>}
                iconBg="bg-amber-400"
                value={monthlyTotals.remarks}
                label="Remarks"
                subLabel="Total Remarks"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M6 8h12m-12 5 8.5 8M6 13h3m0 0c6.667 0 6.667-10 0-10"></path></svg>}
                iconBg="bg-cyan-500"
                value={formatCurrency(monthlyTotals.billed)}
                label="Billed"
                subLabel="Fees Billed"
              />
              <SummaryCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>}
                iconBg="bg-emerald-500"
                value={formatCurrency(monthlyTotals.paid)}
                label="Paid"
                subLabel="Fees Paid"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Monthly Achievement</p>
                    <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{myMonthlyAchievement}%</p>
                    {!myTarget && <p className="mt-1 text-sm font-semibold text-slate-400">Target not set</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-700 dark:text-emerald-300">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Amount Paid</p>
                      <p className="mt-1 text-xl font-bold">{formatCurrency(myPaid)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-slate-700 dark:text-slate-300">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Target</p>
                      <p className="mt-1 text-xl font-bold">{myTarget > 0 ? formatCurrency(myTarget) : 'Not Set'}</p>
                    </div>
                  </div>
                </div>
                <AchievementBar paid={myPaid} target={myTarget} />
              </div>
            </div>
          )}

          {monthlyError && <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">{monthlyError}</div>}

          {monthlyLoading && (
            <div className="flex items-center justify-center py-12">
              <Icons.RefreshCcw className="h-6 w-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">Loading...</span>
            </div>
          )}

          {!monthlyLoading && isAdmin && monthlyRows.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">View Counsellor</label>
                <select value={selectedCounsellor || ''} onChange={e => setSelectedCounsellor(e.target.value || null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs">
                  <option value="">All Counsellors</option>
                  {monthlyRowsWithPaid.map(r => <option key={r.username} value={r.username}>{r.username}</option>)}
                </select>
              </div>

              {selectedCounsellor ? (() => {
                const row = monthlyRowsWithPaid.find(r => r.username === selectedCounsellor)!;
                const others: MonthlyReportItem = {
                  username: 'Others',
                  newLeads: monthlyTotals.newLeads - row.newLeads,
                  totalRemarks: monthlyTotals.remarks - row.totalRemarks,
                  feesUpdated: monthlyTotals.fees - row.feesUpdated,
                  totalBilled: monthlyTotals.billed - row.totalBilled,
                  totalPaid: monthlyTotals.paid - getMonthlyPaidAmount(row),
                };
                const hasOthers = others.newLeads > 0 || others.totalRemarks > 0 || others.totalBilled > 0 || getMonthlyPaidAmount(others) > 0;
                const spotData: MonthlyReportItem[] = [row, ...(hasOthers ? [others] : [])];
                const rowTarget = getTarget(selectedCounsellor);
                const rowPaid = getMonthlyPaidAmount(row);
                return (
                  <div className="rounded-2xl border-2 border-blue-50 dark:border-blue-300 bg-blue-50 dark:bg-blue-950/20 p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedCounsellor}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Monthly Report — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                      </div>
                      <button onClick={() => setSelectedCounsellor(null)} className="rounded-full p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-500">
                        <Icons.X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <SummaryCard
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>}
                        iconBg="bg-blue-500"
                        value={row.newLeads}
                        label="Leads"
                        subLabel="New Leads"
                      />
                      <SummaryCard
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>}
                        iconBg="bg-amber-400"
                        value={row.totalRemarks}
                        label="Remarks"
                        subLabel="Total Remarks"
                      />
                      <SummaryCard
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M6 8h12m-12 5 8.5 8M6 13h3m0 0c6.667 0 6.667-10 0-10"></path></svg>}
                        iconBg="bg-cyan-500"
                        value={formatCurrency(row.totalBilled)}
                        label="Billed"
                        subLabel="Fees Billed"
                      />
                      <SummaryCard
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>}
                        iconBg="bg-emerald-500"
                        value={formatCurrency(rowPaid)}
                        label="Paid"
                        subLabel="Fees Paid"
                      />
                    </div>
                    {rowTarget > 0 && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Target Achievement</p>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Target: {formatCurrency(rowTarget)}</span>
                        </div>
                        <AchievementBar paid={rowPaid} target={rowTarget} />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(['newLeads','totalRemarks','totalBilled','totalPaid'] as PieMetric[]).map((metric, i) => (
                        <div key={metric} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                          <DonutChart data={spotData} metric={metric}
                            label={['New Leads Share','Remarks Share','Fees Billed Share','Fees Paid Share'][i]}
                            formatter={i >= 2 ? formatCurrency : undefined} />
                        </div>
                      ))}
                    </div>
                    <div>
                      {counsellorPipelineLoading && (
                        <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 shadow-sm">
                          <Icons.RefreshCcw className="mr-2 h-4 w-4 animate-spin text-slate-400" /> Loading enrolled breakdown...
                        </div>
                      )}
                      {!counsellorPipelineLoading && counsellorPipelineError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-4 text-sm font-semibold text-red-600">{counsellorPipelineError}</div>
                      )}
                      {!counsellorPipelineLoading && !counsellorPipelineError && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                            <DistributionDonutChart data={counsellorPipelineBySource} label="Enrolled by Lead Source" />
                          </div>
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                            <DistributionDonutChart data={counsellorPipelineByCourse} label="Enrolled by Course" />
                          </div>
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                            <DistributionDonutChart data={counsellorPipelineQualifiedVsResponded} label="Enrolled from Qualified vs Responded" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <p className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Counsellor Performance — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                    </p>
                    <GroupedBarChart data={monthlyRowsWithPaid} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(['newLeads','totalRemarks','totalBilled','totalPaid'] as PieMetric[]).map((metric, i) => (
                      <div key={metric} className="rounded-2xl border border-slate-50 dark:border-slate-100 bg-white dark:bg-slate-900 p-4 shadow-sm">
                        <DonutChart data={monthlyRowsWithPaid} metric={metric}
                          label={['New Leads Share','Remarks Share','Fees Billed Share','Fees Paid Share'][i]}
                          formatter={i >= 2 ? formatCurrency : undefined} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!selectedCounsellor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <DistributionDonutChart data={pipelineBySource} label="Enrolled by Lead Source" />
                  </div>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <DistributionDonutChart data={pipelineByCourse} label="Enrolled by Course" />
                  </div>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <DistributionDonutChart data={pipelineQualifiedVsResponded} label="Enrolled from Qualified vs Responded" />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden pb-4">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Monthly Summary Table</p>
                  <p className="text-xs text-slate-400 italic">Click target cell to edit</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-2.5 text-left">Counsellor</th>
                        <th className="px-4 py-2.5 text-right">New Leads</th>
                        <th className="px-4 py-2.5 text-right">Remarks</th>
                        <th className="px-4 py-2.5 text-right">Monthly Billed</th>
                        <th className="px-4 py-2.5 text-right">Amount Paid</th>
                        <th className="px-4 py-2.5 text-right">Target</th>
                        <th className="px-4 py-2.5 text-right">Achievement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRowsWithPaid.map((row, idx) => {
                        const rowTarget = getTarget(row.username);
                        const rowPaid = getMonthlyPaidAmount(row);
                        const isEditingThisRow = editingTargetUsername === row.username;
                        return (
                          <tr key={row.username} onClick={() => !isEditingThisRow && toggleCounsellor(row.username)}
                            className={`border-b border-slate-50 dark:border-slate-50 cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-slate-200 ${selectedCounsellor === row.username ? 'bg-blue-50 dark:bg-blue-950/30' : idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}>
                            <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                              <span className="flex items-center gap-2">
                                {row.username}
                                {selectedCounsellor === row.username && (
                                  <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">selected</span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">{row.newLeads}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span className="rounded-full bg-orange-100 dark:bg-orange-950 px-2 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">{row.totalRemarks}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-indigo-700 dark:text-indigo-400">{formatCurrency(row.totalBilled)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(rowPaid)}</td>
                            <td className="px-4 py-2.5 text-right" onClick={e => { e.stopPropagation(); if (!isEditingThisRow) startEditTarget(row.username); }}>
                              {isEditingThisRow ? (
                                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <input autoFocus type="number" min={0} value={editingTargetValue}
                                    onChange={e => setEditingTargetValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveTarget(row.username); if (e.key === 'Escape') cancelEditTarget(); }}
                                    className="w-28 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-800 dark:text-slate-100" />
                                  <button onClick={() => saveTarget(row.username)} disabled={savingTarget} className="rounded p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950" title="Save">
                                    <Icons.Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={cancelEditTarget} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Cancel">
                                    <Icons.X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 cursor-pointer group">
                                  <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                                    {rowTarget > 0 ? formatCurrency(rowTarget) : <span className="text-slate-400 italic text-xs">Set target</span>}
                                  </span>
                                  <Icons.Edit className="h-3 w-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <AchievementBar paid={rowPaid} target={rowTarget} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-800 dark:text-slate-100">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-400">{monthlyTotals.newLeads}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-orange-600 dark:text-orange-400">{monthlyTotals.remarks}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-indigo-700 dark:text-indigo-400">{formatCurrency(monthlyTotals.billed)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(monthlyTotals.paid)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {(() => { const t = targets.reduce((s, x) => s + (x.target || 0), 0); return t > 0 ? formatCurrency(t) : '—'; })()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {(() => { const t = targets.reduce((s, x) => s + (x.target || 0), 0); return <AchievementBar paid={monthlyTotals.paid} target={t} />; })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!monthlyLoading && isAdmin && monthlyRows.length === 0 && !monthlyError && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <p className="text-slate-500 dark:text-slate-400">No activity data for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyReportView;