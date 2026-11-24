import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { WhatsAppBillingSummaryResponse } from '../../types';
import { Icons } from '../Icons';

// ─── Helpers ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];
const daysAgoStr = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0);

const makeMoney = (currency: string) => (value: number) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing',
  MARKETING_LITE: 'Marketing Lite',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
  AUTHENTICATION_INTERNATIONAL: 'Authentication (Intl.)',
  SERVICE: 'Service',
  REFERRAL_CONVERSION: 'Referral Conversion',
};

const PRICING_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Billable',
  FREE_CUSTOMER_SERVICE: 'Free (customer service)',
  FREE_ENTRY_POINT: 'Free (entry point)',
};

const categoryLabel = (c: string) => CATEGORY_LABELS[c] || c || '-';

const CountCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className={`rounded-2xl border border-current/10 p-4 ${color}`}>
    <p className="text-[11px] font-black uppercase tracking-wider opacity-70">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
  </div>
);

const DailyCostChart = ({ data, money }: { data: { date: string; cost: number }[]; money: (n: number) => string }) => {
  if (!data.length) return null;
  const maxVal = Math.max(0.01, ...data.map(d => d.cost));
  const svgW = 760, svgH = 260;
  const ml = 56, mr = 16, mt = 16, mb = 32;
  const chartW = svgW - ml - mr;
  const chartH = svgH - mt - mb;
  const slot = chartW / data.length;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 8));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: maxVal * t, y: chartH - t * chartH }));

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
      <g transform={`translate(${ml},${mt})`}>
        {yTicks.map(({ v, y }) => (
          <g key={y}>
            <line x1={0} y1={y} x2={chartW} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{v.toFixed(v >= 10 ? 0 : 1)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.cost / maxVal) * chartH;
          const x = i * slot + (slot - barW) / 2;
          return (
            <g key={d.date}>
              <rect x={x} y={chartH - h} width={barW} height={h} rx={2} fill="#22c55e">
                <title>{`${d.date}: ${money(d.cost)}`}</title>
              </rect>
              {i % xLabelEvery === 0 && (
                <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={10} fill="#475569">{d.date.slice(5)}</text>
              )}
            </g>
          );
        })}
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#cbd5e1" strokeWidth={1} />
      </g>
    </svg>
  );
};

export const WhatsAppBillingView: React.FC = () => {
  const [startDate, setStartDate] = useState(daysAgoStr(29));
  const [endDate, setEndDate] = useState(todayStr());

  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('all');
  const [phoneNumbers, setPhoneNumbers] = useState<{ id: string; display_phone_number: string; verified_name?: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState<WhatsAppBillingSummaryResponse | null>(null);

  const currency = summary?.account?.currency || 'INR';
  const money = makeMoney(currency);

  const loadReport = async (phoneId = selectedPhoneId) => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.fetchWhatsAppBillingSummary(startDate, endDate, phoneId);
      if (!data.success) throw new Error('Unable to load WhatsApp pricing');
      setSummary(data);
      if (data.phoneNumbers && data.phoneNumbers.length > 0) {
        setPhoneNumbers(data.phoneNumbers);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load WhatsApp billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiService.fetchWhatsAppAccount().then(res => {
      if (res?.account?.phoneNumbers?.length) {
        setPhoneNumbers(res.account.phoneNumbers);
      }
    }).catch(err => {
      console.warn('Could not prefetch phone numbers:', err);
    });
  }, []);

  useEffect(() => {
    loadReport(selectedPhoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoneId]);

  const selectedPhoneObj = phoneNumbers.find(p => p.id === selectedPhoneId);

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-5">
      {/* Header & Controls Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">WhatsApp Billing</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Meta Cloud API
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {summary?.account?.name ? `${summary.account.name} · ` : ''}
              {selectedPhoneObj ? `${selectedPhoneObj.display_phone_number} · ` : ''}
              {startDate} to {endDate}
            </p>
          </div>

          <a
            href="https://business.facebook.com/latest/billing_hub/payment_activity"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 self-start md:self-auto"
          >
            <span>Balance &amp; payment history on Meta Billing</span>
            <span>↗</span>
          </a>
        </div>

        {/* Toolbar: Pricing Overview Badge + Mobile Number Dropdown + Date Range + Refresh */}
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Section Indicator */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icons.Settings className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pricing Overview</h4>
              <p className="text-[11px] text-slate-400">Message volumes, categories &amp; approximate charges</p>
            </div>
          </div>

          {/* Controls: Phone Dropdown, Date Range, Refresh */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Mobile Number Dropdown */}
            <div className="relative min-w-[200px] sm:min-w-[250px] flex-1 sm:flex-initial">
              <select
                value={selectedPhoneId}
                onChange={(e) => setSelectedPhoneId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors shadow-2xs"
                title="Filter by mobile number"
              >
                <option value="all">📱 All Mobile Numbers</option>
                {phoneNumbers.map((phone) => (
                  <option key={phone.id} value={phone.id}>
                    {phone.display_phone_number || phone.id} {phone.verified_name ? `(${phone.verified_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs in unified container */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 px-2.5 py-1.5 text-xs sm:text-sm shadow-2xs">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-medium focus:outline-none text-xs"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayStr()}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-medium focus:outline-none text-xs"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadReport(selectedPhoneId)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/20 disabled:opacity-60 transition-all shrink-0 cursor-pointer"
            >
              <Icons.RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 flex items-center gap-2">
          <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Icons.RefreshCcw className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500 font-medium text-sm">Loading WhatsApp billing data...</span>
        </div>
      )}

      {!loading && !error && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CountCard label="Total Spend" value={money(summary.totals.cost)} color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
            <CountCard label="Messages" value={formatNumber(summary.totals.volume)} color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" />
            <CountCard label="Billable Messages" value={formatNumber(summary.totals.billableVolume)} color="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" />
            <CountCard label="Avg. Cost / Billable" value={money(summary.totals.avgCostPerBillable)} color="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Daily Spend</p>
            {summary.daily.length === 0
              ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  No billing activity recorded for {selectedPhoneObj?.display_phone_number || 'the selected filter'} in this date range.
                </div>
              )
              : <DailyCostChart data={summary.daily} money={money} />}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Messages</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Avg. / Message</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCategory.map(row => (
                  <tr key={`${row.category}-${row.pricingType}`} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{categoryLabel(row.category)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{PRICING_TYPE_LABELS[row.pricingType] || row.pricingType}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatNumber(row.volume)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(row.cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{row.volume ? money(row.cost / row.volume) : '-'}</td>
                  </tr>
                ))}
                {summary.byCategory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic">
                      No billing activity recorded for {selectedPhoneObj?.display_phone_number || 'the selected filter'} in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Costs are approximate, as reported by Meta, and may differ slightly from the final invoice.</p>
        </div>
      )}
    </div>
  );
};

export default WhatsAppBillingView;
