import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lead, User, InternCertificateDetail, CertificateResult, Installment } from '../types';
import { apiService } from '../services/api';
import { FilterState } from '../App';
import MessageModal from './MessageModal';

interface InternshipEnrolledViewProps {
  leads: Lead[];
  users: User[];
  currentUserRole?: string;
  onUpdateLead: (lead: Lead) => void;
  onOpenFees?: (leadId: string) => void;
  onDeleteLead?: (id: string) => void;
  onEditLead?: (lead: Lead) => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}

const SALUTATIONS = ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'];

const emptyForm = (): InternCertificateDetail => ({
  salutation: '',
  userName: '',
  userEmail: '',
  phone: '',
  reg_no: '',
  year_of_study: '',
  college: '',
  college_location: '',
  degree: '',
  other_degree: '',
  department: '',
  internship: '',
  other_internship: '',
  workshop: '',
  other_workshop: '',
  start_date: '',
  end_date: '',
  issue_date: '',
  company: '',
  batch_code: '',
});

// Inline SVG Icon components
const MenuIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
);
const UserIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
);
const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
);
const FilterIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.172a1 1 0 01-1.447.894l-4-2A1 1 0 017 18v-3.586a1 1 0 00-.293-.707L.293 7.293A1 1 0 010 6.586V4z"/></svg>
);
const CrownIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7M5 19h14"/></svg>
);
const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
);
const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
);
const RefreshIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
);
const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
);
const PrinterIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-16 0v5a2 2 0 002 2h12a2 2 0 002-2v-5m-14 4h12"/></svg>
);
const CopyIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
);
const SendIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
);
const XIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
);
const ManageIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className={className}>
    <path d="M18 23h-2v-2a3.003 3.003 0 0 0-3-3H9a3.003 3.003 0 0 0-3 3v2H4v-2a5.006 5.006 0 0 1 5-5h4a5.006 5.006 0 0 1 5 5ZM11 6a3 3 0 1 1-3 3a3 3 0 0 1 3-3m0-2a5 5 0 1 0 5 5a5 5 0 0 0-5-5M2 26h28v2H2zM22 4v2h4.586L20 12.586L21.414 14L28 7.414V12h2V4z" />
  </svg>
);
const EditIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
);

function getFeesSummary(lead: Lead) {
  const inst = lead.fees?.installments ?? [];
  if (inst.length === 0) return null;
  const paidCount = inst.filter(i => i.status === 'Paid').length;
  const totalCount = inst.length;
  const totalPaid = inst.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const totalPending = inst.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0);
  const allPaid = paidCount === totalCount;
  return { paidCount, totalCount, totalPaid, totalPending, allPaid };
}

function getAvatarColor(_name: string) {
  return 'bg-teal-100 text-teal-700 font-bold';
}

/** Deterministic low-opacity pastel color for batch codes */
function getBatchColor(code: string): { bg: string; border: string; text: string; dot: string } {
  if (!code) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' };
  const palette = [
    { bg: 'bg-blue-50/90', border: 'border-blue-200/90', text: 'text-blue-700', dot: 'bg-blue-400' },
    { bg: 'bg-purple-50/90', border: 'border-purple-200/90', text: 'text-purple-700', dot: 'bg-purple-400' },
    { bg: 'bg-emerald-50/90', border: 'border-emerald-200/90', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    { bg: 'bg-amber-50/90', border: 'border-amber-200/90', text: 'text-amber-700', dot: 'bg-amber-400' },
    { bg: 'bg-rose-50/90', border: 'border-rose-200/90', text: 'text-rose-700', dot: 'bg-rose-400' },
    { bg: 'bg-cyan-50/90', border: 'border-cyan-200/90', text: 'text-cyan-700', dot: 'bg-cyan-400' },
    { bg: 'bg-violet-50/90', border: 'border-violet-200/90', text: 'text-violet-700', dot: 'bg-violet-400' },
    { bg: 'bg-orange-50/90', border: 'border-orange-200/90', text: 'text-orange-700', dot: 'bg-orange-400' },
    { bg: 'bg-teal-50/90', border: 'border-teal-200/90', text: 'text-teal-700', dot: 'bg-teal-400' },
    { bg: 'bg-indigo-50/90', border: 'border-indigo-200/90', text: 'text-indigo-700', dot: 'bg-indigo-400' },
    { bg: 'bg-pink-50/90', border: 'border-pink-200/90', text: 'text-pink-700', dot: 'bg-pink-400' },
    { bg: 'bg-lime-50/90', border: 'border-lime-200/90', text: 'text-lime-700', dot: 'bg-lime-400' },
    { bg: 'bg-fuchsia-50/90', border: 'border-fuchsia-200/90', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
    { bg: 'bg-sky-50/90', border: 'border-sky-200/90', text: 'text-sky-700', dot: 'bg-sky-400' },
  ];
  let hash = 0;
  const clean = code.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) & 0xffffffff;
  }
  return palette[Math.abs(hash) % palette.length];
}

const InternshipEnrolledView: React.FC<InternshipEnrolledViewProps> = ({
  leads,
  users,
  currentUserRole,
  onUpdateLead,
  onOpenFees,
  onDeleteLead,
  onEditLead,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'certificates' | 'lead' | 'fees' | 'history'>('details');
  const requestedTabRef = useRef<'details' | 'certificates' | 'lead' | 'fees' | 'history' | null>(null);
  const internalRequestIdRef = useRef(0);
  const batchRequestIdRef = useRef(0);
  const [formData, setFormData] = useState<InternCertificateDetail>(emptyForm());
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [printingAll, setPrintingAll] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [generatingBatchForLead, setGeneratingBatchForLead] = useState<Set<string>>(new Set());
  const [generatedCerts, setGeneratedCerts] = useState<CertificateResult[]>([]);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery ?? localSearchQuery;
  const setSearchQuery = onSearchQueryChange ?? setLocalSearchQuery;
  const [internalLeads, setInternalLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const MSG_CHUNK_LIMIT = 200;

  const [isMessagingMode, setIsMessagingMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [isSelectingAllMsg, setIsSelectingAllMsg] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'batch'>('list');
  const [batchLeads, setBatchLeads] = useState<Lead[]>([]);
  const [isFetchingBatch, setIsFetchingBatch] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [dateScheduled, setDateScheduled] = useState('');
  const [batchModal, setBatchModal] = useState<{ code: string; members: Lead[] } | null>(null);
  const [leadLoading, setLeadLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [colleges, setColleges] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);

  const initialFilters: FilterState = {
    courses: [],
    programTypes: [],
    professions: [],
    sources: [],
    statuses: [],
    pipelines: [],
    assignedUsers: [],
    campaigns: [],
    fromDate: '',
    toDate: '',
    statusFilter: null,
    college: ''
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [feesBilledAmount, setFeesBilledAmount] = useState('0');
  const [feesInstallments, setFeesInstallments] = useState<Installment[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesDirty, setFeesDirty] = useState(false);
  const [feesGeneratingIndex, setFeesGeneratingIndex] = useState<number | null>(null);

  const copyBatchCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const internshipLeads = internalLeads;
  const filteredLeads = internalLeads;

  useEffect(() => {
    let mounted = true;
    apiService.getColleges().then(list => {
      if (mounted && list.length > 0) setColleges(list);
    }).catch(() => {});
    apiService.getBatches().then(list => {
      if (mounted && list.length > 0) setBatches(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const fetchPage = async (page: number, query: string, currentFilters: FilterState) => {
    const requestId = ++internalRequestIdRef.current;
    setIsLoadingInternal(true);
    try {
      const res = await apiService.queryLeads({
        view: 'internship-enrolled',
        page,
        limit: PAGE_SIZE,
        includeStats: false,
        mode: 'full',
        searchQuery: query,
        filters: {
          college: currentFilters.college || '',
          batch: currentFilters.batch || '',
          assignedUser: currentFilters.assignedUser || '',
          source: currentFilters.source || '',
          fromDate: currentFilters.fromDate || '',
          toDate: currentFilters.toDate || '',
          campaigns: currentFilters.campaigns || [],
          statusFilter: currentFilters.statusFilter || null,
        },
      });
      if (requestId !== internalRequestIdRef.current) return;
      if (res?.success) {
        setInternalLeads(res.leads || []);
        setTotalLeads(typeof res.total === 'number' ? res.total : 0);
      }
    } catch {
      setInternalLeads([]);
      setTotalLeads(0);
    } finally {
      if (requestId === internalRequestIdRef.current) setIsLoadingInternal(false);
    }
  };

  const fetchAllBatchLeads = async (query: string, currentFilters: FilterState) => {
    const requestId = ++batchRequestIdRef.current;
    setIsFetchingBatch(true);
    try {
      const res = await apiService.queryLeads({
        view: 'internship-enrolled',
        page: 1,
        limit: 2000,
        includeStats: false,
        mode: 'full',
        searchQuery: query,
        filters: {
          college: currentFilters.college || '',
          batch: currentFilters.batch || '',
          assignedUser: currentFilters.assignedUser || '',
          source: currentFilters.source || '',
          fromDate: currentFilters.fromDate || '',
          toDate: currentFilters.toDate || '',
          campaigns: currentFilters.campaigns || [],
          statusFilter: currentFilters.statusFilter || null,
        },
      });
      if (requestId !== batchRequestIdRef.current) return;
      if (res?.success) setBatchLeads(res.leads || []);
    } catch {
      setBatchLeads([]);
    } finally {
      if (requestId === batchRequestIdRef.current) setIsFetchingBatch(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    void fetchPage(1, searchQuery, filters);
  }, [searchQuery, filters]);

  useEffect(() => {
    void fetchPage(currentPage, searchQuery, filters);
  }, [currentPage]);

  useEffect(() => {
    if (viewMode === 'batch') {
      void fetchAllBatchLeads(searchQuery, filters);
    }
  }, [viewMode, searchQuery, filters]);

  useEffect(() => {
    setSelectedMsgIds(new Set());
  }, [searchQuery, filters]);

  useEffect(() => {
    let mounted = true;
    apiService.getCampaignNames().then(list => {
      if (mounted) setCampaignNames(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const toggleMsgSelection = (id: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchAllMatchingLeadIds = async (query: string, currentFilters: FilterState): Promise<string[]> => {
    let page = 1;
    let total = 0;
    let ids: string[] = [];
    while (true) {
      const res = await apiService.queryLeads({
        view: 'internship-enrolled',
        page,
        limit: MSG_CHUNK_LIMIT,
        includeStats: false,
        mode: 'summary',
        searchQuery: query,
        filters: {
          college: currentFilters.college || '',
          batch: currentFilters.batch || '',
          assignedUser: currentFilters.assignedUser || '',
          source: currentFilters.source || '',
          fromDate: currentFilters.fromDate || '',
          toDate: currentFilters.toDate || '',
          campaigns: currentFilters.campaigns || [],
          statusFilter: currentFilters.statusFilter || null,
        },
      });
      if (!res?.success) break;
      if (page === 1) total = res.total || 0;
      const chunk = (res.leads || []).map(l => l._id);
      ids = ids.concat(chunk);
      if (ids.length >= total || chunk.length === 0) break;
      page += 1;
    }
    return ids;
  };

  const selectAllMatching = async () => {
    setIsSelectingAllMsg(true);
    try {
      const ids = await fetchAllMatchingLeadIds(searchQuery, filters);
      setSelectedMsgIds(new Set(ids));
    } finally {
      setIsSelectingAllMsg(false);
    }
  };

  const uncheckAllMsg = () => setSelectedMsgIds(new Set());

  const exitMessagingMode = () => {
    setIsMessagingMode(false);
    uncheckAllMsg();
  };

  const handleSendMessage = async (message: string, campaignName: string) => {
    try {
      setIsSendingMessage(true);
      const res = await apiService.sendMessageToLeads(Array.from(selectedMsgIds), message, campaignName);
      alert(res.message);
      setIsMessageModalOpen(false);
      exitMessagingMode();
      if (campaignName) {
        apiService.getCampaignNames().then(setCampaignNames).catch(() => {});
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleUpdateLead = (updated: Lead) => {
    setInternalLeads(prev => prev.map(l => l._id === updated._id ? updated : l));
    setBatchLeads(prev => prev.map(l => l._id === updated._id ? updated : l));
    onUpdateLead(updated);
  };

  const hasActiveFilters = useMemo(() => {
    const arrActive = (filters.courses || []).length > 0 || (filters.assignedUsers || []).length > 0 || (filters.programTypes || []).length > 0 || (filters.professions || []).length > 0 || (filters.sources || []).length > 0 || (filters.statuses || []).length > 0 || (filters.pipelines || []).length > 0 || (filters.campaigns || []).length > 0;
    return arrActive || filters.fromDate !== '' || filters.toDate !== '' || !!(filters.college && filters.college !== '') || !!(filters.batch && filters.batch !== '') || !!(filters.assignedUser && filters.assignedUser !== '') || !!(filters.source && filters.source !== '');
  }, [filters]);

  const batchGroups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of batchLeads) {
      const details = Array.isArray(lead.InternDetails) ? lead.InternDetails : [];
      const latest = details[details.length - 1];
      const code = latest?.batch_code?.trim() || '';
      const key = code || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return a.localeCompare(b);
    });
  }, [batchLeads]);

  const selectedLead = useMemo(
    () => internshipLeads.find(l => l._id === selectedLeadId) ?? batchLeads.find(l => l._id === selectedLeadId) ?? null,
    [internshipLeads, batchLeads, selectedLeadId],
  );

  const toDateObjectChat = (date: any): Date | null => {
    const parsed = typeof date === 'string' ? date : date?.$date;
    if (!parsed) return null;
    const obj = new Date(parsed);
    return Number.isNaN(obj.getTime()) ? null : obj;
  };

  const formatChatDayLabel = (date: Date) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((todayStart.getTime() - messageDayStart.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatChatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const chatTimeline = useMemo(() => {
    const sorted = [...(selectedLead?.conversations || [])].sort((a, b) => {
      const aTime = toDateObjectChat(a.timestamp)?.getTime() || 0;
      const bTime = toDateObjectChat(b.timestamp)?.getTime() || 0;
      return aTime - bTime;
    });
    const grouped: { dayKey: string; dayLabel: string; items: typeof sorted }[] = [];
    sorted.forEach((conversation) => {
      const conversationDate = toDateObjectChat(conversation.timestamp);
      const dayKey = conversationDate ? `${conversationDate.getFullYear()}-${conversationDate.getMonth()}-${conversationDate.getDate()}` : 'unknown';
      const dayLabel = conversationDate ? formatChatDayLabel(conversationDate) : 'Unknown Date';
      const existingGroup = grouped.find(group => group.dayKey === dayKey);
      if (existingGroup) existingGroup.items.push(conversation);
      else grouped.push({ dayKey, dayLabel, items: [conversation] });
    });
    return grouped;
  }, [selectedLead?.conversations]);

  useEffect(() => {
    if (!selectedLead) return;
    setDateScheduled((selectedLead.date_scheduled as string) || '');
    const latest =
      Array.isArray(selectedLead.InternDetails) && selectedLead.InternDetails.length > 0
        ? selectedLead.InternDetails[selectedLead.InternDetails.length - 1]
        : null;

    const rawNumber = (selectedLead.userNumber || '').replace(/\D/g, '');
    const phone10 = rawNumber.startsWith('91') && rawNumber.length === 12
      ? rawNumber.slice(2)
      : rawNumber;

    if (latest) {
      setFormData({
        ...emptyForm(),
        ...latest,
        start_date: latest.start_date ? latest.start_date.split('T')[0] : '',
        end_date: latest.end_date ? latest.end_date.split('T')[0] : '',
        issue_date: latest.issue_date ? latest.issue_date.split('T')[0] : '',
      });
    } else {
      setFormData({ ...emptyForm(), userName: selectedLead.userName, phone: phone10 });
    }
    setIsLeader(!!selectedLead.is_leader);
    const existingCerts = Array.isArray(selectedLead.certificates) ? selectedLead.certificates : [];
    setGeneratedCerts(existingCerts);
    setActiveTab(requestedTabRef.current ?? (existingCerts.length > 0 ? 'certificates' : 'details'));
    requestedTabRef.current = null;
    setIsDirty(false);
    setNewRemark('');
    setFeesBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
    setFeesInstallments(selectedLead.fees?.installments || []);
    setFeesDirty(false);
    setFeesGeneratingIndex(null);
  }, [selectedLeadId]);

  const openFeesTabForLead = (leadId: string) => {
    requestedTabRef.current = 'fees';
    setSelectedLeadId(leadId);
    setActiveTab('fees');
  };

  const isBilledAmountLocked =
    currentUserRole !== 'admin' && (selectedLead?.fees?.billedAmount ?? 0) > 0;

  const handleFeesBilledAmountChange = (value: string) => {
    if (isBilledAmountLocked) return;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFeesBilledAmount(value);
      setFeesDirty(true);
    }
  };

  const handleAddInstallment = () => {
    const nextNumber = feesInstallments.length > 0 ? Math.max(...feesInstallments.map(i => i.number)) + 1 : 1;
    setFeesInstallments([
      ...feesInstallments,
      {
        number: nextNumber,
        dueDate: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'Pending',
      },
    ]);
    setFeesDirty(true);
  };

  const handleInstallmentChange = async (index: number, field: keyof Installment, value: any) => {
    const nextInstallments = [...feesInstallments];
    nextInstallments[index] = { ...nextInstallments[index], [field]: value };
    setFeesInstallments(nextInstallments);

    if (field !== 'status' || !selectedLead) {
      setFeesDirty(true);
      return;
    }

    try {
      setFeesLoading(true);
      const response = await apiService.updateLeadFees(selectedLead._id, {
        billedAmount: parseFloat(feesBilledAmount) || 0,
        installments: nextInstallments.map((inst, idx) => ({
          ...inst,
          number: idx + 1,
        })),
      });

      if (response?.lead) {
        handleUpdateLead(response.lead);
        setFeesDirty(false);
      } else {
        setFeesDirty(true);
      }
    } catch (error) {
      console.error('Failed to update installment status', error);
      alert('Failed to update installment status. Please try saving.');
      setFeesDirty(true);
    } finally {
      setFeesLoading(false);
    }
  };

  const handleDeleteInstallment = (index: number) => {
    setFeesInstallments(feesInstallments.filter((_, i) => i !== index));
    setFeesDirty(true);
  };

  const handleSaveFees = async () => {
    if (!selectedLead || !feesDirty) return;

    try {
      setFeesLoading(true);
      const response = await apiService.updateLeadFees(selectedLead._id, {
        billedAmount: parseFloat(feesBilledAmount) || 0,
        installments: feesInstallments.map((inst, idx) => ({
          ...inst,
          number: idx + 1,
        })),
      });

      if (response?.lead) {
        handleUpdateLead(response.lead);
        setFeesDirty(false);
        alert('Fees updated successfully!');
      } else {
        alert('Fees updated, but could not refresh data automatically. Please reload.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to update fees.');
    } finally {
      setFeesLoading(false);
    }
  };

  const handleGenerateBill = async (index: number) => {
    if (!selectedLead) return;

    setFeesGeneratingIndex(index);
    try {
      const response = await apiService.generateBill(selectedLead._id, index, false);
      const updatedInstallments = feesInstallments.map((inst, idx) =>
        idx === index
          ? {
              ...inst,
              billGenerated: response.billGenerated ?? true,
              billUrl: response.details?.billUrl || response.details?.billFile || inst.billUrl,
              billGeneratedAt: new Date().toISOString(),
            }
          : inst,
      );

      setFeesInstallments(updatedInstallments);
      handleUpdateLead({
        ...selectedLead,
        fees: {
          ...(selectedLead.fees || { billedAmount: 0, installments: [] }),
          billedAmount: response.totalBilledAmount ?? selectedLead.fees?.billedAmount ?? (parseFloat(feesBilledAmount) || 0),
          installments: updatedInstallments,
        },
      });

      if (response.details?.billUrl) {
        window.open(response.details.billUrl, '_blank', 'noopener');
      }

      alert(response.message || 'Bill generated');
    } catch (error) {
      console.error('Generate bill error', error);
      alert('Failed to generate bill');
    } finally {
      setFeesGeneratingIndex(null);
    }
  };

  const handleFieldChange = (field: keyof InternCertificateDetail, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedLead) return;
    try {
      setLoading(true);
      const result = await apiService.saveInternCertificateDetails({ ...formData, is_leader: isLeader });
      if (result.success && result.chat) {
        const updatedLead: Lead = {
          ...selectedLead,
          InternDetails: result.chat.InternDetails || [],
          is_leader: typeof result.chat.is_leader === 'boolean' ? result.chat.is_leader : isLeader,
        };
        handleUpdateLead(updatedLead);
        setIsDirty(false);
        alert('Certificate details saved successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save details.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedLead) return;
    try {
      setGenerating(true);
      const result = await apiService.generateInternCertificate(selectedLead.userNumber);
      if (result.success) {
        const certs: CertificateResult[] = result.certificates || [];
        setGeneratedCerts(certs);
        const updatedLead: Lead = {
          ...selectedLead,
          certificates: certs,
          ...(result.internDetails ? { InternDetails: [result.internDetails] } : {}),
        };
        handleUpdateLead(updatedLead);
        setActiveTab('certificates');
      } else {
        alert(result.message || 'Failed to generate certificates.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate certificates.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBatch = async () => {
    if (!selectedLead) return;
    try {
      setGeneratingBatch(true);
      const internIndex =
        Array.isArray(selectedLead.InternDetails) && selectedLead.InternDetails.length > 0
          ? selectedLead.InternDetails.length - 1
          : undefined;
      const result = await apiService.generateBatchCode(selectedLead._id, internIndex);
      if (result.success && result.batch_code) {
        setFormData(prev => ({ ...prev, batch_code: result.batch_code }));
        setIsDirty(true);
      } else {
        alert(result.message || 'Failed to generate batch code.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate batch code.');
    } finally {
      setGeneratingBatch(false);
    }
  };

  const handlePrintAll = async () => {
    if (!selectedLead) return;
    try {
      setPrintingAll(true);
      const result = await apiService.printAllCertificates(selectedLead.userNumber);
      if (result.success && result.url) {
        window.open(result.url, '_blank', 'noopener');
      } else {
        alert(result.message || 'Failed to generate combined certificate.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate combined certificate.');
    } finally {
      setPrintingAll(false);
    }
  };

  const handleGenerateBatchForLead = async (lead: Lead) => {
    setGeneratingBatchForLead(prev => new Set(prev).add(lead._id));
    try {
      const internIndex =
        Array.isArray(lead.InternDetails) && lead.InternDetails.length > 0
          ? lead.InternDetails.length - 1
          : undefined;
      const result = await apiService.generateBatchCode(lead._id, internIndex);
      if (result.success && result.batch_code) {
        const updatedDetails = Array.isArray(lead.InternDetails) ? [...lead.InternDetails] : [];
        const idx = internIndex ?? updatedDetails.length - 1;
        if (updatedDetails[idx]) {
          updatedDetails[idx] = { ...updatedDetails[idx], batch_code: result.batch_code };
        }
        handleUpdateLead({ ...lead, InternDetails: updatedDetails });
      } else {
        alert(result.message || 'Failed to generate batch code.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate batch code.');
    } finally {
      setGeneratingBatchForLead(prev => { const s = new Set(prev); s.delete(lead._id); return s; });
    }
  };

  const toggleBatch = (key: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const parseDate = (d: any): string => {
    if (!d) return '';
    if (typeof d === 'string') return d.split('T')[0];
    if (d.$date) return d.$date.split('T')[0];
    return '';
  };

  const formatRemarkDate = (ts: any) => {
    const d = parseDate(ts);
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const feesPaidAmount = feesInstallments
    .filter(i => i.status === 'Paid')
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const feesBalanceAmount = Math.max((parseFloat(feesBilledAmount) || 0) - feesPaidAmount, 0);
  const pendingInstallments = feesInstallments.filter(i => i.status === 'Pending');
  const billedNum = parseFloat(feesBilledAmount) || 0;
  const paidPct = billedNum > 0 ? Math.min(100, Math.round((feesPaidAmount / billedNum) * 100)) : 0;
  const pendingPct = billedNum > 0 ? Math.min(100, Math.round((feesBalanceAmount / billedNum) * 100)) : 0;

  const handleStatusChange = async (status: string) => {
    if (!selectedLead) return;
    try {
      setLeadLoading(true);
      const updated = await apiService.updateLead({ _id: selectedLead._id, status });
      handleUpdateLead(updated);
    } catch { alert('Status update failed'); } finally { setLeadLoading(false); }
  };

  const handleAssign = async (assignedto: string) => {
    if (!selectedLead) return;
    try {
      setLeadLoading(true);
      const updated = await apiService.updateLead({ _id: selectedLead._id, assignedto: assignedto || undefined });
      handleUpdateLead(updated);
    } catch { alert('Assignment failed'); } finally { setLeadLoading(false); }
  };

  const handleAddRemark = async () => {
    if (!selectedLead || !newRemark.trim()) return;
    try {
      setLeadLoading(true);
      const updated = await apiService.addRemark(selectedLead._id, newRemark);
      handleUpdateLead(updated);
      setNewRemark('');
    } catch { alert('Failed to add remark'); } finally { setLeadLoading(false); }
  };

    const handleDateScheduledSave = async () => {
    if (!selectedLead) return;
    try {
      setLeadLoading(true);
      const result = await apiService.updateDateScheduled(selectedLead._id, dateScheduled || null);
      if (result.success && result.lead) {
        const savedDate = (result.lead.date_scheduled as string | null) ?? null;
        const batchId = selectedLead.batchId;
        const latestDetail = Array.isArray(selectedLead.InternDetails) && selectedLead.InternDetails.length > 0
          ? selectedLead.InternDetails[selectedLead.InternDetails.length - 1]
          : null;
        const batchCode = latestDetail?.batch_code?.trim();

        setInternalLeads(prev => prev.map(l => {
          if (l._id === result.lead._id) return result.lead;
          if (batchId && l.batchId === batchId) return { ...l, date_scheduled: savedDate };
          if (!batchId && batchCode) {
            const lLatest = Array.isArray(l.InternDetails) && l.InternDetails.length > 0
              ? l.InternDetails[l.InternDetails.length - 1]
              : null;
            if (lLatest?.batch_code?.trim() === batchCode) return { ...l, date_scheduled: savedDate };
          }
          return l;
        }));
        setBatchLeads(prev => prev.map(l => {
          if (l._id === result.lead._id) return result.lead;
          if (batchId && l.batchId === batchId) return { ...l, date_scheduled: savedDate };
          if (!batchId && batchCode) {
            const lLatest = Array.isArray(l.InternDetails) && l.InternDetails.length > 0
              ? l.InternDetails[l.InternDetails.length - 1]
              : null;
            if (lLatest?.batch_code?.trim() === batchCode) return { ...l, date_scheduled: savedDate };
          }
          return l;
        }));
        handleUpdateLead(result.lead);
      }
    } catch { alert('Failed to update scheduled date'); } finally { setLeadLoading(false); }
  };

  const handleDeleteRemark = async (remarkId: string) => {
    if (!selectedLead) return;
    try {
      setLeadLoading(true);
      const updated = await apiService.deleteRemark(selectedLead._id, remarkId);
      handleUpdateLead(updated);
    } catch { alert('Failed to delete remark'); } finally { setLeadLoading(false); }
  };

const handleDeleteLeadById = (id: string) => {
    if (!window.confirm('Delete this lead permanently?')) return;
    onDeleteLead?.(id);
    if (selectedLeadId === id) setSelectedLeadId(null);
  };

  const handleBatchCodeClick = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    const localMembers = internshipLeads.filter(l => {
      const details = Array.isArray(l.InternDetails) ? l.InternDetails : [];
      const latest = details[details.length - 1];
      return (latest?.batch_code?.trim() || '') === code;
    });
    setBatchModal({ code, members: localMembers });
    try {
      const res = await apiService.queryLeads({
        view: 'internship-enrolled',
        page: 1,
        limit: 500,
        includeStats: false,
        mode: 'full',
        searchQuery: '',
        filters: { batch: code },
      });
      if (res?.success && res.leads) {
        setBatchModal({ code, members: res.leads });
      }
    } catch {
      // keep local members
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all';

  const labelClass = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block';

  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE));
  const paginatedLeads = internalLeads;

  return (
    <div className="flex h-full  text-slate-800 overflow-hidden relative font-sans">

      {/* ── Main panel with right margin/spacing when popup is open ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedLeadId ? 'md:mr-[calc(min(38vw,520px)-16px)]' : ''}`}>

        {/* Header */}
        <div className={`transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5 pt-6 pb-3' : 'p-6 pb-3'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Internship Enrolled</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {totalLeads} student{totalLeads !== 1 ? 's' : ''} · Manage batch, trainer & fees
              </p>
            </div>
          </div>
        </div>

        {/* Control bar */}
        <div className={`pb-3 flex items-center justify-between gap-4 flex-nowrap transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5' : 'px-6'}`}>
          <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white p-1 max-w-full overflow-x-auto min-w-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-2 min-w-[88px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${viewMode === 'list' && filters.statusFilter !== 'responded' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-slate-700 hover:bg-teal-50'}`}
            >
              <MenuIcon className="w-4 h-4" />List
            </button>
            <button
              onClick={() => { setViewMode('batch'); setFilters(prev => ({ ...prev, statusFilter: null })); }}
              className={`flex items-center justify-center gap-2 min-w-[120px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${viewMode === 'batch' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-slate-700 hover:bg-teal-50'}`}
            >
              <UserIcon className="w-4 h-4" />Active Batch
            </button>
            {/* <button
              onClick={() => { setViewMode('batch'); setFilters(prev => ({ ...prev, statusFilter: null })); }}
              className={`flex items-center justify-center gap-2 min-w-[150px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${viewMode === 'batch' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-slate-700 hover:bg-teal-50'}`}
            >
              <CheckIcon className="w-4 h-4 text-teal-50" />Completed Batch
            </button> */}
            <button
              onClick={() => { setViewMode('list'); setFilters(prev => ({ ...prev, statusFilter: prev.statusFilter === 'responded' ? null : 'responded' })); }}
              className={`flex items-center justify-center gap-2 min-w-[110px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filters.statusFilter === 'responded' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-slate-700 hover:bg-teal-50'}`}
            >
              <CheckIcon className="w-4 h-4" />Responded
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0 justify-end">
            <button
              onClick={() => setIsFilterOpen(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${hasActiveFilters ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-700 border-blue-200 hover:bg-blue-50'}`}
            >
              <FilterIcon className="w-4 h-4 text-blue-500" />
              <span>Filters</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
            </button>

            {viewMode === 'list' && (
              isMessagingMode ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase mr-1">{selectedMsgIds.size} Selected</span>
                  <button onClick={selectAllMatching} disabled={isSelectingAllMsg} className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 disabled:opacity-50">{isSelectingAllMsg ? 'Selecting…' : 'Select All'}</button>
                  <button onClick={uncheckAllMsg} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Clear</button>
                  {selectedMsgIds.size > 0 && (
                    <button onClick={() => setIsMessageModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-blue-700">
                      <SendIcon className="w-4 h-4" />
                      <span>Send Message</span>
                    </button>
                  )}
                  <button onClick={exitMessagingMode} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><XIcon className="w-5 h-5" /></button>
                </div>
              ) : (
                <button
                  onClick={() => setIsMessagingMode(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 hover:bg-blue-50 rounded-xl font-semibold text-sm transition-all border border-blue-200 whitespace-nowrap active:scale-95 cursor-pointer shadow-2xs"
                >
                  <SendIcon className="w-4 h-4 text-blue-500" />
                  <span>Message Mode</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Filter Drawer */}
        {isFilterOpen && (
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-40 border-l border-slate-200">
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800">Filters</h2>
                <button onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><XIcon className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">College</label>
                  <select value={filters.college || ''} onChange={e => setFilters({ ...filters, college: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="">All Colleges</option>
                    {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch</label>
                  <select value={filters.batch || ''} onChange={e => setFilters({ ...filters, batch: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="">All Batches</option>
                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Range</label>
                  <div className="mt-2 flex gap-2">
                    <input type="date" value={filters.fromDate || ''} onChange={e => setFilters({ ...filters, fromDate: e.target.value })} className="w-1/2 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    <input type="date" value={filters.toDate || ''} onChange={e => setFilters({ ...filters, toDate: e.target.value })} className="w-1/2 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned To</label>
                  <select value={filters.assignedUser || ''} onChange={e => setFilters({ ...filters, assignedUser: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="">All Staff</option>
                    {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button onClick={() => setFilters(initialFilters)} className="flex-1 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Reset</button>
                <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-2 text-sm font-bold bg-blue-500 text-white rounded-lg">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* ── List View ── */}
        {viewMode === 'list' && (
          <div className={`pb-6 flex-1 overflow-hidden transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5' : 'px-6'}`}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
              <div className="overflow-auto flex-1 min-w-0 slim-scrollbar">
                {isLoadingInternal && (
                  <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 font-bold flex items-center gap-1.5">
                    <RefreshIcon className="w-3 h-3 animate-spin" /> Loading students…
                  </div>
                )}
                <table className="w-full min-w-[900px] text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {isMessagingMode && (
                        <th className="px-4 py-4 w-10 text-center border-b border-slate-100">
                          <CheckIcon className="w-4 h-4 text-slate-300 mx-auto" />
                        </th>
                      )}
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Student</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 hidden sm:table-cell">Contact</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 hidden lg:table-cell">College</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 hidden md:table-cell">Batch</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 text-center">Fees</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingInternal && internalLeads.length === 0 ? (
                      <tr>
                        <td colSpan={isMessagingMode ? 7 : 6} className="px-6 py-16 text-center text-slate-400 text-sm">Loading students…</td>
                      </tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={isMessagingMode ? 7 : 6} className="px-6 py-16 text-center text-slate-400 italic text-sm">No internship enrolled students found.</td>
                      </tr>
                    ) : (
                      paginatedLeads.map(lead => {
                        const latestDetail = Array.isArray(lead.InternDetails) && lead.InternDetails.length > 0
                          ? lead.InternDetails[lead.InternDetails.length - 1]
                          : null;
                        const batchCode = latestDetail?.batch_code?.trim() || '';

                        return (
                          <tr
                            key={lead._id}
                            className={`hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer ${selectedLeadId === lead._id ? 'selected-lead-row bg-blue-50/80 dark:bg-blue-600/20 shadow-[inset_4px_0_0_#3b82f6] dark:shadow-[inset_4px_0_0_#60a5fa]' : ''}`}
                            onClick={() => setSelectedLeadId(lead._id)}
                          >
                            {isMessagingMode && (
                              <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedMsgIds.has(lead._id)}
                                  onChange={() => toggleMsgSelection(lead._id)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                  {(lead.userName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <span>{lead.userName}</span>
                                    {lead.is_leader && (
                                      <span title="Batch Leader" className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold uppercase">
                                        <CrownIcon className="w-3 h-3" /> Leader
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {new Date(typeof lead.datecreated === 'string' ? lead.datecreated : (lead.datecreated as any).$date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">{lead.userNumber}</span>
                                <span
                                  role="button"
                                  title="Open in WhatsApp"
                                  onClick={e => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                                  className="text-emerald-500 hover:text-emerald-600 cursor-pointer"
                                >
                                  <WhatsAppIcon className="w-4 h-4" />
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell max-w-xs">
                              <span className="text-sm text-slate-700 font-medium truncate block">
                                {latestDetail?.college || <span className="text-slate-300 italic">—</span>}
                              </span>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell">
                              {batchCode ? (() => {
                                const bColor = getBatchColor(batchCode);
                                return (
                                  <button
                                    onClick={e => handleBatchCodeClick(e, batchCode)}
                                    title="Click to see batch members"
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase transition-all hover:shadow-xs active:scale-95 cursor-pointer ${bColor.bg} ${bColor.border} ${bColor.text}`}
                                  >
                                    {batchCode}
                                  </button>
                                );
                              })() : (
                                <button
                                  onClick={e => { e.stopPropagation(); handleGenerateBatchForLead(lead); }}
                                  disabled={generatingBatchForLead.has(lead._id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-all shadow-sm"
                                >
                                  {generatingBatchForLead.has(lead._id) ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : <PlusIcon className="w-3.5 h-3.5" />}
                                  Add
                                </button>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {(() => {
                                const fees = getFeesSummary(lead);
                                if (!fees) {
                                  return (
                                    <button
                                      onClick={e => { e.stopPropagation(); openFeesTabForLead(lead._id); }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white text-[10px] font-bold uppercase hover:bg-teal-700 transition-all"
                                    >
                                      <PlusIcon className="w-3 h-3" /> Add
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); openFeesTabForLead(lead._id); }}
                                    className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all ${fees.allPaid ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}
                                  >
                                    <span className="text-[10px] font-bold uppercase">
                                      {fees.allPaid ? '✓ All Paid' : `${fees.paidCount}/${fees.totalCount} Paid`}
                                    </span>
                                    <span className="text-[9px]">
                                      ₹{fees.totalPaid.toLocaleString()} paid {fees.totalPending > 0 ? `· ₹${fees.totalPending.toLocaleString()} due` : ''}
                                    </span>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={e => { e.stopPropagation(); setSelectedLeadId(lead._id); }}
                                  className="text-[#0d9488] hover:text-teal-700 p-1.5 rounded-lg hover:bg-teal-50 transition-colors flex-shrink-0"
                                  title="Manage student"
                                >
                                  <ManageIcon className="w-4 h-4" />
                                </button>
                                {currentUserRole === 'admin' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteLeadById(lead._id); }}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete lead"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <span className="text-xs text-slate-500">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalLeads)} of {totalLeads} students
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-slate-500 font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Batch Groups View ── */}
        {viewMode === 'batch' && (
          <div className={`pb-6 flex-1 min-h-0 overflow-y-auto transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5' : 'px-6'}`}>
            {batchGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <UserIcon className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-sm font-bold text-slate-500">No internship batches found</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {batchGroups.map(([batchKey, members]) => {
                const isNone = batchKey === '__none__';
                const isOpen = expandedBatches.has(batchKey);
                const paidCount = members.filter(member => getFeesSummary(member)?.allPaid).length;

                return (
                  <section
                    key={batchKey}
                    className="min-w-0 overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => toggleBatch(batchKey)}
                      className="w-full bg-teal-50 px-4 py-2.5 text-center transition-colors"
                    >
                      <p className="truncate text-xs font-extrabold uppercase tracking-wide text-slate-800">
                        {isNone ? 'No Batch Assigned' : `BATCH - ${batchKey}`}
                      </p>
                      <div className="mt-1.5 flex items-center justify-center gap-2 text-[9px] font-semibold text-teal-700">
                        <span className="flex flex-col items-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">{members.length}</span>
                          <span>Students</span>
                        </span>
                        <span className="mb-3 w-7 border-t border-dotted border-green-700" />
                        <span className="flex flex-col items-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">{paidCount}</span>
                          <span>Paid</span>
                        </span>
                        <ChevronDownIcon className={`mb-2 ml-2 h-4 w-4 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    <div className="px-2.5 pb-2.5">
                      <div className="grid grid-cols-[minmax(0,1.7fr)_38px_46px_minmax(0,1fr)_25px] items-center gap-1 border-b border-slate-100 py-2 text-[8px] font-bold uppercase text-slate-500 sm:grid-cols-[minmax(0,1.7fr)_48px_52px_minmax(0,1fr)_28px]">
                        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{members.length} Students</span>
                        <span className="text-center">Paid</span>
                        <span className="text-center">Manage</span>
                        <span className="text-center">Amount</span>
                        <span className="text-center">Remove</span>
                      </div>

                      {(isOpen ? members : members.slice(0, 3)).map(lead => {
                        const fees = getFeesSummary(lead);
                        return (
                          <div
                            key={lead._id}
                            className="grid grid-cols-[minmax(0,1.7fr)_38px_46px_minmax(0,1fr)_25px] items-center gap-1 border-b border-slate-50 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1.7fr)_48px_52px_minmax(0,1fr)_28px]"
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedLeadId(lead._id)}
                              className="flex min-w-0 items-center gap-1.5 text-left hover:opacity-80"
                              title={`Open ${lead.userName || 'student'} details`}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-700">
                                {(lead.userName || '?').charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[9px] font-bold text-slate-800">{lead.userName || 'Unknown student'}</span>
                                <span className="block truncate text-[8px] text-slate-500">{lead.userNumber || '—'}</span>
                              </span>
                            </button>

                            <div className="flex justify-center">
                              {fees?.allPaid ? (
                                <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <span className="rounded bg-green-600 px-1 py-0.5 text-[7px] font-bold text-white">{fees ? `${fees.paidCount}/${fees.totalCount}` : 'Add'}</span>
                              )}
                            </div>

                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => setSelectedLeadId(lead._id)}
                                title="Manage student"
                                className="text-[#0d9488] hover:text-teal-700 p-1 rounded hover:bg-teal-50 transition-colors"
                              >
                                <ManageIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => openFeesTabForLead(lead._id)}
                                title="Manage fees"
                                className={`max-w-full rounded-md px-1.5 py-1 text-left text-[7px] leading-tight ${fees?.allPaid ? 'bg-green-100 text-green-800' : 'bg-emerald-100 text-emerald-800'} hover:ring-1 hover:ring-emerald-300`}
                              >
                                <span className="block font-bold">{fees?.allPaid ? '✓ All Paid' : fees ? 'Fees' : '+ Add'}</span>
                                {fees && <span className="block">₹{fees.totalPaid.toLocaleString()} paid</span>}
                              </button>
                            </div>

                            <div className="flex justify-center">
                              {onDeleteLead && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLeadById(lead._id)}
                                  title="Remove student"
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {members.length > 3 && (
                        <button
                          type="button"
                          onClick={() => toggleBatch(batchKey)}
                          className="mt-2 w-full rounded-md bg-slate-50 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                        >
                          {isOpen ? 'Show less' : `View all ${members.length} students`}
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Batch Modal ── */}
      {batchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setBatchModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Batch Members</h2>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase mt-1 ${getBatchColor(batchModal.code).bg} ${getBatchColor(batchModal.code).border} ${getBatchColor(batchModal.code).text}`}>
                  {batchModal.code}
                </span>
              </div>
              <button onClick={() => setBatchModal(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <XIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {batchModal.members.map(m => (
                <div key={m._id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{m.userName}</p>
                    <p className="text-xs text-slate-400">{m.userNumber}</p>
                  </div>
                  <button
                    onClick={() => {
                      setBatchModal(null);
                      setSelectedLeadId(m._id);
                    }}
                    className="text-[#0d9488] hover:text-teal-700 p-1.5 rounded-lg hover:bg-teal-50 transition-colors flex-shrink-0"
                    title="Manage student"
                  >
                    <ManageIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Pop-up Panel (Strict Match with Reference Image) ── */}
      {selectedLead && (
        <div
          className="fixed inset-y-0 right-0 sm:inset-y-2 sm:right-2 w-full sm:w-[min(94vw,520px)] md:w-[min(38vw,520px)] min-w-0 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-none sm:rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans animate-in slide-in-from-right duration-200"
          style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        >

          {/* Pop-up Header */}
          <div className="p-5 pb-3 border-b border-teal-200 dark:border-teal-900/60 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${getAvatarColor(selectedLead.userName || 'M')}`}>
                  {(selectedLead.userName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate">{selectedLead.userName}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 font-medium">{selectedLead.userNumber}</span>
                    <span
                      role="button"
                      onClick={() => {
                        const num = (selectedLead.userNumber || '').replace(/\D/g, '');
                        if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener');
                      }}
                      className="text-emerald-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-teal-700">College Internship</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedLeadId(null)}
                className="w-7 h-7 rounded-full text-teal-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Pill Tabs Header */}
            <div className="flex gap-1 mt-4 p-1 bg-teal-50 dark:bg-slate-950/80 rounded-2xl border border-transparent dark:border-slate-800">
              {[
                { id: 'details', label: 'CERT DETAILS' },
                { id: 'certificates', label: 'CERTS' },
                { id: 'fees', label: 'FEES' },
                { id: 'lead', label: 'LEAD DETAILS' },
                { id: 'history', label: 'HISTORY' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-teal-100 text-teal-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 dark:bg-slate-900">

            {/* ── CERT DETAILS TAB ── */}
            {activeTab === 'details' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">Internship Certificate Details</p>
                </div>

                {/* Unified Details Card matching Internship theme */}
                <div className="bg-[#f0fdfa] dark:bg-slate-950/70 border border-teal-100/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3.5">Certificate Details</h4>

                  <div className="space-y-3.5">
                    {/* Salutation + Full Name */}
                    <div className="grid grid-cols-12 gap-2.5">
                      <div className="col-span-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Salutation :
                        </label>
                        <div className="relative">
                          <select
                            value={formData.salutation || 'Ms'}
                            onChange={e => handleFieldChange('salutation', e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 pr-7 appearance-none focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer shadow-2xs"
                          >
                            <option value="">Select</option>
                            {SALUTATIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-teal-600">
                            <ChevronDownIcon className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                      <div className="col-span-8">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Full Name :
                        </label>
                        <input
                          type="text"
                          value={formData.userName || ''}
                          onChange={e => handleFieldChange('userName', e.target.value)}
                          placeholder="Student Name"
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Email :
                        </label>
                        <input
                          type="email"
                          value={formData.userEmail || ''}
                          onChange={e => handleFieldChange('userEmail', e.target.value)}
                          placeholder="email@example.com"
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Phone :
                        </label>
                        <input
                          type="text"
                          value={formData.phone || ''}
                          onChange={e => handleFieldChange('phone', e.target.value)}
                          placeholder="Phone number"
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Register No + Year of Study */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Register No. :
                        </label>
                        <input
                          type="text"
                          value={formData.reg_no || ''}
                          onChange={e => handleFieldChange('reg_no', e.target.value)}
                          placeholder="Register Number"
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Year of Study :
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 3rd Year"
                          value={formData.year_of_study || ''}
                          onChange={e => handleFieldChange('year_of_study', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* College */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                        College :
                      </label>
                      <input
                        type="text"
                        value={formData.college || ''}
                        onChange={e => handleFieldChange('college', e.target.value)}
                        placeholder="College name"
                        className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* College Location + Department */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          College Location :
                        </label>
                        <input
                          type="text"
                          value={formData.college_location || ''}
                          onChange={e => handleFieldChange('college_location', e.target.value)}
                          placeholder="City / Location"
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Department :
                        </label>
                        <input
                          type="text"
                          value={formData.department || ''}
                          onChange={e => handleFieldChange('department', e.target.value)}
                          placeholder="Department"
                          className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Degree */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                        Degree :
                      </label>
                      <input
                        type="text"
                        value={formData.degree || ''}
                        onChange={e => handleFieldChange('degree', e.target.value)}
                        placeholder="e.g. B.Tech / BE"
                        className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* Internship Program */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                        Internship Program :
                      </label>
                      <input
                        type="text"
                        value={formData.internship || ''}
                        onChange={e => handleFieldChange('internship', e.target.value)}
                        placeholder="Program Name"
                        className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* Workshop (Optional) */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                        Workshop (Optional) :
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. POWER BI"
                        value={formData.workshop || ''}
                        onChange={e => handleFieldChange('workshop', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                        Company :
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Appin Technology"
                        value={formData.company || ''}
                        onChange={e => handleFieldChange('company', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-teal-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                      />
                    </div>

                    {/* Batch Leader Selection */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1.5 block">
                        Batch Leader :
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => { setIsLeader(false); setIsDirty(true); }}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-full transition-all text-xs font-bold ${
                            !isLeader
                              ? 'bg-teal-50 text-teal-800 border border-teal-300 shadow-2xs'
                              : 'bg-white text-slate-400 border border-slate-200 hover:bg-teal-50/40 hover:text-teal-700 hover:border-teal-200 font-medium'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${!isLeader ? 'bg-teal-600' : 'bg-slate-300'}`} />
                          Not Leader
                        </button>

                        <button
                          type="button"
                          onClick={() => { setIsLeader(prev => !prev); setIsDirty(true); }}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-full transition-all text-xs font-bold uppercase tracking-wider ${
                            isLeader
                              ? 'bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-amber-50/50 hover:border-amber-200'
                          }`}
                        >
                          <CrownIcon className={`w-3.5 h-3.5 ${isLeader ? 'text-amber-600' : 'text-slate-400'}`} />
                          LEADER
                        </button>
                      </div>
                    </div>

                    {/* Batch Code + Generate Button */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                        Batch Code :
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            readOnly
                            value={formData.batch_code || ''}
                            className="w-full bg-white border border-teal-200/90 text-slate-900 font-mono font-bold text-xs rounded-xl py-2 px-3 pr-7 uppercase tracking-wider shadow-2xs"
                          />
                          <span className="w-2 h-2 rounded-full bg-teal-500 absolute right-2.5 top-3 animate-pulse" />
                        </div>

                        <button
                          type="button"
                          onClick={() => copyBatchCode(formData.batch_code || '')}
                          title="Copy batch code"
                          className="p-2 rounded-xl border border-teal-200/90 bg-white hover:bg-teal-50 text-teal-700 transition-colors shadow-2xs"
                        >
                          <CopyIcon className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={handleGenerateBatch}
                          disabled={generatingBatch}
                          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                        >
                          <RefreshIcon className={`w-3 h-3 ${generatingBatch ? 'animate-spin' : ''}`} />
                          Generate
                        </button>
                      </div>
                      <p className="text-[9.5px] text-teal-800/60 font-medium mt-1">
                        Auto-generates from college name + start date (e.g. BATCH-KRP-04-25)
                      </p>
                    </div>

                    {/* Dates Row */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Start Date :
                        </label>
                        <input
                          type="date"
                          value={formData.start_date || ''}
                          onChange={e => handleFieldChange('start_date', e.target.value)}
                          className="w-full bg-white border border-teal-200/90 text-slate-900 font-semibold text-xs rounded-xl py-1.5 px-2 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          End Date :
                        </label>
                        <input
                          type="date"
                          value={formData.end_date || ''}
                          onChange={e => handleFieldChange('end_date', e.target.value)}
                          className="w-full bg-white border border-teal-200/90 text-slate-900 font-semibold text-xs rounded-xl py-1.5 px-2 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1 block">
                          Issue Date :
                        </label>
                        <input
                          type="date"
                          value={formData.issue_date || ''}
                          onChange={e => handleFieldChange('issue_date', e.target.value)}
                          className="w-full bg-white border border-teal-200/90 text-slate-900 font-semibold text-xs rounded-xl py-1.5 px-2 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons inside Details Tab */}
                <div className="pt-1.5 space-y-2 shrink-0">
                  <button
                    onClick={handleSave}
                    disabled={loading || !isDirty}
                    className="w-full py-3 px-5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : null}
                    {loading ? 'Saving Details...' : 'Save Certificate Details'}
                  </button>

                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full py-3 px-5 bg-[#0f766e] hover:bg-[#115e59] text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {generating ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : null}
                    {generating ? 'Generating...' : 'Generate Certificates'}
                  </button>
                </div>
              </div>
            )}

            {/* ── CERTS TAB ── */}
            {activeTab === 'certificates' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={handlePrintAll}
                    disabled={printingAll || generatedCerts.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    Print All
                  </button>
                </div>

                <div className="space-y-3">
                  {generatedCerts.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-8 border border-dashed border-slate-200 rounded-2xl">
                      No certificates generated yet.
                    </p>
                  ) : (
                    generatedCerts.map((cert, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800">Certificate {idx + 1}</p>
                            <p className="text-[9px] text-slate-400 truncate mt-0.5">{cert.fileName || 'certificate_document.pdf'}</p>
                          </div>
                        </div>
                        {cert.s3?.url && (
                          <button
                            onClick={() => window.open(cert.s3!.url, '_blank', 'noopener')}
                            className="text-xs font-bold text-teal-700 hover:underline shrink-0"
                          >
                            View
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── FEES TAB ── */}
            {activeTab === 'fees' && (
              <div className="space-y-6">
                {/* Summary Progress Bars matching Course Enrolled / Image 2 */}
                <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5 sm:space-y-3">
                  {/* Row 1: Billed */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 w-14 shrink-0">Billed</span>
                    <span className="text-xs text-slate-400 font-normal shrink-0">( ₹ )</span>
                    <div className="w-16 sm:w-20 shrink-0 flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={feesBilledAmount}
                        onChange={e => handleFeesBilledAmountChange(e.target.value)}
                        onFocus={e => !isBilledAmountLocked && e.target.select()}
                        readOnly={isBilledAmountLocked}
                        className={`font-bold text-slate-900 text-base sm:text-lg tracking-tight bg-transparent border-none border-0 outline-none focus:outline-none focus:ring-0 focus:border-none p-0 m-0 w-full shadow-none ${isBilledAmountLocked ? 'cursor-not-allowed' : 'cursor-text'}`}
                        style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                        placeholder="0"
                        title={isBilledAmountLocked ? 'Only admins can change the billed amount once set' : 'Click to edit billed amount'}
                      />
                      {isBilledAmountLocked && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-[70px]">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-[#1d4ed8] h-full rounded-full w-full" />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Paid */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 w-14 shrink-0">Paid</span>
                    <span className="text-xs text-slate-400 font-normal shrink-0">( ₹ )</span>
                    <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight w-16 sm:w-20 shrink-0 truncate">
                      {feesPaidAmount.toLocaleString('en-IN')}
                    </span>
                    <div className="flex-1 min-w-[70px]">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-[#16a34a] h-full rounded-full transition-all duration-300"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Pending */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 w-14 shrink-0">Pending</span>
                    <span className="text-xs text-slate-400 font-normal shrink-0">( ₹ )</span>
                    <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight w-16 sm:w-20 shrink-0 truncate">
                      {feesBalanceAmount.toLocaleString('en-IN')}
                    </span>
                    <div className="flex-1 min-w-[70px]">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-[#dc2626] h-full rounded-full transition-all duration-300"
                          style={{ width: `${pendingPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Installments Header + Button */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">Installments details</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {feesInstallments.length} Total · {pendingInstallments.length} Pending
                    </p>
                  </div>
                  <button
                    onClick={handleAddInstallment}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-full shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    + Add Installment
                  </button>
                </div>

                {/* Installment List */}
                <div className="space-y-4">
                  {feesInstallments.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No installments added yet. Click "+ Add Installment" above.
                    </p>
                  ) : (
                    feesInstallments.map((inst, index) => {
                      const installmentLabel =
                        index === 0 ? '1st Installment' : index === 1 ? '2nd Installment' : index === 2 ? '3rd Installment' : `${index + 1}th Installment`;

                      return (
                        <div
                          key={index}
                          className="p-5 rounded-3xl border border-teal-100/70 bg-white shadow-xs space-y-4 relative hover:border-teal-200 transition-colors"
                        >
                          {/* Title & Delete */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 underline underline-offset-4 decoration-slate-300">
                              {installmentLabel}
                            </span>
                            <button
                              onClick={() => handleDeleteInstallment(index)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                              title="Delete installment"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Due Date Row */}
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-xs font-semibold text-slate-700">Due Date:</label>
                            <div className="relative flex-1 max-w-[200px]">
                              <input
                                type="date"
                                value={inst.dueDate ? (parseDate(inst.dueDate) || '') : ''}
                                onChange={e => handleInstallmentChange(index, 'dueDate', e.target.value)}
                                className="w-full text-right pr-3 pl-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl outline-none focus:border-teal-600 transition-colors"
                              />
                            </div>
                          </div>

                          {/* Amount Row */}
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-xs font-semibold text-slate-700">Amount:</label>
                            <div className="relative flex-1 max-w-[200px]">
                              <input
                                type="text"
                                value={inst.amount.toLocaleString('en-IN')}
                                onChange={e => handleInstallmentChange(index, 'amount', Number(e.target.value.replace(/,/g, '')))}
                                className="w-full text-right pr-8 pl-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl outline-none focus:border-teal-600 transition-colors"
                              />
                              <span className="text-xs font-bold text-teal-600 absolute right-3 top-2.5 pointer-events-none">₹</span>
                            </div>
                          </div>

                          {/* Status Row */}
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-xs font-semibold text-slate-700">Status:</label>
                            <div className="w-1/2 flex justify-end">
                              <select
                                value={inst.status}
                                onChange={e => handleInstallmentChange(index, 'status', e.target.value)}
                                className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold outline-none transition-colors ${
                                  inst.status === 'Paid'
                                    ? 'border-teal-300 text-teal-700 bg-teal-50'
                                    : 'border-amber-300 text-amber-700 bg-amber-50'
                                }`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                              </select>
                            </div>
                          </div>

                          {/* View Bill Button */}
                          <div className="pt-2">
                            <button
                              onClick={() => handleGenerateBill(index)}
                              disabled={feesGeneratingIndex === index}
                              className="py-2.5 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {feesGeneratingIndex === index ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : null}
                              {feesGeneratingIndex === index ? 'Generating...' : 'View Bill'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Save Fees Button */}
                {feesDirty ? (
                  <button
                    onClick={handleSaveFees}
                    disabled={feesLoading}
                    style={{ color: '#ffffff' }}
                    className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white !text-white font-bold text-sm rounded-2xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {feesLoading ? <RefreshIcon className="w-4 h-4 animate-spin text-white" /> : null}
                    <span className="text-white !text-white font-bold">{feesLoading ? 'Saving Fees...' : 'Save Fees'}</span>
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-2">All changes are saved</p>
                )}
              </div>
            )}

            {/* ── LEAD DETAILS TAB ── */}
            {activeTab === 'lead' && (
              <div className="space-y-4">
                {/* Actions: Edit Lead & Delete Lead */}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => onEditLead?.(selectedLead)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <EditIcon className="w-3.5 h-3.5" /> Edit Lead
                  </button>
                  {currentUserRole === 'admin' && (
                    <button
                      onClick={() => { if (!window.confirm('Delete this lead permanently?')) return; onDeleteLead?.(selectedLead._id); setSelectedLeadId(null); }}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all"
                    >
                      <TrashIcon className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>

                {/* Status & Pipeline */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1.5 block">STATUS</label>
                    <div className="relative">
                      <select
                        value={selectedLead.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        disabled={leadLoading}
                        className="w-full bg-white border border-teal-200/90 text-slate-900 font-semibold text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-teal-600 appearance-none pr-8 cursor-pointer transition-colors"
                      >
                        <option value="Hot">Hot</option>
                        <option value="Warm">Warm</option>
                        <option value="Cold">Cold</option>
                      </select>
                      <ChevronDownIcon className="w-3.5 h-3.5 text-teal-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1.5 block">PIPELINE</label>
                    <div className="w-full bg-[#f0fdfa] border border-teal-100/90 text-teal-800 font-semibold text-xs rounded-xl py-2.5 px-3">
                      {selectedLead.pipeline || 'Enrolled'}
                    </div>
                  </div>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1.5 block">ASSIGNED TO</label>
                  {currentUserRole === 'admin' ? (
                    <div className="relative">
                      <select
                        value={selectedLead.assignedto || ''}
                        onChange={e => handleAssign(e.target.value)}
                        disabled={leadLoading}
                        className="w-full bg-white border border-teal-200/90 text-slate-900 font-semibold text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-teal-600 appearance-none pr-8 cursor-pointer transition-colors"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                      </select>
                      <ChevronDownIcon className="w-3.5 h-3.5 text-teal-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="w-full bg-[#f0fdfa] border border-teal-100/90 text-teal-800 font-semibold text-xs rounded-xl py-2.5 px-3">
                      {selectedLead.assignedto || <span className="text-slate-400 italic">Unassigned</span>}
                    </div>
                  )}
                </div>

                {/* Unified Lead Information Card matching Internship Theme */}
                <div className="bg-[#f0fdfa] dark:bg-slate-950/70 border border-teal-100/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
                  <h4 className="text-base font-bold text-slate-900 mb-4">Lead Information</h4>

                  <div className="space-y-4">
                    {/* Row 1: COURSE & SOURCE */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1">COURSE</p>
                        <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                          {selectedLead.course || 'College Internship'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1">SOURCE</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.leadfrom || 'Website'}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: PROGRAM TYPE & PROFESSION */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1">PROGRAM TYPE</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.programType || '2 Hours'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1">PROFESSION</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.profession || 'Job Seeker'}
                        </span>
                      </div>
                    </div>

                    {selectedLead.referredBy && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 mb-1">REFERRED BY</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.referredBy}
                        </span>
                      </div>
                    )}

                    {/* Date Scheduled */}
                    <div className="space-y-1 pt-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70 dark:text-teal-400 mb-1 block">Date Scheduled</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dateScheduled}
                          onChange={e => setDateScheduled(e.target.value)}
                          disabled={leadLoading}
                          className="w-full bg-white dark:bg-slate-900 border border-teal-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-teal-600"
                        />
                        <button
                          onClick={handleDateScheduledSave}
                          disabled={leadLoading}
                          className="flex-shrink-0 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarks Section */}
                <div className="space-y-3 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70">
                    Remarks ({(selectedLead.remarks || []).length})
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a remark..."
                      value={newRemark}
                      onChange={e => setNewRemark(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddRemark(); }}
                      disabled={leadLoading}
                      className="flex-1 px-3.5 py-2.5 bg-white border border-teal-200/90 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-600 transition-colors"
                    />
                    <button
                      onClick={handleAddRemark}
                      disabled={!newRemark.trim() || leadLoading}
                      className="w-9 h-9 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors flex items-center justify-center shadow-xs disabled:opacity-50 shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(selectedLead.remarks || []).length === 0 ? (
                      <p className="text-center text-slate-400 text-xs italic py-6">No remarks yet</p>
                    ) : (
                      [...(selectedLead.remarks || [])].reverse().map(r => (
                        <div key={r._id} className="group p-3 bg-[#f0fdfa] dark:bg-slate-900/60 rounded-2xl border border-teal-100/80 dark:border-slate-800 flex justify-between gap-3 items-center">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-normal flex-1">{r.remark}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] text-teal-700/60 dark:text-teal-400 font-bold">
                              {formatRemarkDate(r.timestamp)}{r.addedBy ? ' · ' + r.addedBy : ''}
                            </span>
                            <button
                              onClick={() => handleDeleteRemark(r._id)}
                              disabled={leadLoading}
                              className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete remark"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
              <div className="space-y-5">
                {/* Campaign History Section */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70">
                    Campaign History ({(selectedLead.campaignHistory || []).length})
                  </p>
                  {(selectedLead.campaignHistory || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-4 bg-teal-50/40 rounded-2xl border border-dashed border-teal-200/60">
                      No campaign message sent yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...(selectedLead.campaignHistory || [])].reverse().map((c, i) => (
                        <div key={i} className="p-3.5 bg-teal-50/60 hover:bg-teal-50 rounded-2xl border border-teal-100/70 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-800 truncate">{c.campaignName}</p>
                            {c.repliedAt ? (
                              <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-teal-100 text-teal-700">
                                Replied
                              </span>
                            ) : (
                              <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-200 text-slate-600">
                                No reply yet
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 font-semibold">
                            Sent {formatRemarkDate(c.sentAt)}{c.repliedAt ? ` · Replied ${formatRemarkDate(c.repliedAt)}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conversation History Section (Extended freely below) */}
                <div className="space-y-2.5 pb-6">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900/70">
                    Conversation History ({(selectedLead.conversations || []).length})
                  </p>

                  {(selectedLead.conversations || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-6 bg-teal-50/40 rounded-2xl border border-dashed border-teal-200/60">
                      No conversation history found
                    </p>
                  ) : (
                    <div className="p-4 sm:p-5 bg-[#f0fdfa]/70 dark:bg-slate-950/70 border border-teal-100/90 dark:border-slate-800 rounded-3xl space-y-4 shadow-xs">
                      {chatTimeline.map((group) => (
                        <div key={group.dayKey} className="space-y-3">
                          <div className="flex justify-center sticky top-0 z-10 py-0.5">
                            <span className="px-3.5 py-1 rounded-full bg-white/95 dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200/80 dark:border-amber-700/50 uppercase tracking-wider shadow-2xs">
                              {group.dayLabel}
                            </span>
                          </div>

                          {group.items.map((c, i) => {
                            const msgDate = toDateObjectChat(c.timestamp);
                            const timeLabel = formatChatTime(msgDate);

                            return (
                              <div key={`${group.dayKey}-${i}`} className="space-y-2">
                                {c.userMsg && (
                                  <div className="flex flex-col items-end">
                                    <div className="bg-teal-600 text-white p-3.5 rounded-2xl rounded-tr-none text-xs max-w-[85%] shadow-xs leading-relaxed font-medium">
                                      <p>{c.userMsg}</p>
                                      {timeLabel && (
                                        <div className="text-[9px] text-teal-100 mt-1.5 text-right font-normal">
                                          {timeLabel}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {c.botReply && (
                                  <div className="flex flex-col items-start">
                                    <div className="bg-white text-slate-800 p-3.5 rounded-2xl rounded-tl-none text-xs max-w-[85%] border border-teal-100/90 shadow-xs leading-relaxed font-medium">
                                      {(c.botReply || '').split('\n').map((line, j) => (
                                        <p key={j} className="mb-1 last:mb-0">{line}</p>
                                      ))}
                                      {timeLabel && (
                                        <div className="text-[9px] text-slate-400 mt-1.5 text-right font-normal">
                                          {timeLabel}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <MessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        recipientCount={selectedMsgIds.size}
        onSend={handleSendMessage}
        isSending={isSendingMessage}
        campaignNames={campaignNames}
      />
    </div>
  );
};

export default InternshipEnrolledView;