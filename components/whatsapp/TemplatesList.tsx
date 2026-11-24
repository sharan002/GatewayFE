import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { getSocket } from '../../services/socket';
import { WaTemplate, WaTemplatesResponse } from '../../types';
import { Icons } from '../Icons';

interface Props {
  onCreateClick?: () => void;
  onEdit?: (template: WaTemplate) => void;
  onDuplicate?: (template: WaTemplate) => void;
  onViewDetails?: (template: WaTemplate) => void;
}

interface RealtimeToast {
  id: string;
  type: 'APPROVED' | 'REJECTED' | 'PAUSED' | 'INFO';
  title: string;
  message?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  UTILITY: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  MARKETING: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  AUTHENTICATION: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  PENDING: { label: 'In Review', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  PAUSED: { label: 'Paused', bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  DISABLED: { label: 'Disabled', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
};

export const TemplatesList: React.FC<Props> = ({ onCreateClick, onEdit, onDuplicate, onViewDetails }) => {
  const [data, setData] = useState<WaTemplatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);

  // Test send modal state
  const [testModalTemplate, setTestModalTemplate] = useState<WaTemplate | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testBodyParams, setTestBodyParams] = useState<Record<number, string>>({});
  const [testHeaderParam, setTestHeaderParam] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Deleting template id
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Real-time socket listener for Meta template status updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = (event: {
      templateId?: string;
      metaId?: string;
      name: string;
      language: string;
      status: string;
      rejectedReason?: string;
      qualityScore?: string;
      updatedAt?: string;
    }) => {
      const toastId = `${Date.now()}_${Math.random()}`;
      const isApproved = event.status === 'APPROVED';
      const isRejected = event.status === 'REJECTED';
      const isPaused = event.status === 'PAUSED';

      const toastType = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : isPaused ? 'PAUSED' : 'INFO';
      const toastTitle = isApproved
        ? `🎉 Template Approved by Meta!`
        : isRejected
        ? `⚠️ Template Rejected by Meta`
        : `Template Status Update: ${event.status}`;

      const toastMsg = isRejected && event.rejectedReason
        ? `"${event.name}" (${event.language}): ${event.rejectedReason}`
        : `"${event.name}" (${event.language}) is now ${event.status}.`;

      setToasts(prev => [...prev.slice(-3), { id: toastId, type: toastType, title: toastTitle, message: toastMsg }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 7000);

      // Instantly update local list and counter metrics
      setData(prev => {
        if (!prev) return prev;

        if (event.status === 'DELETED') {
          const target = prev.templates.find(
            t => (event.templateId && t._id === event.templateId) || (t.name === event.name && t.language === event.language)
          );
          const filtered = prev.templates.filter(
            t => (event.templateId ? t._id !== event.templateId : true) && !(t.name === event.name && t.language === event.language)
          );
          const newStats = { ...prev.stats };
          if (target?.status) {
            const key = target.status.toLowerCase() as keyof typeof newStats;
            if (newStats[key] !== undefined) newStats[key] = Math.max(0, newStats[key] - 1);
          }
          newStats.total = Math.max(0, newStats.total - 1);
          return {
            ...prev,
            templates: filtered,
            total: Math.max(0, prev.total - 1),
            stats: newStats,
          };
        }

        const oldTpl = prev.templates.find(t => t.name === event.name && t.language === event.language);
        const oldStatus = oldTpl ? oldTpl.status : null;

        const updatedTemplates = prev.templates.map(t => {
          if ((event.templateId && t._id === event.templateId) || (t.name === event.name && t.language === event.language)) {
            return {
              ...t,
              status: event.status as any,
              rejectedReason: event.rejectedReason ?? t.rejectedReason,
              qualityScore: event.qualityScore ?? t.qualityScore,
              lastSyncedAt: event.updatedAt || new Date().toISOString(),
            };
          }
          return t;
        });

        const newStats = { ...prev.stats };
        if (oldStatus && oldStatus !== event.status) {
          const oldKey = oldStatus.toLowerCase() as keyof typeof newStats;
          const newKey = event.status.toLowerCase() as keyof typeof newStats;
          if (newStats[oldKey] !== undefined) newStats[oldKey] = Math.max(0, newStats[oldKey] - 1);
          if (newStats[newKey] !== undefined) newStats[newKey] = (newStats[newKey] || 0) + 1;
        }

        return {
          ...prev,
          templates: updatedTemplates,
          stats: newStats,
        };
      });
    };

    const handleDeleted = (event: { templateId?: string; metaId?: string; name?: string }) => {
      setData(prev => {
        if (!prev) return prev;
        const target = prev.templates.find(
          t =>
            (event.templateId && t._id === event.templateId) ||
            (event.metaId && t.metaId === event.metaId) ||
            (event.name && t.name === event.name)
        );
        const filtered = prev.templates.filter(
          t =>
            (event.templateId ? t._id !== event.templateId : true) &&
            (event.metaId ? t.metaId !== event.metaId : true) &&
            (event.name ? t.name !== event.name : true)
        );
        const newStats = { ...prev.stats };
        if (target?.status) {
          const key = target.status.toLowerCase() as keyof typeof newStats;
          if (newStats[key] !== undefined) newStats[key] = Math.max(0, newStats[key] - 1);
        }
        newStats.total = Math.max(0, newStats.total - 1);
        return {
          ...prev,
          templates: filtered,
          total: Math.max(0, prev.total - 1),
          stats: newStats,
        };
      });
    };

    socket.on('wa_template_update', handleUpdate);
    socket.on('wa_template_deleted', handleDeleted);

    return () => {
      socket.off('wa_template_update', handleUpdate);
      socket.off('wa_template_deleted', handleDeleted);
    };
  }, []);

  // Background live sync from Meta on initial mount so templates deleted in Meta
  // WhatsApp Manager or newly approved in Meta are reconciled immediately.
  useEffect(() => {
    let active = true;
    apiService
      .syncWhatsAppTemplates()
      .then(res => {
        if (active && res) {
          fetchTemplates();
        }
      })
      .catch(err => {
        console.warn('Background WhatsApp template sync notice:', err?.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await apiService.fetchWhatsAppTemplates({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        sortBy,
        sortOrder,
        limit: 100,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [statusFilter, categoryFilter, sortBy, sortOrder]);

  const sortedTemplates = React.useMemo(() => {
    if (!data?.templates) return [];
    const list = [...data.templates];
    list.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') {
        return dir * (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'category') {
        return dir * (a.category || '').localeCompare(b.category || '');
      }
      if (sortBy === 'status') {
        return dir * (a.status || '').localeCompare(b.status || '');
      }
      // Default: updatedAt / createdAt / _id descending
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
      if (timeA !== timeB) return dir * (timeA - timeB);
      return dir * String(a._id || '').localeCompare(String(b._id || ''));
    });
    return list;
  }, [data?.templates, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemplates();
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await apiService.syncWhatsAppTemplates();
      setSyncMessage(res.message);
      await fetchTemplates();
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const stats = data?.stats || {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    paused: 0,
    disabled: 0,
  };

  const getBodyText = (tpl: WaTemplate): string => {
    const bodyComp = tpl.components?.find(c => c.type === 'BODY');
    return bodyComp?.text || '-';
  };

  const getHeaderPreview = (tpl: WaTemplate): string => {
    const h = tpl.components?.find(c => c.type === 'HEADER');
    if (!h) return 'None';
    if (h.format === 'TEXT') return `Text: "${h.text || ''}"`;
    return `Media (${h.format})`;
  };

  const getButtonCount = (tpl: WaTemplate): number => {
    const btnComp = tpl.components?.find(c => c.type === 'BUTTONS');
    return btnComp?.buttons?.length || 0;
  };

  const handleOpenTestModal = (tpl: WaTemplate) => {
    setTestModalTemplate(tpl);
    setTestPhone('');
    setTestResult(null);

    // Parse variables from body text {{1}}, {{2}}...
    const bodyComp = tpl.components?.find(c => c.type === 'BODY');
    const bodyMatches = [...(bodyComp?.text || '').matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1], 10));
    const uniqueVars = Array.from(new Set(bodyMatches)).sort((a, b) => a - b);

    const samples = bodyComp?.example?.body_text?.[0] || [];
    const initialParams: Record<number, string> = {};
    uniqueVars.forEach((varNum, idx) => {
      initialParams[varNum] = samples[idx] || `Sample ${varNum}`;
    });
    setTestBodyParams(initialParams);

    const headerComp = tpl.components?.find(c => c.type === 'HEADER');
    setTestHeaderParam(headerComp?.example?.header_text?.[0] || '');
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalTemplate || !testPhone.trim()) return;

    try {
      setSendingTest(true);
      setTestResult(null);

      // Collect body parameters in sequential order
      const bodyKeys = Object.keys(testBodyParams).map(Number).sort((a, b) => a - b);
      const bodyValues = bodyKeys.map(k => testBodyParams[k]);

      const res = await apiService.sendTestWhatsAppTemplate(testModalTemplate._id, testPhone.trim(), {
        body: bodyValues.length > 0 ? bodyValues : undefined,
        header: testHeaderParam.trim() ? testHeaderParam.trim() : undefined,
      });

      setTestResult({
        success: true,
        message: res.message || `Test message delivered successfully to ${testPhone}!`,
      });
    } catch (err: any) {
      console.error('Test template send failed:', err);
      setTestResult({
        success: false,
        message: err.message || 'Failed to send test message via Meta API',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleDeleteTemplate = async (tpl: WaTemplate) => {
    if (!window.confirm(`Are you sure you want to delete template "${tpl.name}" from Meta and the CRM? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(tpl._id);
      const res = await apiService.deleteWhatsAppTemplate(tpl._id);
      setData(prev => {
        if (!prev) return prev;
        const newStats = { ...prev.stats };
        if (tpl.status) {
          const key = tpl.status.toLowerCase() as keyof typeof newStats;
          if (newStats[key] !== undefined) newStats[key] = Math.max(0, newStats[key] - 1);
        }
        newStats.total = Math.max(0, newStats.total - 1);
        return {
          ...prev,
          templates: prev.templates.filter(t => t._id !== tpl._id),
          total: Math.max(0, prev.total - 1),
          stats: newStats,
        };
      });
      if (selectedTemplate?._id === tpl._id) {
        setSelectedTemplate(null);
      }

      const toastId = `toast-del-${Date.now()}`;
      setToasts(prev => [
        ...prev.slice(-3),
        {
          id: toastId,
          type: 'INFO',
          title: 'Template Deleted',
          message: res?.message || `Template "${tpl.name}" deleted from Meta WhatsApp Manager & CRM.`,
        },
      ]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 6000);
    } catch (err: any) {
      alert(`Failed to delete template: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Real-time Meta Live Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-start gap-3 transition-all animate-in slide-in-from-bottom-3 duration-200 ${
                t.type === 'APPROVED'
                  ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : t.type === 'REJECTED'
                  ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                  : 'bg-amber-50/95 dark:bg-amber-950/95 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
              }`}
            >
              <div className="pt-0.5">
                {t.type === 'APPROVED' ? (
                  <Icons.CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Icons.X className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black">{t.title}</div>
                {t.message && <div className="text-[11px] opacity-90 mt-0.5 leading-snug">{t.message}</div>}
              </div>
              <button
                type="button"
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="opacity-60 hover:opacity-100 p-0.5"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'ring-2 ring-blue-500 bg-blue-50/40 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-sm'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Templates</div>
          <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{stats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'APPROVED'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Approved
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.approved}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'PENDING'
              ? 'ring-2 ring-amber-500 bg-amber-50/40 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            In Review
          </div>
          <div className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">{stats.pending}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'REJECTED'
              ? 'ring-2 ring-rose-500 bg-rose-50/40 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Rejected
          </div>
          <div className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-300">{stats.rejected}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('PAUSED')}
          className={`p-4 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            statusFilter === 'PAUSED'
              ? 'ring-2 ring-orange-500 bg-orange-50/40 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Paused
          </div>
          <div className="mt-1 text-2xl font-black text-orange-700 dark:text-orange-300">{stats.paused}</div>
        </button>
      </div>

      {/* Sync Notification Banner */}
      {syncMessage && (
        <div className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
          syncMessage.toLowerCase().includes('fail') || syncMessage.toLowerCase().includes('error')
            ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {syncMessage.toLowerCase().includes('fail') || syncMessage.toLowerCase().includes('error') ? (
              <Icons.AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Icons.CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{syncMessage}</span>
          </div>
          <button type="button" onClick={() => setSyncMessage(null)} className="p-1 hover:opacity-80">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">All Categories</option>
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>

          {/* Sort selector dropdown */}
          <select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('_');
              setSortBy(field);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
            title="Sort templates"
          >
            <option value="updatedAt_asc">Oldest First (Ascending)</option>
            <option value="updatedAt_desc">Newest First (Descending)</option>
            <option value="name_asc">Name: A → Z (Ascending)</option>
            <option value="name_desc">Name: Z → A (Descending)</option>
            <option value="category_asc">Category (Ascending)</option>
            <option value="status_asc">Status (Ascending)</option>
          </select>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Fetch latest template statuses directly from Meta WhatsApp Manager"
          >
            <Icons.RefreshCcw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync with Meta'}</span>
          </button>

          {onCreateClick && (
            <button
              type="button"
              onClick={onCreateClick}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
            >
              <Icons.Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          )}
        </div>
      </div>

      {/* Templates Table / List View */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <Icons.RefreshCcw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading WhatsApp templates from database...</span>
          </div>
        ) : (data?.templates || []).length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 mx-auto flex items-center justify-center">
              <Icons.WhatsApp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">No WhatsApp Templates Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {search || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No templates match your current search and filter criteria.'
                  : 'Sync your templates from Meta WhatsApp Manager or create your first template in the CRM.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <Icons.RefreshCcw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync with Meta</span>
              </button>
              {onCreateClick && (
                <button
                  type="button"
                  onClick={onCreateClick}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  <Icons.Plus className="w-3.5 h-3.5" />
                  <span>Create Template</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                      } else {
                        setSortBy('name');
                        setSortOrder('desc');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Template Name</span>
                      {sortBy === 'name' ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortBy === 'category') {
                        setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                      } else {
                        setSortBy('category');
                        setSortOrder('desc');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Category</span>
                      {sortBy === 'category' ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortBy === 'status') {
                        setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                      } else {
                        setSortBy('status');
                        setSortOrder('desc');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {sortBy === 'status' ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4">Header / Buttons</th>
                  <th className="py-3 px-4">Body Preview</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedTemplates.map((tpl) => {
                  const statusInfo = STATUS_BADGES[tpl.status] || {
                    label: tpl.status,
                    bg: 'bg-slate-100',
                    text: 'text-slate-700',
                    dot: 'bg-slate-400',
                  };
                  const catColor = CATEGORY_COLORS[tpl.category] || {
                    bg: 'bg-slate-100',
                    text: 'text-slate-700',
                    border: 'border-slate-200',
                  };

                  return (
                    <tr
                      key={tpl._id}
                      onClick={() => {
                        if (onViewDetails) {
                          onViewDetails(tpl);
                        } else {
                          setSelectedTemplate(tpl);
                        }
                      }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <span>{tpl.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {tpl.language}
                          </span>
                        </div>
                        {tpl.metaId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {tpl.metaId}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catColor.bg} ${catColor.text} ${catColor.border}`}
                        >
                          {tpl.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusInfo.bg} ${statusInfo.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.label}
                          </span>
                          {tpl.rejectedReason && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 max-w-[180px] truncate" title={tpl.rejectedReason}>
                              {tpl.rejectedReason}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        <div>{getHeaderPreview(tpl)}</div>
                        <div className="text-[11px] text-slate-400">
                          {getButtonCount(tpl)} {getButtonCount(tpl) === 1 ? 'button' : 'buttons'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{getBodyText(tpl)}</p>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {onViewDetails && (
                            <button
                              type="button"
                              onClick={() => onViewDetails(tpl)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1"
                              title="View Template Details & Meta Analytics"
                            >
                              <Icons.PendingAlert className="w-3 h-3 text-blue-600" />
                              <span>Details</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedTemplate(tpl)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
                            title="Preview Template"
                          >
                            Preview
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenTestModal(tpl)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1"
                            title="Send Test Message via Meta"
                          >
                            <Icons.Send className="w-3 h-3" />
                            <span>Test</span>
                          </button>

                          {onEdit && (
                            <button
                              type="button"
                              disabled={tpl.status === 'PENDING'}
                              onClick={() => onEdit(tpl)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                                tpl.status === 'PENDING'
                                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
                                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                              }`}
                              title={tpl.status === 'PENDING' ? 'Cannot edit while under Meta review' : 'Edit & Resubmit to Meta'}
                            >
                              <Icons.Edit className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {onDuplicate && (
                            <button
                              type="button"
                              onClick={() => onDuplicate(tpl)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                              title="Duplicate Template"
                            >
                              Copy
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={deletingId === tpl._id}
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="p-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                            title="Delete from Meta & CRM"
                          >
                            {deletingId === tpl._id ? (
                              <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Icons.Trash className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedTemplate(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{selectedTemplate.name}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {selectedTemplate.language}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400 font-mono">Meta ID: {selectedTemplate.metaId || 'Not synced'}</span>
                  <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs font-semibold text-blue-600">{selectedTemplate.category}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Smartphone style bubble preview */}
            <div className="p-4 rounded-2xl bg-[#EFEAE2] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl rounded-tl-sm shadow-sm space-y-2.5 max-w-sm">
                {/* Header */}
                {selectedTemplate.components?.some(c => c.type === 'HEADER') && (
                  <div className="pb-2 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-slate-100">
                    {selectedTemplate.components.find(c => c.type === 'HEADER')?.format === 'TEXT'
                      ? selectedTemplate.components.find(c => c.type === 'HEADER')?.text
                      : `[Header Media: ${selectedTemplate.components.find(c => c.type === 'HEADER')?.format}]`}
                  </div>
                )}

                {/* Body */}
                <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {getBodyText(selectedTemplate)}
                </div>

                {/* Footer */}
                {selectedTemplate.components?.some(c => c.type === 'FOOTER') && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    {selectedTemplate.components.find(c => c.type === 'FOOTER')?.text}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 text-right pt-0.5">
                  12:00 PM <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>

              {/* Buttons */}
              {selectedTemplate.components?.some(c => c.type === 'BUTTONS') && (
                <div className="space-y-1.5 max-w-sm">
                  {selectedTemplate.components
                    .find(c => c.type === 'BUTTONS')
                    ?.buttons?.map((btn, idx) => (
                      <div
                        key={idx}
                        className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 text-xs font-bold text-center border border-slate-200/60 dark:border-slate-800 shadow-sm"
                      >
                        {btn.type === 'PHONE_NUMBER' && '📞 '}
                        {btn.type === 'URL' && '🔗 '}
                        {btn.text}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Template Status / Meta Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTemplate.status}</span>
              </div>
              {selectedTemplate.rejectedReason && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Rejection Reason:</span>
                  <span className="font-semibold text-right max-w-xs">{selectedTemplate.rejectedReason}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Last Synced:</span>
                <span>{selectedTemplate.lastSyncedAt ? new Date(selectedTemplate.lastSyncedAt).toLocaleString() : 'Never'}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDeleteTemplate(selectedTemplate)}
                disabled={deletingId === selectedTemplate._id}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 p-2"
              >
                {deletingId === selectedTemplate._id ? 'Deleting...' : 'Delete Template'}
              </button>

              <div className="flex items-center gap-2">
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTemplate;
                      setSelectedTemplate(null);
                      onViewDetails(t);
                    }}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                  >
                    <Icons.PendingAlert className="w-3.5 h-3.5" />
                    <span>View Analytics</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const t = selectedTemplate;
                    setSelectedTemplate(null);
                    handleOpenTestModal(t);
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                >
                  Send Test
                </button>

                {onEdit && (
                  <button
                    type="button"
                    disabled={selectedTemplate.status === 'PENDING'}
                    onClick={() => {
                      const t = selectedTemplate;
                      setSelectedTemplate(null);
                      onEdit(t);
                    }}
                    className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                      selectedTemplate.status === 'PENDING'
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    Edit & Resubmit
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Send Modal */}
      {testModalTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (!sendingTest) setTestModalTemplate(null);
          }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                    Send WhatsApp Test Message
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    Meta Live
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Template: <code className="font-mono font-bold text-slate-700 dark:text-slate-300">{testModalTemplate.name}</code> ({testModalTemplate.language})
                </p>
              </div>
              <button
                type="button"
                disabled={sendingTest}
                onClick={() => setTestModalTemplate(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {testResult.success ? (
                  <Icons.CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Icons.AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="font-semibold">{testResult.message}</div>
              </div>
            )}

            <form onSubmit={handleSendTest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient WhatsApp Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Icons.Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g. 919876543210 (with country code, no +)"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter mobile number with country code (e.g. 91 for India).
                </p>
              </div>

              {/* Header parameter if applicable */}
              {testModalTemplate.components?.some(c => c.type === 'HEADER' && c.format === 'TEXT' && /\{\{1\}\}/.test(c.text || '')) && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Header Variable {'{{1}}'}
                  </label>
                  <input
                    type="text"
                    value={testHeaderParam}
                    onChange={(e) => setTestHeaderParam(e.target.value)}
                    placeholder="Header sample value"
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {/* Body variables */}
              {Object.keys(testBodyParams).length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Body Variable Values
                  </div>
                  <div className="space-y-2">
                    {Object.keys(testBodyParams)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((varNum) => (
                        <div key={varNum} className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-blue-600 w-12 shrink-0">
                            {'{{'}{varNum}{'}}'}
                          </span>
                          <input
                            type="text"
                            value={testBodyParams[varNum] || ''}
                            onChange={(e) =>
                              setTestBodyParams(prev => ({ ...prev, [varNum]: e.target.value }))
                            }
                            placeholder={`Value for {{${varNum}}}`}
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                Test messages will be sent from your registered WhatsApp business phone number via the Meta Cloud API.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={sendingTest}
                  onClick={() => setTestModalTemplate(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest || !testPhone.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-emerald-500/20"
                >
                  {sendingTest ? (
                    <>
                      <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Icons.Send className="w-3.5 h-3.5" />
                      <span>Send Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
