import * as XLSX from 'xlsx';
import { apiService } from '../services/api';
import type { FilterState } from '../App';
import { expandSourceAliases } from '../types';

const EXPORT_CHUNK = 200;

function parseDate(val: any): string {
  if (!val) return '';
  try {
    const s = typeof val === 'string' ? val : (val.$date || '');
    if (!s) return '';
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

function getField(lead: any, ...keys: string[]): string {
  for (const k of keys) {
    if (lead[k] !== undefined && lead[k] !== null && lead[k] !== '') return String(lead[k]);
  }
  return '';
}

function getLastRemark(lead: any): string {
  const remarks: any[] = Array.isArray(lead.remarks) ? lead.remarks : [];
  if (!remarks.length) return '';
  const sorted = [...remarks].sort((a, b) => {
    const ta = typeof a.timestamp === 'string' ? a.timestamp : (a.timestamp?.$date || '');
    const tb = typeof b.timestamp === 'string' ? b.timestamp : (b.timestamp?.$date || '');
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
  return sorted[0]?.remark || '';
}

function getAllRemarks(lead: any): string {
  const remarks: any[] = Array.isArray(lead.remarks) ? lead.remarks : [];
  if (!remarks.length) return '';
  return remarks
    .map((r: any) => {
      const ts = parseDate(r.timestamp);
      const by = r.addedBy || r.username || r.createdBy || r.by || '';
      return `${ts}${by ? ` [${by}]` : ''}: ${r.remark || ''}`;
    })
    .join(' | ');
}

function cleanExportFilters(filters?: FilterState): Record<string, any> {
  if (!filters) return {};
  const out: Record<string, any> = {};
  if (Array.isArray(filters.courses) && filters.courses.length > 0) out.courses = filters.courses;
  if (Array.isArray(filters.programTypes) && filters.programTypes.length > 0) out.programTypes = filters.programTypes;
  if (Array.isArray(filters.professions) && filters.professions.length > 0) out.professions = filters.professions;
  if (Array.isArray(filters.sources) && filters.sources.length > 0) out.sources = expandSourceAliases(filters.sources);
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) out.statuses = filters.statuses;
  if (Array.isArray(filters.pipelines) && filters.pipelines.length > 0) out.pipelines = filters.pipelines;
  if (Array.isArray(filters.assignedUsers) && filters.assignedUsers.length > 0) out.assignedUsers = filters.assignedUsers;
  if (Array.isArray(filters.branches) && filters.branches.length > 0) out.branches = filters.branches;
  if (Array.isArray(filters.campaigns) && filters.campaigns.length > 0) out.campaigns = filters.campaigns;
  if (filters.fromDate) out.fromDate = filters.fromDate;
  if (filters.toDate) out.toDate = filters.toDate;
  if (filters.statusFilter) out.statusFilter = filters.statusFilter;
  if (filters.college) out.college = filters.college;
  if (filters.batch) out.batch = filters.batch;
  if (filters.assignedUser) out.assignedUser = filters.assignedUser;
  if (filters.source) out.source = filters.source;
  return out;
}

async function fetchAllForView(
  view: string,
  mode: 'summary' | 'full',
  searchQuery: string = '',
  filters: Record<string, any> = {},
  onProgress?: (msg: string) => void,
  stepLabel: string = 'leads',
): Promise<any[]> {
  let page = 1;
  let total = Infinity;
  const all: any[] = [];
  const cleanFilters = cleanExportFilters(filters as FilterState);

  while (all.length < total) {
    try {
      const res = await apiService.queryLeads({
        view,
        page,
        limit: EXPORT_CHUNK,
        includeStats: false,
        mode,
        searchQuery,
        filters: cleanFilters,
      });

      if (!res?.success) break;
      if (page === 1) total = typeof res.total === 'number' ? res.total : Infinity;

      const chunk: any[] = res.leads || [];
      all.push(...chunk);

      if (onProgress && total !== Infinity && total > 0) {
        onProgress(`Fetching ${stepLabel} (${all.length}/${total})...`);
      }

      if (chunk.length < EXPORT_CHUNK || all.length >= total) break;
      page++;
      if (page > 200) break; // safety guard (40,000 leads)
    } catch (err) {
      console.error(`Failed to fetch chunk for view ${view} page ${page}:`, err);
      break;
    }
  }

  return all;
}

function addSheetToWorkbook(wb: XLSX.WorkBook, name: string, aoa: any[][]): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ─── Sheet builders ────────────────────────────────────────────────────────────

function buildDashboardRows(leads: any[]): any[][] {
  const headers = [
    'Name', 'Phone', 'Course', 'Program Type', 'Source', 'Status', 'Pipeline',
    'Assigned To', 'Branch', 'Profession', 'Location', 'Date Created', 'Last Interacted',
    'Reminder', 'Follow-ups', 'Last Remark', 'All Remarks',
  ];
  return [
    headers,
    ...leads.map(l => [
      getField(l, 'userName', 'username', 'name') || 'Unknown',
      getField(l, 'userNumber', 'phone', 'mobile') || '',
      getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
      getField(l, 'programType', 'program_type') || '',
      getField(l, 'leadfrom', 'source') || '',
      getField(l, 'status') || '',
      getField(l, 'pipeline') || '',
      getField(l, 'assignedto', 'assignedTo') || '',
      getField(l, 'branch') || '',
      getField(l, 'profession') || '',
      getField(l, 'location', 'city') || '',
      parseDate(l.datecreated || l.createdAt),
      parseDate(l.lastInteracted || l.updatedAt),
      l.reminder ? parseDate(l.reminder) : '',
      l.followUpCount || 0,
      getLastRemark(l),
      getAllRemarks(l),
    ]),
  ];
}

function buildRemindersRows(leads: any[]): any[][] {
  const headers = [
    'Name', 'Phone', 'Course', 'Source', 'Status', 'Pipeline',
    'Assigned To', 'Branch', 'Reminder Date', 'Follow-ups', 'Last Remark', 'Date Created',
  ];
  return [
    headers,
    ...leads.map(l => [
      getField(l, 'userName', 'username', 'name') || 'Unknown',
      getField(l, 'userNumber', 'phone', 'mobile') || '',
      getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
      getField(l, 'leadfrom', 'source') || '',
      getField(l, 'status') || '',
      getField(l, 'pipeline') || '',
      getField(l, 'assignedto', 'assignedTo') || '',
      getField(l, 'branch') || '',
      l.reminder ? parseDate(l.reminder) : '',
      l.followUpCount || 0,
      getLastRemark(l),
      parseDate(l.datecreated || l.createdAt),
    ]),
  ];
}

function buildEnrolledRows(leads: any[]): any[][] {
  const headers = [
    'Name', 'Phone', 'Course', 'Program Type', 'Batch ID', 'Trainer', 'Batch Date',
    'Billed Amount', 'Total Paid', 'Total Pending', 'Assigned To', 'Branch', 'Date Created', 'Last Remark',
  ];
  return [
    headers,
    ...leads.map(l => {
      const fees = l.fees || l.feeStructure;
      const installs: any[] = Array.isArray(fees?.installments) ? fees.installments : [];
      const paid = installs.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + (i.amount || 0), 0);
      const pending = installs.filter((i: any) => i.status === 'Pending').reduce((s: number, i: any) => s + (i.amount || 0), 0);
      return [
        getField(l, 'userName', 'username', 'name') || 'Unknown',
        getField(l, 'userNumber', 'phone', 'mobile') || '',
        getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
        getField(l, 'programType', 'program_type') || '',
        getField(l, 'batchId') || '',
        getField(l, 'Trainer') || '',
        l.batch_date ? parseDate(l.batch_date) : '',
        fees?.billedAmount || 0,
        paid,
        pending,
        getField(l, 'assignedto', 'assignedTo') || '',
        getField(l, 'branch') || '',
        parseDate(l.datecreated || l.createdAt),
        getLastRemark(l),
      ];
    }),
  ];
}

function buildInternshipRows(leads: any[]): any[][] {
  const headers = [
    'Name', 'Phone', 'Course', 'College', 'Degree', 'Department',
    'Internship', 'Start Date', 'End Date', 'Batch Code', 'Assigned To', 'Branch', 'Date Created',
  ];
  const rows: any[][] = [];
  for (const l of leads) {
    const details: any[] = Array.isArray(l.InternDetails) ? l.InternDetails : [];
    if (details.length > 0) {
      for (const d of details) {
        rows.push([
          getField(l, 'userName', 'username', 'name') || 'Unknown',
          getField(l, 'userNumber', 'phone', 'mobile') || '',
          getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
          d.college || '',
          d.degree || d.other_degree || '',
          d.department || '',
          d.internship || d.other_internship || '',
          d.start_date ? parseDate(d.start_date) : '',
          d.end_date ? parseDate(d.end_date) : '',
          d.batch_code || '',
          getField(l, 'assignedto', 'assignedTo') || '',
          getField(l, 'branch') || '',
          parseDate(l.datecreated || l.createdAt),
        ]);
      }
    } else {
      rows.push([
        getField(l, 'userName', 'username', 'name') || 'Unknown',
        getField(l, 'userNumber', 'phone', 'mobile') || '',
        getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
        '', '', '', '', '', '', '',
        getField(l, 'assignedto', 'assignedTo') || '',
        getField(l, 'branch') || '',
        parseDate(l.datecreated || l.createdAt),
      ]);
    }
  }
  return [headers, ...rows];
}

function buildFeesRows(leads: any[]): any[][] {
  const enrolled = leads.filter(l => (l.pipeline || '').toLowerCase() === 'enrolled');
  const targetLeads = enrolled.length > 0 ? enrolled : leads;

  let maxInst = 0;
  for (const l of targetLeads) {
    const fees = l.fees || l.feeStructure;
    const n = Array.isArray(fees?.installments) ? fees.installments.length : 0;
    if (n > maxInst) maxInst = n;
  }

  const instHeaders: string[] = [];
  for (let i = 1; i <= maxInst; i++) {
    instHeaders.push(`Inst.${i} Amount`, `Inst.${i} Due Date`, `Inst.${i} Status`, `Inst.${i} Paid At`);
  }

  const headers = [
    'Name', 'Phone', 'Course', 'Program Type',
    'Billed Amount', 'Total Paid', 'Total Pending',
    'Assigned To', 'Branch', 'Last Remark',
    ...instHeaders,
  ];

  const rows = targetLeads.map(l => {
    const fees = l.fees || l.feeStructure;
    const installs: any[] = Array.isArray(fees?.installments) ? fees.installments : [];
    const paid = installs.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const pending = installs.filter((i: any) => i.status === 'Pending').reduce((s: number, i: any) => s + (i.amount || 0), 0);

    const base = [
      getField(l, 'userName', 'username', 'name') || 'Unknown',
      getField(l, 'userNumber', 'phone', 'mobile') || '',
      getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
      getField(l, 'programType', 'program_type') || '',
      fees?.billedAmount || 0,
      paid,
      pending,
      getField(l, 'assignedto', 'assignedTo') || '',
      getField(l, 'branch') || '',
      getLastRemark(l),
    ];

    const instCells: any[] = [];
    for (let i = 0; i < maxInst; i++) {
      const inst = installs[i];
      if (inst) {
        instCells.push(
          inst.amount || 0,
          parseDate(inst.dueDate),
          inst.status || '',
          inst.paidAt ? parseDate(inst.paidAt) : '',
        );
      } else {
        instCells.push('', '', '', '');
      }
    }

    return [...base, ...instCells];
  });

  return [headers, ...rows];
}

function buildNotInterestedRows(leads: any[]): any[][] {
  const headers = [
    'Name', 'Phone', 'Course', 'Source', 'Status', 'Pipeline',
    'Assigned To', 'Branch', 'Last Remark', 'Date Created', 'Last Interacted',
  ];
  return [
    headers,
    ...leads.map(l => [
      getField(l, 'userName', 'username', 'name') || 'Unknown',
      getField(l, 'userNumber', 'phone', 'mobile') || '',
      getField(l, 'course', 'courseofintrest', 'courseTitle') || '',
      getField(l, 'leadfrom', 'source') || '',
      getField(l, 'status') || '',
      getField(l, 'pipeline') || '',
      getField(l, 'assignedto', 'assignedTo') || '',
      getField(l, 'branch') || '',
      getLastRemark(l),
      parseDate(l.datecreated || l.createdAt),
      parseDate(l.lastInteracted || l.updatedAt),
    ]),
  ];
}

// ─── Per-view export config (shared by the full export and the single-view export) ────

type ExportStep = {
  view: string;
  label: string;
  sheetName: string;
  mode: 'summary' | 'full';
  build: (leads: any[]) => any[][];
};

const EXPORT_STEPS: Record<string, ExportStep> = {
  leads:                 { view: 'dashboard',           label: 'Leads',               sheetName: 'Leads',               mode: 'summary', build: buildDashboardRows     },
  dashboard:             { view: 'dashboard',           label: 'Dashboard',           sheetName: 'Dashboard',           mode: 'summary', build: buildDashboardRows     },
  transferred:           { view: 'transferred',         label: 'Transferred',         sheetName: 'Transferred',         mode: 'summary', build: buildDashboardRows     },
  reminders:             { view: 'reminders',           label: 'Reminders',           sheetName: 'Reminders',           mode: 'summary', build: buildRemindersRows     },
  enrolled:              { view: 'course-enrolled',     label: 'Course Enrolled',     sheetName: 'Course Enrolled',     mode: 'full',    build: buildEnrolledRows      },
  'course-enrolled':     { view: 'course-enrolled',     label: 'Course Enrolled',     sheetName: 'Course Enrolled',     mode: 'full',    build: buildEnrolledRows      },
  'internship-enrolled': { view: 'internship-enrolled', label: 'Internship Enrolled', sheetName: 'Internship Enrolled', mode: 'full',    build: buildInternshipRows    },
  fees:                  { view: 'fees',                label: 'Fees',                sheetName: 'Fees',                mode: 'full',    build: buildFeesRows          },
  'not-interested':      { view: 'not-interested',      label: 'Not Interested',      sheetName: 'Not Interested',      mode: 'summary', build: buildNotInterestedRows },
};

const FILTERABLE_VIEWS = new Set(['dashboard', 'leads', 'transferred', 'not-interested']);
const SEARCHABLE_VIEWS = new Set(['dashboard', 'leads', 'transferred', 'not-interested', 'enrolled', 'course-enrolled', 'internship-enrolled', 'fees']);

function isFilterStateActive(filters: FilterState): boolean {
  if (!filters) return false;
  const {
    courses = [], programTypes = [], professions = [], sources = [], statuses = [], pipelines = [],
    assignedUsers = [], branches = [], campaigns = [], fromDate = '', toDate = '', statusFilter = null,
  } = filters;
  const arrayFiltersActive =
    courses.length > 0 || programTypes.length > 0 || professions.length > 0 ||
    sources.length > 0 || statuses.length > 0 || pipelines.length > 0 ||
    assignedUsers.length > 0 || branches.length > 0 || campaigns.length > 0;
  return arrayFiltersActive || fromDate !== '' || toDate !== '' || statusFilter !== null;
}

async function exportSingleView(
  step: ExportStep,
  searchQuery: string,
  filters: Record<string, any>,
  onProgress?: (msg: string) => void,
  currentLeads?: any[],
): Promise<void> {
  onProgress?.(`Fetching ${step.label}...`);
  let leads = await fetchAllForView(step.view, step.mode, searchQuery, filters, onProgress, step.label);

  // Fallback to in-memory leads if API returned 0 leads but UI has leads loaded
  if (leads.length === 0 && Array.isArray(currentLeads) && currentLeads.length > 0) {
    console.warn(`[Export CRM] API returned 0 leads for ${step.view}, falling back to ${currentLeads.length} loaded leads in memory.`);
    leads = currentLeads;
  }

  const rows = step.build(leads);
  const wb = XLSX.utils.book_new();
  addSheetToWorkbook(wb, step.sheetName, rows);
  const safeName = step.sheetName.replace(/[^a-z0-9]+/gi, '_');
  XLSX.writeFile(wb, `CRM_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Main export entry points ──────────────────────────────────────────────────

export async function exportAllCrmData(onProgress?: (msg: string) => void): Promise<void> {
  const wb = XLSX.utils.book_new();

  const steps = [
    EXPORT_STEPS.leads,
    EXPORT_STEPS.reminders,
    EXPORT_STEPS.enrolled,
    EXPORT_STEPS['internship-enrolled'],
    EXPORT_STEPS.fees,
    EXPORT_STEPS['not-interested'],
  ];

  for (const step of steps) {
    onProgress?.(`Fetching ${step.label}...`);
    const leads = await fetchAllForView(step.view, step.mode, '', {}, onProgress, step.label);
    const aoa = step.build(leads);
    addSheetToWorkbook(wb, step.sheetName, aoa);
  }

  const filename = `CRM_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Sidebar / Menu "Export CRM" button:
// Exports the current view with any active search and filters.
// If the API returns 0 leads but the UI currently has leads loaded in memory,
// currentLeads is used as a fallback so that the user never gets an empty file.
export async function exportCrmData(
  currentView: string,
  filters: FilterState,
  searchQuery: string,
  onProgress?: (msg: string) => void,
  currentLeads?: any[],
): Promise<void> {
  const step = EXPORT_STEPS[currentView];
  const trimmedSearch = (searchQuery || '').trim();

  // If we are on any recognizable view, export that specific view
  if (step) {
    const effectiveSearch = SEARCHABLE_VIEWS.has(currentView) ? trimmedSearch : '';
    const effectiveFilters = FILTERABLE_VIEWS.has(currentView) ? filters : {};
    await exportSingleView(step, effectiveSearch, effectiveFilters, onProgress, currentLeads);
    return;
  }

  // If on an unknown view but search or filters are active, export filtered Leads
  if (trimmedSearch.length > 0 || isFilterStateActive(filters)) {
    await exportSingleView(EXPORT_STEPS.leads, trimmedSearch, filters, onProgress, currentLeads);
    return;
  }

  // Fallback to full export across views
  await exportAllCrmData(onProgress);
}
