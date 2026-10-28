import React, { useEffect, useMemo, useState } from 'react';
import { Lead, Remark } from '../types';
import { apiService } from '../services/api';

// Admin-only, read-only window onto the "Looking for job" hand-off queue.
// These leads are hidden from the dashboard and worked by HR; this view shows
// the status and remarks HR has recorded against each one.

const PAGE_SIZE = 200;

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
    case 'hot': return 'bg-red-100 text-red-700';
    case 'warm': return 'bg-amber-100 text-amber-700';
    case 'cold': return 'bg-sky-100 text-sky-700';
    default: return 'bg-slate-100 text-slate-600';
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
      if (statusFilter !== 'all' && (l.status || '').toLowerCase() !== statusFilter) return false;
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1 min-w-[280px]">
          {[
            { label: 'Total', value: counts.total, cls: 'bg-slate-100 text-slate-600' },
            { label: 'Hot', value: counts.hot, cls: 'bg-red-50 text-red-600' },
            { label: 'Warm', value: counts.warm, cls: 'bg-amber-50 text-amber-600' },
            { label: 'Cold', value: counts.cold, cls: 'bg-sky-50 text-sky-600' },
            { label: 'No HR remarks', value: counts.noRemarks, cls: 'bg-violet-50 text-violet-600' },
          ].map(c => (
            <div key={c.label} className={`p-3 rounded-xl border border-current/10 ${c.cls}`}>
              <span className="text-[10px] font-bold uppercase opacity-60 tracking-wider block leading-none">{c.label}</span>
              <span className="text-xl font-black block leading-none mt-1.5">{c.value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or number"
            className="flex-1 sm:w-56 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none"
          >
            <option value="all">All status</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
          <button onClick={load} disabled={loading} className="px-3 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">HR Status</th>
                <th className="px-4 py-3">Latest HR Remark</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No job enquiries found.</td></tr>
              )}
              {filtered.map(lead => {
                const remarks = sortedRemarks(lead);
                const latest = remarks[0];
                const open = expandedId === lead._id;
                return (
                  <React.Fragment key={lead._id}>
                    <tr className="border-t border-slate-100 hover:bg-slate-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{lead.userName || '—'}</div>
                        <div className="text-xs text-slate-500">{lead.userNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.course || lead.courseofintrest || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${statusStyle(lead.status)}`}>{lead.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {latest ? (
                          <>
                            <div className="text-slate-700 line-clamp-2 break-words">{latest.remark}</div>
                            {latest.addedBy && <div className="text-[11px] text-slate-400 mt-0.5">by {latest.addedBy}</div>}
                          </>
                        ) : <span className="text-slate-400">No remarks yet</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(latest?.timestamp ?? lead.lastInteracted)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedId(open ? null : lead._id)}
                          disabled={remarks.length === 0}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {open ? 'Hide' : `View (${remarks.length})`}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="px-4 py-3">
                          <ul className="space-y-2">
                            {remarks.map((r, i) => (
                              <li key={r._id || i} className="p-3 bg-white border border-slate-200 rounded-lg">
                                <div className="text-slate-700 whitespace-pre-wrap break-words">{r.remark}</div>
                                <div className="text-[11px] text-slate-400 mt-1">{fmt(r.timestamp)}{r.addedBy ? ` · ${r.addedBy}` : ''}</div>
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
