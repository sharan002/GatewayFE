import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lead, User, Installment, CourseCertificateDetail, CourseCertificateResult, IdCardDetail, IdCardResult } from '../types';
import { apiService } from '../services/api';
import { Icons } from './Icons';
import { FilterState } from '../App';
import MessageModal from './MessageModal';
import { COURSES } from './FilterPanel';
import { getTrainerShortCode, getCourseShortCode, formatTime12h } from '../utils/batchCode';

interface CourseEnrolledViewProps {
  leads: Lead[];
  users: User[];
  currentUserRole?: string;
  onUpdateLead: (lead: Lead) => void;
  onDeleteLead?: (id: string) => void;
  onEditLead?: (lead: Lead) => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}

/** Deterministic pastel color for a batch code string */
function batchColor(code: string): { bg: string; border: string; text: string; dot: string } {
  const palette = [
    { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-400' },
    { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-400' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-400' },
    { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-400' },
    { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
    { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', dot: 'bg-lime-400' },
    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-400' },
  ];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) & 0xffff;
  return palette[hash % palette.length];
}

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

const CourseEnrolledView: React.FC<CourseEnrolledViewProps> = ({
  leads,
  users,
  currentUserRole,
  onUpdateLead,
  onDeleteLead,
  onEditLead,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'idcard' | 'batch' | 'fees' | 'lead' | 'cert' | 'history'>('batch');
  const requestedTabRef = useRef<'idcard' | 'batch' | 'fees' | 'lead' | 'cert' | 'history' | null>(null);
  const requestedEditModeRef = useRef<boolean>(false);
  const internalRequestIdRef = useRef(0);

  // Trainers
  const [trainers, setTrainers] = useState<{ _id: string; username: string; batchIds: string[] }[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(false);

  // Batch form state
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [batchForm, setBatchForm] = useState({ batchId: '', trainer: '', batchDate: '', startTime: '', endTime: '' });
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fees state
  const [feesBilledAmount, setFeesBilledAmount] = useState('0');
  const [feesInstallments, setFeesInstallments] = useState<Installment[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesDirty, setFeesDirty] = useState(false);
  const [feesGeneratingIndex, setFeesGeneratingIndex] = useState<number | null>(null);

  // Lead tab state
  const [leadLoading, setLeadLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');

  // Certificate tab state
  const emptyCertForm = (): CourseCertificateDetail => ({
    salutation: '', userName: '', course: '', issue_date: null, project_title: '', intern_title: '',
  });
  const [certForm, setCertForm] = useState<CourseCertificateDetail>(emptyCertForm());
  const [certDirty, setCertDirty] = useState(false);
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [isPrintingCert, setIsPrintingCert] = useState(false);
  const [generatedCourseCerts, setGeneratedCourseCerts] = useState<CourseCertificateResult[]>([]);

  // ID Card tab state
  const emptyIdCardForm = (): IdCardDetail => ({
    dob: null, address: '', idNo: '', classStart: null, validTill: null, photoUrl: '',
  });
  const [idCardForm, setIdCardForm] = useState<IdCardDetail>(emptyIdCardForm());
  const [idCardEditMode, setIdCardEditMode] = useState(false);
  const [idCardDirty, setIdCardDirty] = useState(false);
  const [isSavingIdCard, setIsSavingIdCard] = useState(false);
  const [isGeneratingIdCard, setIsGeneratingIdCard] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [generatedIdCards, setGeneratedIdCards] = useState<IdCardResult[]>([]);
  const [validTillTouched, setValidTillTouched] = useState(false);

  // View/filter state
  const [viewMode, setViewMode] = useState<'list' | 'batch'>('list');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [batchModal, setBatchModal] = useState<{ code: string; members: Lead[] } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery ?? localSearchQuery;
  const setSearchQuery = onSearchQueryChange ?? setLocalSearchQuery;

  const [internalLeads, setInternalLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [enrolledBatches, setEnrolledBatches] = useState<string[]>([]);
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const MSG_CHUNK_LIMIT = 200;

  // Messaging mode
  const [isMessagingMode, setIsMessagingMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [isSelectingAllMsg, setIsSelectingAllMsg] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);

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
    batch: '',
    assignedUser: '',
    source: '',
  };
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // ----- Derived state -----

  // Server already filters — internalLeads is the current page of matching leads
  const filteredLeads = internalLeads;

  const hasActiveFilters = useMemo(() => {
    return !!(filters.batch || filters.assignedUser || filters.source || filters.fromDate || filters.toDate || (filters.campaigns && filters.campaigns.length > 0) || (filters.courses && filters.courses.length > 0));
  }, [filters]);

  const batchGroups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of filteredLeads) {
      const key = (lead.batchId || '').trim() || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return a.localeCompare(b);
    });
  }, [filteredLeads]);

  const selectedLead = useMemo(() => internalLeads.find(l => l._id === selectedLeadId) ?? null, [internalLeads, selectedLeadId]);

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

  // ----- Effects -----

  useEffect(() => {
    if (!selectedLead) return;
    setBatchForm({
      batchId: selectedLead.batchId || '',
      trainer: selectedLead.Trainer || '',
      batchDate: selectedLead.batch_date || '',
      startTime: selectedLead.batch_start_time || '',
      endTime: selectedLead.batch_end_time || '',
    });
    const editMode = requestedEditModeRef.current;
    requestedEditModeRef.current = false;
    setBatchEditMode(editMode);
    setFeesBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
    setFeesInstallments(selectedLead.fees?.installments || []);
    setFeesDirty(false);
    setFeesGeneratingIndex(null);
    setNewRemark('');

    const latestCert = Array.isArray(selectedLead.CourseCertDetails) && selectedLead.CourseCertDetails.length
      ? selectedLead.CourseCertDetails[selectedLead.CourseCertDetails.length - 1]
      : null;
    setCertForm(latestCert ? {
      salutation: latestCert.salutation || '',
      userName: latestCert.userName || selectedLead.userName || '',
      course: latestCert.course || selectedLead.course || '',
      issue_date: parseDate(latestCert.issue_date) || null,
      project_title: latestCert.project_title || '',
      intern_title: latestCert.intern_title || '',
    } : { ...emptyCertForm(), userName: selectedLead.userName || '', course: selectedLead.course || '' });
    setCertDirty(false);
    setGeneratedCourseCerts(selectedLead.courseCertificates || []);

    const latestIdCard = Array.isArray(selectedLead.IdCardDetails) && selectedLead.IdCardDetails.length
      ? selectedLead.IdCardDetails[selectedLead.IdCardDetails.length - 1]
      : null;
    setIdCardForm(latestIdCard ? {
      dob: parseDate(latestIdCard.dob) || null,
      address: latestIdCard.address || '',
      idNo: latestIdCard.idNo || selectedLead._id,
      classStart: parseDate(latestIdCard.classStart) || selectedLead.batch_date || null,
      validTill: parseDate(latestIdCard.validTill) || null,
      photoUrl: latestIdCard.photoUrl || '',
    } : { ...emptyIdCardForm(), idNo: selectedLead._id, classStart: selectedLead.batch_date || null });
    setValidTillTouched(!!parseDate(latestIdCard?.validTill));
    setIdCardEditMode(false);
    setIdCardDirty(false);
    setGeneratedIdCards(selectedLead.idCards || []);

    const tab = requestedTabRef.current ?? 'batch';
    setActiveTab(tab);
    requestedTabRef.current = null;
  }, [selectedLeadId]);

  // Keep fees in sync when lead updates externally (e.g. status changes)
  useEffect(() => {
    if (!selectedLead || feesDirty) return;
    setFeesBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
    setFeesInstallments(selectedLead.fees?.installments || []);
  }, [selectedLead?.fees]);

  // Fetch trainers once on mount
  useEffect(() => {
    setTrainersLoading(true);
    apiService.getTrainers()
      .then(data => { if (data.success) setTrainers(data.trainers); })
      .catch(() => {})
      .finally(() => setTrainersLoading(false));
  }, []);

  // Fetch all distinct batch codes for the filter dropdown (always the full list)
  useEffect(() => {
    let mounted = true;
    apiService.getEnrolledBatches().then(list => {
      if (mounted && list.length > 0) setEnrolledBatches(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Fetch known campaign names for the message modal dropdown
  useEffect(() => {
    let mounted = true;
    apiService.getCampaignNames().then(list => {
      if (mounted) setCampaignNames(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Core fetch: one page at a time from the server
  const fetchPage = async (page: number, query: string, currentFilters: FilterState) => {
    const requestId = ++internalRequestIdRef.current;
    setIsLoadingInternal(true);
    try {
      const res = await apiService.queryLeads({
        view: 'course-enrolled',
        page,
        limit: PAGE_SIZE,
        includeStats: false,
        mode: 'full',
        searchQuery: query,
        filters: {
          batch: currentFilters.batch || '',
          assignedUser: currentFilters.assignedUser || '',
          source: currentFilters.source || '',
          fromDate: currentFilters.fromDate || '',
          toDate: currentFilters.toDate || '',
          campaigns: currentFilters.campaigns || [],
          courses: currentFilters.courses || [],
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

  // When search or filters change, reset to page 1 and fetch
  useEffect(() => {
    setCurrentPage(1);
    void fetchPage(1, searchQuery, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters]);

  // When page changes (not due to filter reset), fetch that page
  useEffect(() => {
    void fetchPage(currentPage, searchQuery, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Exiting messaging mode (or a change of query) invalidates any prior selection
  useEffect(() => {
    setSelectedMsgIds(new Set());
  }, [searchQuery, filters]);

  // ----- Messaging mode -----

  const toggleMsgSelection = (id: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Fetches every lead matching the current search/filters (not just the loaded page) in chunks
  const fetchAllMatchingLeadIds = async (query: string, currentFilters: FilterState): Promise<string[]> => {
    let page = 1;
    let total = 0;
    let ids: string[] = [];
    while (true) {
      const res = await apiService.queryLeads({
        view: 'course-enrolled',
        page,
        limit: MSG_CHUNK_LIMIT,
        includeStats: false,
        mode: 'summary',
        searchQuery: query,
        filters: {
          batch: currentFilters.batch || '',
          assignedUser: currentFilters.assignedUser || '',
          source: currentFilters.source || '',
          fromDate: currentFilters.fromDate || '',
          toDate: currentFilters.toDate || '',
          campaigns: currentFilters.campaigns || [],
          courses: currentFilters.courses || [],
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

  // ----- Helpers -----

  const handleUpdateLead = (updated: Lead) => {
    setInternalLeads(prev => prev.map(l => l._id === updated._id ? updated : l));
    onUpdateLead(updated);
  };

  const parseDate = (d: any): string => {
    if (!d) return '';
    if (typeof d === 'string') return d.split('T')[0];
    if (d.$date) return d.$date.split('T')[0];
    return '';
  };

  const formatDDMMYYYY = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const addMonthsToDateString = (dateStr: string, months: number): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const formatRemarkDate = (ts: any) => {
    const d = typeof ts === 'string' ? ts : ts?.$date;
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatFeesDateTime = (dateString: any) => {
    const raw = typeof dateString === 'string' ? dateString : dateString?.$date;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const copyBatchCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const openFeesTab = (leadId: string) => {
    requestedTabRef.current = 'fees';
    setSelectedLeadId(leadId);
  };

  const openInEditMode = (leadId: string) => {
    requestedTabRef.current = 'batch';
    requestedEditModeRef.current = true;
    setSelectedLeadId(leadId);
  };

  // ----- Fees computed -----

  const feesPaidAmount = feesInstallments.filter(i => i.status === 'Paid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const feesBalanceAmount = Math.max((parseFloat(feesBilledAmount) || 0) - feesPaidAmount, 0);
  const pendingInstallments = feesInstallments.filter(i => i.status === 'Pending');
  const overdueInstallments = pendingInstallments.filter(inst => {
    const dv = parseDate(inst.dueDate);
    if (!dv || inst.amount <= 0) return false;
    const due = new Date(dv);
    if (isNaN(due.getTime())) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return due < today;
  });

  // Certificates can only be generated once billing is set up (billed amount > 0) and fully paid:
  // no pending installments AND no outstanding balance (covers the case where billing is set but no installments/payments exist yet)
  const canGenerateCourseCert = (parseFloat(feesBilledAmount) || 0) > 0 && pendingInstallments.length === 0 && feesBalanceAmount === 0;

  // ----- Batch actions -----

  const handleSaveBatch = async () => {
    if (!selectedLead) return;
    if (!batchForm.trainer) { alert('Please select a trainer first.'); return; }
    const isGeneratingNewBatchCode = !batchForm.batchId || batchForm.batchId === '__new__';
    if (isGeneratingNewBatchCode && (!batchForm.startTime || !batchForm.endTime)) {
      alert('Please set both Start Time and End Time before generating a batch code.');
      return;
    }
    try {
      setIsSavingBatch(true);
      const batchIdToSend = (!batchForm.batchId || batchForm.batchId === '__new__') ? undefined : batchForm.batchId;
      const result = await apiService.saveBatch(selectedLead._id, {
        batchId: batchIdToSend,
        batch_date: batchForm.batchDate || undefined,
        batch_start_time: batchForm.startTime || undefined,
        batch_end_time: batchForm.endTime || undefined,
        Trainer: batchForm.trainer,
        course: selectedLead.course || undefined,
        programType: selectedLead.programType || undefined,
      });
      if (result.success) {
        const updated: Lead = {
          ...selectedLead,
          batchId: result.batchId ?? batchForm.batchId,
          Trainer: result.Trainer ?? batchForm.trainer,
          batch_date: result.batch_date ?? batchForm.batchDate,
          batch_start_time: result.batch_start_time ?? batchForm.startTime,
          batch_end_time: result.batch_end_time ?? batchForm.endTime,
        };
        handleUpdateLead(updated);
        setBatchForm({
          batchId: result.batchId || batchForm.batchId,
          trainer: result.Trainer || batchForm.trainer,
          batchDate: result.batch_date || batchForm.batchDate,
          startTime: result.batch_start_time || batchForm.startTime,
          endTime: result.batch_end_time || batchForm.endTime,
        });
        setBatchEditMode(false);
      } else {
        alert(result.message || 'Failed to save batch details.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save batch details.');
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleAutoGenerateBatch = async () => {
    if (!selectedLead) return;
    if (!batchForm.trainer) { alert('Please select a trainer before generating a batch code.'); return; }
    if (!batchForm.startTime || !batchForm.endTime) {
      alert('Please set both Start Time and End Time before generating a batch code.');
      setBatchEditMode(true);
      return;
    }
    try {
      setIsGeneratingBatch(true);
      const result = await apiService.saveBatch(selectedLead._id, {
        batchId: undefined,
        batch_date: batchForm.batchDate || undefined,
        batch_start_time: batchForm.startTime || undefined,
        batch_end_time: batchForm.endTime || undefined,
        Trainer: batchForm.trainer,
        course: selectedLead.course || undefined,
        programType: selectedLead.programType || undefined,
      });
      if (result.success) {
        const updated: Lead = {
          ...selectedLead,
          batchId: result.batchId,
          Trainer: result.Trainer ?? batchForm.trainer,
          batch_date: result.batch_date ?? batchForm.batchDate,
          batch_start_time: result.batch_start_time ?? batchForm.startTime,
          batch_end_time: result.batch_end_time ?? batchForm.endTime,
        };
        handleUpdateLead(updated);
        setBatchForm(prev => ({
          ...prev,
          batchId: result.batchId || prev.batchId,
          trainer: result.Trainer || prev.trainer,
          batchDate: result.batch_date || prev.batchDate,
          startTime: result.batch_start_time || prev.startTime,
          endTime: result.batch_end_time || prev.endTime,
        }));
        setBatchEditMode(false);
      } else {
        alert(result.message || 'Failed to generate batch code.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate batch code.');
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // A batch code is only auto-generated when no existing code is selected; timings are required for that.
  const isGeneratingNewBatchCode = !batchForm.batchId || batchForm.batchId === '__new__';

  // ----- Fees actions -----

  // Billed amount is locked for non-admins once a value has been saved
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
    setFeesInstallments([...feesInstallments, { number: nextNumber, dueDate: new Date().toISOString().split('T')[0], amount: 0, status: 'Pending' }]);
    setFeesDirty(true);
  };

  const handleInstallmentChange = async (index: number, field: keyof Installment, value: any) => {
    const next = [...feesInstallments];
    next[index] = { ...next[index], [field]: value };
    setFeesInstallments(next);

    if (field !== 'status' || !selectedLead) {
      setFeesDirty(true);
      return;
    }
    try {
      setFeesLoading(true);
      const response = await apiService.updateLeadFees(selectedLead._id, {
        billedAmount: parseFloat(feesBilledAmount) || 0,
        installments: next.map((inst, idx) => ({ ...inst, number: idx + 1 })),
      });
      if (response?.lead) {
        handleUpdateLead(response.lead);
        setFeesDirty(false);
      } else {
        setFeesDirty(true);
      }
    } catch {
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
        installments: feesInstallments.map((inst, idx) => ({ ...inst, number: idx + 1 })),
      });
      if (response?.lead) {
        handleUpdateLead(response.lead);
        setFeesDirty(false);
        alert('Fees updated successfully!');
      } else {
        alert('Fees updated, but could not refresh automatically. Please reload.');
      }
    } catch {
      alert('Failed to update fees.');
    } finally {
      setFeesLoading(false);
    }
  };

  const handleCancelFees = () => {
    if (!selectedLead) return;
    setFeesBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
    setFeesInstallments(selectedLead.fees?.installments || []);
    setFeesDirty(false);
  };

  const handleGenerateBill = async (index: number) => {
    if (!selectedLead) return;
    setFeesGeneratingIndex(index);
    try {
      const response = await apiService.generateBill(selectedLead._id, index, false);
      const updatedInstallments = feesInstallments.map((inst, idx) =>
        idx === index
          ? { ...inst, billGenerated: response.billGenerated ?? true, billUrl: response.details?.billUrl || response.details?.billFile || inst.billUrl, billGeneratedAt: new Date().toISOString() }
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
      if (response.details?.billUrl) window.open(response.details.billUrl, '_blank', 'noopener');
      alert(response.message || 'Bill generated');
    } catch {
      alert('Failed to generate bill');
    } finally {
      setFeesGeneratingIndex(null);
    }
  };

  // ----- Lead tab actions -----

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

  const handleDeleteRemark = async (remarkId: string) => {
    if (!selectedLead) return;
    try {
      setLeadLoading(true);
      const updated = await apiService.deleteRemark(selectedLead._id, remarkId);
      handleUpdateLead(updated);
    } catch { alert('Failed to delete remark'); } finally { setLeadLoading(false); }
  };

  // ----- Certificate tab actions -----

  const handleCertFieldChange = (field: keyof CourseCertificateDetail, value: any) => {
    setCertForm(prev => ({ ...prev, [field]: value }));
    setCertDirty(true);
  };

  const handleSaveCourseCert = async () => {
    if (!selectedLead) return;
    try {
      setIsSavingCert(true);
      const result = await apiService.saveCourseCertificateDetails({
        userNumber: selectedLead.userNumber,
        ...certForm,
      });
      if (result.success && result.chat) {
        handleUpdateLead({ ...selectedLead, CourseCertDetails: result.chat.CourseCertDetails || [] });
        setCertDirty(false);
      } else {
        alert(result.message || 'Failed to save certificate details.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save certificate details.');
    } finally {
      setIsSavingCert(false);
    }
  };

  const handleGenerateCourseCert = async () => {
    if (!selectedLead) return;
    try {
      setIsGeneratingCert(true);
      const result = await apiService.generateCourseCompletionCertificate(selectedLead.userNumber);
      if (result.success) {
        const certs: CourseCertificateResult[] = result.certificates || [];
        setGeneratedCourseCerts(certs);
        handleUpdateLead({ ...selectedLead, courseCertificates: certs });
      } else {
        alert(result.message || 'Failed to generate certificates.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate certificates.');
    } finally {
      setIsGeneratingCert(false);
    }
  };

  const handlePrintAllCourseCerts = async () => {
    if (!selectedLead) return;
    try {
      setIsPrintingCert(true);
      const result = await apiService.printAllCourseCertificates(selectedLead.userNumber);
      if (result.success && result.url) {
        window.open(result.url, '_blank', 'noopener');
      } else {
        alert(result.message || 'Failed to generate combined certificate.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate combined certificate.');
    } finally {
      setIsPrintingCert(false);
    }
  };

  // ----- ID Card actions -----

  const handleIdCardFieldChange = (field: keyof IdCardDetail, value: any) => {
    if (field === 'validTill') {
      setValidTillTouched(true);
      setIdCardForm(prev => ({ ...prev, validTill: value }));
    } else if (field === 'classStart') {
      setIdCardForm(prev => ({
        ...prev,
        classStart: value,
        validTill: (!validTillTouched && value) ? addMonthsToDateString(value, 6) : prev.validTill,
      }));
    } else {
      setIdCardForm(prev => ({ ...prev, [field]: value }));
    }
    setIdCardDirty(true);
  };

  const handleSaveIdCardDetails = async () => {
    if (!selectedLead) return;
    try {
      setIsSavingIdCard(true);
      const result = await apiService.saveIdCardDetails({
        _id: selectedLead._id,
        ...idCardForm,
      });
      if (result.success && result.chat) {
        handleUpdateLead({ ...selectedLead, IdCardDetails: result.chat.IdCardDetails || [] });
        setIdCardDirty(false);
        setIdCardEditMode(false);
      } else {
        alert(result.message || 'Failed to save ID card details.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save ID card details.');
    } finally {
      setIsSavingIdCard(false);
    }
  };

  const handleUploadIdCardPhoto = async (file: File) => {
    if (!selectedLead) return;
    try {
      setIsUploadingPhoto(true);
      const result = await apiService.uploadIdCardPhoto(selectedLead._id, file);
      if (result.success && result.url) {
        setIdCardForm(prev => ({ ...prev, photoUrl: result.url }));
        setIdCardDirty(true);
      } else {
        alert(result.message || 'Failed to upload photo.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleGenerateIdCard = async () => {
    if (!selectedLead) return;
    try {
      setIsGeneratingIdCard(true);
      const result = await apiService.generateIdCard(selectedLead._id);
      if (result.success && result.idCard) {
        const cards: IdCardResult[] = [result.idCard];
        setGeneratedIdCards(cards);
        handleUpdateLead({ ...selectedLead, idCards: cards });
      } else {
        alert(result.message || 'Failed to generate ID card.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate ID card.');
    } finally {
      setIsGeneratingIdCard(false);
    }
  };

  const handleDeleteLeadById = (id: string) => {
    if (!window.confirm('Delete this lead permanently?')) return;
    onDeleteLead?.(id);
    if (selectedLeadId === id) setSelectedLeadId(null);
  };

  const toggleBatch = (key: string) => {
    setExpandedBatches(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  // ----- Pagination -----

  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE));
  const paginatedLeads = internalLeads;

  // ----- Styles -----

  const fieldClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all';
  const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest';

  // ----- Render -----

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">

      {/* ── Main panel ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedLeadId ? 'md:mr-[480px]' : ''}`}>

        {/* Header */}
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800">Course Enrolled</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {totalLeads} student{totalLeads !== 1 ? 's' : ''} · Manage batch, trainer & fees
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Icons.Menu className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode('batch')}
                  className={`px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${viewMode === 'batch' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Icons.User className="w-3.5 h-3.5" /> Batches
                </button>
              </div>
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-48 shadow-sm"
                />
              </div>
              <button
                onClick={() => setFilters(prev => ({ ...prev, statusFilter: prev.statusFilter === 'responded' ? null : 'responded' }))}
                title="Show students who responded after a follow-up"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all shadow-sm ${filters.statusFilter === 'responded' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${filters.statusFilter === 'responded' ? 'bg-white' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'}`} />
                <span className="hidden sm:inline">Responded</span>
              </button>
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${hasActiveFilters ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icons.Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
              </button>
              {viewMode === 'list' && (
                isMessagingMode ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                    <span className="text-xs font-bold text-slate-400 uppercase mr-1">{selectedMsgIds.size} Selected</span>
                    <button
                      onClick={selectAllMatching}
                      disabled={isSelectingAllMsg}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 disabled:opacity-50"
                    >
                      {isSelectingAllMsg ? 'Selecting…' : 'Select All'}
                    </button>
                    <button onClick={uncheckAllMsg} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200">Clear</button>
                    {selectedMsgIds.size > 0 && (
                      <button onClick={() => setIsMessageModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:shadow-lg active:scale-95 transition-all">
                        <Icons.Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Send Message</span>
                      </button>
                    )}
                    <button onClick={exitMessagingMode} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="Exit Messaging Mode"><Icons.X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsMessagingMode(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-sm transition-all border border-indigo-200"
                  >
                    <Icons.Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Messaging Mode</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Summary chips */}
        <div className="px-6 pb-3 flex gap-3 flex-wrap">
          {viewMode === 'batch' && (
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-2 shadow-sm">
              <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Batches</p>
              <p className="text-xl font-black text-green-700">{batchGroups.filter(([k]) => k !== '__none__').length}</p>
            </div>
          )}
        </div>

        {/* Filter drawer */}
        {isFilterOpen && (
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-40 border-l border-slate-200">
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800">Filters</h2>
                <button onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-slate-200 rounded-full">
                  <Icons.X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className={labelClass}>Batch Code</label>
                  <select value={filters.batch || ''} onChange={e => setFilters({ ...filters, batch: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Batches</option>
                    {enrolledBatches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Course</label>
                  <select value={filters.courses?.[0] || ''} onChange={e => setFilters({ ...filters, courses: e.target.value ? [e.target.value] : [] })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Courses</option>
                    {COURSES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date Range</label>
                  <div className="mt-2 flex gap-2">
                    <input type="date" value={filters.fromDate || ''} onChange={e => setFilters({ ...filters, fromDate: e.target.value })} className="w-1/2 px-3 py-2 border border-slate-200 rounded-lg" />
                    <input type="date" value={filters.toDate || ''} onChange={e => setFilters({ ...filters, toDate: e.target.value })} className="w-1/2 px-3 py-2 border border-slate-200 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Assigned To</label>
                  <select value={filters.assignedUser || ''} onChange={e => setFilters({ ...filters, assignedUser: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Staff</option>
                    {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Lead Source</label>
                  <select value={filters.source || ''} onChange={e => setFilters({ ...filters, source: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Sources</option>
                    {['Manual', 'Website', 'WhatsApp', 'Instagram', 'Facebook', 'LinkedIn', 'Referral', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {campaignNames.length > 0 && (
                  <div>
                    <label className={labelClass}>Campaign Replied</label>
                    <select value={filters.campaigns?.[0] || ''} onChange={e => setFilters({ ...filters, campaigns: e.target.value ? [e.target.value] : [] })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                      <option value="">All Campaigns</option>
                      {campaignNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button onClick={() => setFilters(initialFilters)} className="flex-1 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Reset</button>
                <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-2 text-sm font-bold bg-green-600 text-white rounded-lg">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <div className="px-6 pb-6 flex-1 overflow-hidden">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
              <div className="overflow-auto flex-1">
                {isLoadingInternal && (
                  <div className="px-5 py-2 bg-green-50 border-b border-green-100 text-xs text-green-600 font-bold flex items-center gap-1.5">
                    <Icons.RefreshCcw className="w-3 h-3 animate-spin" /> Loading…
                  </div>
                )}
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {isMessagingMode && (
                        <th className="px-4 py-4 w-10 text-center border-b border-slate-100 animate-in fade-in duration-300">
                          <Icons.Check className="w-4 h-4 text-slate-300 mx-auto" />
                        </th>
                      )}
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Student</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 hidden sm:table-cell">Contact</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 hidden md:table-cell">Course</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Batch</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 hidden lg:table-cell">Trainer</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center">Fees</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingInternal && internalLeads.length === 0 ? (
                      <tr>
                        <td colSpan={isMessagingMode ? 8 : 7} className="px-6 py-16 text-center text-slate-400 text-sm">Loading students…</td>
                      </tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={isMessagingMode ? 8 : 7} className="px-6 py-16 text-center text-slate-400 italic text-sm">No enrolled students found.</td>
                      </tr>
                    ) : (
                      paginatedLeads.map(lead => {
                        const batchCode = (lead.batchId || '').trim();
                        const color = batchCode ? batchColor(batchCode) : null;
                        return (
                          <tr
                            key={lead._id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedLeadId === lead._id ? 'bg-green-50/50' : ''} ${selectedMsgIds.has(lead._id) ? 'bg-indigo-50/40' : ''}`}
                            onClick={() => openInEditMode(lead._id)}
                          >
                            {isMessagingMode && (
                              <td className="px-4 py-4 text-center animate-in fade-in duration-300" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedMsgIds.has(lead._id)}
                                  onChange={() => toggleMsgSelection(lead._id)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                  {(lead.userName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <span>{lead.userName}</span>
                                    {lead.respondedAfterFollowUp && (
                                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Responded"></span>
                                    )}
                                    {(lead.campaignHistory || []).some(c => c.repliedAt) && (
                                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title={`Replied to campaign: ${[...(lead.campaignHistory || [])].reverse().find(c => c.repliedAt)?.campaignName || ''}`}></span>
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
                                  onClick={e => { e.stopPropagation(); const n = (lead.userNumber || '').replace(/\D/g, ''); if (n) window.open(`https://wa.me/${n}`, '_blank', 'noopener'); }}
                                  className="text-green-500 hover:text-green-600 cursor-pointer"
                                >
                                  <Icons.WhatsApp className="w-4 h-4" />
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell">
                              {lead.course
                                ? <span className="text-sm text-slate-700 font-medium" title={lead.course}>{getCourseShortCode(lead.course)}</span>
                                : <span className="text-slate-300 italic text-xs">—</span>}
                            </td>
                            <td className="px-5 py-4">
                              {batchCode && color ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={async e => {
                                      e.stopPropagation();
                                      const local = internalLeads.filter(l => (l.batchId || '').trim() === batchCode);
                                      setBatchModal({ code: batchCode, members: local });
                                      try {
                                        const res = await apiService.queryLeads({ view: 'course-enrolled', page: 1, limit: 500, includeStats: false, mode: 'full', searchQuery: '', filters: { batch: batchCode } });
                                        if (res?.success && res.leads) setBatchModal({ code: batchCode, members: res.leads });
                                      } catch { /* keep local */ }
                                    }}
                                    title="View batch members"
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border cursor-pointer hover:shadow-md active:scale-95 transition-all ${color.bg} ${color.border} ${color.text}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                    {batchCode}
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); copyBatchCode(batchCode); }}
                                    title="Copy batch code"
                                    className={`p-1 rounded transition-colors ${copiedCode === batchCode ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                  >
                                    {copiedCode === batchCode ? <Icons.Check className="w-3 h-3" /> : <Icons.Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); openInEditMode(lead._id); }}
                                  title="Assign batch"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 text-white text-[9px] font-black hover:bg-green-700 transition-all active:scale-95"
                                >
                                  <Icons.Plus className="w-2.5 h-2.5" />
                                  Add
                                </button>
                              )}
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell">
                              {lead.Trainer
                                ? <span className="text-sm text-slate-700 font-medium" title={lead.Trainer}>{getTrainerShortCode(lead.Trainer)}</span>
                                : <span className="text-slate-300 italic text-xs">—</span>}
                              {lead.batch_date && (
                                <div className="text-[10px] text-slate-400 mt-0.5">{new Date(lead.batch_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                              )}
                              {lead.batch_start_time && lead.batch_end_time && (
                                <div className="text-[10px] text-slate-400">{formatTime12h(lead.batch_start_time)} - {formatTime12h(lead.batch_end_time)}</div>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {(() => {
                                const fees = getFeesSummary(lead);
                                if (!fees) {
                                  return (
                                    <button
                                      onClick={e => { e.stopPropagation(); openFeesTab(lead._id); }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-green-700 transition-all hover:shadow-sm active:scale-95"
                                    >
                                      <Icons.Plus className="w-3 h-3" /> Add
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); openFeesTab(lead._id); }}
                                    className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all hover:shadow-sm active:scale-95 ${fees.allPaid ? 'bg-green-50 border-green-100 hover:bg-green-100' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}
                                  >
                                    <span className={`text-[10px] font-black uppercase ${fees.allPaid ? 'text-green-700' : 'text-amber-700'}`}>
                                      {fees.allPaid ? '✓ All Paid' : `${fees.paidCount}/${fees.totalCount} Paid`}
                                    </span>
                                    <span className={`text-[9px] ${fees.allPaid ? 'text-green-500' : 'text-amber-500'}`}>
                                      ₹{fees.totalPaid.toLocaleString()} paid{fees.totalPending > 0 ? ` · ₹${fees.totalPending.toLocaleString()} due` : ''}
                                    </span>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={e => { e.stopPropagation(); openInEditMode(lead._id); }}
                                  className="text-green-600 hover:text-green-700 text-xs font-bold hover:underline"
                                >
                                  Manage
                                </button>
                                {currentUserRole === 'admin' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteLeadById(lead._id); }}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete lead"
                                  >
                                    <Icons.Trash className="w-3.5 h-3.5" />
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
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <span className="text-xs text-slate-500">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalLeads)} of {totalLeads} students
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-slate-500 font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Batch Groups view ── */}
        {viewMode === 'batch' && (
          <div className="px-6 pb-6 flex-1 overflow-auto space-y-3">
            {batchGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Icons.User className="w-8 h-8 opacity-30" />
                </div>
                <p className="text-sm font-bold text-slate-500">No students found</p>
              </div>
            )}
            {batchGroups.map(([batchKey, members]) => {
              const isNone = batchKey === '__none__';
              const color = isNone
                ? { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-300' }
                : batchColor(batchKey);
              const isOpen = expandedBatches.has(batchKey);
              const trainerName = members.find(m => m.Trainer)?.Trainer;
              const batchDateName = members.find(m => m.batch_date)?.batch_date;
              return (
                <div key={batchKey} className={`rounded-2xl border ${color.border} overflow-hidden shadow-sm`}>
                  <button
                    className={`w-full flex items-center justify-between px-5 py-4 ${color.bg} hover:brightness-[0.97] transition-all`}
                    onClick={() => toggleBatch(batchKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${color.dot} flex-shrink-0`} />
                      <div className="text-left">
                        <p className={`text-sm font-black uppercase tracking-wider ${color.text}`}>
                          {isNone ? 'No Batch Assigned' : batchKey}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {members.length} student{members.length !== 1 ? 's' : ''}
                          {!isNone && trainerName && ` · ${trainerName}`}
                          {!isNone && batchDateName && ` · ${new Date(batchDateName).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isNone && (
                        <button
                          onClick={e => { e.stopPropagation(); copyBatchCode(batchKey); }}
                          className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${copiedCode === batchKey ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white'}`}
                        >
                          {copiedCode === batchKey ? <Icons.Check className="w-3 h-3" /> : <Icons.Copy className="w-3 h-3" />}
                          {copiedCode === batchKey ? 'Copied' : 'Copy'}
                        </button>
                      )}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isOpen ? color.text : 'text-slate-400'}`}>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-white divide-y divide-slate-50">
                      {members.map(lead => {
                        const fees = getFeesSummary(lead);
                        return (
                          <div
                            key={lead._id}
                            className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => openInEditMode(lead._id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {(lead.userName || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>{lead.userName}</span>
                                  {lead.respondedAfterFollowUp && (
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Responded"></span>
                                  )}
                                  {(lead.campaignHistory || []).some(c => c.repliedAt) && (
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title={`Replied to campaign: ${[...(lead.campaignHistory || [])].reverse().find(c => c.repliedAt)?.campaignName || ''}`}></span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400">{lead.userNumber} · {lead.course || 'General'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {isNone && (
                                <button
                                  onClick={e => { e.stopPropagation(); openInEditMode(lead._id); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 text-white text-[9px] font-black hover:bg-green-700 transition-all active:scale-95"
                                >
                                  <Icons.Plus className="w-2.5 h-2.5" />
                                  Add
                                </button>
                              )}
                              {fees ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fees.allPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {fees.allPaid ? '✓ Paid' : `${fees.paidCount}/${fees.totalCount}`}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">No fees</span>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedLeadId(lead._id); }}
                                className="text-xs font-bold text-green-600 hover:underline"
                              >
                                Manage
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selectedLead && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-30">

          {/* Panel header */}
          <div className="p-5 border-b border-slate-100 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-black text-lg flex-shrink-0">
                  {(selectedLead.userName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-slate-800 text-base truncate">{selectedLead.userName}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{selectedLead.userNumber}</span>
                    <span
                      role="button"
                      title="Open in WhatsApp"
                      onClick={() => { const n = (selectedLead.userNumber || '').replace(/\D/g, ''); if (n) window.open(`https://wa.me/${n}`, '_blank', 'noopener'); }}
                      className="text-green-500 hover:text-green-600 cursor-pointer"
                    >
                      <Icons.WhatsApp className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  {selectedLead.course && (
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mt-0.5 truncate">{selectedLead.course}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedLeadId(null)} className="p-2 hover:bg-slate-100 rounded-full flex-shrink-0 mt-0.5">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4 bg-slate-100 p-1 rounded-xl">
              {(['idcard', 'batch', 'fees', 'cert', 'lead', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === tab ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {tab === 'idcard' ? 'ID Card' : tab === 'batch' ? 'Batch' : tab === 'fees' ? 'Fees' : tab === 'cert' ? 'Cert' : tab === 'lead' ? 'Lead' : 'History'}
                </button>
              ))}
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* ── ID Card tab ── */}
            {activeTab === 'idcard' && (
              <div className="space-y-5">

                {/* View mode: show current values */}
                {!idCardEditMode && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black text-slate-700">ID Card Details</p>
                      <button
                        onClick={() => setIdCardEditMode(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-black hover:bg-slate-200 transition-colors"
                      >
                        <Icons.Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>

                    <div className="flex justify-center">
                      {idCardForm.photoUrl ? (
                        <img src={idCardForm.photoUrl} alt="Student" className="w-28 h-32 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div className="w-28 h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-300 text-xs">
                          No Photo
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Name</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">{selectedLead.userName}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Course</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {selectedLead.course || <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Mobile</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">{selectedLead.userNumber}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>ID No</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">{idCardForm.idNo}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>DOB</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {idCardForm.dob
                            ? new Date(idCardForm.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Address</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {idCardForm.address || <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Enrolled on</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {idCardForm.classStart
                            ? formatDDMMYYYY(idCardForm.classStart)
                            : <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Valid Till</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {idCardForm.validTill
                            ? formatDDMMYYYY(idCardForm.validTill)
                            : <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={handleGenerateIdCard}
                        disabled={isGeneratingIdCard}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-white font-black text-sm rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
                      >
                        {isGeneratingIdCard ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        {isGeneratingIdCard ? 'Generating...' : 'Generate ID Card PDF'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className={labelClass}>Generated ID Cards ({generatedIdCards.length})</p>
                      {generatedIdCards.length === 0 ? (
                        <p className="text-center text-slate-400 text-xs italic py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No ID card generated yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {generatedIdCards.map((card, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Student ID Card</p>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{card.fileName}</p>
                              </div>
                              {card.success && card.s3?.url && (
                                <button
                                  onClick={() => window.open(card.s3!.url, '_blank', 'noopener')}
                                  className="flex-shrink-0 text-xs font-bold text-green-600 hover:underline"
                                >
                                  Open
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Edit mode */}
                {idCardEditMode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-700">Edit ID Card Details</p>
                    </div>

                    <div className="flex justify-center">
                      <label className="cursor-pointer group relative">
                        {idCardForm.photoUrl ? (
                          <img src={idCardForm.photoUrl} alt="Student" className="w-28 h-32 object-cover rounded-xl border border-slate-200" />
                        ) : (
                          <div className="w-28 h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-300 text-xs">
                            No Photo
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black transition-opacity">
                          {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingPhoto}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadIdCardPhoto(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className={labelClass}>Name</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{selectedLead.userName}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className={labelClass}>Course</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{selectedLead.course || '—'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className={labelClass}>Mobile</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{selectedLead.userNumber}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>ID No</label>
                      <input
                        type="text"
                        value={idCardForm.idNo || ''}
                        onChange={e => handleIdCardFieldChange('idNo', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Date of Birth</label>
                      <input
                        type="date"
                        value={idCardForm.dob || ''}
                        onChange={e => handleIdCardFieldChange('dob', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Address</label>
                      <textarea
                        value={idCardForm.address || ''}
                        onChange={e => handleIdCardFieldChange('address', e.target.value)}
                        rows={2}
                        className={fieldClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Enrolled on</label>
                      <input
                        type="date"
                        value={idCardForm.classStart || ''}
                        onChange={e => handleIdCardFieldChange('classStart', e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Valid Till</label>
                      <input
                        type="date"
                        value={idCardForm.validTill || ''}
                        onChange={e => handleIdCardFieldChange('validTill', e.target.value)}
                        className={fieldClass}
                      />
                      {!validTillTouched && (
                        <p className="text-[10px] text-slate-400 pl-0.5">Defaults to 6 months after Enrolled on — edit to set a custom date.</p>
                      )}
                    </div>

                    {/* Save / Cancel */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setIdCardEditMode(false);
                          const latestIdCard = Array.isArray(selectedLead.IdCardDetails) && selectedLead.IdCardDetails.length
                            ? selectedLead.IdCardDetails[selectedLead.IdCardDetails.length - 1]
                            : null;
                          setIdCardForm(latestIdCard ? {
                            dob: parseDate(latestIdCard.dob) || null,
                            address: latestIdCard.address || '',
                            idNo: latestIdCard.idNo || selectedLead._id,
                            classStart: parseDate(latestIdCard.classStart) || selectedLead.batch_date || null,
                            validTill: parseDate(latestIdCard.validTill) || null,
                            photoUrl: latestIdCard.photoUrl || '',
                          } : { ...emptyIdCardForm(), idNo: selectedLead._id, classStart: selectedLead.batch_date || null });
                          setValidTillTouched(!!parseDate(latestIdCard?.validTill));
                          setIdCardDirty(false);
                        }}
                        className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveIdCardDetails}
                        disabled={isSavingIdCard}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {isSavingIdCard ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        {isSavingIdCard ? 'Saving...' : 'Save Details'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Batch tab ── */}
            {activeTab === 'batch' && (
              <div className="space-y-5">

                {/* View mode: show current values */}
                {!batchEditMode && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black text-slate-700">Batch Details</p>
                      <button
                        onClick={() => setBatchEditMode(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-black hover:bg-slate-200 transition-colors"
                      >
                        <Icons.Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Batch Code */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Batch Code</p>
                        {selectedLead.batchId ? (
                          <div className="flex items-center gap-2 mt-2">
                            {(() => {
                              const c = batchColor(selectedLead.batchId);
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black uppercase border ${c.bg} ${c.border} ${c.text}`}>
                                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                                  {selectedLead.batchId}
                                </span>
                              );
                            })()}
                            <button
                              onClick={() => copyBatchCode(selectedLead.batchId!)}
                              title="Copy batch code"
                              className={`p-1.5 rounded-lg transition-colors ${copiedCode === selectedLead.batchId ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                            >
                              {copiedCode === selectedLead.batchId ? <Icons.Check className="w-4 h-4" /> : <Icons.Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm text-slate-400 italic">Not assigned</span>
                            <button
                              onClick={handleAutoGenerateBatch}
                              disabled={isGeneratingBatch}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-black hover:bg-green-700 transition-all disabled:opacity-50"
                            >
                              {isGeneratingBatch ? <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Icons.RefreshCcw className="w-3.5 h-3.5" />}
                              Auto-Generate
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Trainer */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100" title={selectedLead.Trainer || ''}>
                        <p className={labelClass}>Trainer</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {selectedLead.Trainer ? getTrainerShortCode(selectedLead.Trainer) : <span className="text-slate-400 italic font-normal text-xs">Not assigned</span>}
                        </p>
                      </div>

                      {/* Course (short code) */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100" title={selectedLead.course || ''}>
                        <p className={labelClass}>Course</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {selectedLead.course ? getCourseShortCode(selectedLead.course) : <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>

                      {/* Batch Date */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Batch Date</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {selectedLead.batch_date
                            ? new Date(selectedLead.batch_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>

                      {/* Batch Timing */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className={labelClass}>Batch Timing</p>
                        <p className="text-sm font-bold text-slate-800 mt-1.5">
                          {selectedLead.batch_start_time && selectedLead.batch_end_time
                            ? `${formatTime12h(selectedLead.batch_start_time)} - ${formatTime12h(selectedLead.batch_end_time)}`
                            : <span className="text-slate-400 italic font-normal text-xs">Not set</span>}
                        </p>
                      </div>
                    </div>

                    {/* Quick generate if nothing set */}
                    {!selectedLead.batchId && (
                      <p className="text-[10px] text-slate-400 text-center">
                        Auto-generate creates a code like <span className="font-bold">Moha-PYT-8hr-2307-0930-1030</span> (trainer-course-programtype-date-start-end)
                      </p>
                    )}
                  </>
                )}

                {/* Edit mode */}
                {batchEditMode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-700">Edit Batch Details</p>
                    </div>

                    {/* Trainer dropdown */}
                    <div className="space-y-1">
                      <label className={labelClass}>Trainer</label>
                      <select
                        value={batchForm.trainer}
                        onChange={e => setBatchForm(prev => ({ ...prev, trainer: e.target.value, batchId: '' }))}
                        className={fieldClass}
                        disabled={trainersLoading}
                      >
                        <option value="">{trainersLoading ? 'Loading trainers...' : '— Select Trainer —'}</option>
                        {trainers.map(t => (
                          <option key={t._id} value={t.username}>{t.username} ({getTrainerShortCode(t.username)})</option>
                        ))}
                      </select>
                    </div>

                    {/* Batch Code dropdown (trainer-aware) */}
                    <div className="space-y-1">
                      <label className={labelClass}>Batch Code</label>
                      {batchForm.trainer ? (
                        <select
                          value={batchForm.batchId}
                          onChange={e => setBatchForm(prev => ({ ...prev, batchId: e.target.value }))}
                          className={fieldClass}
                        >
                          <option value="">— Select existing batch —</option>
                          {(trainers.find(t => t.username === batchForm.trainer)?.batchIds ?? []).map(bid => (
                            <option key={bid} value={bid}>{bid}</option>
                          ))}
                          <option value="__new__">+ Generate New Batch Code</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value=""
                          readOnly
                          placeholder="Select a trainer first"
                          className={`${fieldClass} cursor-not-allowed opacity-50`}
                        />
                      )}
                      {batchForm.batchId === '__new__' && (
                        <p className="text-[10px] text-slate-400 pl-0.5">A new code will be auto-generated when you save.</p>
                      )}
                    </div>

                    {/* Batch Date field */}
                    <div className="space-y-1">
                      <label className={labelClass}>Batch Date</label>
                      <input
                        type="date"
                        value={batchForm.batchDate || ''}
                        onChange={e => setBatchForm(prev => ({ ...prev, batchDate: e.target.value }))}
                        className={fieldClass}
                      />
                    </div>

                    {/* Batch Start / End Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={labelClass}>
                          Start Time{isGeneratingNewBatchCode && <span className="text-red-500"> *</span>}
                        </label>
                        <input
                          type="time"
                          value={batchForm.startTime || ''}
                          onChange={e => setBatchForm(prev => ({ ...prev, startTime: e.target.value }))}
                          className={fieldClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClass}>
                          End Time{isGeneratingNewBatchCode && <span className="text-red-500"> *</span>}
                        </label>
                        <input
                          type="time"
                          value={batchForm.endTime || ''}
                          onChange={e => setBatchForm(prev => ({ ...prev, endTime: e.target.value }))}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    {isGeneratingNewBatchCode ? (
                      <p className="text-[10px] text-amber-600 font-bold pl-0.5">Start Time and End Time are required to generate a batch code, e.g. Moha-PYT-8hr-2307-0930-1030.</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 pl-0.5">Setting both times lets an auto-generated batch code include them, e.g. Moha-PYT-8hr-2307-0930-1030.</p>
                    )}

                    {/* Save / Cancel */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setBatchEditMode(false);
                          setBatchForm({
                            batchId: selectedLead.batchId || '',
                            trainer: selectedLead.Trainer || '',
                            batchDate: selectedLead.batch_date || '',
                            startTime: selectedLead.batch_start_time || '',
                            endTime: selectedLead.batch_end_time || '',
                          });
                        }}
                        className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveBatch}
                        disabled={isSavingBatch || isGeneratingBatch || (isGeneratingNewBatchCode && (!batchForm.startTime || !batchForm.endTime))}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {isSavingBatch ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        {isSavingBatch ? 'Saving...' : 'Save Batch'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Fees tab ── */}
            {activeTab === 'fees' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-3 rounded-xl border ${isBilledAmountLocked ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Billed Amount
                      {isBilledAmountLocked && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      )}
                    </label>
                    <div className="flex items-center mt-1">
                      <span className="text-slate-400 mr-1 text-sm">Rs</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={feesBilledAmount}
                        onChange={e => handleFeesBilledAmountChange(e.target.value)}
                        onFocus={e => !isBilledAmountLocked && e.target.select()}
                        readOnly={isBilledAmountLocked}
                        className={`bg-transparent border-none p-0 w-full font-black text-slate-800 text-lg focus:ring-0 outline-none ${isBilledAmountLocked ? 'cursor-not-allowed' : ''}`}
                        placeholder="0"
                        title={isBilledAmountLocked ? 'Only admins can change the billed amount once set' : undefined}
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                    <label className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Paid</label>
                    <div className="mt-1 font-black text-green-700 text-lg">Rs {feesPaidAmount.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Pending</label>
                    <div className="mt-1 font-black text-red-700 text-lg">Rs {feesBalanceAmount.toLocaleString()}</div>
                  </div>
                </div>

                {overdueInstallments.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <Icons.X className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-700">
                      {overdueInstallments.length} installment{overdueInstallments.length !== 1 ? 's are' : ' is'} overdue
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700">Installments</h3>
                      <p className="text-xs text-slate-500">{feesInstallments.length} total · {pendingInstallments.length} pending</p>
                    </div>
                    <div className="flex gap-2">
                      {feesDirty && (
                        <button onClick={handleCancelFees} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all">Cancel</button>
                      )}
                      <button onClick={handleAddInstallment} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-all">
                        + Add Installment
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    {feesInstallments.map((inst, index) => {
                      const dueDateValue = parseDate(inst.dueDate);
                      const isOverdue =
                        inst.status === 'Pending' &&
                        !!dueDateValue &&
                        !isNaN(new Date(dueDateValue).getTime()) &&
                        new Date(dueDateValue) < new Date() &&
                        inst.amount > 0;

                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-xl border bg-white shadow-sm transition-colors group ${isOverdue ? 'border-red-300 bg-red-50/40' : 'border-slate-200 hover:border-green-200'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                              {isOverdue && <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded">Overdue</span>}
                            </div>
                            <button onClick={() => handleDeleteInstallment(index)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Icons.Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Due Date</label>
                              <input
                                type="date"
                                value={parseDate(inst.dueDate)}
                                onChange={e => handleInstallmentChange(index, 'dueDate', e.target.value)}
                                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-green-500 py-2 px-2 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Amount</label>
                              <input
                                type="number"
                                value={inst.amount}
                                onChange={e => handleInstallmentChange(index, 'amount', Number(e.target.value))}
                                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-green-500 py-2 px-2 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Status</label>
                            <select
                              value={inst.status}
                              onChange={e => handleInstallmentChange(index, 'status', e.target.value as Installment['status'])}
                              className={`w-full text-xs font-bold py-2 px-2 rounded-lg border outline-none focus:ring-1 ${inst.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500' : 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-500'}`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Paid">Paid</option>
                            </select>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {inst.billGenerated ? (
                              inst.billUrl ? (
                                <a href={inst.billUrl} target="_blank" rel="noopener" className="text-xs text-indigo-600 font-bold" onClick={e => e.stopPropagation()}>View Bill</a>
                              ) : (
                                <span className="text-xs text-slate-500">Bill generated</span>
                              )
                            ) : inst.status === 'Paid' ? (
                              <button
                                onClick={e => { e.stopPropagation(); handleGenerateBill(index); }}
                                disabled={feesGeneratingIndex === index}
                                className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all ${feesGeneratingIndex === index ? 'bg-slate-300 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                              >
                                {feesGeneratingIndex === index ? 'Generating...' : 'Generate Bill'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Bill available after payment</span>
                            )}
                            {inst.billGenerated && inst.billGeneratedAt && (
                              <div className="text-[10px] text-slate-400">{formatFeesDateTime(inst.billGeneratedAt)}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {feesInstallments.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No installments added yet. Click "+ Add Installment" to create one.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Certificate tab ── */}
            {activeTab === 'cert' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-700">Completion Certificate Details</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Salutation</label>
                    <select
                      value={certForm.salutation || ''}
                      onChange={e => handleCertFieldChange('salutation', e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">—</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Miss">Miss</option>
                      <option value="Dr">Dr</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Issue Date</label>
                    <input
                      type="date"
                      value={certForm.issue_date || ''}
                      onChange={e => handleCertFieldChange('issue_date', e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Student Name</label>
                  <input
                    type="text"
                    value={certForm.userName || ''}
                    onChange={e => handleCertFieldChange('userName', e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Course</label>
                  <input
                    type="text"
                    value={certForm.course || ''}
                    onChange={e => handleCertFieldChange('course', e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Project Title</label>
                  <input
                    type="text"
                    value={certForm.project_title || ''}
                    onChange={e => handleCertFieldChange('project_title', e.target.value)}
                    placeholder="e.g. AI Powered CRM"
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Internship Title</label>
                  <input
                    type="text"
                    value={certForm.intern_title || ''}
                    onChange={e => handleCertFieldChange('intern_title', e.target.value)}
                    placeholder="e.g. AI Powered CRM"
                    className={fieldClass}
                  />
                </div>

                <div className="pt-1">
                  <button
                    onClick={handleGenerateCourseCert}
                    disabled={isGeneratingCert || certDirty || !canGenerateCourseCert}
                    title={
                      certDirty ? 'Save details before generating'
                        : !canGenerateCourseCert ? 'Billing must be completed and fully paid (no pending installments) before generating certificates'
                        : undefined
                    }
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-white font-black text-sm rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    {isGeneratingCert ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                    {isGeneratingCert ? 'Generating...' : 'Generate Certificates'}
                  </button>
                  {!canGenerateCourseCert && !certDirty && (
                    <p className="text-[10px] text-amber-600 text-center mt-2">
                      Complete billing (amount &gt; 0) and clear all pending installments to generate certificates.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={labelClass}>Generated Certificates ({generatedCourseCerts.length})</p>
                    {generatedCourseCerts.length > 0 && (
                      <button
                        onClick={handlePrintAllCourseCerts}
                        disabled={isPrintingCert}
                        className="text-xs font-black text-green-600 hover:underline disabled:opacity-50"
                      >
                        {isPrintingCert ? 'Preparing...' : 'Print All'}
                      </button>
                    )}
                  </div>
                  {generatedCourseCerts.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No certificates generated yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {generatedCourseCerts.map((cert, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                              {cert.type === 'enrollment' ? 'Course Enrollment' : cert.type === 'completion' ? 'Course Completion' : cert.type === 'project' ? 'Project Experience' : cert.type === 'internship' ? 'Internship' : 'Certificate'}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{cert.fileName}</p>
                          </div>
                          {cert.success && cert.s3?.url && (
                            <button
                              onClick={() => window.open(cert.s3!.url, '_blank', 'noopener')}
                              className="flex-shrink-0 text-xs font-bold text-green-600 hover:underline"
                            >
                              Open
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Lead tab ── */}
            {activeTab === 'lead' && (
              <div className="space-y-5">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditLead?.(selectedLead)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-200 transition-all"
                  >
                    <Icons.Edit className="w-3.5 h-3.5" /> Edit Lead
                  </button>
                  {currentUserRole === 'admin' && (
                    <button
                      onClick={() => { if (!window.confirm('Delete this lead permanently?')) return; onDeleteLead?.(selectedLead._id); setSelectedLeadId(null); }}
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-100 transition-all"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Status</label>
                    <select value={selectedLead.status} onChange={e => handleStatusChange(e.target.value)} disabled={leadLoading} className={fieldClass}>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Pipeline</label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-bold">{selectedLead.pipeline || 'N/A'}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Assigned To</label>
                  {currentUserRole === 'admin' ? (
                    <select value={selectedLead.assignedto || ''} onChange={e => handleAssign(e.target.value)} disabled={leadLoading} className={fieldClass}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
                      {selectedLead.assignedto || <span className="text-slate-400 italic">Unassigned</span>}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
                  <div>
                    <p className={labelClass}>Course</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedLead.course || 'N/A'}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Source</p>
                    <p className="text-sm text-slate-600 mt-0.5">{selectedLead.leadfrom || 'Manual'}</p>
                  </div>
                  {selectedLead.programType && (
                    <div>
                      <p className={labelClass}>Program Type</p>
                      <p className="text-sm text-slate-600 mt-0.5">{selectedLead.programType}</p>
                    </div>
                  )}
                  {selectedLead.profession && (
                    <div>
                      <p className={labelClass}>Profession</p>
                      <p className="text-sm text-slate-600 mt-0.5">{selectedLead.profession}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className={labelClass}>Remarks ({(selectedLead.remarks || []).length})</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a remark..."
                      value={newRemark}
                      onChange={e => setNewRemark(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddRemark(); }}
                      disabled={leadLoading}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={handleAddRemark}
                      disabled={!newRemark.trim() || leadLoading}
                      className="flex-shrink-0 p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Icons.Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                    {(selectedLead.remarks || []).length === 0 ? (
                      <p className="text-center text-slate-400 text-xs italic py-6">No remarks yet</p>
                    ) : (
                      [...(selectedLead.remarks || [])].reverse().map(r => (
                        <div key={r._id} className="group p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between gap-3 items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 leading-normal">{r.remark}</p>
                            <p className="text-[9px] text-slate-400 mt-1 font-bold">
                              {formatRemarkDate(r.timestamp)}{r.addedBy ? ` · ${r.addedBy}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteRemark(r._id)}
                            disabled={leadLoading}
                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          >
                            <Icons.Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className={labelClass}>Campaign History ({(selectedLead.campaignHistory || []).length})</p>
                  {(selectedLead.campaignHistory || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-6">No campaign messages sent yet</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                      {[...(selectedLead.campaignHistory || [])].reverse().map((c, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-800 truncate">{c.campaignName}</p>
                            {c.repliedAt ? (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-100 text-green-700">Replied</span>
                            ) : (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-200 text-slate-500">No reply yet</span>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 font-bold">
                            Sent {formatRemarkDate(c.sentAt)}{c.repliedAt ? ` · Replied ${formatRemarkDate(c.repliedAt)}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className={labelClass}>Conversation History ({(selectedLead.conversations || []).length})</p>
                  {(selectedLead.conversations || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-6">No conversation history found</p>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-0.5">
                      {chatTimeline.map((group) => (
                        <div key={group.dayKey} className="space-y-3">
                          <div className="flex justify-center">
                            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 uppercase tracking-wide">
                              {group.dayLabel}
                            </span>
                          </div>
                          {group.items.map((c, i) => {
                            const msgDate = toDateObjectChat(c.timestamp);
                            const timeLabel = formatChatTime(msgDate);
                            return (
                              <div key={`${group.dayKey}-${i}`} className="space-y-2">
                                <div className="flex flex-col items-end">
                                  <div className="bg-green-600 text-white p-2.5 rounded-2xl rounded-tr-none text-xs max-w-[90%] shadow-sm leading-relaxed">
                                    {c.userMsg}
                                    {timeLabel && <div className="text-[9px] text-green-100 mt-1 text-right">{timeLabel}</div>}
                                  </div>
                                </div>
                                <div className="flex flex-col items-start">
                                  <div className="bg-slate-100 text-slate-700 p-2.5 rounded-2xl rounded-tl-none text-xs max-w-[90%] border border-slate-200 shadow-sm leading-relaxed">
                                    {(c.botReply || '').split('\n').map((l, j) => <p key={j} className="mb-1 last:mb-0">{l}</p>)}
                                    {timeLabel && <div className="text-[9px] text-slate-400 mt-1 text-right">{timeLabel}</div>}
                                  </div>
                                </div>
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

          {/* Panel footer */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 shrink-0">
            {activeTab === 'fees' && feesDirty && (
              <button
                onClick={handleSaveFees}
                disabled={feesLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
              >
                {feesLoading ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                {feesLoading ? 'Saving...' : 'Save Fees'}
              </button>
            )}
            {activeTab === 'fees' && !feesDirty && (
              <p className="text-center text-xs text-slate-400">All changes are saved</p>
            )}
            {activeTab === 'batch' && !batchEditMode && !selectedLead.batchId && (
              <button
                onClick={() => setBatchEditMode(true)}
                className="w-full py-3 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all"
              >
                Set Batch Details
              </button>
            )}
            {activeTab === 'cert' && certDirty && (
              <button
                onClick={handleSaveCourseCert}
                disabled={isSavingCert}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-black text-sm rounded-xl hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
              >
                {isSavingCert ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                {isSavingCert ? 'Saving...' : 'Save Certificate Details'}
              </button>
            )}
            {activeTab === 'cert' && !certDirty && (
              <p className="text-center text-xs text-slate-400">All changes are saved</p>
            )}
          </div>
        </div>
      )}

      {/* Batch members modal */}
      {batchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setBatchModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Batch Members</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-bold uppercase tracking-wider">{batchModal.code}</p>
              </div>
              <button onClick={() => setBatchModal(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
              {batchModal.members.map(lead => (
                <div key={lead._id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {(lead.userName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                      <span className="truncate">{lead.userName}</span>
                      {lead.respondedAfterFollowUp && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Responded"></span>
                      )}
                      {(lead.campaignHistory || []).some(c => c.repliedAt) && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title={`Replied to campaign: ${[...(lead.campaignHistory || [])].reverse().find(c => c.repliedAt)?.campaignName || ''}`}></span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400">{lead.userNumber}</p>
                  </div>
                  <button
                    onClick={() => {
                      setBatchModal(null);
                      setInternalLeads(prev => prev.some(l => l._id === lead._id) ? prev : [...prev, lead]);
                      openInEditMode(lead._id);
                    }}
                    className="text-xs font-bold text-green-600 hover:underline flex-shrink-0"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
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

export default CourseEnrolledView;
