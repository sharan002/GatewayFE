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

/** Match student profile avatars to the List button color with soft opacity. */
function profileColor(_id: string): { bg: string; text: string } {
  return { bg: 'bg-violet-100', text: 'text-violet-700 font-bold' };
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

  useEffect(() => {
    if (!selectedLead || feesDirty) return;
    setFeesBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
    setFeesInstallments(selectedLead.fees?.installments || []);
  }, [selectedLead?.fees]);

  useEffect(() => {
    setTrainersLoading(true);
    apiService.getTrainers()
      .then(data => { if (data.success) setTrainers(data.trainers); })
      .catch(() => {})
      .finally(() => setTrainersLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    apiService.getEnrolledBatches().then(list => {
      if (mounted && list.length > 0) setEnrolledBatches(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    apiService.getCampaignNames().then(list => {
      if (mounted) setCampaignNames(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

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

  useEffect(() => {
    setCurrentPage(1);
    void fetchPage(1, searchQuery, filters);
  }, [searchQuery, filters]);

  useEffect(() => {
    void fetchPage(currentPage, searchQuery, filters);
  }, [currentPage]);

  useEffect(() => {
    setSelectedMsgIds(new Set());
  }, [searchQuery, filters]);

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

  const formatDisplayMobile = (phone?: string | null): string => {
    if (!phone) return '';
    const cleaned = phone.trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    return cleaned;
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

  const canGenerateCourseCert = (parseFloat(feesBilledAmount) || 0) > 0 && pendingInstallments.length === 0 && feesBalanceAmount === 0;

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

  const isGeneratingNewBatchCode = !batchForm.batchId || batchForm.batchId === '__new__';

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

  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE));
  const paginatedLeads = internalLeads;

  const fieldClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';
  const labelClass = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest';

  return (
    <div className="flex h-full overflow-hidden relative">

      {/* ── Main panel with spacing when popup is open ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedLeadId ? 'md:mr-[calc(min(38vw,520px)-16px)]' : ''}`}>

        {/* Sticky Header and Control Bar Container */}
        <div className={`sticky top-0 z-20/95 backdrop-blur-md pt-6 pb-3 shadow-xs transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5' : 'px-6'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Course Enrolled</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {totalLeads} student{totalLeads !== 1 ? 's' : ''} · Manage batch, trainer & fees
              </p>
            </div>
          </div>

          {/* Main view tabs & Action Buttons - flex-wrap md:flex-nowrap prevents line wrapping when sidebar opens */}
          <div className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap w-full">
            <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white p-1 max-w-full overflow-x-auto min-w-0 shrink-0">
              <button onClick={() => setViewMode('list')} className={`flex items-center justify-center gap-2 min-w-[88px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${viewMode === 'list' && filters.statusFilter !== 'responded' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-slate-700 hover:bg-violet-50'}`}><Icons.Menu className="w-4 h-4"/>List</button>
              <button onClick={() => { setViewMode('batch'); setFilters(prev => ({...prev, statusFilter: null})); }} className={`flex items-center justify-center gap-2 min-w-[120px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${viewMode === 'batch' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-slate-700 hover:bg-violet-50'}`}><Icons.User className="w-4 h-4"/>Active Batch</button>
              {/* <button onClick={() => { setViewMode('batch'); setFilters(prev => ({...prev, statusFilter: null})); }} className="flex items-center justify-center gap-2 min-w-[150px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-slate-700 hover:bg-blue-50 transition-all"><Icons.Check className="w-4 h-4 text-blue-500"/>Completed Batch</button> */}
              <button onClick={() => { setViewMode('list'); setFilters(prev => ({ ...prev, statusFilter: prev.statusFilter === 'responded' ? null : 'responded' })); }} className={`flex items-center justify-center gap-2 min-w-[110px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filters.statusFilter === 'responded' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-slate-700 hover:bg-violet-50'}`}><Icons.Check className="w-4 h-4"/>Responded</button>
            </div>
            <div className="flex items-center gap-3 shrink-0 justify-end ml-auto">
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`order-2 md:order-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${hasActiveFilters ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-700 border-blue-200 hover:bg-blue-50'}`}
              >
                <Icons.Filter className="w-4 h-4 text-blue-500" />
                <span>Filters</span>
                {hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
              </button>
              {viewMode === 'list' && (
                isMessagingMode ? (
                  <div className="order-3 md:order-4 flex items-center gap-2 animate-in slide-in-from-right-2 flex-wrap whitespace-nowrap">
                    <span className="text-xs font-bold text-slate-500 uppercase mr-1">{selectedMsgIds.size} Selected</span>
                    <button onClick={selectAllMatching} disabled={isSelectingAllMsg} className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 disabled:opacity-50">{isSelectingAllMsg ? 'Selecting…' : 'Select All'}</button>
                    <button onClick={uncheckAllMsg} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200">Clear</button>
                    {selectedMsgIds.size > 0 && <button onClick={() => setIsMessageModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:shadow-lg active:scale-95 transition-all"><Icons.Send className="w-4 h-4" /><span>Send Message</span></button>}
                    <button onClick={exitMessagingMode} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="Exit Messaging Mode"><Icons.X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <button onClick={() => setIsMessagingMode(true)} className="order-3 md:order-4 flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 hover:bg-blue-50 rounded-xl font-semibold text-sm transition-all border border-blue-200 whitespace-nowrap">
                    <Icons.Send className="w-4 h-4 text-blue-500" /><span>Message Mode</span>
                  </button>
                )
              )}
            </div>
          </div>
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
                <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-2 text-sm font-bold bg-blue-500 text-white rounded-lg">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <div className={`pb-6 flex-1 overflow-hidden transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5' : 'px-6'}`}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
              <div className="overflow-auto flex-1 min-w-0 slim-scrollbar">
                {isLoadingInternal && (
                  <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 font-bold flex items-center gap-1.5">
                    <Icons.RefreshCcw className="w-3 h-3 animate-spin" /> Loading…
                  </div>
                )}
                <table className="w-full min-w-[900px] text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {isMessagingMode && (
                        <th className="px-4 py-4 w-10 text-center border-b border-slate-100 animate-in fade-in duration-300">
                          <Icons.Check className="w-4 h-4 text-slate-300 mx-auto" />
                        </th>
                      )}
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Student</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 hidden sm:table-cell">Contact</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 hidden md:table-cell">Course</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Batch</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 hidden lg:table-cell">Trainer</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 text-center">Fees</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Action</th>
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
                            className={`hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer ${selectedLeadId === lead._id ? 'selected-lead-row bg-blue-50/80 dark:bg-blue-600/20 shadow-[inset_4px_0_0_#3b82f6] dark:shadow-[inset_4px_0_0_#60a5fa]' : ''} ${selectedMsgIds.has(lead._id) ? 'bg-indigo-50/40 dark:bg-indigo-500/[0.08]' : ''}`}
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
                                <div className={`w-9 h-9 rounded-full ${profileColor(lead._id).bg} ${profileColor(lead._id).text} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
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
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border cursor-pointer hover:shadow-md active:scale-95 transition-all ${color.bg} ${color.border} ${color.text}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                    {batchCode}
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); copyBatchCode(batchCode); }}
                                    title="Copy batch code"
                                    className={`p-1 rounded transition-colors ${copiedCode === batchCode ? 'text-blue-500 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                  >
                                    {copiedCode === batchCode ? <Icons.Check className="w-3 h-3" /> : <Icons.Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); openInEditMode(lead._id); }}
                                  title="Assign batch"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#8b5cf6] text-white text-[9px] font-bold hover:bg-violet-700 transition-all active:scale-95"
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
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8b5cf6] text-white text-[10px] font-bold uppercase tracking-wide hover:bg-violet-700 transition-all hover:shadow-sm active:scale-95"
                                    >
                                      <Icons.Plus className="w-3 h-3" /> Add
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); openFeesTab(lead._id); }}
                                    className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all hover:shadow-sm active:scale-95 ${fees.allPaid ? 'bg-emerald-50 border-blue-100 hover:bg-blue-100' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}
                                  >
                                    <span className={`text-[10px] font-bold uppercase ${fees.allPaid ? 'text-green-700' : 'text-amber-700'}`}>
                                      {fees.allPaid ? '✓ All Paid' : `${fees.paidCount}/${fees.totalCount} Paid`}
                                    </span>
                                    <span className={`text-[9px] ${fees.allPaid ? 'text-green-700' : 'text-amber-500'}`}>
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
                                className="text-[#8b5cf6] hover:text-violet-700 p-1.5 rounded-lg hover:bg-violet-50 transition-colors flex-shrink-0"
                                title="Edit"
                                 >
                                <svg xmlns="http://www.w3.org/2000/svg" width="1.25em" height="1.25em" viewBox="0 0 32 32">
                                <path d="M0 0h32v32H0z" fill="none" />
                                <path fill="currentColor" d="M18 23h-2v-2a3.003 3.003 0 0 0-3-3H9a3.003 3.003 0 0 0-3 3v2H4v-2a5.006 5.006 0 0 1 5-5h4a5.006 5.006 0 0 1 5 5ZM11 6a3 3 0 1 1-3 3a3 3 0 0 1 3-3m0-2a5 5 0 1 0 5 5a5 5 0 0 0-5-5M2 26h28v2H2zM22 4v2h4.586L20 12.586L21.414 14L28 7.414V12h2V4z" />
                                  </svg>
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

        {/* ── Active Batch Card Grid view matching screenshot ── */}
        {viewMode === 'batch' && (
          <div className={`pb-6 flex-1 overflow-auto space-y-6 transition-all duration-300 ${selectedLeadId ? 'pl-6 pr-3.5' : 'px-6'}`}>
            {/* Top Bar: Active Batches count & Month/Year selectors */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                Active Batches: {batchGroups.filter(([k]) => k !== '__none__').length}
              </div>
              <div className="flex items-center gap-2">
                <select className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none shadow-xs">
                  <option>October</option>
                  <option>January</option>
                  <option>February</option>
                  <option>March</option>
                  <option>April</option>
                  <option>May</option>
                  <option>June</option>
                  <option>July</option>
                  <option>August</option>
                  <option>September</option>
                  <option>November</option>
                  <option>December</option>
                </select>
                <select className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none shadow-xs">
                  <option>2026</option>
                  <option>2025</option>
                  <option>2024</option>
                </select>
              </div>
            </div>

            {batchGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Icons.User className="w-8 h-8 opacity-30" />
                </div>
                <p className="text-sm font-bold text-slate-500">No students found</p>
              </div>
            )}

            {/* Grid of Batch Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {batchGroups.map(([batchKey, members]) => {
                const isNone = batchKey === '__none__';
                if (isNone && members.length === 0) return null;
                const batchCode = isNone ? 'No Batch Assigned' : batchKey;
                const courseName = members.find(m => m.course)?.course || 'GENERAL';

                return (
                  <div key={batchKey} className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all">
                    {/* Card Header */}
                    <div className="bg-violet-50/70 p-3.5 border-b border-violet-100">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight break-all" title={batchCode}>
                          {batchCode}
                        </h3>
                        <button
                          onClick={() => !isNone && copyBatchCode(batchCode)}
                          title="Copy batch code"
                          className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                        >
                          <Icons.Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="inline-flex items-center gap-1 text-violet-700 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Active
                        </span>
                        <span className="text-slate-500 uppercase tracking-wider truncate max-w-[140px]" title={courseName}>
                          {courseName}
                        </span>
                      </div>
                    </div>

                    {/* Sub-header columns */}
                    <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      <span>{members.length} Student{members.length !== 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-6">
                        <span>Paid</span>
                        <span>Manage</span>
                      </div>
                    </div>

                    {/* Student List inside Card */}
                    <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                      {members.map(lead => {
                        const fees = getFeesSummary(lead);
                        const isPaid = fees ? fees.allPaid : false;
                        const initial = (lead.userName || '?').charAt(0).toUpperCase();

                        return (
                          <div
                            key={lead._id}
                            onClick={() => openInEditMode(lead._id)}
                            className="px-3.5 py-3 flex items-center justify-between gap-2 hover:bg-blue-50/50 dark:hover:bg-blue-500/[0.08] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-full ${profileColor(lead._id).bg} ${profileColor(lead._id).text} flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs`}>
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{lead.userName}</p>
                                <p className="text-[10px] text-slate-400 truncate">{lead.userNumber}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-7 flex-shrink-0">
                              <span className="text-[#8b5cf6] font-bold text-sm">
                                {isPaid ? '✓' : <span className="text-amber-500 text-xs">⏳</span>}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); openInEditMode(lead._id); }}
                                className="text-[#8b5cf6] hover:text-violet-800 p-1"
                                title="Manage student"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Pagination indicator matching screenshot */}
            <div className="flex items-center justify-center gap-4 py-4 text-xs font-bold text-slate-600">
              <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">‹</button>
              <span>01 - 01</span>
              <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Student details right sidebar ── */}
      {selectedLead && (
        <div className="fixed inset-y-0 right-0 sm:inset-y-2 sm:right-2 w-full sm:w-[min(94vw,520px)] md:w-[min(38vw,520px)] min-w-0 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-none sm:rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans animate-in slide-in-from-right duration-200 " style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

          {/* Panel header matching reference redesign */}
          <div className="p-5 pb-0 shrink-0 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#f3e8ff] dark:bg-purple-950/60 text-[#7e22ce] dark:text-purple-300 flex items-center justify-center font-bold text-base flex-shrink-0">
                  {(selectedLead.userName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate">{selectedLead.userName}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-500 font-medium">{selectedLead.userNumber}</span>
                    <span
                      role="button"
                      title="Open in WhatsApp"
                      onClick={() => { const n = (selectedLead.userNumber || '').replace(/\D/g, ''); if (n) window.open(`https://wa.me/${n}`, '_blank', 'noopener'); }}
                      className="text-emerald-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <Icons.WhatsApp className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {selectedLead.course && (
                  <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider hidden sm:inline">
                    {selectedLead.course}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  {currentUserRole === 'admin' && (
                    <button
                      onClick={() => handleDeleteLeadById(selectedLead._id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete student"
                    >
                      <Icons.Trash className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEditLead?.(selectedLead)}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit student"
                  >
                    <Icons.Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedLeadId(null)}
                    className="w-8 h-8 rounded-full bg-[#dc2626] hover:bg-red-700 text-white flex items-center justify-center shadow-xs transition-transform active:scale-95 flex-shrink-0"
                    title="Close"
                  >
                    <Icons.X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs matching screenshot */}
            <div className="flex items-center gap-1 mt-4 bg-[#f5f3ff] dark:bg-slate-950/80 p-1.5 rounded-2xl overflow-x-auto custom-scrollbar border border-transparent dark:border-slate-800">
              {(['batch', 'idcard', 'fees', 'cert', 'lead', 'history'] as const).map(tab => {
                const label = tab === 'idcard' ? 'ID CARD' : tab === 'batch' ? 'BATCH' : tab === 'fees' ? 'FEES' : tab === 'cert' ? 'CERT' : tab === 'lead' ? 'LEAD' : 'HISTORY';
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                      isActive 
                        ? 'bg-[#ede9fe] text-[#7e22ce] dark:bg-purple-600 dark:text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-5 dark:bg-slate-900">

            {/* ── ID Card tab matching reference screenshot ── */}
            {activeTab === 'idcard' && (
              <div className="space-y-4">
                {!idCardEditMode && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">ID Card Details</p>
                      <button
                        onClick={() => setIdCardEditMode(true)}
                        className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
                        title="Edit ID Card Details"
                      >
                        <Icons.Edit className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Centered Add Photo Box matching screenshot */}
                    <div className="flex justify-center my-3">
                      <label className="cursor-pointer group relative">
                        {idCardForm.photoUrl ? (
                          <div className="relative w-28 h-28">
                            <img src={idCardForm.photoUrl} alt="Student" className="w-full h-full object-cover rounded-2xl border border-slate-200 shadow-xs" />
                            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                              {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                            </div>
                          </div>
                        ) : (
                          <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-[#8b5cf6]/60 bg-[#fbf9fe] hover:bg-violet-50/50 flex flex-col items-center justify-center text-center p-2 transition-colors">
                            <span className="text-sm font-bold text-[#7c3aed]">+ Add photo</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Tap to upload</span>
                          </div>
                        )}
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

                    {/* Unified Details Card matching screenshot */}
                    <div className="bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Details</h4>

                      <div className="space-y-4">
                        {/* Row 1: NAME & COURSE */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">NAME</p>
                            <p className="text-sm font-bold text-slate-900">{selectedLead.userName || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">COURSE</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {selectedLead.course || 'Data Analytics'}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: MOBILE & DATE OF BIRTH */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">MOBILE</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {formatDisplayMobile(selectedLead.userNumber) || '—'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">DATE OF BIRTH</p>
                            <span className="text-xs underline decoration-slate-300 underline-offset-4 font-medium text-slate-400 inline-block">
                              {idCardForm.dob ? formatDDMMYYYY(idCardForm.dob) : 'Not added yet'}
                            </span>
                          </div>
                        </div>

                        {/* Row 3: ENROLLED ON & VALID TILL */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">ENROLLED ON</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {idCardForm.classStart ? formatDDMMYYYY(idCardForm.classStart) : (selectedLead.batch_date ? formatDDMMYYYY(selectedLead.batch_date) : '—')}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">VALID TILL</p>
                            <span className="text-xs underline decoration-slate-300 underline-offset-4 font-medium text-slate-400 inline-block">
                              {idCardForm.validTill ? formatDDMMYYYY(idCardForm.validTill) : 'Not added yet'}
                            </span>
                          </div>
                        </div>

                        {/* Row 4: ID NUMBER */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">ID NUMBER</p>
                          <span className="text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block break-all">
                            {idCardForm.idNo || selectedLead._id}
                          </span>
                        </div>

                        {/* Row 5: ADDRESS */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">ADDRESS</p>
                          <span className="text-xs underline decoration-slate-300 underline-offset-4 font-medium text-slate-400 inline-block leading-relaxed">
                            {idCardForm.address || 'Not added yet'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Generate ID card PDF Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleGenerateIdCard}
                        disabled={isGeneratingIdCard}
                        className="w-full py-3.5 px-6 rounded-2xl bg-[#51228d] hover:bg-[#431a77] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingIdCard ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        {isGeneratingIdCard ? 'Generating PDF...' : 'Generate ID card PDF'}
                      </button>
                    </div>

                    {/* Generated ID Cards List matching screenshot */}
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-medium text-slate-500">
                        Generate ID Cards ({generatedIdCards.length})
                      </p>
                      {generatedIdCards.length === 0 ? (
                        <p className="text-center text-slate-400 text-xs italic py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No ID card generated yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {generatedIdCards.map((card, idx) => (
                            <div key={idx} className="p-3 bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between gap-3 border border-transparent dark:border-slate-800 transition-colors">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800">Student ID Card</p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                                  {card.fileName || 'idcard.pdf'}
                                </p>
                              </div>
                              {card.s3?.url && (
                                <button
                                  onClick={() => window.open(card.s3!.url, '_blank', 'noopener')}
                                  className="text-xs font-bold text-[#7c3aed] dark:text-purple-400 hover:underline flex-shrink-0"
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

                {idCardEditMode && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Edit ID Card Details</p>
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
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Centered Add Photo Box matching screenshot */}
                    <div className="flex justify-center my-3">
                      <label className="cursor-pointer group relative">
                        {idCardForm.photoUrl ? (
                          <div className="relative w-28 h-28">
                            <img src={idCardForm.photoUrl} alt="Student" className="w-full h-full object-cover rounded-2xl border border-slate-200 shadow-xs" />
                            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                              {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                            </div>
                          </div>
                        ) : (
                          <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-[#8b5cf6]/60 bg-[#fbf9fe] hover:bg-violet-50/50 flex flex-col items-center justify-center text-center p-2 transition-colors">
                            <span className="text-sm font-bold text-[#7c3aed]">+ Add photo</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Tap to upload</span>
                          </div>
                        )}
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

                    {/* Unified Details Card matching ID Card Details exactly */}
                    <div className="bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Details</h4>

                      <div className="space-y-4">
                        {/* Row 1: NAME & COURSE */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">NAME</p>
                            <p className="text-sm font-bold text-slate-900">{selectedLead.userName || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">COURSE</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {selectedLead.course || 'Data Analytics'}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: MOBILE & DATE OF BIRTH */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">MOBILE</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {formatDisplayMobile(selectedLead.userNumber) || '—'}
                            </span>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">DATE OF BIRTH</label>
                            <input
                              type="date"
                              value={idCardForm.dob || ''}
                              onChange={e => handleIdCardFieldChange('dob', e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Row 3: ENROLLED ON & VALID TILL */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">ENROLLED ON</label>
                            <input
                              type="date"
                              value={idCardForm.classStart || ''}
                              onChange={e => handleIdCardFieldChange('classStart', e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">VALID TILL</label>
                            <input
                              type="date"
                              value={idCardForm.validTill || ''}
                              onChange={e => handleIdCardFieldChange('validTill', e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Row 4: ID NUMBER */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">ID NUMBER</label>
                          <input
                            type="text"
                            value={idCardForm.idNo || ''}
                            onChange={e => handleIdCardFieldChange('idNo', e.target.value)}
                            placeholder="Enter ID number"
                            className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                          />
                        </div>

                        {/* Row 5: ADDRESS */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">ADDRESS</label>
                          <textarea
                            value={idCardForm.address || ''}
                            onChange={e => handleIdCardFieldChange('address', e.target.value)}
                            rows={2}
                            placeholder="Enter student address"
                            className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action buttons matching previous ID card details */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
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
                        className="py-3.5 px-6 rounded-2xl bg-purple-100/70 hover:bg-purple-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-purple-900 dark:text-slate-200 font-bold text-sm text-center transition-colors dark:border dark:border-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveIdCardDetails}
                        disabled={isSavingIdCard}
                        className="py-3.5 px-6 rounded-2xl bg-[#51228d] hover:bg-[#431a77] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSavingIdCard ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        {isSavingIdCard ? 'Saving...' : 'Save Details'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* ── Batch tab matching reference redesign ── */}
            {activeTab === 'batch' && (
              <div className="space-y-4">
                {!batchEditMode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Batch Details</p>
                      <button
                        type="button"
                        onClick={() => setBatchEditMode(true)}
                        className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
                        title="Edit Batch Details"
                      >
                        <Icons.Edit className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Unified Details Card matching ID Card Details UI */}
                    <div className="bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Details</h4>

                      <div className="space-y-4">
                        {/* Row 1: TRAINER & BATCH DATE */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">TRAINER</p>
                            <p className="text-sm font-bold text-slate-900">
                              {selectedLead.Trainer ? (
                                `${selectedLead.Trainer} (${getTrainerShortCode(selectedLead.Trainer)})`
                              ) : (
                                <span className="text-slate-400 font-medium text-xs">Not assigned</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">BATCH DATE</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {selectedLead.batch_date
                                ? new Date(selectedLead.batch_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : 'Not set'}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: BATCH CODE */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">BATCH CODE</p>
                          {selectedLead.batchId ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block tracking-wide">
                                {selectedLead.batchId}
                              </span>
                              <button
                                onClick={() => copyBatchCode(selectedLead.batchId!)}
                                title="Copy batch code"
                                className={`p-1 rounded-lg transition-colors ${copiedCode === selectedLead.batchId ? 'text-[#7c3aed] bg-purple-100' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                {copiedCode === selectedLead.batchId ? <Icons.Check className="w-3.5 h-3.5" /> : <Icons.Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 font-medium text-xs">Not assigned</span>
                              <button
                                onClick={handleAutoGenerateBatch}
                                disabled={isGeneratingBatch}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#51228d] hover:bg-[#431a77] text-white text-xs font-bold transition-all disabled:opacity-50"
                              >
                                {isGeneratingBatch ? <Icons.RefreshCcw className="w-3 h-3 animate-spin" /> : <Icons.RefreshCcw className="w-3 h-3" />}
                                Auto-Generate
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Row 3: START TIME & END TIME */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">START TIME</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {selectedLead.batch_start_time ? formatTime12h(selectedLead.batch_start_time) : 'Not set'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">END TIME</p>
                            <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                              {selectedLead.batch_end_time ? formatTime12h(selectedLead.batch_end_time) : 'Not set'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Primary Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setBatchEditMode(true)}
                        className="w-full py-3.5 px-6 rounded-2xl bg-[#51228d] hover:bg-[#431a77] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Icons.Edit className="w-4 h-4" />
                        Edit Batch Details
                      </button>
                    </div>
                  </div>
                )}

                {batchEditMode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edit Batch Details</p>
                      <button
                        type="button"
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
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Unified Details Card matching ID Card Details exactly */}
                    <div className="bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Batch Details</h4>

                      <div className="space-y-4">
                        {/* TRAINER */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">TRAINER :</label>
                          <div className="relative">
                            <select
                              value={batchForm.trainer}
                              onChange={e => setBatchForm(prev => ({ ...prev, trainer: e.target.value, batchId: '' }))}
                              className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 appearance-none pr-10 cursor-pointer transition-colors"
                              disabled={trainersLoading}
                            >
                              <option value="">{trainersLoading ? 'Loading trainers...' : '— Select Trainer —'}</option>
                              {trainers.map(t => (
                                <option key={t._id} value={t.username}>{t.username} ({getTrainerShortCode(t.username)})</option>
                              ))}
                            </select>
                            <Icons.ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                          </div>
                        </div>

                        {/* BATCH CODE */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">BATCH CODE:</label>
                          <div className="relative">
                            {batchForm.trainer ? (
                              <select
                                value={batchForm.batchId}
                                onChange={e => setBatchForm(prev => ({ ...prev, batchId: e.target.value }))}
                                className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 appearance-none pr-10 cursor-pointer transition-colors"
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
                                className="w-full bg-white/70 border border-purple-100 text-slate-400 font-medium text-xs rounded-xl py-2.5 px-3 cursor-not-allowed focus:outline-none"
                              />
                            )}
                            <Icons.ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                          </div>
                          {batchForm.batchId === '__new__' && (
                            <p className="text-[10px] text-[#7c3aed] font-medium pt-1">A new code will be auto-generated when you save.</p>
                          )}
                        </div>

                        {/* BATCH DATE */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">BATCH DATE</label>
                          <input
                            type="date"
                            value={batchForm.batchDate || ''}
                            onChange={e => setBatchForm(prev => ({ ...prev, batchDate: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 cursor-pointer transition-colors"
                          />
                        </div>

                        {/* START TIME & END TIME */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                              START TIME:{isGeneratingNewBatchCode && <span className="text-red-500"> *</span>}
                            </label>
                            <input
                              type="time"
                              value={batchForm.startTime || ''}
                              onChange={e => setBatchForm(prev => ({ ...prev, startTime: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 cursor-pointer transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                              END TIME:{isGeneratingNewBatchCode && <span className="text-red-500"> *</span>}
                            </label>
                            <input
                              type="time"
                              value={batchForm.endTime || ''}
                              onChange={e => setBatchForm(prev => ({ ...prev, endTime: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 cursor-pointer transition-colors"
                            />
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-normal">
                          Setting both times lets an auto-generated batch code include them.
                        </p>
                      </div>
                    </div>

                    {/* Action buttons matching previous ID card details */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
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
                        className="py-3.5 px-6 rounded-2xl bg-purple-100/70 hover:bg-purple-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-purple-900 dark:text-slate-200 font-bold text-sm text-center transition-colors dark:border dark:border-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBatch}
                        disabled={isSavingBatch || isGeneratingBatch || (isGeneratingNewBatchCode && (!batchForm.startTime || !batchForm.endTime))}
                        className="py-3.5 px-6 rounded-2xl bg-[#51228d] hover:bg-[#431a77] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSavingBatch ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                        {isSavingBatch ? 'Saving...' : 'Save Batch'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Fees tab matching reference redesign ── */}
            {activeTab === 'fees' && (() => {
              const billedNum = parseFloat(feesBilledAmount) || 0;
              const paidPct = billedNum > 0 ? Math.min(100, Math.round((feesPaidAmount / billedNum) * 100)) : 0;
              const pendingPct = billedNum > 0 ? Math.min(100, Math.round((feesBalanceAmount / billedNum) * 100)) : 0;

              return (
                <div className="space-y-6">
                  {/* Summary Progress Bars matching Image 2 */}
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
                          className={`font-bold text-slate-900 text-sm sm:text-base tracking-tight bg-transparent border-none border-0 outline-none focus:outline-none focus:ring-0 focus:border-none p-0 m-0 w-full shadow-none ${isBilledAmountLocked ? 'cursor-not-allowed' : 'cursor-text'}`}
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
                      className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold text-xs rounded-full shadow-xs transition-colors flex items-center gap-1.5"
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
                            className="p-5 rounded-3xl border border-purple-100/70 bg-white shadow-xs space-y-4 relative hover:border-purple-200 transition-colors"
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
                                <Icons.Trash className="w-4 h-4" />
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
                                  className="w-full text-right pr-3 pl-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl outline-none focus:border-[#7c3aed] transition-colors"
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
                                  className="w-full text-right pr-8 pl-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl outline-none focus:border-[#7c3aed] transition-colors"
                                />
                                <span className="text-xs font-bold text-[#7c3aed] absolute right-3 top-2.5 pointer-events-none">₹</span>
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
                                      ? 'border-violet-300 text-[#7c3aed] bg-[#ede9fe]'
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
                                className="py-2.5 px-6 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
                              >
                                {feesGeneratingIndex === index ? <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                                {feesGeneratingIndex === index ? 'Generating...' : 'View Bill'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Certificate tab ── */}
            {activeTab === 'cert' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Completion Certificate Details</p>
                </div>

                {/* Unified Details Card matching ID Card Details UI */}
                <div className="bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Certificate Details</h4>

                  <div className="space-y-4">
                    {/* Row 1: SALUTATION & STUDENT NAME */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                          Salutation <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={certForm.salutation || ''}
                          onChange={e => handleCertFieldChange('salutation', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                        >
                          <option value="">Select</option>
                          <option value="Mr">Mr</option>
                          <option value="Mrs">Mrs</option>
                          <option value="Ms">Ms</option>
                          <option value="Miss">Miss</option>
                          <option value="Dr">Dr</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                          Student Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={certForm.userName || ''}
                          onChange={e => handleCertFieldChange('userName', e.target.value)}
                          placeholder="Full Name"
                          className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Row 2: COURSE & ISSUE DATE */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">COURSE</p>
                        <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                          {selectedLead.course || 'Data Analytics'}
                        </span>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">ISSUE DATE</label>
                        <input
                          type="date"
                          value={certForm.issue_date || ''}
                          onChange={e => handleCertFieldChange('issue_date', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Row 3: PROJECT TITLE */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">PROJECT TITLE</label>
                      <input
                        type="text"
                        value={certForm.project_title || ''}
                        onChange={e => handleCertFieldChange('project_title', e.target.value)}
                        placeholder="e.g. Java Full-Stack with AI"
                        className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                      />
                    </div>

                    {/* Row 4: INTERNSHIP TITLE */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">INTERNSHIP TITLE</label>
                      <input
                        type="text"
                        value={certForm.intern_title || ''}
                        onChange={e => handleCertFieldChange('intern_title', e.target.value)}
                        placeholder="e.g. AI Powered CRM"
                        className="w-full bg-white dark:bg-slate-800 border border-purple-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs rounded-xl py-2 px-3 focus:outline-none focus:border-[#7c3aed] dark:focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions: Save (if modified) & Generate */}
                <div className="space-y-3 pt-1">
                  {certDirty && (
                    <button
                      onClick={handleSaveCourseCert}
                      disabled={isSavingCert}
                      className="w-full py-3.5 px-6 rounded-2xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSavingCert ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                      {isSavingCert ? 'Saving Details...' : 'Save Certificate Details'}
                    </button>
                  )}

                  <button
                    onClick={handleGenerateCourseCert}
                    disabled={isGeneratingCert || certDirty || !canGenerateCourseCert}
                    title={
                      certDirty ? 'Save details before generating'
                        : !canGenerateCourseCert ? 'Billing must be completed and fully paid (no pending installments) before generating certificates'
                        : undefined
                    }
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#51228d] hover:bg-[#431a77] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingCert ? <Icons.RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                    {isGeneratingCert ? 'Generating...' : 'Generate Certificates'}
                  </button>

                  {!canGenerateCourseCert && !certDirty && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-center">
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                        Complete billing (amount &gt; 0) and clear all pending installments to generate certificates.
                      </p>
                    </div>
                  )}
                </div>

                {/* Generated Certificates List matching ID card screenshot */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">
                      Generated Certificates ({generatedCourseCerts.length})
                    </p>
                    {generatedCourseCerts.length > 0 && (
                      <button
                        onClick={handlePrintAllCourseCerts}
                        disabled={isPrintingCert}
                        className="text-xs font-bold text-[#7c3aed] hover:underline disabled:opacity-50"
                      >
                        {isPrintingCert ? 'Preparing...' : 'Print all'}
                      </button>
                    )}
                  </div>
                  {generatedCourseCerts.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No certificates generated yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {generatedCourseCerts.map((cert, idx) => (
                        <div key={idx} className="p-3 bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between gap-3 border border-transparent dark:border-slate-800 transition-colors">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800">
                              {cert.type === 'enrollment' ? 'Course Enrollment' : cert.type === 'completion' ? 'Course Completion' : cert.type === 'project' ? 'Project Experience' : cert.type === 'internship' ? 'Internship' : 'Certificate'}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                              {cert.fileName || 'certificate.pdf'}
                            </p>
                          </div>
                          {cert.success && cert.s3?.url && (
                            <button
                              onClick={() => window.open(cert.s3!.url, '_blank', 'noopener')}
                              className="text-xs font-bold text-[#7c3aed] hover:underline flex-shrink-0"
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
              <div className="space-y-4">
                {/* Actions: Edit Lead & Delete Lead */}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => onEditLead?.(selectedLead)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#ede9fe] hover:bg-[#ddd6fe] dark:bg-purple-600 dark:hover:bg-purple-700 text-[#7c3aed] dark:text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Icons.Edit className="w-3.5 h-3.5" /> Edit Lead
                  </button>
                  {currentUserRole === 'admin' && (
                    <button
                      onClick={() => { if (!window.confirm('Delete this lead permanently?')) return; onDeleteLead?.(selectedLead._id); setSelectedLeadId(null); }}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all border border-transparent dark:border-red-900/50"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>

                {/* Status & Pipeline */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">STATUS</label>
                    <div className="relative">
                      <select
                        value={selectedLead.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        disabled={leadLoading}
                        className="w-full bg-white border border-purple-200/90 text-slate-900 font-semibold text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-[#7c3aed] appearance-none pr-8 cursor-pointer transition-colors"
                      >
                        <option value="Hot">Hot</option>
                        <option value="Warm">Warm</option>
                        <option value="Cold">Cold</option>
                      </select>
                      <Icons.ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">PIPELINE</label>
                    <div className="w-full bg-[#e5effc] text-slate-800 font-semibold text-xs rounded-xl py-2.5 px-3">
                      {selectedLead.pipeline || 'Enrolled'}
                    </div>
                  </div>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">ASSIGNED TO</label>
                  {currentUserRole === 'admin' ? (
                    <div className="relative">
                      <select
                        value={selectedLead.assignedto || ''}
                        onChange={e => handleAssign(e.target.value)}
                        disabled={leadLoading}
                        className="w-full bg-white border border-purple-200/90 text-slate-900 font-semibold text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-[#7c3aed] appearance-none pr-8 cursor-pointer transition-colors"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                      </select>
                      <Icons.ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-full bg-[#e5effc] text-slate-800 font-semibold text-xs rounded-xl py-2.5 px-3">
                      {selectedLead.assignedto || <span className="text-slate-400 italic">Unassigned</span>}
                    </div>
                  )}
                </div>

                {/* Unified Lead Information Card matching ID Card Details */}
                <div className="bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4">Lead Information</h4>

                  <div className="space-y-4">
                    {/* Row 1: COURSE & SOURCE */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">COURSE</p>
                        <span className="text-sm font-bold text-slate-900 underline decoration-slate-300 underline-offset-4 inline-block">
                          {selectedLead.course || '—'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">SOURCE</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.leadfrom || 'Manual'}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: PROGRAM TYPE & PROFESSION */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">PROGRAM TYPE</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.programType || '—'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">PROFESSION</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.profession || '—'}
                        </span>
                      </div>
                    </div>

                    {selectedLead.referredBy && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">REFERRED BY</p>
                        <span className="text-xs font-semibold text-slate-700 inline-block">
                          {selectedLead.referredBy}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remarks Section */}
                <div className="space-y-3 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                      className="flex-1 px-3.5 py-2.5 bg-white border border-purple-200/90 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#7c3aed] transition-colors"
                    />
                    <button
                      onClick={handleAddRemark}
                      disabled={!newRemark.trim() || leadLoading}
                      className="flex-shrink-0 p-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center"
                      title="Add Remark"
                    >
                      <Icons.Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
                    {(selectedLead.remarks || []).length === 0 ? (
                      <p className="text-center text-slate-400 text-xs italic py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No remarks yet
                      </p>
                    ) : (
                      [...(selectedLead.remarks || [])].reverse().map(r => (
                        <div key={r._id} className="group p-3.5 bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 rounded-2xl flex justify-between gap-3 items-start border border-transparent dark:border-slate-800 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">{r.remark}</p>
                            <p className="text-[9px] text-slate-400 mt-1.5 font-bold">
                              {formatRemarkDate(r.timestamp)}{r.addedBy ? ` · ${r.addedBy}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteRemark(r._id)}
                            disabled={leadLoading}
                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            title="Delete remark"
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
              <div className="space-y-5">
                {/* Campaign History Section */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Campaign History ({(selectedLead.campaignHistory || []).length})
                  </p>
                  {(selectedLead.campaignHistory || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No campaign message sent yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...(selectedLead.campaignHistory || [])].reverse().map((c, i) => (
                        <div key={i} className="p-3.5 bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-800 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{c.campaignName}</p>
                            {c.repliedAt ? (
                              <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#ede9fe] text-[#7c3aed]">
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Conversation History ({(selectedLead.conversations || []).length})
                  </p>
                  {(selectedLead.conversations || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs italic py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No conversation history found
                    </p>
                  ) : (
                    <div className="p-4 bg-[#f6f3fc] dark:bg-slate-950/70 border border-purple-100/60 dark:border-slate-800 rounded-3xl space-y-4 shadow-xs">
                      {chatTimeline.map((group) => (
                        <div key={group.dayKey} className="space-y-3">
                          <div className="flex justify-center sticky top-0 z-10 py-0.5">
                            <span className="px-3 py-1 rounded-full bg-white/95 dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200/70 dark:border-amber-700/50 uppercase tracking-wider shadow-2xs">
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
                                    <div className="bg-[#7c3aed] text-white p-3 rounded-2xl rounded-tr-none text-xs max-w-[85%] shadow-xs leading-relaxed font-medium">
                                      <p>{c.userMsg}</p>
                                      {timeLabel && (
                                        <div className="text-[9px] text-purple-200 mt-1 text-right font-normal">
                                          {timeLabel}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {c.botReply && (
                                  <div className="flex flex-col items-start">
                                    <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-3 rounded-2xl rounded-tl-none text-xs max-w-[85%] border border-purple-100/80 dark:border-slate-800 shadow-xs leading-relaxed font-medium">
                                      {(c.botReply || '').split('\n').map((l, j) => (
                                        <p key={j} className="mb-1 last:mb-0">{l}</p>
                                      ))}
                                      {timeLabel && (
                                        <div className="text-[9px] text-slate-400 mt-1 text-right font-normal">
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

          {/* Panel footer */}
          {((activeTab === 'fees') || (activeTab === 'cert') || (activeTab === 'batch' && !batchEditMode && !selectedLead.batchId)) && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              {activeTab === 'fees' && feesDirty && (
                <button
                  onClick={handleSaveFees}
                  disabled={feesLoading}
                  style={{ color: '#ffffff' }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white !text-white font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-50"
                >
                  {feesLoading ? <Icons.RefreshCcw className="w-4 h-4 animate-spin text-white" /> : null}
                  <span className="text-white !text-white font-bold">{feesLoading ? 'Saving...' : 'Save Fees'}</span>
                </button>
              )}
              {activeTab === 'fees' && !feesDirty && (
                <p className="text-center text-xs text-slate-400">All changes are saved</p>
              )}
              {activeTab === 'batch' && !batchEditMode && !selectedLead.batchId && (
                <button
                  onClick={() => setBatchEditMode(true)}
                  style={{ color: '#ffffff' }}
                  className="w-full py-3.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white !text-white font-bold text-sm rounded-2xl transition-all shadow-sm"
                >
                  <span className="text-white !text-white font-bold">Set Batch Details</span>
                </button>
              )}
              {activeTab === 'cert' && certDirty && (
                <button
                  onClick={handleSaveCourseCert}
                  disabled={isSavingCert}
                  style={{ color: '#ffffff' }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white !text-white font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-50"
                >
                  {isSavingCert ? <Icons.RefreshCcw className="w-4 h-4 animate-spin text-white" /> : null}
                  <span className="text-white !text-white font-bold">{isSavingCert ? 'Saving...' : 'Save Certificate Details'}</span>
                </button>
              )}
              {activeTab === 'cert' && !certDirty && (
                <p className="text-center text-xs text-slate-400">All changes are saved</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch members modal */}
      {batchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setBatchModal(null)}>
          <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Batch Members</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-bold uppercase tracking-wider">{batchModal.code}</p>
              </div>
              <button onClick={() => setBatchModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
              {batchModal.members.map(lead => (
                <div key={lead._id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <div className={`w-8 h-8 rounded-full ${profileColor(lead._id).bg} ${profileColor(lead._id).text} flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                    {(lead.userName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate flex items-center gap-1.5">
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
                    className="text-xs font-bold text-blue-600 hover:underline flex-shrink-0"
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
