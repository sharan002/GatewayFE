import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lead, User, DashboardCounts, LeadStats, LeadGroup, LeadGroupMember, ReferralGroup, ReferralGroupMember, normalizeLeadSource, expandSourceAliases } from './types';
import { apiService } from './services/api';
import { Icons } from './components/Icons';
import LeadFormModal from './components/LeadFormModal';
import LeadDetails from './components/LeadDetails';
import FilterPanel from './components/FilterPanel';
import Login from './components/Login';
import FeesView from './components/FeesView';
import InternshipEnrolledView from './components/InternshipEnrolledView';
import CourseEnrolledView from './components/CourseEnrolledView';
import MessageModal from './components/MessageModal';
import LeadAssistantChatbot from './components/LeadAssistantChatbot';
import DailyReminderGate from './components/DailyReminderGate';
import DailyReportView from './components/DailyReportView';
import NotesView from './components/NotesView';
import UserManagementView from './components/UserManagementView';
import { exportCrmData } from './utils/exportCrm';
import GroupChatView from './components/GroupChatView';
import ReleaseNotesView, { hasActiveReleaseNotes } from './components/ReleaseNotesView';
import WeeklyAIReportView from './components/WeeklyAIReportView';
import GoogleAnalyticsView from './components/GoogleAnalyticsView';
import BulkMsgView from './components/BulkMsgView';
import WhatsAppManagerView from './components/whatsapp/WhatsAppManagerView';
import CtwaAdsView from './components/CtwaAdsView';     
import BatchTimetableView from './components/BatchTimetableView';
import HrPortalView from './components/HrPortalView';
import JobEnquiryView from './components/JobEnquiryView';
import ReviewMeetingView from './components/ReviewMeetingView';
import SalesTrainingView from './components/SalesTrainingView';
import { LeadGroupChips, CreateGroupModal, LeadGroupPopup, GroupsPanel } from './components/LeadGroups';
import { ReferralGroupsButton, ReferralGroupsPanel, ReferralGroupPopup, ReferralCodeChip } from './components/ReferralGroups';

type View = 'dashboard' | 'leads' | 'transferred' | 'reminders' | 'enrolled' | 'internship-enrolled' | 'fees' | 'not-interested' | 'daily-report' | 'weekly-ai-report' | 'notes' | 'user-management' | 'group-chat' | 'release-notes' | 'google-analytics' | 'bulk-msg' | 'whatsapp-manager' | 'ctwa-ads' | 'batch-timetable' | 'hr-portal' | 'job-enquiry' | 'review-meeting' | 'sales-training';

export interface FilterState {
  courses: string[];
  programTypes: string[];
  professions: string[];
  sources: string[];
  statuses: string[];
  pipelines: string[];
  assignedUsers: string[];
  branches?: string[];
  campaigns: string[];
  fromDate: string;
  toDate: string;
  statusFilter: 'hot' | 'warm' | 'cold' | 'no-remarks' | 'responded' | 'qualified' | null;
  college?: string;
  batch?: string;
  assignedUser?: string;
  source?: string;
}

export const initialFilters: FilterState = {
  courses: [],
  programTypes: [],
  professions: [],
  sources: [],
  statuses: [],
  pipelines: [],
  assignedUsers: [],
  branches: [],
  campaigns: [],
  fromDate: '',
  toDate: '',
  statusFilter: null,
  college: '',
  batch: '',
  assignedUser: '',
  source: '',
};

const parseMongoDate = (date: any): string => {
  if (!date) return new Date().toISOString();
  if (typeof date === 'string') return date;
  if (date.$date) return date.$date;
  return new Date().toISOString();
};

const normalizeRemark = (remark: any) => ({
  _id: remark?._id?.$oid || remark?._id || Math.random().toString(36).substr(2, 9),
  remark: remark?.remark || '',
  timestamp: parseMongoDate(remark?.timestamp),
  addedBy: remark?.addedBy || remark?.username || remark?.createdBy || remark?.by || undefined,
});

const normalizeLead = (lead: any): Lead => ({
  _id: lead._id?.$oid || lead._id || Math.random().toString(36).substr(2, 9),
  userName: lead.userName || lead.username || 'Unknown Student',
  userNumber: lead.userNumber || '0000000000',
  course: lead.course || lead.courseofintrest || lead.courseTitle || null,
  leadfrom: lead.leadfrom || lead.source || 'Manual',
  referredBy: lead.referredBy || null,
  referralCode: lead.referralCode || null,
  is_referral_leader: !!lead.is_referral_leader,
  status: lead.status || 'Cold',
  pipeline: lead.pipeline || 'New',
  conversations: Array.isArray(lead.conversations) ? lead.conversations : [],
  remarks: Array.isArray(lead.remarks) ? lead.remarks.map(normalizeRemark) : [],
  datecreated: parseMongoDate(lead.datecreated),
  lastInteracted: parseMongoDate(lead.lastInteracted),
  followUpCount: lead.followUpCount || 0,
  respondedAfterFollowUp: !!lead.respondedAfterFollowUp,
  demoBooked: !!lead.demoBooked,
  lastFollowUpSentAt: lead.lastFollowUpSentAt ? parseMongoDate(lead.lastFollowUpSentAt) : null,
  reminder: lead.reminder ? parseMongoDate(lead.reminder) : null,
  profession: lead.profession || null,
  location: lead.location || lead.city || null,
  programType: lead.programType || lead.program_type || lead.programtype || null,
  assignedto: lead.assignedto || undefined,
  branch: lead.branch || undefined,
  fees: lead.fees || lead.feeStructure,
  aiAnalysis: lead.aiAnalysis || null,
  aiConversationSummary: lead.aiConversationSummary || null,
  InternDetails: Array.isArray(lead.InternDetails) ? lead.InternDetails : [],
  certificates: Array.isArray(lead.certificates) ? lead.certificates : [],
  is_leader: !!lead.is_leader,
  batchId: lead.batchId || null,
  Trainer: lead.Trainer || null,
  batch_date: lead.batch_date || null,
  campaignHistory: Array.isArray(lead.campaignHistory) ? lead.campaignHistory : [],
  autoReassignHistory: Array.isArray(lead.autoReassignHistory) ? lead.autoReassignHistory : [],
});

/**
 * Compact AI assistant button for dashboard rows.
 */
const AIAnalysisCell = ({ lead, onOpenAssistant }: { lead: Lead, onOpenAssistant: (id: string) => void }) => {
  return (
    <div className="flex min-w-0 items-center justify-center p-0.5">
      <button
        onClick={(e) => { e.stopPropagation(); onOpenAssistant(lead._id); }}
        className="max-w-full whitespace-normal break-words rounded-md border border-slate-100 bg-slate-50 px-1 py-1 text-[9px] font-bold uppercase leading-tight text-slate-700 shadow-sm hover:text-slate-900 lg:px-2 lg:text-[10px]"
      >
        AI Chat
      </button>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-blue-600 font-bold text-sm animate-pulse">Processing...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [isCounselorOpen, setIsCounselorOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("All Time");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false); 
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branchList, setBranchList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = localStorage.getItem('crm_view') as View;
    const valid: View[] = ['dashboard', 'transferred', 'reminders', 'enrolled', 'internship-enrolled', 'fees', 'not-interested', 'daily-report', 'notes', 'user-management', 'group-chat', 'release-notes', 'google-analytics', 'bulk-msg', 'whatsapp-manager', 'ctwa-ads', 'batch-timetable', 'hr-portal', 'job-enquiry', 'review-meeting', 'sales-training'];
    return valid.includes(saved) ? saved : 'dashboard';
  });
  const [feesInitialLeadId, setFeesInitialLeadId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);
  const [autoAssignStaffs, setAutoAssignStaffs] = useState<string[]>([]);
  const [excludedStaffs, setExcludedStaffs] = useState<string[]>([]);
  const [isAutoAssignConfigOpen, setIsAutoAssignConfigOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isMessagingMode, setIsMessagingMode] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);

  // ── Lead Groups ──
  const [leadGroups, setLeadGroups] = useState<LeadGroup[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupPickIds, setGroupPickIds] = useState<Set<string>>(new Set());
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<LeadGroupMember[]>([]);
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false);
  const [isGroupsPanelOpen, setIsGroupsPanelOpen] = useState(false);
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);

  // ── Referral Groups ──
  const [referralGroups, setReferralGroups] = useState<ReferralGroup[]>([]);
  const [isReferralPanelOpen, setIsReferralPanelOpen] = useState(false);
  const [openReferralGroup, setOpenReferralGroup] = useState<ReferralGroup | null>(null);
  const [referralMembers, setReferralMembers] = useState<ReferralGroupMember[]>([]);
  const [isLoadingReferralMembers, setIsLoadingReferralMembers] = useState(false);

  const [assistantOpenLeadId, setAssistantOpenLeadId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [dashboardAnalyticsLeads, setDashboardAnalyticsLeads] = useState<Lead[]>([]);
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts | null>(null);
  const [reminderLeads, setReminderLeads] = useState<Lead[]>([]);
  const [isFetchingLeads, setIsFetchingLeads] = useState(false);
  const leadsRequestIdRef = useRef(0);
  const [searchTabCounts, setSearchTabCounts] = useState<Record<string, number>>({});
  const searchTabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [showLeadLegend, setShowLeadLegend] = useState(false);

  const applyDateRange = (range: string) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    const day = now.getDay();
    if (range === 'All Time') { start = new Date(''); end = new Date(''); }
    else if (range === 'Last 24 hrs') start.setHours(start.getHours() - 24);
    else if (range === 'Last week') start.setDate(start.getDate() - 7);
    else if (range === 'Last month') start.setMonth(start.getMonth() - 1);
    else if (range === 'Today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (range === 'Yesterday') { start.setDate(now.getDate() - 1); end = new Date(start); }
    else if (range === 'This Week (Sun-Today)') start.setDate(now.getDate() - day);
    else if (range === 'Last Week (Sun - Sat)') { start.setDate(now.getDate() - day - 7); end = new Date(start); end.setDate(start.getDate() + 6); }
    else if (range === 'This Month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (range === 'Last Month') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (range === 'Last 90 Days') start.setDate(now.getDate() - 89);
    else if (range === 'Quarter to Date') start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    else if (range === 'This Year (Jan - Today)') start = new Date(now.getFullYear(), 0, 1);
    else if (range === 'Last 28 Days') start.setDate(now.getDate() - 27);
    else if (range === 'Last 30 Days') start.setDate(now.getDate() - 29);
    const toDate = range === 'All Time' ? '' : end.toISOString().slice(0, 10);
    const fromDate = range === 'All Time' ? '' : start.toISOString().slice(0, 10);
    setSelectedDateRange(range);
    setFilters(prev => ({ ...prev, fromDate, toDate }));
    setIsDateRangeOpen(false);
  };

  const pipelineMatrix = useMemo(() => {
    const stageMapping: Record<string, string[]> = {
      'New Leads': ['new', 'new leads', 'lead', 'fresh'],
      'RNR': ['rnr', 'ring not received', 'not reachable', 'busy'],
      'Contacted': ['contacted', 'connected', 'talked'],
      'Asked Time': ['asked time', 'call back', 'callback', 'follow up', 'follow-up'],
      'Not Interested': ['not interested', 'closed', 'rejected', 'dropped']
    };

    return Object.entries(stageMapping).map(([stageName, possibleValues]) => {
      const stageLeads = leads.filter(l => {
        const p = (l.pipeline || '').toLowerCase().trim();
        return possibleValues.some(v => p.includes(v)) || (stageName === 'New Leads' && !l.pipeline);
      });

      const counts = {
        hot: stageLeads.filter(l => l.status?.toLowerCase() === 'hot').length,
        warm: stageLeads.filter(l => l.status?.toLowerCase() === 'warm').length,
        cold: stageLeads.filter(l => l.status?.toLowerCase() === 'cold').length,
        remark: stageLeads.filter(l => !l.remarks || l.remarks.length === 0).length,
        responded: stageLeads.filter(l => l.respondedAfterFollowUp || l.status?.toLowerCase() === 'responded').length,
        qualified: stageLeads.filter(l => l.status?.toLowerCase() === 'qualified' || l.pipeline?.toLowerCase() === 'qualified').length,
      };

      const total = stageLeads.length;
      return { stageName, counts, total };
    });
  }, [leads]);

  const applyCounselor = (username: string) => {
    setFilters(prev => ({ ...prev, assignedUsers: username ? [username] : [], assignedUser: username }));
    setIsCounselorOpen(false);
  };

  const autoAssignRef = useRef(autoAssignEnabled);
  useEffect(() => { autoAssignRef.current = autoAssignEnabled; }, [autoAssignEnabled]);

  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('crm_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(JSON.parse(localStorage.getItem('crm_user') || 'null'));

  const viewLabels: Record<View, string> = {
    'user-management': 'User Management',
    dashboard: currentUser?.role === 'hr' ? 'Job Seekers' : 'Dashboard',
    leads: 'Leads',
    transferred: 'Transferred Leads',
    reminders: 'Reminders',
    enrolled: 'Enrolled',
    'internship-enrolled': 'Internship Enrolled',
    fees: 'Revenue',
    'not-interested': 'Not Interested',
    'daily-report': currentUser?.role === 'admin' ? 'Daily Report' : 'My Report',
    'weekly-ai-report': 'AI Report',
    notes: 'Notes & Sheet',
    'group-chat': 'Team Chat',
    'release-notes': "What's New",
    'google-analytics': 'Google Analytics',
    'bulk-msg': 'Bulk WhatsApp',
    'whatsapp-manager': 'WhatsApp Manager',
    'ctwa-ads': 'Meta Ads Manager',
    'batch-timetable': 'Batch Timetable',
    'hr-portal': 'HR Portal',
    'job-enquiry': 'Job Enquiry',
    'review-meeting': 'Review Meeting',
    'sales-training': 'Sales Training',
  };

  useEffect(() => {
    localStorage.setItem('crm_view', currentView);
  }, [currentView]);

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('crm_theme') === 'dark';
    if (saved) document.documentElement.classList.add('dark');
    return saved;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('crm_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const LEADS_PER_PAGE = 50;
  const LEADS_CHUNK_LIMIT = 200;

  const fetchDashboardMeta = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await apiService.fetchDashboardMeta(currentUser.username);
      if (data.success) {
        if (data.staffs) setUsers(data.staffs);
        if (data.counts) setDashboardCounts(data.counts);
      }
      if (currentUser.role === 'admin') {
        try {
          const b = await apiService.getBranches();
          if (b.success) setBranchList(b.branches);
        } catch { /* branch list is optional UI sugar */ }
      }
      if (currentUser.role === 'admin') {
        const settings = await apiService.getSettings();
        if (settings.success) setAutoAssignEnabled(settings.autoAssign);
        const staffSettings = await apiService.getAutoAssignStaffs();
        if (staffSettings.success) {
          setAutoAssignStaffs(staffSettings.staffs || []);
          setExcludedStaffs(staffSettings.excludedStaffs || []);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard meta:', err);
      handleLogout(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadsForCurrentView = async (opts?: { forceLoadAll?: boolean }): Promise<Lead[] | undefined> => {
    if (!currentUser) return;

    if (currentView === 'fees' || currentView === 'job-enquiry') return;

    const requestId = ++leadsRequestIdRef.current;

    if (currentView === 'reminders') {
      try {
        setIsFetchingLeads(true);
        const res = await apiService.queryLeads({
          view: 'reminders',
          page: 1,
          limit: 500,
          includeStats: false,
          mode: 'summary',
        });
        if (requestId !== leadsRequestIdRef.current) return;
        if (res.success) {
          const normalized = res.leads.map(normalizeLead);
          setReminderLeads(normalized);
        }
      } catch (err) {
        console.error('Failed to fetch reminders:', err);
      } finally {
        if (requestId === leadsRequestIdRef.current) setIsFetchingLeads(false);
      }
      return;
    }

    const hasActiveFilters = (() => {
      const { statusFilter, fromDate, toDate, courses, programTypes, professions, sources, statuses, pipelines, assignedUsers, branches, campaigns } = filters;
      const arrayFiltersActive =
        courses.length > 0 ||
        programTypes.length > 0 ||
        professions.length > 0 ||
        sources.length > 0 ||
        statuses.length > 0 ||
        pipelines.length > 0 ||
        assignedUsers.length > 0 ||
        (branches?.length ?? 0) > 0 ||
        campaigns.length > 0;
      return arrayFiltersActive || fromDate !== '' || toDate !== '' || statusFilter !== null;
    })();

    const isSearchOrFilterActive = searchQuery.trim().length > 0 || hasActiveFilters;
    const shouldLoadAll = opts?.forceLoadAll || isSearchOrFilterActive;

    const mode = (currentView === 'internship-enrolled' || currentView === 'enrolled') ? 'full' : 'summary';

    const queryFilters = filters.sources && filters.sources.length > 0
      ? { ...filters, sources: expandSourceAliases(filters.sources) }
      : filters;

    try {
      setIsFetchingLeads(true);

      if (!shouldLoadAll) {
        const res = await apiService.queryLeads({
          view: currentView === 'leads' ? 'dashboard' : currentView,
          searchQuery,
          filters: queryFilters,
          page: currentPage,
          limit: LEADS_PER_PAGE,
          includeStats: true,
          mode,
        });

        if (requestId !== leadsRequestIdRef.current) return;
        if (res.success) {
          const normalized = res.leads.map(normalizeLead);
          setLeads(normalized);
          setLeadsTotal(res.total || 0);
          setLeadStats(res.stats ?? null);
          return normalized;
        }
        return;
      }

      let page = 1;
      let total = 0;
      let accumulated: Lead[] = [];

      while (true) {
        const res = await apiService.queryLeads({
          view: currentView === 'leads' ? 'dashboard' : currentView,
          searchQuery,
          filters: queryFilters,
          page,
          limit: LEADS_CHUNK_LIMIT,
          includeStats: page === 1,
          mode,
        });

        if (requestId !== leadsRequestIdRef.current) return;
        if (!res.success) break;

        if (page === 1) {
          total = res.total || 0;
          setLeadsTotal(total);
          setLeadStats(res.stats ?? null);
        }

        const chunk = res.leads.map(normalizeLead);
        accumulated = accumulated.concat(chunk);
        setLeads(accumulated);

        if (accumulated.length >= total || chunk.length === 0) break;
        page += 1;
      }
      return accumulated;
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      if (requestId === leadsRequestIdRef.current) setIsFetchingLeads(false);
    }
  };

  const fetchLeadGroups = async () => {
    try {
      const groups = await apiService.getLeadGroups();
      setLeadGroups(groups);
    } catch (err) {
      console.error('Failed to fetch lead groups:', err);
    } finally {
      // no-op
    }
  };

  const fetchReferralGroups = async () => {
    try {
      const groups = await apiService.getReferralGroups();
      setReferralGroups(groups);
    } catch (err) {
      console.error('Failed to fetch referral groups:', err);
    }
  };

  const openReferralPopup = async (group: ReferralGroup) => {
    setOpenReferralGroup(group);
    setIsReferralPanelOpen(false);
    setIsLoadingReferralMembers(true);
    setReferralMembers([]);
    try {
      const members = await apiService.getReferralGroupMembers(group.code);
      setReferralMembers(members);
    } catch (err) {
      console.error('Failed to load referral group members:', err);
    } finally {
      setIsLoadingReferralMembers(false);
    }
  };

  const openReferralPopupByCode = (code: string, fallbackLeaderName?: string | null) => {
    const known = referralGroups.find(g => g.code === code);
    openReferralPopup(known || { code, leaderId: '', leaderName: fallbackLeaderName || 'Unknown', leaderNumber: '', memberCount: 0 });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardMeta();
    fetchLeadsForCurrentView();
    apiService.getCampaignNames().then(setCampaignNames).catch(() => {});
    fetchLeadGroups();
    fetchReferralGroups();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const ws = new WebSocket('wss://nonveracious-conveniently-jacques.ngrok-free.dev/ws');

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_user' && data.user) {
          let freshLead = normalizeLead(data.user);

          if (!freshLead.assignedto && currentUser?.role === 'admin' && autoAssignRef.current) {
            try {
              const res = await apiService.triggerAutoAssign(freshLead._id);
              if (res.success && res.lead) {
                freshLead = normalizeLead(res.lead);
              }
            } catch (e) {
              console.error('Failed to trigger auto-assign for external lead:', e);
            }
          }

          setLeads(prev => {
            const exists = prev.some(l => l._id === freshLead._id);
            if (exists) {
              return prev.map(l => l._id === freshLead._id ? freshLead : l);
            }
            return prev;
          });
        }
      } catch (e) { console.error('WS Error:', e); }
    };
    return () => ws.close();
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    if (!isAuthenticated || currentView !== 'dashboard') return;
    let cancelled = false;

    const loadDashboardAnalytics = async () => {
      try {
        const pageSize = 500;
        let page = 1;
        let total = 0;
        const all: Lead[] = [];
        do {
          const response = await apiService.queryLeads({
            view: 'dashboard',
            page,
            limit: pageSize,
            includeStats: false,
            mode: 'summary',
          });
          if (!response?.success || !Array.isArray(response.leads)) break;
          all.push(...response.leads.map(normalizeLead));
          total = Number(response.total || all.length);
          page += 1;
        } while (all.length < total && page <= 200);

        if (!cancelled) setDashboardAnalyticsLeads(all);
      } catch (error) {
        console.error('Failed to load dashboard analytics:', error);
      }
    };

    loadDashboardAnalytics();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentView]);

  const handleStatusFilterClick = (status: 'hot' | 'warm' | 'cold' | 'no-remarks' | 'responded' | 'qualified') => {
    setFilters(prev => ({
      ...prev,
      statusFilter: prev.statusFilter === status ? null : status
    }));
  };

  const isLeadsTableView =
    currentView === 'dashboard' ||
    currentView === 'leads' ||
    currentView === 'transferred' ||
    currentView === 'not-interested' ||
    currentView === 'reminders';
  const isDailyReportView = currentView === 'daily-report' || currentView === 'weekly-ai-report';
  const isPickMode = isMessagingMode || isGroupMode;

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLeadsForCurrentView();
  }, [isAuthenticated, currentView, searchQuery, filters, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentView, searchQuery, filters]);

  useEffect(() => {
    if (searchTabTimerRef.current) clearTimeout(searchTabTimerRef.current);
    const q = searchQuery.trim();
    if (!q || !currentUser) {
      setSearchTabCounts({});
      return;
    }
    searchTabTimerRef.current = setTimeout(async () => {
      const views = ['dashboard', 'enrolled', 'internship-enrolled', 'not-interested'] as const;
      const results = await Promise.all(
        views.map(view =>
          apiService.queryLeads({ view, searchQuery: q, page: 1, limit: 1, includeStats: false, mode: 'summary' })
            .then(res => ({ view, total: res.success ? (res.total ?? 0) : 0 }))
            .catch(() => ({ view, total: 0 }))
        )
      );
      const counts: Record<string, number> = {};
      results.forEach(({ view, total }) => { counts[view] = total; });
      setSearchTabCounts(counts);
    }, 400);
    return () => { if (searchTabTimerRef.current) clearTimeout(searchTabTimerRef.current); };
  }, [searchQuery, currentUser]);

  const filteredLeads = leads;

  const toggleLeadSelection = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  const selectAllFiltered = async () => {
    let allLeads = leads;
    if (leads.length < leadsTotal) {
      const fetched = await fetchLeadsForCurrentView({ forceLoadAll: true });
      if (fetched) allLeads = fetched;
    }
    setSelectedLeadIds(new Set(allLeads.map(l => l._id)));
  };

  const uncheckAll = () => {
    setSelectedLeadIds(new Set());
  };

  const exitMessagingMode = () => {
    setIsMessagingMode(false);
    uncheckAll();
  };

  useEffect(() => { if (isMessagingMode && isGroupMode) setIsGroupMode(false); }, [isMessagingMode]);
  useEffect(() => {
    if (isGroupMode) { setIsMessagingMode(false); uncheckAll(); }
    else setGroupPickIds(new Set());
  }, [isGroupMode]);
  useEffect(() => { setGroupPickIds(new Set()); }, [currentView]);

  const groupsByLeadId = useMemo(() => {
    const map = new Map<string, LeadGroup[]>();
    for (const g of leadGroups) {
      for (const id of g.memberIds) {
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(g);
      }
    }
    return map;
  }, [leadGroups]);

  const activeGroup = useMemo(
    () => leadGroups.find(g => g._id === openGroupId) ?? null,
    [leadGroups, openGroupId],
  );

  const canManageGroup = (g: LeadGroup | null) =>
    !!g && (currentUser?.role === 'admin' || (!!g.createdBy && g.createdBy === currentUser?.username));

  const toggleGroupPick = (id: string) => {
    setGroupPickIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openGroupPopup = async (group: LeadGroup) => {
    setOpenGroupId(group._id);
    setIsGroupsPanelOpen(false);
    setIsLoadingGroupMembers(true);
    setGroupMembers([]);
    try {
      const members = await apiService.getLeadGroupMembers(group._id);
      setGroupMembers(members);
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setIsLoadingGroupMembers(false);
    }
  };

  const handleCreateGroup = async (name: string, color: string) => {
    try {
      setIsCreatingGroup(true);
      await apiService.createLeadGroup(name, color, Array.from(groupPickIds));
      await fetchLeadGroups();
      setIsCreateGroupOpen(false);
      setIsGroupMode(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAddPickedToGroup = async (groupId: string) => {
    try {
      setLoading(true);
      await apiService.updateLeadGroupMembers(groupId, { add: Array.from(groupPickIds) });
      await fetchLeadGroups();
      setAddToGroupOpen(false);
      setIsGroupMode(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add leads to group');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameGroup = async (name: string) => {
    if (!activeGroup) return;
    try {
      await apiService.updateLeadGroup(activeGroup._id, { name });
      await fetchLeadGroups();
    } catch (err: any) {
      alert(err.message || 'Failed to rename group');
    }
  };

  const handleRecolorGroup = async (color: string) => {
    if (!activeGroup) return;
    try {
      await apiService.updateLeadGroup(activeGroup._id, { color });
      await fetchLeadGroups();
    } catch (err: any) {
      alert(err.message || 'Failed to update group colour');
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroup) return;
    try {
      await apiService.deleteLeadGroup(activeGroup._id);
      setOpenGroupId(null);
      await fetchLeadGroups();
    } catch (err: any) {
      alert(err.message || 'Failed to delete group');
    }
  };

  const handleRemoveGroupMember = async (leadId: string) => {
    if (!activeGroup) return;
    try {
      await apiService.updateLeadGroupMembers(activeGroup._id, { remove: [leadId] });
      setGroupMembers(prev => prev.filter(m => m._id !== leadId));
      await fetchLeadGroups();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleAddGroupMembers = async (leadIds: string[]) => {
    if (!activeGroup) return;
    try {
      await apiService.updateLeadGroupMembers(activeGroup._id, { add: leadIds });
      const [members] = await Promise.all([
        apiService.getLeadGroupMembers(activeGroup._id),
        fetchLeadGroups(),
      ]);
      setGroupMembers(members);
    } catch (err: any) {
      alert(err.message || 'Failed to add member');
    }
  };

  const handleSendMessage = async (message: string, campaignName: string) => {
    try {
      setIsSendingMessage(true);
      const res = await apiService.sendMessageToLeads(Array.from(selectedLeadIds), message, campaignName);
      alert(res.message);
      setIsMessageModalOpen(false);
      exitMessagingMode();
      if (campaignName) {
        apiService.getCampaignNames().then(setCampaignNames).catch(() => {});
      }
    } catch (err) {
      alert('Failed to send messages');
      exitMessagingMode();
    } finally {
      setIsSendingMessage(false);
    }
  };

  const remindersList = useMemo(() => {
    const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null;
    const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`).getTime() : null;
    return reminderLeads
      .filter(l => {
        if (!l.reminder) return false;
        const reminderTime = new Date(parseMongoDate(l.reminder)).getTime();
        if (from !== null && reminderTime < from) return false;
        if (to !== null && reminderTime > to) return false;
        if (filters.assignedUsers?.length && !filters.assignedUsers.includes(l.assignedto || '')) return false;
        return true;
      })
      .sort((a, b) => new Date(parseMongoDate(a.reminder)).getTime() - new Date(parseMongoDate(b.reminder)).getTime());
  }, [reminderLeads, filters.fromDate, filters.toDate, filters.assignedUsers]);

  const internshipEnrolledCount = dashboardCounts?.internshipEnrolledCount ?? 0;
  const enrolledCount = Math.max(0, (dashboardCounts?.enrolledCount ?? 0) - internshipEnrolledCount);
  const notInterestedCount = dashboardCounts?.notInterestedCount ?? 0;

  const categorizedReminders = useMemo(() => {
    if (currentUser?.role !== 'admin') return { 'My Reminders': remindersList };
    const groups: Record<string, Lead[]> = {};
    remindersList.forEach(lead => {
      const staff = lead.assignedto || 'Unassigned';
      if (!groups[staff]) groups[staff] = [];
      groups[staff].push(lead);
    });
    return groups;
  }, [remindersList, currentUser]);

  const stats = useMemo(() => {
    const s = leadStats;
    return {
      total: s?.total ?? leadsTotal ?? 0,
      cold: s?.cold ?? 0,
      warm: s?.warm ?? 0,
      hot: s?.hot ?? 0,
      unassigned: s?.unassigned ?? 0,
      noRemarks: s?.noRemarks ?? 0,
      responded: s?.responded ?? 0,
      qualified: s?.qualified ?? 0,
    };
  }, [leadStats, leadsTotal]);

  const dashboardInsights = useMemo(() => {
    const sourceRecords = dashboardAnalyticsLeads.length ? dashboardAnalyticsLeads : leads;
    const records = sourceRecords.filter(lead => {
      const createdAt = new Date(parseMongoDate(lead.datecreated));
      if (filters.fromDate && createdAt < new Date(`${filters.fromDate}T00:00:00`)) return false;
      if (filters.toDate && createdAt >= new Date(`${filters.toDate}T23:59:59.999`)) return false;
      const selectedCounselors = filters.assignedUsers || [];
      if (selectedCounselors.length && !selectedCounselors.includes(String(lead.assignedto || ''))) return false;
      return true;
    });
    const countBy = (getKey: (lead: Lead) => string) => {
      const counts = new Map<string, number>();
      records.forEach(lead => {
        const raw = getKey(lead).trim();
        const key = raw || 'Unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    };
    const sources = countBy(lead => normalizeLeadSource(String(lead.leadfrom || (lead as any).source || 'Unknown')));
    const courses = countBy(lead => String(lead.course || 'General'));
    const pipeline = countBy(lead => String(lead.pipeline || 'New')).slice(0, 6);
    const palette = ['#35ad58', '#3985f4', '#ff624f', '#aa72e5', '#48b7e7', '#ffb933', '#53cdd1', '#f05ad7'];
    const sourceTotal = sources.reduce((sum, [, value]) => sum + value, 0);
    let offset = 0;
    const segments = sources.map(([name, value], index) => {
      const start = offset;
      offset += sourceTotal ? (value / sourceTotal) * 100 : 0;
      return `${palette[index % palette.length]} ${start}% ${offset}%`;
    });
    return {
      sources,
      courses: courses.slice(0, 5),
      pipeline,
      sourceTotal,
      donut: segments.length ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#e2e8f0 0% 100%)',
      sourceRecords: records.length,
    };
  }, [dashboardAnalyticsLeads, leads, stats, filters.fromDate, filters.toDate, filters.assignedUsers]);

  const handleDistribute = async () => {
    if (!confirm('This will alternatively assign all unassigned leads among your staff. Continue?')) return;
    try {
      setLoading(true);
      const res = await apiService.distributeLeads();
      alert(res.message);
      await fetchDashboardMeta();
      await fetchLeadsForCurrentView({ forceLoadAll: true });
    } catch (err) {
      alert('Distribution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoAssign = async () => {
    const newState = !autoAssignEnabled;
    try {
      setLoading(true);
      const res = await apiService.updateSettings(newState);
      if (res.success) {
        setAutoAssignEnabled(newState);
      } else {
        alert('Failed to update toggle');
      }
    } catch (err) {
      alert('Network error updating setting');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaffInAutoAssign = async (username: string) => {
    const isCurrentlyExcluded = excludedStaffs.includes(username);
    const newExcluded = isCurrentlyExcluded
      ? excludedStaffs.filter(s => s !== username)
      : [...excludedStaffs, username];
    setExcludedStaffs(newExcluded);
    try {
      const res = await apiService.updateAutoAssignStaffs(newExcluded);
      if (!res.success) throw new Error(res.message || 'Failed to update staff preference');
    } catch (err) {
      setExcludedStaffs(excludedStaffs);
      alert('Failed to update staff preference');
    }
  };

  const handleUpdateReminder = async (leadId: string, date: string | null) => {
    try {
      setLoading(true);
      const updated = await apiService.updateLead({ _id: leadId, reminder: date });
      const norm = normalizeLead(updated);
      setLeads(prev => prev.map(l => l._id === leadId ? norm : l));
      setReminderLeads(prev => prev.map(l => l._id === leadId ? norm : l));
      if (selectedLead?._id === leadId) setSelectedLead(norm);
    } catch (err) {
      alert('Failed to update reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = (confirm = true) => {
    if (confirm && !window.confirm('Logout?')) return;
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_view');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLeads([]);
    setLeadsTotal(0);
    setLeadStats(null);
    setDashboardCounts(null);
    setReminderLeads([]);
  };

  const handleExportCrm = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress('Starting...');
    try {
      await exportCrmData(currentView, filters, searchQuery, (msg) => setExportProgress(msg));
    } catch (err) {
      console.error('CRM export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const handleAddLead = async (leadData: Partial<Lead>) => {
    try {
      setLoading(true);
      const payload = {
        ...leadData,
        assignedto: currentUser?.username
      };
      await apiService.addLead(payload);
      setIsAddModalOpen(false);
      await fetchDashboardMeta();
      await fetchLeadsForCurrentView({ forceLoadAll: true });
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteLead = async (id: string) => {
    if (currentUser?.role !== 'admin') return alert('Only admins can delete leads');
    if (!confirm('Delete this lead?')) return;
    try {
      setLoading(true);
      await apiService.deleteLead(id);
      setSelectedLead(null);
      await fetchDashboardMeta();
      await fetchLeadsForCurrentView({ forceLoadAll: true });
    } catch (err) { alert('Delete failed'); }
    finally { setLoading(false); }
  };

  const getDaysRemaining = (dateStr: string) => {
    try {
      const targetDate = new Date(dateStr);
      const now = new Date();
      targetDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return { text: `${Math.abs(diffDays)}d Overdue`, color: 'text-red-600 bg-red-50' };
      if (diffDays === 0) return { text: 'Today', color: 'text-orange-600 bg-orange-50' };
      return { text: `${diffDays}d Left`, color: 'text-blue-600 bg-blue-50' };
    } catch (e) {
      return { text: 'Invalid', color: 'text-slate-400' };
    }
  };

  const formatDate = (date: any) => {
    const d = parseMongoDate(date);
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (date: any) => {
    const d = parseMongoDate(date);
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getLatestRemark = (remarks: Lead['remarks']) => {
    if (!remarks || remarks.length === 0) return null;
    return [...remarks].sort(
      (a, b) => new Date(parseMongoDate(b.timestamp)).getTime() - new Date(parseMongoDate(a.timestamp)).getTime()
    )[0];
  };

  const handleAnalyzeLead = async (leadId: string) => {
    try {
      setLoading(true);
      const result = await apiService.analyzeLead(leadId);
      if (result.success && result.analysis) {
        setLeads(prev => prev.map(l => l._id === leadId ? { ...l, aiAnalysis: result.analysis } : l));
        setSelectedLead(prev => prev && prev._id === leadId ? { ...prev, aiAnalysis: result.analysis } : prev);
      }
    } catch (err) {
      alert('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const openAssistantForLead = (leadId: string) => {
    setAssistantOpenLeadId(leadId);
  };

  const openLeadDetails = async (leadId: string) => {
    try {
      setLoading(true);
      const res = await apiService.fetchLeadById(leadId);
      if (res.success && res.lead) {
        setSelectedLead(normalizeLead(res.lead));
      }
    } catch (err) {
      console.error('Failed to open lead:', err);
      alert('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = useMemo(() => {
    const { statusFilter, fromDate, toDate, courses, programTypes, professions, sources, statuses, pipelines, assignedUsers, branches, campaigns } = filters;
    const arrayFiltersActive =
      courses.length > 0 ||
      programTypes.length > 0 ||
      professions.length > 0 ||
      sources.length > 0 ||
      statuses.length > 0 ||
      pipelines.length > 0 ||
      assignedUsers.length > 0 ||
      campaigns.length > 0;
    return arrayFiltersActive || fromDate !== '' || toDate !== '' || statusFilter !== null;
  }, [filters]);

  const isSearchOrFilterActive = searchQuery.trim().length > 0 || hasActiveFilters;
  const totalPages = isSearchOrFilterActive
    ? 1
    : Math.max(1, Math.ceil(leadsTotal / LEADS_PER_PAGE));
  const paginatedLeads = filteredLeads;

  const isHr = currentUser?.role === 'hr';

  const mobileNavItems: { key: string; label: string; icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement; active: boolean; onClick: () => void }[] = isHr
    ? [
        { key: 'dashboard', label: 'Job Seekers', icon: Icons.Grid, active: currentView === 'dashboard', onClick: () => setCurrentView('dashboard') },
        { key: 'hr-portal', label: 'HR Portal', icon: Icons.Crown, active: currentView === 'hr-portal', onClick: () => setCurrentView('hr-portal') },
      ]
    : [
        { key: 'dashboard', label: 'Dashboard', icon: Icons.Grid, active: currentView === 'dashboard' || currentView === 'transferred', onClick: () => setCurrentView('dashboard') },
        { key: 'leads', label: 'Leads', icon: Icons.User, active: currentView === 'leads', onClick: () => setCurrentView('leads') },
        { key: 'daily-report', label: currentUser?.role === 'admin' ? 'Daily Report' : 'My Report', icon: Icons.CheckCircle, active: currentView === 'daily-report', onClick: () => setCurrentView('daily-report') },
        { key: 'batch-timetable', label: 'Batches', icon: Icons.Calendar, active: currentView === 'batch-timetable', onClick: () => setCurrentView('batch-timetable') },
        { key: 'weekly-ai-report', label: 'AI Report', icon: Icons.Bot, active: currentView === 'weekly-ai-report', onClick: () => setCurrentView('weekly-ai-report') },
      ];

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-[#f7f8fa] dark:bg-[#0b0f19] overflow-hidden text-left relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      {loading && <LoadingSpinner />}
      <DailyReminderGate isAuthenticated={isAuthenticated} />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[9998] md:hidden bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-[50] ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 ${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col h-full md:h-screen md:shrink-0 rounded-none border-r border-slate-200/80 dark:border-slate-800 shadow-sm md:shadow-none transform transition-all duration-300 md:relative md:inset-auto md:m-0 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      
        {/* Brand Header */}
        <div className={`px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center relative group/header ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
              <img
                src="/minmini-png-logo3.png"
                alt="Minmini Logo"
                className="w-full h-full object-cover"
              />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col truncate">
                <h1 className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-white leading-tight truncate">Minmini CRM</h1>
                <span className="text-[11px] text-slate-400 dark:text-slate-400 font-normal tracking-tight truncate mt-0.5">Powered by Bot Kovai</span>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsSidebarCollapsed(prev => !prev)} 
            className={`hidden md:flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all ${
              isSidebarCollapsed 
                ? 'absolute -right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/header:opacity-100 shadow-md bg-white dark:bg-slate-800 z-10' 
                : 'flex-shrink-0'
            }`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? '-rotate-90' : 'rotate-90'}`} />
          </button>

          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <Icons.X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* ── GROUP 1: Dashboard ── */}
          <button 
            onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }} 
            title={isSidebarCollapsed ? 'Dashboard' : undefined}
            className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] relative group ${
              currentView === 'dashboard' 
                ? 'bg-[#f4f3ff] dark:bg-indigo-950/40 text-[#4f46e5] dark:text-indigo-300 font-bold' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            } ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <Icons.LayoutGrid className="w-5 h-5 flex-shrink-0 text-[#6366f1] dark:text-indigo-400" />
            {!isSidebarCollapsed && <span className="truncate">Dashboard</span>}
            {searchQuery.trim() && currentView !== 'dashboard' && (searchTabCounts['dashboard'] ?? 0) > 0 && (
              <span className={`${isSidebarCollapsed ? 'absolute top-2 right-2 w-2.5 h-2.5' : 'ml-auto text-[10px] px-1.5 py-0.5'} bg-amber-500 text-white font-bold rounded-full text-center animate-pulse`}>
                {!isSidebarCollapsed && searchTabCounts['dashboard']}
              </span>
            )}
          </button>

          <div className="my-1.5 border-b border-slate-100 dark:border-slate-800" />

          {/* ── GROUP 2: Pipeline & Operations ── */}
          {/* Leads */}
          {!isHr && (
            <button
              onClick={() => { setCurrentView('leads'); setIsMobileMenuOpen(false); }}
              title={isSidebarCollapsed ? 'Leads' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] relative group ${
                currentView === 'leads' || currentView === 'transferred'
                  ? 'bg-[#eff6ff] dark:bg-blue-950/40 text-[#1d4ed8] dark:text-blue-300 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.User className="w-5 h-5 flex-shrink-0 text-[#2563eb] dark:text-blue-400" />
              {!isSidebarCollapsed && <span className="truncate">Leads</span>}
            </button>
          )}

          {/* Reminder - Commented out
          {!isHr && (
            <button
              onClick={() => { setCurrentView('reminders'); setIsMobileMenuOpen(false); }}
              title={isSidebarCollapsed ? 'Reminder' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] relative group ${
                currentView === 'reminders'
                  ? 'bg-[#fef4e8] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Bell className="w-5 h-5 flex-shrink-0 text-[#d97706] dark:text-amber-400" />
              {!isSidebarCollapsed && <span className="truncate">Reminder</span>}
            </button>
          )}
          */}

          {/* Course Enrolled */}
          {!isHr && (() => { 
            const searchCourseEnrolledCount = Math.max(0, (searchTabCounts['enrolled'] ?? 0) - (searchTabCounts['internship-enrolled'] ?? 0)); 
            return (
              <button 
                onClick={() => { setCurrentView('enrolled'); setIsMobileMenuOpen(false); }} 
                title={isSidebarCollapsed ? 'Course Enrolled' : undefined}
                className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] relative group ${
                  currentView === 'enrolled' 
                    ? 'bg-[#f5f3ff] dark:bg-violet-950/40 text-[#6d28d9] dark:text-violet-300 font-bold' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icons.ShieldCheck className="w-5 h-5 flex-shrink-0 text-[#8b5cf6] dark:text-violet-400" />
                {!isSidebarCollapsed && <span className="truncate">Course Enrolled</span>}
                {searchQuery.trim() && currentView !== 'enrolled' && searchCourseEnrolledCount > 0 ? (
                  <span className={`${isSidebarCollapsed ? 'absolute top-2 right-2 w-2.5 h-2.5' : 'ml-auto text-[10px] px-1.5 py-0.5'} bg-amber-500 text-white font-bold rounded-full text-center animate-pulse`}>
                    {!isSidebarCollapsed && searchCourseEnrolledCount}
                  </span>
                ) : enrolledCount > 0 && !isSidebarCollapsed && (
                  <span className="ml-auto bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {enrolledCount}
                  </span>
                )}
              </button>
            ); 
          })()}

          {/* Batch Timetable */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('batch-timetable'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Batch Timetable' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'batch-timetable' 
                  ? 'bg-[#fef7ee] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Clock className="w-5 h-5 flex-shrink-0 text-[#d97706] dark:text-amber-500" />
              {!isSidebarCollapsed && <span className="truncate">Batch Timetable</span>}
            </button>
          )}

          {/* Internship Enrollment */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('internship-enrolled'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Internship Enrollment' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] relative group ${
                currentView === 'internship-enrolled' 
                  ? 'bg-[#f0fdfa] dark:bg-teal-950/40 text-[#0f766e] dark:text-teal-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Briefcase className="w-5 h-5 flex-shrink-0 text-[#0d9488] dark:text-teal-400" />
              {!isSidebarCollapsed && <span className="truncate">Internship Enrollment</span>}
              {searchQuery.trim() && currentView !== 'internship-enrolled' && (searchTabCounts['internship-enrolled'] ?? 0) > 0 ? (
                <span className={`${isSidebarCollapsed ? 'absolute top-2 right-2 w-2.5 h-2.5' : 'ml-auto text-[10px] px-1.5 py-0.5'} bg-amber-500 text-white font-bold rounded-full text-center animate-pulse`}>
                  {!isSidebarCollapsed && searchTabCounts['internship-enrolled']}
                </span>
              ) : internshipEnrolledCount > 0 && !isSidebarCollapsed && (
                <span className="ml-auto bg-[#0d9488] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {internshipEnrolledCount}
                </span>
              )}
            </button>
          )}

          {/* Fees */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('fees'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Revenue' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'fees' 
                  ? 'bg-[#fefce8] dark:bg-yellow-950/40 text-[#a16207] dark:text-yellow-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.IndianRupee className="w-5 h-5 flex-shrink-0 text-[#ca8a04] dark:text-yellow-500" />
              {!isSidebarCollapsed && <span className="truncate">Revenue</span>}
            </button>
          )}

          <div className="my-1.5 border-b border-slate-100 dark:border-slate-800" />

          {/* ── GROUP 3: Reports & Notes ── */}
          {/* Notes & Sheet */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('notes'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Notes & Sheet' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'notes' 
                  ? 'bg-[#fff1f2] dark:bg-rose-950/40 text-[#be123c] dark:text-rose-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.ShoppingBag className="w-5 h-5 flex-shrink-0 text-[#f43f5e] dark:text-rose-400" />
              {!isSidebarCollapsed && <span className="truncate">Notes & Sheet</span>}
            </button>
          )}

          {/* Daily Report */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('daily-report'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Daily Report' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'daily-report' 
                  ? 'bg-[#f0f9ff] dark:bg-sky-950/40 text-[#0369a1] dark:text-sky-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.DailyReportIcon className="w-5 h-5 flex-shrink-0 text-[#0284c7] dark:text-sky-400" />
              {!isSidebarCollapsed && <span className="truncate">Daily Report</span>}
            </button>
          )}

          {/* AI Report */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('weekly-ai-report'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'AI Report' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'weekly-ai-report' 
                  ? 'bg-[#faf5ff] dark:bg-purple-950/40 text-[#7e22ce] dark:text-purple-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Sparkles className="w-5 h-5 flex-shrink-0 text-[#a855f7] dark:text-purple-400" />
              {!isSidebarCollapsed && <span className="truncate">AI Report</span>}
            </button>
          )}

          {/* Sales Training */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('sales-training'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Sales Training' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'sales-training' 
                  ? 'bg-[#fef2f2] dark:bg-red-950/40 text-[#b91c1c] dark:text-red-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Presentation className="w-5 h-5 flex-shrink-0 text-[#f87171] dark:text-red-400" />
              {!isSidebarCollapsed && <span className="truncate">Sales Training</span>}
            </button>
          )}

          <div className="my-1.5 border-b border-slate-100 dark:border-slate-800" />

          {/* ── GROUP 4: Administration & Analytics ── */}
          {/* Employees */}
          {(currentUser?.role === 'admin' || isHr) && (
            <button 
              onClick={() => { setCurrentView('hr-portal'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Employees' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'hr-portal' 
                  ? 'bg-[#fff7ed] dark:bg-orange-950/40 text-[#c2410c] dark:text-orange-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.CalendarCheck className="w-5 h-5 flex-shrink-0 text-[#f97316] dark:text-orange-400" />
              {!isSidebarCollapsed && <span className="truncate">Employees</span>}
            </button>
          )}

          {/* User Management */}
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentView('user-management'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'User Management' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'user-management' 
                  ? 'bg-[#eef2ff] dark:bg-indigo-950/40 text-[#4338ca] dark:text-indigo-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.UserCog className="w-5 h-5 flex-shrink-0 text-[#4f46e5] dark:text-indigo-400" />
              {!isSidebarCollapsed && <span className="truncate">User Management</span>}
            </button>
          )}

          {/* Google Analytics 4 tab (Commented out)
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentView('google-analytics'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Google Analytics' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'google-analytics' 
                  ? 'bg-[#fffbeb] dark:bg-amber-950/40 text-[#b45309] dark:text-amber-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.GoogleAnalytics className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Google Analytics</span>}
            </button>
          )} */}

          {/* HR Portal */}
          {(currentUser?.role === 'admin' || isHr) && (
            <button 
              onClick={() => { setCurrentView('hr-portal'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'HR Portal' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'hr-portal' 
                  ? 'bg-[#fdf2f8] dark:bg-pink-950/40 text-[#be185d] dark:text-pink-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.IdBadge className="w-5 h-5 flex-shrink-0 text-[#ec4899] dark:text-pink-400" />
              {!isSidebarCollapsed && <span className="truncate">HR Portal</span>}
            </button>
          )}

          {/* Job Enquiry */}
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentView('job-enquiry'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Job Enquiry' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'job-enquiry' 
                  ? 'bg-[#ecfeff] dark:bg-cyan-950/40 text-[#0e7490] dark:text-cyan-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.UserSearch className="w-5 h-5 flex-shrink-0 text-[#06b6d4] dark:text-cyan-400" />
              {!isSidebarCollapsed && <span className="truncate">Job Enquiry</span>}
            </button>
          )}

          <div className="my-1.5 border-b border-slate-100 dark:border-slate-800" />

          {/* ── GROUP 5: Communication & Updates ── */}
          {/* Review Meeting */}
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentView('review-meeting'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Review Meeting' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'review-meeting' 
                  ? 'bg-[#fdf2f8] dark:bg-pink-950/40 text-[#9d174d] dark:text-pink-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.CalendarSearch className="w-5 h-5 flex-shrink-0 text-[#be185d] dark:text-pink-400" />
              {!isSidebarCollapsed && <span className="truncate">Review Meeting</span>}
            </button>
          )}

          {/* Team Chat */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('group-chat'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Team Chat' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'group-chat' 
                  ? 'bg-[#eff6ff] dark:bg-blue-950/40 text-[#1d4ed8] dark:text-blue-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Chat className="w-5 h-5 flex-shrink-0 text-[#2563eb] dark:text-blue-400" />
              {!isSidebarCollapsed && <span className="truncate">Team Chat</span>}
            </button>
          )}

          {/* Bulk WhatsApp */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('bulk-msg'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Bulk WhatsApp' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'bulk-msg' 
                  ? 'bg-[#f0fdf4] dark:bg-green-950/40 text-[#15803d] dark:text-green-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.WhatsApp className="w-5 h-5 flex-shrink-0 text-[#25D366] dark:text-green-400" />
              {!isSidebarCollapsed && <span className="truncate">Bulk WhatsApp</span>}
            </button>
          )}

          {/* WhatsApp Manager */}
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentView('whatsapp-manager'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'WhatsApp Manager' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'whatsapp-manager' 
                  ? 'bg-[#ecfdf5] dark:bg-emerald-950/40 text-[#047857] dark:text-emerald-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.WhatsApp className="w-5 h-5 flex-shrink-0 text-[#25D366]" />
              {!isSidebarCollapsed && <span className="truncate">WhatsApp Manager</span>}
            </button>
          )}

          {/* Meta Ads Manager */}
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentView('ctwa-ads'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? 'Meta Ads Manager' : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] ${
                currentView === 'ctwa-ads' 
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Target className="w-5 h-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              {!isSidebarCollapsed && <span className="truncate">Meta Ads Manager</span>}
            </button>
          )}

          {/* What's New */}
          {!isHr && (
            <button 
              onClick={() => { setCurrentView('release-notes'); setIsMobileMenuOpen(false); }} 
              title={isSidebarCollapsed ? "What's New" : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2 rounded-xl transition-all font-medium text-[13.5px] relative group ${
                currentView === 'release-notes' 
                  ? 'bg-[#fdf4ff] dark:bg-fuchsia-950/40 text-[#a21caf] dark:text-fuchsia-300 font-bold' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icons.Star className="w-5 h-5 flex-shrink-0 text-[#c026d3] dark:text-fuchsia-400" />
              {!isSidebarCollapsed && <span className="truncate">What's New</span>}
              {hasActiveReleaseNotes() && (
                <span className={`${isSidebarCollapsed ? 'absolute top-2 right-2 w-2 h-2' : 'ml-auto w-2 h-2'} rounded-full bg-purple-500 animate-pulse`} />
              )}
            </button>
          )}

          <div className="my-1.5 border-b border-slate-100 dark:border-slate-800" />
        </nav>
      </aside>

            {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed z-[9996] left-1/2 -translate-x-1/2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-full shadow-2xl px-1.5 py-1.5 max-w-[calc(100%-1.5rem)]">
        {mobileNavItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              aria-label={item.label}
              title={item.label}
              className={`flex items-center justify-center rounded-full transition-all shrink-0 ${
                item.active 
                  ? 'gap-2 px-4 py-3 bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                  : 'p-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.active && <span className="text-xs font-bold whitespace-nowrap">{item.label}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          aria-label="More"
          title="More"
          className={`flex items-center justify-center rounded-full transition-all shrink-0 ${
            isMobileMenuOpen 
              ? 'gap-2 px-4 py-3 bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
              : 'p-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Icons.MoreHorizontal className="w-5 h-5 shrink-0" />
          {isMobileMenuOpen && <span className="text-xs font-bold whitespace-nowrap">More</span>}
        </button>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0 pr-4 sm:pr-6 pl-0 sm:pl-2">
        <header className="relative h-20 bg-transparent flex items-center justify-between px-3 sm:px-4 shrink-0 z-40">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex flex-col justify-center min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate leading-tight">
                Vanakkam 🙏 {currentUser?.username || 'User'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {!isDailyReportView && currentView !== 'notes' && currentView !== 'user-management' && currentView !== 'hr-portal' && currentView !== 'job-enquiry' && currentView !== 'review-meeting' && currentView !== 'sales-training' && currentView !== 'group-chat' && currentView !== 'bulk-msg' && currentView !== 'whatsapp-manager' && currentView !== 'ctwa-ads' && (
              <div className="relative max-w-xs w-full hidden md:block ml-2">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className={`w-full pl-9 ${searchQuery ? 'pr-8' : 'pr-3'} py-2 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm ${/^\+?[\d\s-]+$/.test(searchQuery.trim()) && searchQuery.replace(/\D/g, '').length >= 3 ? 'bg-amber-50 border-amber-400 font-semibold text-amber-900' : ''}`} 
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Clear search">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2">
              {currentUser?.role === 'admin' && stats.unassigned > 0 && (
                <button onClick={handleDistribute} disabled={loading} className="flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-200 px-3.5 py-2 rounded-2xl font-bold text-xs hover:bg-orange-100 transition-all disabled:opacity-50 shadow-sm">
                  <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  <span>Bulk Assign ({stats.unassigned})</span>
                </button>
              )}
              {!isHr && (
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-2xl font-bold text-xs hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  <span>Add Lead</span>
                </button>
              )}

              {['leads', 'transferred', 'reminders', 'not-interested'].includes(currentView) && (
                isLeadsTableView && (
                  <button onClick={() => setIsFilterOpen(true)} title="Filter leads" className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition-all ${hasActiveFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    <Icons.Filter className="w-4 h-4" /><span>Filter</span>{hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </button>
                )
              )}
              {currentUser?.role === 'admin' && isLeadsTableView && (
                <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Auto-Assign</span>
                  <button type="button" aria-label="Toggle auto assign" onClick={handleToggleAutoAssign} disabled={loading} className={`relative w-9 h-5 rounded-full transition-colors ${autoAssignEnabled ? 'bg-blue-600' : 'bg-slate-300'} ${loading ? 'opacity-50' : ''}`}><span className={`absolute top-0.5 ${autoAssignEnabled ? 'left-[18px]' : 'left-0.5'} h-4 w-4 rounded-full bg-white transition-all`} /></button>
                  <span className={`text-[9px] font-bold ${autoAssignEnabled ? 'text-green-600' : 'text-slate-400'}`}>{autoAssignEnabled ? 'On' : 'Off'}</span>
                  <button onClick={() => setIsAutoAssignConfigOpen(v => !v)} title="Configure auto-assign" className="p-1 text-slate-500 hover:bg-slate-100 rounded"><Icons.Settings className="w-3.5 h-3.5" /></button>
                  {isAutoAssignConfigOpen && (
                    <div className="absolute right-4 top-16 z-50 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl space-y-1">
                      <p className="px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400">Staff in Auto-Assign</p>
                      {autoAssignStaffs.map(username => {
                        const included = !excludedStaffs.includes(username);
                        return (
                          <button
                            key={username}
                            onClick={() => handleToggleStaffInAutoAssign(username)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                          >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                              included
                                ? 'bg-blue-600 border-blue-600 shadow-2xs'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {included && (
                                <svg className="w-2.5 h-2.5 text-white stroke-[3.5] stroke-current fill-none" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                            <span className={`font-semibold ${included ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                              {username}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setIsDark((d: boolean) => !d)} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all">
              {isDark ? (
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              ) : (
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              )}
            </button>

            <div className="relative">
              <button 
                onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span aria-hidden="true">{currentUser?.username?.charAt(0).toUpperCase() || 'U'}</span>
              </button>

              {isProfileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[9997] bg-transparent" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div className="fixed right-6 top-20 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9998] p-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                      <p className="font-semibold text-slate-800 text-sm truncate">{currentUser?.username}</p>
                      <p className="text-slate-400 text-xs capitalize">{currentUser?.role}</p>
                    </div>

                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => { setIsProfileDropdownOpen(false); handleExportCrm(); }}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:text-white hover:bg-green-600 transition-all text-xs font-bold mb-1 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isExporting ? (
                          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        ) : (
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        )}
                        <span className="truncate">{isExporting ? exportProgress : 'Export CRM'}</span>
                      </button>
                    )}

                    <button 
                      onClick={() => { setIsProfileDropdownOpen(false); handleLogout(); }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:text-white hover:bg-red-600 transition-all text-xs font-bold"
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {!isDailyReportView && currentView !== 'user-management' && currentView !== 'hr-portal' && currentView !== 'job-enquiry' && currentView !== 'review-meeting' && currentView !== 'sales-training' && currentView !== 'group-chat' && currentView !== 'bulk-msg' && currentView !== 'whatsapp-manager' && currentView !== 'ctwa-ads' && (
              <button onClick={() => setIsMobileActionsOpen(!isMobileActionsOpen)} className="md:hidden p-2.5 hover:bg-slate-100 rounded-2xl relative flex-shrink-0 bg-white border border-slate-200 shadow-sm">
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                {(hasActiveFilters || selectedLeadIds.size > 0 || isMessagingMode || isGroupMode || groupPickIds.size > 0) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                )}
              </button>
            )}
          </div>
        </header>

        {!isHr && ['dashboard', 'leads', 'transferred', 'reminders', 'not-interested'].includes(currentView) && (
          <div className={`shrink-0 px-4 sm:px-6 pb-4 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 ${selectedLead ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex items-center gap-2 overflow-visible max-w-full">
              <div className="inline-flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-sm shrink-0">
                <button
                  onClick={() => setCurrentView('leads')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${currentView === 'leads' ? 'bg-sky-50 text-sky-700 border border-sky-200 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                >
                  <Icons.User className="w-4 h-4 shrink-0" />
                  <span>Leads</span>
                </button>

                <button
                  onClick={() => setCurrentView('transferred')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${currentView === 'transferred' ? 'bg-sky-50 text-sky-700 border border-sky-200 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                >
                  <Icons.GraduationCap className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Transferred Leads</span>
                </button>

                {!isHr && (
                  <button
                    onClick={() => setCurrentView('reminders')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all relative ${currentView === 'reminders' ? 'bg-amber-50 text-amber-700 border border-amber-200 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                  >
                    <Icons.Calendar className="w-4 h-4 shrink-0" />
                    <span>Reminder</span>
                    {(dashboardCounts?.remindersCount ?? remindersList.length) > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[9px] font-bold">
                        {dashboardCounts?.remindersCount ?? remindersList.length}
                      </span>
                    )}
                  </button>
                )}

                {!isHr && (
                  <button
                    onClick={() => setCurrentView('not-interested')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all relative ${currentView === 'not-interested' ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                  >
                    <Icons.Ban className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Not Interested</span>
                  </button>
                )}
              </div>

              <div className="relative shrink-0 group/dotguide">
                <button
                  type="button"
                  aria-label="Dot Color Guide"
                  title="Dot Color Guide"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icons.Info className="h-4 w-4" />
                </button>

                <div className="absolute left-0 top-full z-[9999] mt-2 hidden w-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl group-hover/dotguide:block">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Dot Color Guide
                  </p>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span><strong className="text-slate-800 dark:text-white">Red</strong> — Demo Booked</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                      <span><strong className="text-slate-800 dark:text-white">Green</strong> — Responded after follow-up</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                      <span><strong className="text-slate-800 dark:text-white">Purple</strong> — Replied to a campaign</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-amber-500" />
                      <span><strong className="text-slate-800 dark:text-white">Amber</strong> — Referral lead</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                      <span><strong className="text-slate-800 dark:text-white">Cyan</strong> — Auto-transferred</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {['leads', 'transferred', 'reminders', 'not-interested'].includes(currentView) && (
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <button
                  onClick={() => {
                    setIsMessagingMode(false);
                    setSelectedLeadIds(new Set());
                    setIsGroupMode(false);
                    setGroupPickIds(new Set());
                    setIsGroupsPanelOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    isGroupsPanelOpen
                      ? 'bg-violet-50 text-violet-700 border-violet-200'
                      : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
                  }`}
                >
                  <Icons.User className="w-4 h-4" />
                  <span>Group</span>
                </button>

                <button
                  onClick={() => {
                    setIsMessagingMode(true);
                    setIsGroupMode(false);
                    setSelectedLeadIds(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    isMessagingMode
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <Icons.Send className="w-4 h-4" />
                  <span>Message Mode</span>
                </button>
              </div>
            )}

            {currentView === 'dashboard' && (
              <div className="flex items-center gap-2.5 shrink-0 relative z-30">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFromDate(filters.fromDate || "");
                      setDraftToDate(filters.toDate || "");
                      setIsDateRangeOpen(prev => !prev);
                      setIsCounselorOpen(false);
                    }}
                    className="h-11 min-w-[170px] flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icons.Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate font-medium">{selectedDateRange}</span>
                    </span>
                    <Icons.ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>

                  {isDateRangeOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[998] bg-transparent cursor-default"
                        onClick={() => setIsDateRangeOpen(false)}
                      />

                      <div className="absolute right-0 top-full mt-2 z-[999] flex w-[440px] gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-slate-800 dark:text-slate-100 shadow-2xl">
                        <div className="w-40 shrink-0 space-y-1 overflow-y-auto border-r border-slate-100 pr-3 max-h-[320px] custom-scrollbar">
                          {[
                            "All Time",
                            "Today",
                            "Yesterday",
                            "This Week (Sun-Today)",
                            "Last Week (Sun - Sat)",
                            "This Month",
                            "Last Month",
                            "Last 28 Days",
                            "Last 30 Days",
                            "Last 90 Days",
                            "Quarter to Date",
                            "This Year (Jan - Today)",
                          ].map((range) => (
                            <button
                              key={range}
                              type="button"
                              onClick={() => {
                                applyDateRange(range);
                              }}
                              className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                                selectedDateRange === range
                                  ? "bg-blue-50 font-bold text-blue-700"
                                  : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {range}
                            </button>
                          ))}
                        </div>

                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="mb-3 text-sm font-bold">Select date range</p>

                            <label className="mb-1 block text-xs text-slate-500">Start Date</label>
                            <input
                              type="date"
                              value={draftFromDate}
                              onChange={(e) => {
                                setDraftFromDate(e.target.value);
                                setSelectedDateRange("Custom");
                              }}
                              className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                            />

                            <label className="mb-1 block text-xs text-slate-500">End Date</label>
                            <input
                              type="date"
                              min={draftFromDate || undefined}
                              value={draftToDate}
                              onChange={(e) => {
                                setDraftToDate(e.target.value);
                                setSelectedDateRange("Custom");
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                            />

                            <div className="mt-3">
                              <span className="text-[11px] font-bold text-slate-400 block mb-1">October 2026</span>
                              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                  <span key={d} className="font-bold text-slate-400 py-0.5">{d}</span>
                                ))}
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                  const dayStr = `2026-10-${String(day).padStart(2, '0')}`;
                                  const isSelected = draftFromDate === dayStr || draftToDate === dayStr;
                                  return (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => {
                                        if (!draftFromDate || (draftFromDate && draftToDate)) {
                                          setDraftFromDate(dayStr);
                                          setDraftToDate('');
                                        } else {
                                          setDraftToDate(dayStr);
                                        }
                                        setSelectedDateRange('Custom');
                                      }}
                                      className={`py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        isSelected ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              onClick={() => setIsDateRangeOpen(false)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              disabled={
                                (!!draftFromDate && !draftToDate) ||
                                (!!draftToDate && !draftFromDate) ||
                                (!!draftFromDate && !!draftToDate && draftFromDate > draftToDate)
                              }
                              onClick={() => {
                                setFilters((prev) => ({
                                  ...prev,
                                  fromDate: draftFromDate,
                                  toDate: draftToDate,
                                }));

                                setIsDateRangeOpen(false);

                                void fetchLeadsForCurrentView({
                                  forceLoadAll: true,
                                });
                              }}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-blue-600/20"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCounselorOpen((prev) => !prev);
                      setIsDateRangeOpen(false);
                    }}
                    className="h-11 min-w-[150px] flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icons.User className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate font-medium">
                        {filters.assignedUsers?.[0] || "All Counselor"}
                      </span>
                    </span>
                    <Icons.ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>

                  {isCounselorOpen && (
                    <div className="absolute right-0 top-full mt-2 z-[99999] max-h-64 w-52 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          applyCounselor("");
                          setIsCounselorOpen(false);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50"
                      >
                        All Counselor
                      </button>

                      {users.map((user) => (
                        <button
                          key={user.username}
                          type="button"
                          onClick={() => {
                            applyCounselor(user.username);
                            setIsCounselorOpen(false);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50"
                        >
                          {user.username}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isMobileActionsOpen && !isDailyReportView && (
          <div className="absolute right-4 top-16 z-[50] md:hidden animate-in slide-in-from-top-2 duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-2 min-w-[200px]">
              {isMessagingMode ? (
                <>
                  <div className="p-3 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Messaging Mode ({selectedLeadIds.size})</p>
                  </div>
                  <button onClick={selectAllFiltered} className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"><Icons.Check className="w-4 h-4" /> <span className="text-sm font-semibold">Select All Filtered</span></button>
                  <button onClick={uncheckAll} className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"><Icons.X className="w-4 h-4" /> <span className="text-sm font-semibold">Uncheck All</span></button>
                  {selectedLeadIds.size > 0 && (
                    <button onClick={() => { setIsMessageModalOpen(true); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left bg-indigo-600 text-white rounded-lg transition-colors mt-1"><Icons.Send className="w-4 h-4" /> <span className="text-sm font-bold">Send Message Now</span></button>
                  )}
                  <button onClick={exitMessagingMode} className="flex items-center gap-3 w-full p-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"><Icons.X className="w-4 h-4" /> <span className="text-sm font-bold">Exit Mode</span></button>
                </>
              ) : isGroupMode ? (
                <>
                  <div className="p-3 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Group Mode ({groupPickIds.size})</p>
                  </div>
                  <button onClick={() => setGroupPickIds(new Set())} className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"><Icons.X className="w-4 h-4" /> <span className="text-sm font-semibold">Clear Selection</span></button>
                  {groupPickIds.size > 0 && (
                    <button onClick={() => { setIsCreateGroupOpen(true); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left bg-violet-600 text-white rounded-lg transition-colors mt-1"><Icons.Plus className="w-4 h-4" /> <span className="text-sm font-bold">Create Group</span></button>
                  )}
                  <button onClick={() => { setIsGroupMode(false); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"><Icons.X className="w-4 h-4" /> <span className="text-sm font-bold">Exit Mode</span></button>
                </>
              ) : (
                <>
                  <button onClick={() => { setIsMessagingMode(true); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left bg-indigo-50 text-indigo-700 rounded-lg transition-colors mb-1"><Icons.Send className="w-4 h-4" /> <span className="text-sm font-bold">Messaging Mode</span></button>
                  {isLeadsTableView && (
                    <button onClick={() => { setIsGroupsPanelOpen(true); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left bg-violet-50 text-violet-700 rounded-lg transition-colors mb-1"><Icons.User className="w-4 h-4" /> <span className="text-sm font-bold">Groups{leadGroups.length > 0 ? ` (${leadGroups.length})` : ''}</span></button>
                  )}
                  {currentView === 'dashboard' && referralGroups.length > 0 && (
                    <button onClick={() => { setIsReferralPanelOpen(true); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left bg-amber-50 text-amber-700 rounded-lg transition-colors mb-1"><Icons.User className="w-4 h-4" /> <span className="text-sm font-bold">Referrals ({referralGroups.length})</span></button>
                  )}
                  <button onClick={() => { setIsFilterOpen(true); setIsMobileActionsOpen(false); }} className={`flex items-center gap-3 w-full p-3 text-left rounded-lg transition-colors ${hasActiveFilters ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}><Icons.Filter className="w-4 h-4" /> <span className="text-sm font-semibold">Filters {hasActiveFilters ? '(Active)' : ''}</span></button>
                  <button onClick={() => { setIsAddModalOpen(true); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"><Icons.Plus className="w-4 h-4 text-green-600" /> <span className="text-sm font-semibold">Add New Lead</span></button>
                  {currentUser?.role === 'admin' && (
                    <button onClick={() => { handleDistribute(); setIsMobileActionsOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"><Icons.RefreshCcw className="w-4 h-4 text-orange-600" /> <span className="text-sm font-semibold">Bulk Assign</span></button>
                  )}
                  {currentUser?.role === 'admin' && (
                    <>
                      <div className="flex items-center justify-between w-full p-3 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-700">Auto-Assign</span>
                          <span className={`text-[10px] font-bold ${autoAssignEnabled ? 'text-green-600' : 'text-slate-400'}`}>{autoAssignEnabled ? 'ON' : 'OFF'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleToggleAutoAssign} disabled={loading} className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${autoAssignEnabled ? 'bg-blue-600' : 'bg-slate-300'} ${loading ? 'opacity-50' : ''}`}><div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 transform ${autoAssignEnabled ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                          <button
                            onClick={() => setIsAutoAssignConfigOpen(o => !o)}
                            title="Configure auto-assign staffs"
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Icons.Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {isAutoAssignConfigOpen && (
                        <div className="mx-1 mb-1 bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Staff in Auto-Assign</p>
                          {autoAssignStaffs.length === 0 ? (
                            <p className="text-xs text-slate-400 py-1">No staff found</p>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {autoAssignStaffs.map(username => {
                                const included = !excludedStaffs.includes(username);
                                return (
                                  <button
                                    key={username}
                                    onClick={() => handleToggleStaffInAutoAssign(username)}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white text-left transition-colors"
                                  >
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${included ? 'bg-blue-600 border-blue-600 shadow-2xs' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                      {included && (
                                        <svg className="w-2.5 h-2.5 text-white stroke-[3.5] stroke-current fill-none" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`text-xs font-semibold ${included ? 'text-slate-700' : 'text-slate-400'}`}>{username}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {isLeadsTableView ? ( 
          <> 
            {currentView !== 'reminders' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 px-4 sm:px-6 pb-4">
                {[
                  {
                    title: 'Total Leads',
                    count: stats.total,
                    icon: <Icons.User className="w-5 h-5 text-blue-600" />,
                    bgIcon: isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600',
                    key: 'total'
                  },
                  {
                    title: 'Hot',
                    count: stats.hot,
                    icon: <Icons.Flame className="w-5 h-5 text-red-500" />,
                    bgIcon: isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600',
                    key: 'hot'
                  },
                  {
                    title: 'Warm',
                    count: stats.warm,
                    icon: <Icons.Sun className="w-5 h-5 text-amber-500" />,
                    bgIcon: isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600',
                    key: 'warm'
                  },
                  {
                    title: 'Cold',
                    count: stats.cold,
                    icon: <Icons.Snowflake className="w-5 h-5 text-sky-500" />,
                    bgIcon: isDark ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600',
                    key: 'cold'
                  },
                  {
                    title: 'Remark',
                    count: stats.noRemarks,
                    icon: <Icons.Ban className="w-5 h-5 text-slate-500" />,
                    bgIcon: isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600',
                    key: 'no-remarks'
                  },
                  {
                    title: 'Responded',
                    count: stats.responded,
                    icon: <Icons.Target className="w-5 h-5 text-purple-600" />,
                    bgIcon: isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600',
                    key: 'responded'
                  },
                  {
                    title: 'Qualified Leads',
                    count: stats.qualified,
                    icon: <Icons.ShieldCheck className="w-5 h-5 text-emerald-600" />,
                    bgIcon: isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
                    key: 'qualified'
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    onClick={currentView === 'dashboard' ? undefined : () => {
                      setCurrentView('leads');
                      if (stat.key !== 'total') {
                        handleStatusFilterClick(stat.key as any);
                      } else {
                        handleStatusFilterClick('all' as any);
                      }
                    }}
                    className={`rounded-2xl p-4 border flex flex-col justify-between shadow-[0_6px_18px_rgba(15,23,42,0.04)] min-h-[110px] ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200/80 text-slate-900'
                    } ${currentView !== 'dashboard' ? 'transition-all hover:shadow-md cursor-pointer' : ''} ${filters.statusFilter === stat.key && currentView !== 'dashboard' ? 'ring-2 ring-blue-500 scale-[1.02]' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.bgIcon}`}>
                        {stat.icon}
                      </div>
                    </div>
                    <div className="mb-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight">{stat.count}</span>
                        <span className="text-[11px] font-medium text-slate-400">Students</span>
                      </div>
                      <p className={`text-xs font-semibold mt-0.5 truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {stat.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentView === 'reminders' ? (
              <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-2 sm:p-6">
                <div className="mb-5 space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                    {[
                      {label:'Total Reminders', value:remindersList.length, icon:<Icons.Calendar className="w-6 h-6"/>, style:'bg-blue-100 text-blue-600'},
                      {label:'Overdue', value:remindersList.filter(l=>getDaysRemaining(parseMongoDate(l.reminder)).text.toLowerCase().includes('overdue')).length, icon:<Icons.Phone className="w-6 h-6"/>, style:'bg-red-100 text-red-600'},
                      {label:'Today', value:remindersList.filter(l=>new Date(parseMongoDate(l.reminder)).toDateString()===new Date().toDateString()).length, icon:<Icons.Calendar className="w-6 h-6"/>, style:'bg-amber-100 text-amber-600'},
                      {label:'Upcoming', value:remindersList.filter(l=>new Date(parseMongoDate(l.reminder))>new Date() && new Date(parseMongoDate(l.reminder)).toDateString()!==new Date().toDateString()).length, icon:<Icons.RefreshCcw className="w-6 h-6"/>, style:'bg-green-100 text-green-600'}
                    ].map(item=><div key={item.label} className="flex items-center gap-3 px-2 py-2 border-r last:border-r-0 border-slate-200"><div className={`rounded-full p-2 ${item.style}`}>{item.icon}</div><div><p className="text-xs text-slate-500">{item.label}</p><p className="text-lg font-bold text-slate-900">{item.value}</p></div></div>)}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Follow-up Dashboard</h3>
                    <p className="text-sm text-slate-500">Reminders categorized by assigned staff member.</p>
                  </div>
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg self-start sm:self-auto">
                    {remindersList.length} Reminders
                  </div>
                </div>

                {remindersList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 sm:py-32 text-slate-400">
                    <Icons.Calendar className="w-16 h-16 sm:w-20 sm:h-20 opacity-10 mb-6" />
                    <p className="text-lg sm:text-xl font-bold">No active reminders</p>
                    <p className="text-sm opacity-60">Follow-ups set by staff will appear here.</p>
                  </div>
                ) : (
                  <div className={`pb-10 ${selectedLead ? 'flex flex-col lg:flex-row gap-4 lg:gap-6 items-start' : ''}`}>
                    <div className={`space-y-8 sm:space-y-12 min-w-0 ${selectedLead ? 'w-full lg:flex-1' : 'w-full'}`}>
                      {(Object.entries(categorizedReminders) as [string, Lead[]][]).map(([staff, staffLeads]) => (
                        <div key={staff} className="space-y-4">
                          <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase">{staff.charAt(0)}</div>
                            <h4 className="text-base sm:text-lg font-bold text-slate-800 uppercase tracking-tight truncate">{staff}</h4>
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px] font-bold">{staffLeads.length}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {staffLeads.map(lead => {
                              const diff = getDaysRemaining(parseMongoDate(lead.reminder));
                              return (
                                <div key={lead._id} onClick={() => { openLeadDetails(lead._id); }} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col group cursor-pointer overflow-hidden">
                                  <div className="p-4 sm:p-5 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{lead.userName.charAt(0)}</div>
                                        <div className="overflow-hidden">
                                          <h4 className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors text-sm sm:text-base">{lead.userName}</h4>
                                          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                                            <span>{lead.userNumber}</span>
                                            <span
                                              role="button"
                                              title="Open in WhatsApp"
                                              onClick={(e) => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                                              className="text-green-500 hover:text-green-600 cursor-pointer"
                                            >
                                              <Icons.WhatsApp className="w-4 h-4" />
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight ${diff.color}`}>{diff.text}</span>
                                    </div>
                                    <div className="space-y-3 text-left">
                                      <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Icons.Calendar className="w-4 h-4 text-slate-400" />
                                        <span className="font-bold">{new Date(parseMongoDate(lead.reminder)).toLocaleDateString()}</span>
                                        <span className="text-slate-400 hidden sm:inline">at</span>
                                        <span className="font-bold hidden sm:inline">{new Date(parseMongoDate(lead.reminder)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Icons.Settings className="w-4 h-4 text-slate-400" />
                                        <span className="truncate font-semibold text-slate-700">{lead.course || 'General Enquiry'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-3 sm:p-4 border-t bg-slate-50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 group-hover:text-blue-700 flex items-center gap-1">Open History <Icons.Plus className="w-3 h-3 rotate-45" /></span>
                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                      <button onClick={() => { const currentVal = lead.reminder ? new Date(parseMongoDate(lead.reminder)).toISOString().slice(0, 16) : ''; const newDate = prompt('Update Follow-up Date (YYYY-MM-DDTHH:MM)', currentVal); if (newDate) handleUpdateReminder(lead._id, newDate); }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200"><Icons.Edit className="w-4 h-4" /></button>
                                      <button onClick={() => { if (confirm('Clear this reminder?')) handleUpdateReminder(lead._id, null); }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100"><Icons.Trash className="w-4 h-4" /></button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedLead && (
                      <div className="w-full lg:w-[460px] xl:w-[480px] lg:shrink-0 lg:sticky lg:top-0">
                        <LeadDetails
                          lead={selectedLead}
                          users={users}
                          currentUserRole={currentUser?.role}
                          onUpdate={(l) => {
                            const norm = normalizeLead(l);
                            setLeads(prev => prev.map(p => p._id === norm._id ? norm : p));
                            setReminderLeads(prev => prev.map(p => p._id === norm._id ? norm : p));
                            setSelectedLead(norm);
                          }}
                          onDelete={handleDeleteLead}
                          onEdit={(l) => { setEditingLead(l); setIsEditModalOpen(true); }}
                          onClose={() => setSelectedLead(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : currentView === 'dashboard' ? (  
              <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-6 pb-3 sm:pb-6 grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 content-start">
                <section className={`min-w-0 rounded-2xl border shadow-sm p-4 sm:p-5 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`} >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`} ><span className="text-blue-500">♧</span> Lead Source</h2>
                    <span className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`} >{dashboardInsights.sourceTotal} leads</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,0.9fr)_minmax(0,1.1fr)] gap-4 items-center">
                    <div className="flex justify-center">
                      <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full" style={{ background: dashboardInsights.donut }}>
                        <div className={`absolute inset-[24%] rounded-full border flex flex-col items-center justify-center shadow-inner ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} >
                          <strong className={`text-xl sm:text-2xl ${isDark ? 'text-slate-100' : 'text-slate-900'}`} >{dashboardInsights.sourceTotal}</strong>
                          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`} >Total Leads</span>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      {dashboardInsights.sources.slice(0, 8).map(([name, value], index) => (
                        <div key={name} className={`grid grid-cols-[minmax(0,1fr)_42px_42px] items-center gap-2 py-1.5 border-b last:border-0 text-xs ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'}`} >
                          <span className="min-w-0 truncate flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ['#35ad58','#3985f4','#ff624f','#aa72e5','#48b7e7','#ffb933','#53cdd1','#f05ad7'][index % 8] }} />{name}</span>
                          <strong className={`text-right ${isDark ? 'text-slate-100' : 'text-slate-900'}`} >{value}</strong>
                          <span className={`text-right text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`} >Leads</span>
                        </div>
                      ))}
                      {!dashboardInsights.sources.length && <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`} >No lead source data available.</p>}
                    </div>
                  </div>
                </section>

                <section className={`min-w-0 rounded-2xl border shadow-sm p-4 sm:p-5 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`} >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`} ><span className="text-blue-500">♧</span> Top Performing Courses</h2>
                    <span className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`} >Top 5</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={`w-full min-w-[340px] text-xs ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      <thead><tr className={isDark ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-600"}><th className="text-left font-medium p-2 rounded-l-lg">Course</th><th className="text-right font-medium p-2">Leads</th><th className="text-right font-medium p-2">Enrolled</th><th className="text-right font-medium p-2 rounded-r-lg">Growth</th></tr></thead>
                      <tbody>
                        {dashboardInsights.courses.map(([course, count]) => (
                          <tr key={course} className={`border-b last:border-0 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <td className={`p-2 font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{course}</td>
                            <td className="p-2 text-right">{count}</td>
                            <td className={`p-2 text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>—</td>
                            <td className={`p-2 text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>—</td>
                          </tr>
                        ))}
                        {!dashboardInsights.courses.length && <tr><td colSpan={4} className={`p-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>No course data available.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className={`mt-2 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Enrollment and growth require historical/enrollment metrics from the API; no values are fabricated.</p>
                </section>

                <section className={`min-w-0 rounded-2xl border shadow-sm p-4 sm:p-5 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      <span className="text-blue-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M10 8h4M10 16h4"/></svg>
                      </span>
                      Pipeline
                    </h2>
                  </div>

                  <div className="w-full min-w-0">
                    <table className={`w-full table-auto text-[10px] sm:text-xs ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      <thead>
                        <tr className={`border-b ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-400'}`}>
                          <th className="w-[24%] text-left font-bold pb-3"></th>
                          <th className="whitespace-nowrap text-center font-bold pb-3"><span className="inline-block rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600 sm:px-2">Hot</span></th>
                          <th className="whitespace-nowrap text-center font-bold pb-3"><span className="inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 sm:px-2">Warm</span></th>
                          <th className="whitespace-nowrap text-center font-bold pb-3"><span className="inline-block rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600 sm:px-2">Cold</span></th>
                          <th className="whitespace-nowrap text-center font-bold pb-3"><span className="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 sm:px-2">Remark</span></th>
                          <th className="whitespace-nowrap text-center font-bold pb-3"><span className="inline-block rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600 sm:px-2">Responded</span></th>
                          <th className="text-center font-bold pb-3"><span className="inline-block max-w-[58px] whitespace-normal rounded-full bg-emerald-50 px-1.5 py-0.5 text-center text-[9px] font-bold leading-tight text-emerald-600 sm:max-w-[76px] sm:px-2">Qualified leads</span></th>
                          <th className="whitespace-nowrap text-center font-bold pb-3"><span className="inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 sm:px-2">Total</span></th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                        {pipelineMatrix.map((row) => (
                          <tr key={row.stageName}>
                            <td className="py-3 font-semibold">
                              <div className="flex min-w-0 items-center gap-1 sm:gap-2.5">
                              <div className={`h-6 w-6 shrink-0 rounded-lg flex items-center justify-center sm:h-7 sm:w-7 ${isDark ? 'bg-slate-700/50' : 'bg-blue-50/50'}`}>
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </div>
                              <span className={`min-w-0 truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={row.stageName}>{row.stageName}</span>
                              </div>
                            </td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300 font-medium">{row.counts.hot}</td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300 font-medium">{row.counts.warm}</td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300 font-medium">{row.counts.cold}</td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300 font-medium">{row.counts.remark}</td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300 font-medium">{row.counts.responded}</td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300 font-medium">{row.counts.qualified}</td>
                            <td className="py-3 text-right font-bold pr-2">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={`min-w-0 min-h-[220px] rounded-2xl border shadow-sm p-5 sm:p-7 flex flex-col justify-between ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`} >
                  <div>
                    <h2 className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>AI Generated Summary</h2>
                    <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Insights and recommendations will appear here.</p>
                  </div>
                  <div className="flex justify-end"><span className="text-amber-300 text-4xl">✦</span></div>
                </section>
              </div>
            ) : (
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col lg:flex-row p-2 sm:p-6 pt-0 gap-2 sm:gap-6 relative">
                <div className={`flex-1 min-w-0 min-h-[360px] overflow-y-auto bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm transition-all flex flex-col ${selectedLead ? 'hidden lg:flex' : 'flex'}`}>
                  {isGroupMode && (
                    <div className="border-t border-slate-200 bg-white shadow-[0_-4px_18px_rgba(15,23,42,0.08)] px-4 py-3">
                      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 sm:gap-3">
                        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-400">{groupPickIds.size} Selected</span>
                        <button
                          onClick={() => setGroupPickIds(new Set())}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setIsCreateGroupOpen(true)}
                          disabled={groupPickIds.size === 0}
                          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Create Group
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLeadIds(new Set(groupPickIds));
                            setGroupPickIds(new Set());
                            setIsGroupMode(false);
                            setIsMessagingMode(true);
                            setIsMessageModalOpen(true);
                          }}
                          disabled={groupPickIds.size === 0}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Icons.Send className="h-4 w-4" /> Message Selected
                        </button>
                        <button
                          onClick={() => {
                            setIsGroupMode(false);
                            setGroupPickIds(new Set());
                          }}
                          aria-label="Exit group selection mode"
                          title="Close group selection mode"
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <Icons.X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}
      
                  {isMessagingMode && !isMessageModalOpen && (
                    <div className="border-t border-slate-200 bg-white shadow-[0_-4px_18px_rgba(15,23,42,0.08)] px-4 py-3">
                      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 sm:gap-3">
                        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-400">{selectedLeadIds.size} Selected</span>
                        <button onClick={selectAllFiltered} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50">Select All</button>
                        <button onClick={uncheckAll} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Clear</button>
                        <button onClick={() => setIsMessageModalOpen(true)} disabled={selectedLeadIds.size === 0} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><Icons.Send className="h-4 w-4" />Send Message</button>
                        <button onClick={exitMessagingMode} aria-label="Cancel message mode" title="Cancel" className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Icons.X className="h-5 w-5" /></button>
                      </div>
                    </div>
                  )}
                  <div className="relative w-full min-w-0 min-h-0 overflow-x-hidden overflow-y-auto flex-1">
                    <div className="md:hidden w-full min-w-0 flex-1">
                      <table className="w-full table-fixed border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="w-[52%] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">Student</th>
                            <th className="w-[48%] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">Program</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredLeads.length === 0 ? (
                            <tr><td colSpan={2} className="px-3 py-8 text-center text-xs text-slate-400">No matching leads found</td></tr>
                          ) : (
                            paginatedLeads.map(lead => (
                              <tr
                                key={`mobile-${lead._id}`}
                                onClick={() => openLeadDetails(lead._id)}
                                className={`cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors ${selectedLead?._id === lead._id ? 'selected-lead-row bg-blue-50/80 dark:bg-blue-600/20 shadow-[inset_4px_0_0_#3b82f6] dark:shadow-[inset_4px_0_0_#60a5fa]' : ''}`}
                              >
                                <td className="px-3 py-3 align-top">
                                  <div className="flex items-start gap-2">
                                    {isPickMode && (
                                      <input
                                        type="checkbox"
                                        checked={isGroupMode ? groupPickIds.has(lead._id) : selectedLeadIds.has(lead._id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => (isGroupMode ? toggleGroupPick(lead._id) : toggleLeadSelection(lead._id))}
                                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 ${isGroupMode ? 'text-violet-600 focus:ring-violet-500' : 'text-blue-600 focus:ring-blue-500'}`}
                                      />
                                    )}
                                    <div className="min-w-0">
                                      <div className="break-words text-xs font-semibold leading-snug text-slate-800">{lead.userName || 'Unnamed student'}</div>
                                      <div className="mt-1 break-words text-[10px] text-slate-500">{lead.userNumber || 'No phone number'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <div className="break-words text-xs font-medium leading-snug text-slate-700">{lead.course || 'General'}</div>
                                  <div className="mt-1 break-words text-[10px] leading-snug text-slate-500">{lead.programType || 'N/A'}</div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <table className="hidden md:table w-full table-fixed">
                      <colgroup>
                        {isPickMode && <col className="w-[4%]" />}
                        <col className={isPickMode ? "w-[16%]" : "w-[18%]"} />
                        <col className={isPickMode ? "w-[15%]" : "w-[16%]"} />
                        <col className={isPickMode ? "w-[9%]" : "w-[10%]"} />
                        <col className={isPickMode ? "w-[12%]" : "w-[13%]"} />
                        <col className={isPickMode ? "w-[15%]" : "w-[16%]"} />
                        <col className="w-[12%]" />
                        <col className={isPickMode ? "w-[10%]" : "w-[9%]"} />
                        <col className={isPickMode ? "w-[7%]" : "w-[6%]"} />
                      </colgroup>
                      <thead className="sticky top-0 bg-slate-50 border-b z-10">
                        <tr>
                          {isPickMode && (
                            <th className="px-1 py-3 text-center animate-in fade-in duration-300">
                              <Icons.Check className="w-4 h-4 text-slate-300 mx-auto" />
                            </th>
                          )}
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Students</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Program</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Source</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Status &amp; Pipeline</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Activity &amp; Remarks</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Reminder</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-left">Assigned To</th>
                          <th className="px-2 py-3 text-[10px] lg:text-xs font-semibold text-slate-800 text-center">AI Assist</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredLeads.length === 0 ? (
                          <tr><td colSpan={isPickMode ? 10 : 9} className="px-6 py-12 text-center text-slate-400 italic text-sm">No matching leads found</td></tr>
                        ) : (
                          paginatedLeads.map(lead => {
                            const latestRemark = getLatestRemark(lead.remarks);
                            return (
                              <tr key={lead._id} onClick={() => openLeadDetails(lead._id)} className={`hover:bg-slate-100/70 dark:hover:bg-slate-700/40 cursor-pointer transition-colors ${selectedLead?._id === lead._id ? 'selected-lead-row bg-blue-50/80 dark:bg-blue-600/20 shadow-[inset_4px_0_0_#3b82f6] dark:shadow-[inset_4px_0_0_#60a5fa]' : ''} ${selectedLeadIds.has(lead._id) ? 'bg-indigo-50/40' : ''} ${groupPickIds.has(lead._id) ? 'bg-violet-50/50' : ''}`}>
                                {isPickMode && (
                                  <td className="px-1 py-3 text-center animate-in fade-in duration-300" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isGroupMode ? groupPickIds.has(lead._id) : selectedLeadIds.has(lead._id)}
                                      onChange={() => (isGroupMode ? toggleGroupPick(lead._id) : toggleLeadSelection(lead._id))}
                                      className={`w-4 h-4 rounded border-slate-300 focus:ring-2 cursor-pointer ${isGroupMode ? 'text-violet-600 focus:ring-violet-500' : 'text-blue-600 focus:ring-blue-500'}`}
                                    />
                                  </td>
                                )}
                                
                                <td className="px-2 py-3">
                                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                                    <span className="truncate max-w-[150px]">{lead.userName}</span>
                                    {lead.demoBooked && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Demo Booked"></span>}
                                    {lead.respondedAfterFollowUp && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Responded"></span>}
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center gap-2">
                                    <span>{lead.userNumber}</span>
                                    <span
                                      role="button"
                                      title="Open in WhatsApp"
                                      onClick={(e) => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                                      className="text-green-500 hover:text-green-600 cursor-pointer"
                                    >
                                      <Icons.WhatsApp className="w-4 h-4" />
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1">{formatDateTime(lead.datecreated)}</div>
                                </td>

                                <td className="px-2 py-3">
                                  <div className="text-sm font-medium text-slate-800 whitespace-normal max-w-[150px]">{lead.course || 'General'}</div>
                                  <div className="flex items-center gap-2 mt-1"><span className="text-xs text-slate-600">{lead.programType || 'N/A'}</span></div>
                                  <LeadGroupChips groups={groupsByLeadId.get(lead._id) ?? []} onOpen={openGroupPopup} />
                                  {lead.referralCode && (
                                    <ReferralCodeChip code={lead.referralCode} onOpen={() => openReferralPopupByCode(lead.referralCode!, lead.referredBy)} />
                                  )}
                                </td>

                                <td className="px-2 py-3">
                                  <div className="max-w-full truncate text-xs text-slate-700" title={lead.leadfrom || 'Unknown'}>{lead.leadfrom || 'Unknown'}</div>
                                </td>

                                <td className="px-2 py-3">
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      lead.status?.toLowerCase() === 'hot' 
                                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/40' 
                                        : lead.status?.toLowerCase() === 'warm' 
                                        ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-900/40' 
                                        : lead.status?.toLowerCase() === 'cold' 
                                        ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/40' 
                                        : lead.status?.toLowerCase() === 'responded' 
                                        ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-900/40' 
                                        : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40'
                                    }`}>
                                      {lead.status}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                      <span className="text-blue-500">⊘</span> {lead.pipeline || 'New'}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-2 py-3">
                                  <div className="flex flex-col gap-1">
                                    <div className="text-[10px] text-slate-400 font-medium">Added: {formatDateTime(lead.datecreated)}</div>
                                    {latestRemark && <div className="text-[10px] text-slate-500">Recent: {formatDateTime(latestRemark.timestamp)}</div>}
                                    <div className="flex items-center gap-2">
                                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${lead.remarks.length > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                                        <Icons.Plus className="w-3 h-3" /> {lead.remarks.length} Remarks
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-2 py-3">
                                  {lead.reminder ? (
                                    <div className="flex items-start gap-1 text-[10px] lg:text-xs text-slate-700">
                                      <Icons.Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="min-w-0 break-words">{formatDateTime(lead.reminder)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300 italic">—</span>
                                  )}
                                </td>

                                <td className="px-2 py-3 text-xs font-medium text-slate-600">
                                  <div className="flex flex-col items-start gap-1 min-w-0">
                                    {lead.assignedto ? (
                                      <div className="flex items-center gap-2 min-w-0 max-w-full">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 uppercase shrink-0">
                                          {lead.assignedto.charAt(0)}
                                        </div>
                                        <span className="truncate max-w-[140px]" title={lead.assignedto}>{lead.assignedto}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 italic text-xs">Unassigned</span>
                                    )}
                                    {currentUser?.role === 'admin' && lead.branch && (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold whitespace-nowrap">
                                        {lead.branch}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-2 py-3 text-center">
                                  <AIAnalysisCell lead={lead} onOpenAssistant={openAssistantForLead} />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!isSearchOrFilterActive && totalPages > 1 && (
                    <div className="shrink-0 sticky bottom-0 bg-white border-t border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between z-10">
                      <span className="text-xs text-slate-500 font-medium">
                        Showing&nbsp;
                        <span className="font-bold text-slate-700">
                          {(currentPage - 1) * LEADS_PER_PAGE + 1}–{Math.min(currentPage * LEADS_PER_PAGE, leadsTotal)}
                        </span>
                        &nbsp;of&nbsp;
                        <span className="font-bold text-slate-700">{leadsTotal}</span>
                        &nbsp;leads
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs font-bold text-slate-700 px-2 tabular-nums">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {selectedLead && (
                  <div className="w-full lg:w-[480px] lg:shrink-0 h-full">
                    <LeadDetails lead={selectedLead} users={users} currentUserRole={currentUser?.role} onUpdate={(l) => { const norm = normalizeLead(l); setLeads(prev => prev.map(p => p._id === norm._id ? norm : p)); setSelectedLead(norm); }} onDelete={handleDeleteLead} onEdit={(l) => { setEditingLead(l); setIsEditModalOpen(true); }} onClose={() => setSelectedLead(null)} />
                  </div>
                )}
              </div>
            )}
          </>
        ) : currentView === 'notes' ? (
          <NotesView currentUser={currentUser} />
        ) : currentView === 'batch-timetable' ? (
          <BatchTimetableView currentUser={currentUser} />
        ) : currentView === 'daily-report' ? (
          <DailyReportView currentUser={currentUser} />
        ) : currentView === 'weekly-ai-report' ? (
          <WeeklyAIReportView currentUser={currentUser} />
        ) : currentView === 'enrolled' ? (
          <CourseEnrolledView
            leads={leads}
            users={users}
            currentUserRole={currentUser?.role}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onUpdateLead={(updatedLead) => {
              const norm = normalizeLead(updatedLead);
              setLeads(prev => prev.map(l => l._id === norm._id ? norm : l));
            }}
            onDeleteLead={handleDeleteLead}
            onEditLead={(lead) => { setEditingLead(lead); setIsEditModalOpen(true); }}
          />
        ) : currentView === 'internship-enrolled' ? (
          <InternshipEnrolledView
            leads={leads}
            users={users}
            currentUserRole={currentUser?.role}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onUpdateLead={(updatedLead) => {
              const norm = normalizeLead(updatedLead);
              setLeads(prev => prev.map(l => l._id === norm._id ? norm : l));
            }}
            onOpenFees={(leadId) => {
              setFeesInitialLeadId(leadId);
              setCurrentView('fees');
            }}
            onDeleteLead={handleDeleteLead}
            onEditLead={(lead) => { setEditingLead(lead); setIsEditModalOpen(true); }}
          />
        ) : currentView === 'user-management' ? (
          <UserManagementView />
        ) : currentView === 'hr-portal' ? (
          <HrPortalView currentUser={currentUser} />
        ) : currentView === 'job-enquiry' && currentUser?.role === 'admin' ? (
          <JobEnquiryView />
        ) : currentView === 'review-meeting' ? (
          <ReviewMeetingView />
        ) : currentView === 'sales-training' ? (
          <SalesTrainingView currentUser={currentUser} />
        ) : currentView === 'google-analytics' ? (
          <GoogleAnalyticsView />
        ) : currentView === 'group-chat' ? (
          <GroupChatView currentUser={currentUser} />
        ) : currentView === 'bulk-msg' ? (
          <BulkMsgView currentUser={currentUser} />
        ) : currentView === 'whatsapp-manager' && currentUser?.role === 'admin' ? (
          <WhatsAppManagerView currentUser={currentUser} initialTab="templates" />
        ) : currentView === 'ctwa-ads' && currentUser?.role === 'admin' ? (
          <CtwaAdsView />
        ) : currentView === 'release-notes' ? (
          <ReleaseNotesView />
        ) : currentView === 'fees' ? (
          <FeesView
            leads={leads}
            currentUser={currentUser}
            users={users}
            initialLeadId={feesInitialLeadId}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onUpdateLead={(updatedLead) => {
              setLeads(prev => prev.map(l => l._id === updatedLead._id ? updatedLead : l));
            }}
          />
        ) : null}
      </main>

      <MessageModal isOpen={isMessageModalOpen} onClose={() => { setIsMessageModalOpen(false); exitMessagingMode(); }} recipientCount={selectedLeadIds.size} onSend={handleSendMessage} isSending={isSendingMessage} campaignNames={campaignNames} />
      <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} filters={filters} users={users} onFilterChange={setFilters} onReset={() => setFilters(initialFilters)} campaignNames={campaignNames} branches={currentUser?.role === 'admin' ? branchList : undefined} />
      <LeadFormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddLead} title="Register New Lead" branches={currentUser?.role === 'admin' ? branchList : undefined} />
      <LeadFormModal key={editingLead?._id ?? 'edit'} isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingLead(null); }} onSubmit={async (d) => { try { setLoading(true); await apiService.editLeadDetails(d); setIsEditModalOpen(false); await fetchDashboardMeta(); await fetchLeadsForCurrentView({ forceLoadAll: true }); } finally { setLoading(false); } }} initialData={editingLead} title="Edit Lead Details" currentUserRole={currentUser?.role} branches={currentUser?.role === 'admin' ? branchList : undefined} />
      <LeadAssistantChatbot leads={leads} openLeadId={assistantOpenLeadId} onClose={() => setAssistantOpenLeadId(null)} />

      {isGroupsPanelOpen && (
        <GroupsPanel
          groups={leadGroups}
          onOpen={openGroupPopup}
          onNewGroup={() => {
            setIsGroupsPanelOpen(false);
            setCurrentView('leads'); 
            setIsMessagingMode(false);
            setSelectedLeadIds(new Set());
            setGroupPickIds(new Set());
            setIsGroupMode(true);
            setCurrentPage(1);
          }}
          onClose={() => setIsGroupsPanelOpen(false)}
        />
      )}

      <CreateGroupModal
        open={isCreateGroupOpen}
        selectedCount={groupPickIds.size}
        busy={isCreatingGroup}
        onCreate={handleCreateGroup}
        onClose={() => setIsCreateGroupOpen(false)}
      />

      {activeGroup && (
        <LeadGroupPopup
          group={activeGroup}
          members={groupMembers}
          loading={isLoadingGroupMembers}
          canManage={canManageGroup(activeGroup)}
          onClose={() => setOpenGroupId(null)}
          onRename={handleRenameGroup}
          onRecolor={handleRecolorGroup}
          onDelete={handleDeleteGroup}
          onRemoveMember={handleRemoveGroupMember}
          onAddMembers={handleAddGroupMembers}
          onOpenLead={(id) => { setOpenGroupId(null); openLeadDetails(id); }}
        />
      )}

      {isReferralPanelOpen && (
        <ReferralGroupsPanel
          groups={referralGroups}
          onOpen={openReferralPopup}
          onClose={() => setIsReferralPanelOpen(false)}
        />
      )}

      {openReferralGroup && (
        <ReferralGroupPopup
          group={openReferralGroup}
          members={referralMembers}
          loading={isLoadingReferralMembers}
          onClose={() => setOpenReferralGroup(null)}
          onOpenLead={(id) => { setOpenReferralGroup(null); openLeadDetails(id); }}
        />
      )}
    </div>
  );
};

export default App;
