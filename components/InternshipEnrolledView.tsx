import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lead, User, InternCertificateDetail, CertificateResult, Installment } from '../types';
import { apiService } from '../services/api';
import { Icons } from './Icons';
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
// const YEARS_OF_STUDY = ['1st Year', '2nd Year', '3rd Year', 'Final Year'];

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

/** Compute fees summary for a lead */
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

const InternshipEnrolledView: React.FC<InternshipEnrolledViewProps> = ({ leads, users, currentUserRole, onUpdateLead, onOpenFees, onDeleteLead, onEditLead, searchQuery: externalSearchQuery, onSearchQueryChange }) => {
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

  // Messaging mode
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
  const [batchModal, setBatchModal] = useState<{ code: string; members: Lead[] } | null>(null);
  const [leadLoading, setLeadLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [dateScheduled, setDateScheduled] = useState('');
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
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  // Server already filters — internalLeads is the current page of matching leads
  const internshipLeads = internalLeads;
  const filteredLeads = internalLeads;

  // Fetch all unique colleges and batches for filter dropdowns (always full list, unaffected by pagination)
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

  // Core fetch: one page at a time from the server
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

  // Fetch ALL leads (no pagination) for the batch grouping view
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

  // Fetch all leads for batch view whenever batch mode is active and query/filters change
  useEffect(() => {
    if (viewMode === 'batch') {
      void fetchAllBatchLeads(searchQuery, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, searchQuery, filters]);

  // Exiting messaging mode (or a change of query) invalidates any prior selection
  useEffect(() => {
    setSelectedMsgIds(new Set());
  }, [searchQuery, filters]);

  // Fetch known campaign names for the message modal dropdown
  useEffect(() => {
    let mounted = true;
    apiService.getCampaignNames().then(list => {
      if (mounted) setCampaignNames(list);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

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

  /** Group filtered leads by their latest batch_code */
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
    // Sort: named batches first (alphabetical), unassigned last
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

  // Pre-populate form when a lead is selected
  useEffect(() => {
    if (!selectedLead) return;
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
    setDateScheduled(selectedLead.date_scheduled ? selectedLead.date_scheduled.split('T')[0] : '');
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

  /** Generate batch code for any lead from the batch view (no-batch group) */
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

  const hasInternDetails = (lead: Lead) =>
    Array.isArray(lead.InternDetails) && lead.InternDetails.length > 0;

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

  const formatFeesDateTime = (dateString: any) => {
    if (!dateString) return '';
    const raw = typeof dateString === 'string' ? dateString : dateString?.$date;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const feesPaidAmount = feesInstallments
    .filter(i => i.status === 'Paid')
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const feesBalanceAmount = Math.max((parseFloat(feesBilledAmount) || 0) - feesPaidAmount, 0);
  const pendingInstallments = feesInstallments.filter(i => i.status === 'Pending');
  const overdueInstallments = pendingInstallments.filter(inst => {
    const dueDateValue = parseDate(inst.dueDate);
    if (!dueDateValue || inst.amount <= 0) return false;
    const dueDate = new Date(dueDateValue);
    if (Number.isNaN(dueDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  });

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
        onUpdateLead(result.lead);
      }
    } catch { alert('Failed to save date scheduled'); } finally { setLeadLoading(false); }
  };

  const handleDeleteLeadById = (id: string) => {
    if (!window.confirm('Delete this lead permanently?')) return;
    onDeleteLead?.(id);
    if (selectedLeadId === id) setSelectedLeadId(null);
  };

  const handleBatchCodeClick = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    // Show modal immediately with any available local members, then fetch all from server
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
      // keep local members already shown
    }
  };

  const fieldClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all';

  const labelClass = 'text-[10px] font-black text-slate-400 uppercase tracking-widest';

  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE));
  const paginatedLeads = internalLeads;

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">

      {/* ── Main panel ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedLeadId ? 'md:mr-[480px]' : ''}`}>

        {/* Header */}
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800">Internship Enrolled</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {totalLeads} student{totalLeads !== 1 ? 's' : ''} • Manage certificate details & generation
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Icons.Menu className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode('batch')}
                  className={`px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${viewMode === 'batch' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Icons.User className="w-3.5 h-3.5" /> Batches
                </button>
              </div>
              {/* Search */}
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 shadow-sm"
                />
              </div>
              <button
                onClick={() => setFilters(prev => ({ ...prev, statusFilter: prev.statusFilter === 'responded' ? null : 'responded' }))}
                title="Show interns who responded after a follow-up"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all shadow-sm ${filters.statusFilter === 'responded' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${filters.statusFilter === 'responded' ? 'bg-white' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'}`} />
                <span className="hidden sm:inline">Responded</span>
              </button>
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${hasActiveFilters ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icons.Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
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

        {/* Local filter drawer - limited to internship filters */}
        {isFilterOpen && (
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-40 border-l border-slate-200">
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800">Filters</h2>
                <button onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><Icons.X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">College</label>
                  <select value={filters.college || ''} onChange={e => setFilters({ ...filters, college: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Colleges</option>
                    {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch</label>
                  <select value={filters.batch || ''} onChange={e => setFilters({ ...filters, batch: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Batches</option>
                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Range</label>
                  <div className="mt-2 flex gap-2">
                    <input type="date" value={filters.fromDate || ''} onChange={e => setFilters({ ...filters, fromDate: e.target.value })} className="w-1/2 px-3 py-2 border border-slate-200 rounded-lg" />
                    <input type="date" value={filters.toDate || ''} onChange={e => setFilters({ ...filters, toDate: e.target.value })} className="w-1/2 px-3 py-2 border border-slate-200 rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned To</label>
                  <select value={filters.assignedUser || ''} onChange={e => setFilters({ ...filters, assignedUser: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Staff</option>
                    {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Source</label>
                  <select value={filters.source || ''} onChange={e => setFilters({ ...filters, source: e.target.value })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="">All Sources</option>
                    {['Manual', 'Website', 'WhatsApp', 'Instagram', 'Facebook', 'LinkedIn', 'Referral', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {campaignNames.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Campaign Replied</label>
                    <select value={filters.campaigns?.[0] || ''} onChange={e => setFilters({ ...filters, campaigns: e.target.value ? [e.target.value] : [] })} className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg">
                      <option value="">All Campaigns</option>
                      {campaignNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button onClick={() => { setFilters(initialFilters); }} className="flex-1 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Reset</button>
                <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* Summary chips */}
        <div className="px-6 pb-3 flex gap-3 flex-wrap">
          {/* <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2 shadow-sm">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total</p>
            <p className="text-xl font-black text-emerald-700">{internshipLeads.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details Saved</p>
            <p className="text-xl font-black text-slate-700">
              {internshipLeads.filter(hasInternDetails).length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Setup</p>
            <p className="text-xl font-black text-slate-700">
              {internshipLeads.filter(l => !hasInternDetails(l)).length}
            </p>
          </div> */}
          {viewMode === 'batch' && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-2 shadow-sm">
              <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Batches</p>
              <p className="text-xl font-black text-violet-700">
                {batchGroups.filter(([k]) => k !== '__none__').length}
              </p>
            </div>
          )}
        </div>

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <div className="px-6 pb-6 flex-1 overflow-hidden">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
              <div className="overflow-auto flex-1">
                {isLoadingInternal && (
                  <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-600 font-bold flex items-center gap-1.5">
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
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 hidden lg:table-cell">College</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 hidden md:table-cell">Batch</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center">Fees</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingInternal && internalLeads.length === 0 ? (
                      <tr>
                        <td colSpan={isMessagingMode ? 7 : 6} className="px-6 py-16 text-center text-slate-400 text-sm">Loading students…</td>
                      </tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={isMessagingMode ? 7 : 6} className="px-6 py-16 text-center text-slate-400 italic text-sm">
                          No internship enrolled students found.
                        </td>
                      </tr>
                    ) : (
                      paginatedLeads.map(lead => {
                        const latestDetail = Array.isArray(lead.InternDetails) && lead.InternDetails.length > 0
                          ? lead.InternDetails[lead.InternDetails.length - 1]
                          : null;
                        const batchCode = latestDetail?.batch_code?.trim() || '';
                        const color = batchCode ? batchColor(batchCode) : null;
                        return (
                          <tr
                            key={lead._id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedLeadId === lead._id ? 'bg-emerald-50/50' : ''} ${selectedMsgIds.has(lead._id) ? 'bg-indigo-50/40' : ''}`}
                            onClick={() => setSelectedLeadId(lead._id)}
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
                                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                  {(lead.userName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800 text-sm">{lead.userName}</span>
                                    {lead.is_leader && (
                                      <span title="Batch Leader" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-black uppercase">
                                        <Icons.Crown className="w-2.5 h-2.5" /> Leader
                                      </span>
                                    )}
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
                                  onClick={e => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                                  className="text-green-500 hover:text-green-600 cursor-pointer"
                                >
                                  <Icons.WhatsApp className="w-4 h-4" />
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell">
                              <span className="text-sm text-slate-700">
                                {latestDetail?.college || <span className="text-slate-300 italic text-xs">—</span>}
                              </span>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell">
                              <div className="flex flex-col gap-1">
                                {batchCode && color ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={e => handleBatchCodeClick(e, batchCode)}
                                      title="Click to see batch members"
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border cursor-pointer hover:shadow-md active:scale-95 transition-all ${color.bg} ${color.border} ${color.text}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                      {batchCode}
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); copyBatchCode(batchCode); }}
                                      title="Copy batch code"
                                      className={`p-1 rounded transition-colors ${copiedCode === batchCode ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                    >
                                      {copiedCode === batchCode
                                        ? <Icons.Check className="w-3 h-3" />
                                        : <Icons.Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleGenerateBatchForLead(lead); }}
                                    disabled={generatingBatchForLead.has(lead._id)}
                                    title="Generate batch code"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 text-white text-[9px] font-black hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50"
                                  >
                                    {generatingBatchForLead.has(lead._id)
                                      ? <Icons.RefreshCcw className="w-2.5 h-2.5 animate-spin" />
                                      : <Icons.RefreshCcw className="w-2.5 h-2.5" />}
                                    Generate
                                  </button>
                                )}
                                {lead.date_scheduled && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {new Date(lead.date_scheduled).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {(() => {
                                const fees = getFeesSummary(lead);
                                if (!fees) {
                                  return (
                                    <button
                                      onClick={e => { e.stopPropagation(); openFeesTabForLead(lead._id); }}
                                      title="Add fees"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 transition-all hover:shadow-sm active:scale-95"
                                    >
                                      <Icons.Plus className="w-3 h-3" />
                                      Add
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); openFeesTabForLead(lead._id); }}
                                    title="Open fees module"
                                    className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all hover:shadow-sm active:scale-95 ${fees.allPaid ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}
                                  >
                                    <span className={`text-[10px] font-black uppercase ${fees.allPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                      {fees.allPaid ? '✓ All Paid' : `${fees.paidCount}/${fees.totalCount} Paid`}
                                    </span>
                                    <span className={`text-[9px] ${fees.allPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                                      ₹{fees.totalPaid.toLocaleString()} paid{fees.totalPending > 0 ? ` · ₹${fees.totalPending.toLocaleString()} due` : ''}
                                    </span>
                                  </button>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={e => { e.stopPropagation(); setSelectedLeadId(lead._id); }}
                                  className="text-emerald-600 hover:text-emerald-700 text-xs font-bold hover:underline"
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
            {isFetchingBatch && (
              <div className="px-5 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                <Icons.RefreshCcw className="w-3 h-3 animate-spin" /> Loading all batches…
              </div>
            )}
            {!isFetchingBatch && batchGroups.length === 0 && (
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
              return (
                <div key={batchKey} className={`rounded-2xl border ${color.border} overflow-hidden shadow-sm`}>
                  {/* Batch header */}
                  <button
                    className={`w-full flex items-center justify-between px-5 py-4 ${color.bg} hover:brightness-[0.97] transition-all`}
                    onClick={() => toggleBatch(batchKey)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Tree connector dot */}
                      <div className={`w-3 h-3 rounded-full ${color.dot} flex-shrink-0`} />
                      <div className="text-left">
                        <p className={`text-sm font-black uppercase tracking-wider ${color.text}`}>
                          {isNone ? 'No Batch Assigned' : batchKey}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {members.length} student{members.length !== 1 ? 's' : ''}
                          {!isNone && ` • ${members.filter(hasInternDetails).length} ready`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isNone && (
                        <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${color.bg} ${color.border} ${color.text}`}>
                          {members.filter(hasInternDetails).length}/{members.length} ready
                        </span>
                      )}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isOpen ? color.text : 'text-slate-400'}`}>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </button>

                  {/* Expandable member list */}
                  {isOpen && (
                    <div className="bg-white divide-y divide-slate-50">
                      {/* Tree line connector */}
                      {members.map((lead, idx) => {
                        const isLast = idx === members.length - 1;
                        return (
                          <div
                            key={lead._id}
                            className={`flex items-center gap-0 hover:bg-slate-50 transition-colors cursor-pointer group ${selectedLeadId === lead._id ? 'bg-emerald-50/40' : ''}`}
                            onClick={() => setSelectedLeadId(lead._id)}
                          >
                            {/* Tree branch lines */}
                            <div className="pl-5 flex-shrink-0 flex flex-col items-center self-stretch">
                              <div className="w-px bg-slate-200 flex-1" />
                              <div className="flex items-center">
                                <div className="w-px bg-slate-200 h-1/2" />
                                <div className="w-3 h-px bg-slate-200" />
                              </div>
                              {!isLast && <div className="w-px bg-slate-200 flex-1" />}
                            </div>

                            <div className="flex-1 flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isNone ? 'bg-slate-100 text-slate-500' : `${color.bg} ${color.text}`}`}>
                                  {(lead.userName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{lead.userName}</span>
                                    {lead.is_leader && (
                                      <span title="Batch Leader" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-black uppercase">
                                        <Icons.Crown className="w-2.5 h-2.5" /> Leader
                                      </span>
                                    )}
                                    {lead.respondedAfterFollowUp && (
                                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Responded"></span>
                                    )}
                                    {(lead.campaignHistory || []).some(c => c.repliedAt) && (
                                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title={`Replied to campaign: ${[...(lead.campaignHistory || [])].reverse().find(c => c.repliedAt)?.campaignName || ''}`}></span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400">{lead.userNumber}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                {/* Fees chip */}
                                {(() => {
                                  const fees = getFeesSummary(lead);
                                  if (!fees) {
                                    return (
                                      <button
                                        onClick={e => { e.stopPropagation(); openFeesTabForLead(lead._id); }}
                                        title="Add fees"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wide hover:bg-emerald-700 transition-all hover:shadow-sm active:scale-95"
                                      >
                                        <Icons.Plus className="w-3 h-3" />
                                        Add Fees
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={e => { e.stopPropagation(); openFeesTabForLead(lead._id); }}
                                      title="Open fees module"
                                      className={`inline-flex flex-col items-center px-2 py-1 rounded-lg border transition-all hover:shadow-sm active:scale-95 ${fees.allPaid ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}
                                    >
                                      <span className={`text-[9px] font-black uppercase ${fees.allPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {fees.allPaid ? '✓ All Paid' : `${fees.paidCount}/${fees.totalCount} Paid`}
                                      </span>
                                      <span className={`text-[8px] ${fees.allPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        ₹{fees.totalPaid.toLocaleString()}{fees.totalPending > 0 ? ` · ₹${fees.totalPending.toLocaleString()} due` : ''}
                                      </span>
                                    </button>
                                  );
                                })()}
                                {/* Generate batch button — only for no-batch group */}
                                {isNone && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleGenerateBatchForLead(lead); }}
                                    disabled={generatingBatchForLead.has(lead._id)}
                                    title="Generate batch code"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 text-white text-[9px] font-black hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50"
                                  >
                                    {generatingBatchForLead.has(lead._id)
                                      ? <Icons.RefreshCcw className="w-2.5 h-2.5 animate-spin" />
                                      : <Icons.RefreshCcw className="w-2.5 h-2.5" />}
                                    Gen Batch
                                  </button>
                                )}
                                <span
                                  role="button"
                                  title="Open in WhatsApp"
                                  onClick={e => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                                  className="text-green-400 hover:text-green-600 cursor-pointer"
                                >
                                  <Icons.WhatsApp className="w-3.5 h-3.5" />
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); setSelectedLeadId(lead._id); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 hover:text-emerald-700 text-xs font-black"
                                >
                                  Manage →
                                </button>
                                {currentUserRole === 'admin' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteLeadById(lead._id); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete lead"
                                  >
                                    <Icons.Trash className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
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

      {/* ── Batch members modal ── */}
      {batchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setBatchModal(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                {(() => {
                  const c = batchColor(batchModal.code);
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase border ${c.bg} ${c.border} ${c.text}`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      {batchModal.code}
                    </span>
                  );
                })()}
                <p className="text-[10px] text-slate-400 mt-1">{batchModal.members.length} student{batchModal.members.length !== 1 ? 's' : ''} in this batch</p>
              </div>
              <button onClick={() => setBatchModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {batchModal.members.map(m => (
                <button
                  key={m._id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left"
                  onClick={() => {
                    setInternalLeads(prev => prev.some(l => l._id === m._id) ? prev : [...prev, m]);
                    setSelectedLeadId(m._id);
                    setBatchModal(null);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(m.userName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-800">{m.userName}</span>
                      {m.is_leader && (
                        <span title="Batch Leader" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-black uppercase">
                          <Icons.Crown className="w-2.5 h-2.5" /> Leader
                        </span>
                      )}
                      {m.respondedAfterFollowUp && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Responded"></span>
                      )}
                      {(m.campaignHistory || []).some(c => c.repliedAt) && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" title={`Replied to campaign: ${[...(m.campaignHistory || [])].reverse().find(c => c.repliedAt)?.campaignName || ''}`}></span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">{m.userNumber}</p>
                  </div>
                  <Icons.Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile overlay ── */}
      {selectedLeadId && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-20 backdrop-blur-sm"
          onClick={() => setSelectedLeadId(null)}
        />
      )}

      {/* ── Right sidebar panel ── */}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-30 flex flex-col border-l border-slate-200 ${selectedLeadId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedLead && (
          <>
            {/* Panel header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
                    {(selectedLead.userName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800">{selectedLead.userName}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span>{selectedLead.userNumber}</span>
                      <span
                        role="button"
                        title="Open in WhatsApp"
                        onClick={e => { e.stopPropagation(); const num = (selectedLead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                        className="text-green-500 hover:text-green-600 cursor-pointer"
                      >
                        <Icons.WhatsApp className="w-4 h-4" />
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-emerald-600 font-bold">{selectedLead.course}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLeadId(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4 p-1 bg-slate-100 rounded-xl">
                {[
                  { id: 'details', label: 'Cert Details' },
                  { id: 'certificates', label: `Certs${generatedCerts.length > 0 ? ` (${generatedCerts.length})` : ''}` },
                  { id: 'fees', label: `Fees${feesInstallments.length > 0 ? ` (${feesInstallments.length})` : ''}` },
                  { id: 'lead', label: 'Lead Details' },
                  { id: 'history', label: 'History' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === 'certificates' && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handlePrintAll}
                    disabled={printingAll}
                    title="Print all certificates as a combined PDF"
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-lg hover:bg-emerald-700 transition-colors shadow-sm active:scale-[0.97] disabled:opacity-50"
                  >
                    {printingAll ? (
                      <><Icons.RefreshCcw className="w-3 h-3 animate-spin" /> Opening...</>
                    ) : (
                      <><Icons.Printer className="w-3 h-3" /> Print All</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ── Details tab ── */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Row: Salutation + Name */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Salutation</label>
                      <select value={formData.salutation || ''} onChange={e => handleFieldChange('salutation', e.target.value)} className={fieldClass}>
                        <option value="">-</option>
                        {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className={labelClass}>Full Name</label>
                      <input type="text" value={formData.userName || ''} onChange={e => handleFieldChange('userName', e.target.value)} className={fieldClass} placeholder="Student name" />
                    </div>
                  </div>

                  {/* Email + Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Email</label>
                      <input type="email" value={formData.userEmail || ''} onChange={e => handleFieldChange('userEmail', e.target.value)} className={fieldClass} placeholder="email@example.com" />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Phone</label>
                      <input type="text" value={formData.phone || ''} onChange={e => handleFieldChange('phone', e.target.value)} className={fieldClass} placeholder="10-digit number" />
                    </div>
                  </div>

                  {/* Reg No + Year of Study */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Register No.</label>
                      <input type="text" value={formData.reg_no || ''} onChange={e => handleFieldChange('reg_no', e.target.value)} className={fieldClass} placeholder="Reg number" />
                    </div>
                    <div className="space-y-1">
                     <label className={labelClass}>Year Of Study</label>
                      <input type="text" value={formData.year_of_study || ''} onChange={e => handleFieldChange('year_of_study', e.target.value)} className={fieldClass} placeholder="Year Of Study" />
                    </div>
                  </div>

                  {/* College */}
                  <div className="space-y-1">
                    <label className={labelClass}>College</label>
                    <input type="text" value={formData.college || ''} onChange={e => handleFieldChange('college', e.target.value)} className={fieldClass} placeholder="College name" />
                  </div>

                  {/* College Location + Department */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>College Location</label>
                      <input type="text" value={formData.college_location || ''} onChange={e => handleFieldChange('college_location', e.target.value)} className={fieldClass} placeholder="City" />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Department</label>
                      <input type="text" value={formData.department || ''} onChange={e => handleFieldChange('department', e.target.value)} className={fieldClass} placeholder="e.g. Computer Science" />
                    </div>
                  </div>

                  {/* Degree */}
                  <div className="space-y-1">
                    <label className={labelClass}>Degree</label>
                    <input type="text" value={formData.degree || ''} onChange={e => handleFieldChange('degree', e.target.value)} className={fieldClass} placeholder="e.g. Bachelor of Technology" />
                  </div>

                  {/* Internship */}
                  <div className="space-y-1">
                    <label className={labelClass}>Internship Program</label>
                    <input type="text" value={formData.internship || ''} onChange={e => handleFieldChange('internship', e.target.value)} className={fieldClass} placeholder="e.g. Full Stack Python" />
                  </div>

                  {/* Workshop */}
                  <div className="space-y-1">
                    <label className={labelClass}>Workshop (optional)</label>
                    <input type="text" value={formData.workshop || ''} onChange={e => handleFieldChange('workshop', e.target.value)} className={fieldClass} placeholder="e.g. PySpark, or leave blank" />
                  </div>

                  {/* Company */}
                  <div className="space-y-1">
                    <label className={labelClass}>Company</label>
                    <input type="text" value={formData.company || ''} onChange={e => handleFieldChange('company', e.target.value)} className={fieldClass} placeholder="Company name" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Batch Leader</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${!isLeader ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                        <input
                          type="radio"
                          name="is_leader"
                          checked={!isLeader}
                          onChange={() => { setIsLeader(false); setIsDirty(true); }}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-semibold">Not Leader</span>
                      </label>
                      <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${isLeader ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                        <input
                          type="radio"
                          name="is_leader"
                          checked={isLeader}
                          onChange={() => { setIsLeader(true); setIsDirty(true); }}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm font-semibold">Leader</span>
                      </label>
                    </div>
                  </div>

                  {/* Batch Code — with Generate button */}
                  <div className="space-y-1">
                    <label className={labelClass}>Batch Code</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={formData.batch_code || ''}
                          onChange={e => handleFieldChange('batch_code', e.target.value)}
                          className={fieldClass}
                          placeholder="e.g. BATCH-KRP-04-25"
                        />
                        {formData.batch_code && (() => {
                          const c = batchColor(formData.batch_code);
                          return (
                            <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${c.dot}`} />
                          );
                        })()}
                      </div>
                      {formData.batch_code && (
                        <button
                          onClick={() => copyBatchCode(formData.batch_code || "")}
                          title="Copy batch code"
                          className={`flex-shrink-0 flex items-center justify-center gap-1 px-2.5 h-9 rounded-xl text-xs font-black transition-all active:scale-[0.97] ${copiedCode === formData.batch_code ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                        >
                          {copiedCode === formData.batch_code
                            ? <><Icons.Check className="w-3.5 h-3.5" /> Copied!</>
                            : <Icons.Copy className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={handleGenerateBatch}
                        disabled={generatingBatch}
                        title="Auto-generate batch code from college & start date"
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-black rounded-xl hover:bg-violet-700 transition-all active:scale-[0.97] disabled:opacity-50 shadow-sm"
                      >
                        {generatingBatch ? (
                          <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Icons.RefreshCcw className="w-3.5 h-3.5" />
                        )}
                        Generate
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 pl-0.5">
                      Auto-generates from college name + start date (e.g. BATCH-KRP-04-25)
                    </p>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Start Date</label>
                      <input type="date" value={formData.start_date || ''} onChange={e => handleFieldChange('start_date', e.target.value)} className={fieldClass} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>End Date</label>
                      <input type="date" value={formData.end_date || ''} onChange={e => handleFieldChange('end_date', e.target.value)} className={fieldClass} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Issue Date</label>
                      <input type="date" value={formData.issue_date || ''} onChange={e => handleFieldChange('issue_date', e.target.value)} className={fieldClass} />
                    </div>
                  </div>

                  {isDirty && (
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest text-center animate-pulse">
                      Unsaved changes — save before generating
                    </p>
                  )}
                </div>
              )}

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
                        <span className="text-slate-400 mr-1">Rs</span>
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
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Paid</label>
                      <div className="mt-1 font-black text-emerald-700 text-lg">Rs {feesPaidAmount.toLocaleString()}</div>
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
                        <p className="text-xs text-slate-500">
                          {feesInstallments.length} total · {pendingInstallments.length} pending
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {feesDirty && (
                          <button
                            onClick={handleCancelFees}
                            className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={handleAddInstallment}
                          className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-all"
                        >
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
                          !Number.isNaN(new Date(dueDateValue).getTime()) &&
                          new Date(dueDateValue) < new Date() &&
                          inst.amount > 0;

                        return (
                          <div
                            key={index}
                            className={`p-3 rounded-xl border bg-white shadow-sm transition-colors group ${isOverdue ? 'border-red-300 bg-red-50/40' : 'border-slate-200 hover:border-emerald-200'}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                                {isOverdue && (
                                  <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteInstallment(index)}
                                className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
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
                                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 py-2 px-2 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Amount</label>
                                <input
                                  type="number"
                                  value={inst.amount}
                                  onChange={e => handleInstallmentChange(index, 'amount', Number(e.target.value))}
                                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 py-2 px-2 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Status</label>
                              <select
                                value={inst.status}
                                onChange={e => handleInstallmentChange(index, 'status', e.target.value as Installment['status'])}
                                className={`w-full text-xs font-bold py-2 px-2 rounded-lg border outline-none focus:ring-1 ${inst.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500' : 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-500'}`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                              </select>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              {inst.billGenerated ? (
                                inst.billUrl ? (
                                  <a
                                    onClick={e => e.stopPropagation()}
                                    href={inst.billUrl}
                                    target="_blank"
                                    rel="noopener"
                                    className="text-xs text-indigo-600 font-bold"
                                  >
                                    View Bill
                                  </a>
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
                                <div className="text-[10px] text-slate-400">
                                  {formatFeesDateTime(inst.billGeneratedAt)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {feesInstallments.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No installments added yet. Click "Add Installment" to create one.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Lead Details tab ── */}
              {activeTab === 'lead' && (
                <div className="space-y-5">
                  {/* Edit + Delete actions */}
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

                  {/* Status + Pipeline */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Status</label>
                      <select
                        value={selectedLead.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        disabled={leadLoading}
                        className={fieldClass}
                      >
                        <option value="Hot">Hot</option>
                        <option value="Warm">Warm</option>
                        <option value="Cold">Cold</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Pipeline</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-bold">
                        {selectedLead.pipeline || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Assigned To */}
                  <div className="space-y-1">
                    <label className={labelClass}>Assigned To</label>
                    {currentUserRole === 'admin' ? (
                      <select
                        value={selectedLead.assignedto || ''}
                        onChange={e => handleAssign(e.target.value)}
                        disabled={leadLoading}
                        className={fieldClass}
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                      </select>
                    ) : (
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
                        {selectedLead.assignedto || <span className="text-slate-400 italic">Unassigned</span>}
                      </div>
                    )}
                  </div>

                  {/* Course + Source + Program */}
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
                  </div>

                  {/* Date Scheduled */}
                  <div className="space-y-1">
                    <label className={labelClass}>Date Scheduled</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dateScheduled}
                        onChange={e => setDateScheduled(e.target.value)}
                        disabled={leadLoading}
                        className={fieldClass}
                      />
                      <button
                        onClick={handleDateScheduledSave}
                        disabled={leadLoading}
                        className="flex-shrink-0 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Remarks */}
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
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleAddRemark}
                        disabled={!newRemark.trim() || leadLoading}
                        className="flex-shrink-0 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
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

              {/* ── History tab ── */}
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
                                    <div className="bg-emerald-600 text-white p-2.5 rounded-2xl rounded-tr-none text-xs max-w-[90%] shadow-sm leading-relaxed">
                                      {c.userMsg}
                                      {timeLabel && <div className="text-[9px] text-emerald-100 mt-1 text-right">{timeLabel}</div>}
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

              {/* ── Certificates tab ── */}
              {activeTab === 'certificates' && (
                <div className="space-y-4">
                  {generatedCerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <Icons.Settings className="w-8 h-8 opacity-30" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">No certificates generated yet</p>
                      <p className="text-xs text-slate-400 mt-1">Save details first, then click Generate.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Icons.Check className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs font-bold text-emerald-700">
                          {generatedCerts.filter(c => c.success).length} certificate{generatedCerts.filter(c => c.success).length !== 1 ? 's' : ''} generated successfully
                        </p>
                      </div>
                      <div className="space-y-2">
                        {generatedCerts.map((cert, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${cert.success ? 'bg-white border-slate-200' : 'bg-red-50 border-red-100'}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cert.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                                {cert.success ? (
                                  <Icons.Check className="w-4 h-4" />
                                ) : (
                                  <Icons.X className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-700">Certificate {idx + 1}</p>
                                <p className="text-[10px] text-slate-400 truncate">{cert.fileName}</p>
                              </div>
                            </div>
                            {cert.success && cert.s3?.url && (
                              <button
                                onClick={() => window.open(cert.s3!.url, '_blank', 'noopener')}
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                              >
                                <Icons.Plus className="w-3 h-3 rotate-45" />
                                Open
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Panel footer actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-2">
              {activeTab === 'details' && (
                <button
                  onClick={handleSave}
                  disabled={loading || !isDirty}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Icons.RefreshCcw className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    'Save Certificate Details'
                  )}
                </button>
              )}

              {(activeTab === 'details' || activeTab === 'certificates') && (
                <button
                  onClick={handleGenerate}
                  disabled={generating || isDirty}
                  title={isDirty ? 'Save details first before generating' : ''}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <><Icons.RefreshCcw className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    'Generate Certificates'
                  )}
                </button>
              )}

              {activeTab === 'fees' && (
                <>
                  <button
                    onClick={handleSaveFees}
                    disabled={feesLoading || !feesDirty}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    {feesLoading ? (
                      <><Icons.RefreshCcw className="w-4 h-4 animate-spin" /> Saving...</>
                    ) : (
                      'Save Fees'
                    )}
                  </button>
                  {feesDirty && (
                    <p className="text-[10px] text-center text-amber-500 font-bold">
                      Save fees changes to keep installments updated
                    </p>
                  )}
                </>
              )}

              {isDirty && activeTab === 'details' && (
                <p className="text-[10px] text-center text-amber-500 font-bold">
                  Save details before generating certificates
                </p>
              )}
            </div>
          </>
        )}
      </div>

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
