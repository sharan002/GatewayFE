import React, { useEffect, useState, useMemo } from 'react';
import { apiService } from '../../services/api';
import { WaTemplate, WaTemplateAnalytics, WaTemplateDailyPoint } from '../../types';
import { Icons } from '../Icons';

interface Props {
  templateId: string;
  onBack: () => void;
  onEdit?: (template: WaTemplate) => void;
  onDuplicate?: (template: WaTemplate) => void;
  onSendTest?: (template: WaTemplate) => void;
  onViewAccountInsights?: () => void;
}

export const TemplateDetailsView: React.FC<Props> = ({
  templateId,
  onBack,
  onEdit,
  onDuplicate,
  onSendTest,
  onViewAccountInsights,
}) => {
  const [template, setTemplate] = useState<WaTemplate | null>(null);
  const [analytics, setAnalytics] = useState<WaTemplateAnalytics | null>(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [perfTab, setPerfTab] = useState<'trend' | 'funnel'>('trend');
  const [errorTab, setErrorTab] = useState<'top' | 'all'>('top');
  const [analyticsNotice, setAnalyticsNotice] = useState<string | null>(null);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredErrorIdx, setHoveredErrorIdx] = useState<number | null>(null);

  const loadData = async (days = rangeDays) => {
    try {
      setLoading(true);
      setError(null);

      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - days);

      const res = await apiService.fetchWhatsAppTemplateAnalytics(templateId, {
        startDate: startD.toISOString().split('T')[0],
        endDate: endD.toISOString().split('T')[0],
      });

      setTemplate(res.template);
      setAnalytics(res.analytics);
      setDateRange(res.dateRange);
      setAnalyticsNotice(res.analyticsError || null);
    } catch (err: any) {
      console.error('Failed to load template analytics:', err);
      setError(err.message || 'Failed to load template details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(rangeDays);
  }, [templateId, rangeDays]);

  const handleCopyMetaId = (id?: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getBodyText = (tpl: WaTemplate): string => {
    const bodyComp = tpl.components?.find(c => c.type === 'BODY');
    if (!bodyComp?.text) return '-';
    let text = bodyComp.text;
    const samples = bodyComp.example?.body_text?.[0] || [];
    samples.forEach((val: string, idx: number) => {
      text = text.replaceAll(`{{${idx + 1}}}`, val || `[Sample ${idx + 1}]`);
    });
    return text;
  };

  const readRate = useMemo(() => {
    if (!analytics || !analytics.delivered) return 0;
    return Math.round((analytics.read / analytics.delivered) * 100);
  }, [analytics]);

  const deliveryRate = useMemo(() => {
    if (!analytics || !analytics.sent) return 0;
    return Math.round((analytics.delivered / analytics.sent) * 100);
  }, [analytics]);

  // Max value calculation for trend chart scaling
  const maxMetricValue = useMemo(() => {
    if (!analytics?.dailyPoints?.length) return 10;
    const vals = analytics.dailyPoints.flatMap(p => [p.sent, p.delivered, p.read, p.replied]);
    return Math.max(...vals, 5);
  }, [analytics]);

  const maxErrorValue = useMemo(() => {
    if (!analytics?.dailyPoints?.length) return 2;
    const vals = analytics.dailyPoints.map(p => p.undelivered);
    return Math.max(...vals, 2);
  }, [analytics]);

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <span>←</span>
            <span>Back to Templates</span>
          </button>

          {/* Date range picker selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Date range:</span>
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value={7}>
                {dateRange.startDate && dateRange.endDate
                  ? `Auto-detected: ${new Date(dateRange.startDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(dateRange.endDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : 'Auto-detected: Last 7 Days'}
              </option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>

        {analyticsNotice && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
            <Icons.AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Meta Analytics Notice: {analyticsNotice}</span>
          </div>
        )}

        {/* Template Title Banner */}
        {template && (
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Icons.PendingAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {template.name} · {template.language}
                  </h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {template.status === 'APPROVED' ? 'Active - Quality pending' : template.status}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{template.category}</span>
                  <span>•</span>
                  <span>
                    Updated on{' '}
                    {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently'}
                  </span>
                  {template.metaId && (
                    <>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => handleCopyMetaId(template.metaId)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-blue-600 transition-colors"
                        title="Copy Meta Template ID"
                      >
                        <span>ID: {template.metaId}</span>
                        <span>{copiedId ? '✓' : '📋'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              {onSendTest && (
                <button
                  type="button"
                  onClick={() => onSendTest(template)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Icons.Send className="w-3.5 h-3.5" />
                  <span>Send test</span>
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  disabled={template.status === 'PENDING'}
                  onClick={() => onEdit(template)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  <Icons.Edit className="w-3.5 h-3.5" />
                  <span>Edit template</span>
                </button>
              )}

              {onDuplicate && (
                <button
                  type="button"
                  onClick={() => onDuplicate(template)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                  title="Duplicate Template"
                >
                  Duplicate
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Meta Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
        <Icons.AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">This template was edited during the selected date range. </span>
          <span className="text-amber-800/90 dark:text-amber-300/90">
            Insights show the total engagement for all versions of this message template in the date range that you selected.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
          <Icons.AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Icons.RefreshCcw className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-sm font-semibold">Loading Meta template performance & spend data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left Column: Template Visual Preview & Account Summary ── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card: Your template preview */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Your template</h3>

              {template && (
                <div className="p-4 rounded-2xl bg-[#EFEAE2] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl rounded-tl-sm shadow-sm space-y-2.5">
                    {/* Header */}
                    {template.components?.some(c => c.type === 'HEADER') && (
                      <div className="pb-1.5 border-b border-slate-100 dark:border-slate-800 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                        {template.components.find(c => c.type === 'HEADER')?.format === 'TEXT'
                          ? template.components.find(c => c.type === 'HEADER')?.text
                          : `[Header Media: ${template.components.find(c => c.type === 'HEADER')?.format}]`}
                      </div>
                    )}

                    {/* Body */}
                    <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {getBodyText(template)}
                    </div>

                    {/* Footer */}
                    {template.components?.some(c => c.type === 'FOOTER') && (
                      <div className="text-[11px] text-slate-400 pt-1">
                        {template.components.find(c => c.type === 'FOOTER')?.text}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 text-right pt-0.5">
                      12:00 PM <span className="text-blue-500 font-bold">✓✓</span>
                    </div>
                  </div>

                  {/* Buttons */}
                  {template.components?.some(c => c.type === 'BUTTONS') && (
                    <div className="space-y-1.5">
                      {template.components
                        .find(c => c.type === 'BUTTONS')
                        ?.buttons?.map((btn, idx) => (
                          <div
                            key={idx}
                            className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 text-xs font-bold text-center border border-slate-200/60 dark:border-slate-800 shadow-sm"
                          >
                            {btn.type === 'PHONE_NUMBER' && '📞 '}
                            {btn.type === 'URL' && '🔗 '}
                            {btn.text}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card: See the complete picture */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">See the complete picture</span>
                <span className="text-blue-600 font-bold text-sm">↗</span>
              </div>
              <p className="text-xs text-slate-500">Monitor performance across your account.</p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onViewAccountInsights}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  View account insights
                </button>
              </div>
            </div>

            {/* Card: Top block reason */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                <span>Top block reason</span>
                <span className="text-slate-400 cursor-help" title="Top customer blocking reasons for this template">ⓘ</span>
              </div>
              <div className="text-[11px] text-slate-400">Last 7 days</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 pt-1">--</div>
            </div>
          </div>

          {/* ── Right Column: Spend, Performance & Errors ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Top Row: Amount Spent & Cost Per Message Delivered */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Amount spent</span>
                  <span className="text-slate-400 cursor-help" title="Total conversation charges incurred for this template">ⓘ</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  ₹{analytics ? analytics.amountSpent.toFixed(2) : '0.00'}
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Cost per message delivered</span>
                  <span className="text-slate-400 cursor-help" title="Average cost incurred per successfully delivered message">ⓘ</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  ₹{analytics ? analytics.costPerDelivered.toFixed(2) : '0.00'}
                </div>
              </div>
            </div>

            {/* Performance Section */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Performance</h3>
                  <span className="text-slate-400 cursor-help" title="Aggregated message delivery, reads, and replies">ⓘ</span>
                </div>

                <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPerfTab('trend')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      perfTab === 'trend'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Trend
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfTab('funnel')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      perfTab === 'funnel'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Funnel
                  </button>
                </div>
              </div>

              {/* 4 Metric Boxes Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Messages sent</span>
                    <span className="text-[11px] text-slate-400">ⓘ</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {analytics?.sent || 0}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Messages delivered</span>
                    <span className="text-[11px] text-slate-400">ⓘ</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {analytics?.delivered || 0}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Messages read</span>
                    <span className="text-[11px] text-slate-400">ⓘ</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5">
                    <span>{analytics?.read || 0}</span>
                    <span className="text-xs font-bold text-slate-400">({readRate}%)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Unique replies</span>
                    <span className="text-[11px] text-slate-400">ⓘ</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {analytics?.replied || 0}
                  </div>
                </div>
              </div>

              {/* Performance Trend Chart */}
              {perfTab === 'trend' ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-500">Timeline Activity</div>
                    <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      4 metrics selected
                    </span>
                  </div>

                  {/* SVG Multi-Line Chart */}
                  <div className="relative w-full pt-1">
                    {/* Hover Floating Tooltip */}
                    {hoveredTrendIdx !== null && analytics?.dailyPoints?.[hoveredTrendIdx] && (
                      <div
                        className="absolute -top-3 z-30 pointer-events-none transform -translate-x-1/2 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white rounded-xl shadow-xl p-2.5 text-xs space-y-1 min-w-[170px] border border-slate-700/80"
                        style={{
                          left: `${Math.max(12, Math.min(88, ((36 + (hoveredTrendIdx / Math.max(1, (analytics.dailyPoints.length - 1))) * (760 - 36 - 24)) / 760) * 100))}%`,
                        }}
                      >
                        <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between">
                          <span>{analytics.dailyPoints[hoveredTrendIdx].date}</span>
                          {analytics.dailyPoints[hoveredTrendIdx].cost > 0 && (
                            <span className="text-emerald-400 font-mono text-[10px]">₹{analytics.dailyPoints[hoveredTrendIdx].cost}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-0.5">
                          <div className="flex items-center gap-1.5 text-rose-300">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span>Sent: <strong>{analytics.dailyPoints[hoveredTrendIdx].sent}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-purple-300">
                            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                            <span>Deliv: <strong>{analytics.dailyPoints[hoveredTrendIdx].delivered}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-teal-300">
                            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                            <span>Read: <strong>{analytics.dailyPoints[hoveredTrendIdx].read}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            <span>Replies: <strong>{analytics.dailyPoints[hoveredTrendIdx].replied}</strong></span>
                          </div>
                        </div>
                      </div>
                    )}

                    <svg viewBox="0 0 760 210" className="w-full h-56 select-none overflow-visible">
                      {(() => {
                        const pts = analytics?.dailyPoints || [];
                        const maxV = Math.max(1, ...pts.flatMap(p => [p.sent, p.delivered, p.read, p.replied]));
                        let maxY = 4;
                        let ticks = [0, 2, 4];
                        if (maxV <= 4) { maxY = 4; ticks = [0, 2, 4]; }
                        else if (maxV <= 8) { maxY = 8; ticks = [0, 2, 4, 6, 8]; }
                        else {
                          const step = Math.ceil(maxV / 4);
                          maxY = step * 4;
                          ticks = [0, step, step * 2, step * 3, step * 4];
                        }

                        const padL = 36, padR = 24, padT = 16, padB = 28;
                        const cW = 760 - padL - padR;
                        const cH = 210 - padT - padB;
                        const N = pts.length;
                        const getX = (i: number) => N <= 1 ? padL + cW / 2 : padL + (i / (N - 1)) * cW;
                        const getY = (val: number) => padT + cH - (val / maxY) * cH;

                        const sentD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.sent).toFixed(1)}`).join(' ');
                        const delivD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.delivered).toFixed(1)}`).join(' ');
                        const readD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.read).toFixed(1)}`).join(' ');
                        const repD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.replied).toFixed(1)}`).join(' ');

                        return (
                          <>
                            {/* Horizontal gridlines and Y labels */}
                            {ticks.map(t => {
                              const y = getY(t);
                              return (
                                <g key={t}>
                                  <line
                                    x1={padL}
                                    y1={y}
                                    x2={padL + cW}
                                    y2={y}
                                    stroke="currentColor"
                                    className="text-slate-200 dark:text-slate-800"
                                    strokeWidth="1"
                                    strokeDasharray={t === 0 ? undefined : "3 3"}
                                  />
                                  <text
                                    x={padL - 10}
                                    y={y + 3.5}
                                    textAnchor="end"
                                    fontSize="10"
                                    className="fill-slate-400 font-semibold"
                                  >
                                    {t}
                                  </text>
                                </g>
                              );
                            })}

                            {/* X-axis date labels */}
                            {pts.map((p, i) => (
                              <text
                                key={i}
                                x={getX(i)}
                                y={padT + cH + 20}
                                textAnchor="middle"
                                fontSize="10"
                                className="fill-slate-400 font-medium"
                              >
                                {p.date}
                              </text>
                            ))}

                            {/* Hover vertical crosshair line */}
                            {hoveredTrendIdx !== null && (
                              <line
                                x1={getX(hoveredTrendIdx)}
                                y1={padT}
                                x2={getX(hoveredTrendIdx)}
                                y2={padT + cH}
                                stroke="#94a3b8"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                              />
                            )}

                            {/* 4 Line paths */}
                            <path d={sentD} fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={delivD} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={readD} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={repD} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Data points & hover zones */}
                            {pts.map((p, i) => {
                              const x = getX(i);
                              const isH = hoveredTrendIdx === i;
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={getY(p.sent)} r={isH ? 4.5 : 3} fill="#ffffff" stroke="#e11d48" strokeWidth="2" />
                                  <circle cx={x} cy={getY(p.delivered)} r={isH ? 4.5 : 3} fill="#ffffff" stroke="#7c3aed" strokeWidth="2" />
                                  <circle cx={x} cy={getY(p.read)} r={isH ? 4.5 : 3} fill="#ffffff" stroke="#0d9488" strokeWidth="2" />
                                  <circle cx={x} cy={getY(p.replied)} r={isH ? 4.5 : 3} fill="#ffffff" stroke="#16a34a" strokeWidth="2" />

                                  <rect
                                    x={x - (cW / Math.max(1, N)) / 2}
                                    y={padT}
                                    width={cW / Math.max(1, N)}
                                    height={cH}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredTrendIdx(i)}
                                    onMouseLeave={() => setHoveredTrendIdx(null)}
                                  />
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-5 text-xs font-semibold flex-wrap pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-600 dark:text-slate-300">Messages sent</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      <span className="text-slate-600 dark:text-slate-300">Messages delivered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                      <span className="text-slate-600 dark:text-slate-300">Messages read</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-600 dark:text-slate-300">Unique replies</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Funnel View */
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-500">Delivery & Engagement Funnel</div>

                  <div className="space-y-3 max-w-lg mx-auto py-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Messages Sent</span>
                        <span>{analytics?.sent || 0} (100%)</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full w-full" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Delivered to Device</span>
                        <span>{analytics?.delivered || 0} ({deliveryRate}%)</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${deliveryRate}%` }}
                          className="h-full bg-purple-600 rounded-full transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Read by Recipient</span>
                        <span>{analytics?.read || 0} ({readRate}%)</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${readRate}%` }}
                          className="h-full bg-teal-500 rounded-full transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Replies Received</span>
                        <span>{analytics?.replied || 0}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${analytics?.replied ? 20 : 0}%` }}
                          className="h-full bg-emerald-500 rounded-full transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error Messages Section */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Error messages</h3>
                    <span className="text-slate-400 cursor-help" title="Meta delivery error and bounce breakdowns">ⓘ</span>
                  </div>
                  <p className="text-xs text-slate-500">Select an error for details.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setErrorTab('top')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        errorTab === 'top'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Top errors
                    </button>
                    <button
                      type="button"
                      onClick={() => setErrorTab('all')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        errorTab === 'all'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      All errors
                    </button>
                  </div>

                  <span className="px-3 py-1 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    Undeliverable messages
                  </span>
                </div>
              </div>

              {/* Error Trend Line Chart */}
              <div className="space-y-4 pt-1">
                <div className="relative w-full pt-1">
                  {/* Hover Tooltip */}
                  {hoveredErrorIdx !== null && analytics?.dailyPoints?.[hoveredErrorIdx] && (
                    <div
                      className="absolute -top-3 z-30 pointer-events-none transform -translate-x-1/2 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white rounded-xl shadow-xl p-2.5 text-xs space-y-1 min-w-[150px] border border-slate-700/80"
                      style={{
                        left: `${Math.max(12, Math.min(88, ((36 + (hoveredErrorIdx / Math.max(1, (analytics.dailyPoints.length - 1))) * (760 - 36 - 24)) / 760) * 100))}%`,
                      }}
                    >
                      <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-1">
                        <span>{analytics.dailyPoints[hoveredErrorIdx].date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-300 text-[11px] pt-0.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <span>Undeliverable: <strong>{analytics.dailyPoints[hoveredErrorIdx].undelivered}</strong></span>
                      </div>
                    </div>
                  )}

                  <svg viewBox="0 0 760 170" className="w-full h-40 select-none overflow-visible">
                    {(() => {
                      const pts = analytics?.dailyPoints || [];
                      const maxErr = Math.max(1, ...pts.map(p => p.undelivered));
                      const maxY = maxErr <= 2 ? 2 : maxErr <= 4 ? 4 : Math.ceil(maxErr);
                      const ticks = maxY === 2 ? [0, 1, 2] : [0, Math.round(maxY / 2), maxY];

                      const padL = 36, padR = 24, padT = 16, padB = 28;
                      const cW = 760 - padL - padR;
                      const cH = 170 - padT - padB;
                      const N = pts.length;
                      const getX = (i: number) => N <= 1 ? padL + cW / 2 : padL + (i / (N - 1)) * cW;
                      const getY = (val: number) => padT + cH - (val / maxY) * cH;

                      const errD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.undelivered).toFixed(1)}`).join(' ');

                      return (
                        <>
                          {/* Horizontal Grid lines & Y-axis labels */}
                          {ticks.map(t => {
                            const y = getY(t);
                            return (
                              <g key={t}>
                                <line
                                  x1={padL}
                                  y1={y}
                                  x2={padL + cW}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-slate-200 dark:text-slate-800"
                                  strokeWidth="1"
                                  strokeDasharray={t === 0 ? undefined : "3 3"}
                                />
                                <text
                                  x={padL - 10}
                                  y={y + 3.5}
                                  textAnchor="end"
                                  fontSize="10"
                                  className="fill-slate-400 font-semibold"
                                >
                                  {t}
                                </text>
                              </g>
                            );
                          })}

                          {/* X-axis date labels */}
                          {pts.map((p, i) => (
                            <text
                              key={i}
                              x={getX(i)}
                              y={padT + cH + 20}
                              textAnchor="middle"
                              fontSize="10"
                              className="fill-slate-400 font-medium"
                            >
                              {p.date}
                            </text>
                          ))}

                          {/* Hover vertical crosshair */}
                          {hoveredErrorIdx !== null && (
                            <line
                              x1={getX(hoveredErrorIdx)}
                              y1={padT}
                              x2={getX(hoveredErrorIdx)}
                              y2={padT + cH}
                              stroke="#ef4444"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                          )}

                          {/* Red Error Line */}
                          <path d={errD} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Dots & hover zones */}
                          {pts.map((p, i) => {
                            const x = getX(i);
                            const y = getY(p.undelivered);
                            const isH = hoveredErrorIdx === i;
                            return (
                              <g key={i}>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isH ? 4.5 : 3}
                                  fill="#ffffff"
                                  stroke="#ef4444"
                                  strokeWidth="2"
                                />
                                <rect
                                  x={x - (cW / Math.max(1, N)) / 2}
                                  y={padT}
                                  width={cW / Math.max(1, N)}
                                  height={cH}
                                  fill="transparent"
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredErrorIdx(i)}
                                  onMouseLeave={() => setHoveredErrorIdx(null)}
                                />
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-700 dark:text-slate-300">Undeliverable messages</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {analytics?.undelivered || 0} total
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TemplateDetailsView;
