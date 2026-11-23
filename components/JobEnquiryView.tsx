import React, { useEffect, useMemo, useState } from 'react';
import { Lead, Remark } from '../types';
import { apiService } from '../services/api';

// Admin-only, read-only window onto the "Looking for job" hand-off queue.

const PAGE_SIZE = 200;

// ─── Local Safe SVG Icons ──────────────────────────────────────────────────
const SvgIcons = {
  UserSearch: (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10" cy="7" r="4" />
      <path d="M10.3 15H6a4 4 0 0 0-4 4v2" />
      <circle cx="17" cy="17" r="3" />
      <path d="m21 21-1.9-1.9" />
    </svg>
  ),
  Briefcase: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  ),
  Users: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Flame: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
  ),
  Sun: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  ),
  Snowflake: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><polyline points="20 16 16 12 20 8"/><polyline points="4 8 8 12 4 16"/><polyline points="16 4 12 8 8 4"/><polyline points="8 20 12 16 16 20"/></svg>
  ),
  ShieldAlert: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  ),
  ArrowUp: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
  ),
  RefreshCcw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
  )
};

const toDate = (v: any): Date | null => {
  const raw = v && typeof v === 'object' && '$date' in v ? v.$date : v;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const fmt = (v: any): string => {
  const d = toDate(v);
  return d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
};

const statusStyle = (status?: string): string => {
  switch ((status || '').toLowerCase()) {
    case 'hot': return 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300';
    case 'warm': return 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300';
    case 'cold': return 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300';
    default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  }
};

const sortedRemarks = (lead: Lead): Remark[] =>
  [...(lead.remarks || [])].sort((a, b) => (toDate(b.timestamp)?.getTime() ?? 0) - (toDate(a.timestamp)?.getTime() ?? 0));

const JobEnquiryView: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const all: Lead[] = [];
      let page = 1;
      while (true) {
        const res = await apiService.queryLeads({ view: 'job-enquiry', page, limit: PAGE_SIZE, includeStats: false, mode: 'summary' });
        if (!res.success) throw new Error('Failed to load job enquiries');
        all.push(...res.leads);
        if (all.length >= (res.total || 0) || res.leads.length === 0) break;
        page++;
      }
      setLeads(all);
    } catch (e: any) {
      setError(e?.message || 'Failed to load job enquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (statusFilter === 'no-remarks') {
        if ((l.remarks || []).length > 0) return false;
      } else if (statusFilter !== 'all' && (l.status || '').toLowerCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (l.userName || '').toLowerCase().includes(q) || (l.userNumber || '').includes(q);
    });
  }, [leads, search, statusFilter]);

  const counts = useMemo(() => ({
    total: leads.length,
    hot: leads.filter(l => (l.status || '').toLowerCase() === 'hot').length,
    warm: leads.filter(l => (l.status || '').toLowerCase() === 'warm').length,
    cold: leads.filter(l => (l.status || '').toLowerCase() === 'cold').length,
    noRemarks: leads.filter(l => !(l.remarks || []).length).length,
  }), [leads]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 transition-colors">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0e7490] dark:text-cyan-300 tracking-tight">Job Enquiry</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Track, Manage &amp; Convert Job Enquiries.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or number"
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-[#0e7490] shadow-2xs w-48 sm:w-56"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none shadow-2xs text-slate-700 dark:text-slate-200 font-bold"
          >
            <option value="all" className="dark:bg-slate-900">All status</option>
            <option value="hot" className="dark:bg-slate-900">Hot</option>
            <option value="warm" className="dark:bg-slate-900">Warm</option>
            <option value="cold" className="dark:bg-slate-900">Cold</option>
            <option value="no-remarks" className="dark:bg-slate-900">No Remarks</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0e7490] hover:bg-[#155e75] text-white rounded-xl disabled:opacity-50 transition shadow-xs hover:shadow"
          >
            <SvgIcons.RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl">{error}</div>}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          {
            key: 'all',
            label: 'Total Leads',
            value: counts.total,
            icon: <SvgIcons.UserSearch className="w-5 h-5 text-[#06b6d4] dark:text-cyan-400" />,
            iconBg: 'bg-[#ecfeff] dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800/80',
            activeBorder: 'border-[#06b6d4] dark:border-cyan-400',
            hoverBorder: 'hover:border-cyan-300 dark:hover:border-cyan-700',
            activeBadge: 'bg-[#ecfeff] dark:bg-cyan-950/60 text-[#0e7490] dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-800',
          },
          {
            key: 'hot',
            label: 'Hot',
            value: counts.hot,
            icon: <SvgIcons.Flame className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
            iconBg: 'bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/40',
            activeBorder: 'border-rose-400 dark:border-rose-500',
            hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-700',
            activeBadge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
          },
          {
            key: 'warm',
            label: 'Warm',
            value: counts.warm,
            icon: <SvgIcons.Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
            iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/40',
            activeBorder: 'border-amber-400 dark:border-amber-500',
            hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
            activeBadge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
          },
          {
            key: 'cold',
            label: 'Cold',
            value: counts.cold,
            icon: <SvgIcons.Snowflake className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
            iconBg: 'bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900/40',
            activeBorder: 'border-sky-400 dark:border-sky-500',
            hoverBorder: 'hover:border-sky-300 dark:hover:border-sky-700',
            activeBadge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800',
          },
          {
            key: 'no-remarks',
            label: 'No Remarks',
            value: counts.noRemarks,
            icon: <SvgIcons.ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
            iconBg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900/40',
            activeBorder: 'border-purple-400 dark:border-purple-500',
            hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-700',
            activeBadge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800',
          },
        ].map(c => {
          const isSelected = statusFilter === c.key;
          return (
            <div
              key={c.key}
              onClick={() => setStatusFilter(isSelected && c.key !== 'all' ? 'all' : c.key)}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${
                isSelected
                  ? `${c.activeBorder} shadow-xs`
                  : `border-slate-200/80 dark:border-slate-800 ${c.hoverBorder}`
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs ${c.iconBg}`}>
                  {c.icon}
                </div>
                {isSelected && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${c.activeBadge}`}>
                    Active
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {c.value}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Students</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {c.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[700px]">
            {/* Soft cyan table header banner */}
            <thead>
              <tr className="bg-[#ecfeff] dark:bg-cyan-950/40 text-[#0e7490] dark:text-cyan-300 text-xs font-bold uppercase tracking-wider border-b border-cyan-200/70 dark:border-cyan-900/60">
                <th className="px-6 py-3.5">Candidate</th>
                <th className="px-6 py-3.5">Course</th>
                <th className="px-6 py-3.5">HR Status</th>
                <th className="px-6 py-3.5">Latest HR Remark</th>
                <th className="px-6 py-3.5">Last Update</th>
                <th className="px-6 py-3.5 text-right">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">No job enquiries found.</td></tr>
              )}
              {filtered.map(lead => {
                const remarks = sortedRemarks(lead);
                const latest = remarks[0];
                const open = expandedId === lead._id;
                return (
                  <React.Fragment key={lead._id}>
                    <tr className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-slate-800 dark:text-slate-100">{lead.userName || '—'}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{lead.userNumber}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{lead.course || lead.courseofintrest || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusStyle(lead.status)}`}>{lead.status || '—'}</span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {latest ? (
                          <>
                            <div className="text-slate-700 dark:text-slate-300 font-medium line-clamp-2 break-words">{latest.remark}</div>
                            {latest.addedBy && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">by {latest.addedBy}</div>}
                          </>
                        ) : <span className="text-slate-400 italic">No remarks yet</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{fmt(latest?.timestamp ?? lead.lastInteracted)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setExpandedId(open ? null : lead._id)}
                          disabled={remarks.length === 0}
                          className="px-3 py-1.5 text-xs font-bold text-[#0e7490] dark:text-cyan-300 bg-[#ecfeff] dark:bg-cyan-950/40 rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-900/50 border border-cyan-200/70 dark:border-cyan-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {open ? 'Hide' : `View (${remarks.length})`}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/70 dark:bg-slate-950/50">
                        <td colSpan={6} className="px-6 py-4">
                          <ul className="space-y-2">
                            {remarks.map((r, i) => (
                              <li key={r._id || i} className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
                                <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words font-medium">{r.remark}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">{fmt(r.timestamp)}{r.addedBy ? ` · ${r.addedBy}` : ''}</div>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobEnquiryView;