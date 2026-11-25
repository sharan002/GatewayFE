import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FilterState } from '../App';
import { Lead, Installment, User, normalizeLeadSource } from '../types';
import { apiService } from '../services/api';
import FilterPanel from './FilterPanel';
import { Icons } from './Icons';

interface FeesViewProps {
    leads: Lead[];
    users: User[];
    currentUser?: User | null;
    searchQuery?: string;
    onSearchQueryChange?: React.Dispatch<React.SetStateAction<string>>;
    onUpdateLead: (lead: Lead) => void;
    initialLeadId?: string | null;
}

interface MonthStats {
    month: string;
    year: number;
    monthName: string;
    billed: number;
    paid: number;
    pending: number;
    installmentCount: number;
}

const FeesView: React.FC<FeesViewProps> = ({ leads, users, currentUser, onUpdateLead, initialLeadId, searchQuery }) => {
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
    };

    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId ?? null);
    const [feesLeads, setFeesLeads] = useState<Lead[]>(leads);
    const [isFetchingFeesLeads, setIsFetchingFeesLeads] = useState(false);
    const feesRequestIdRef = useRef(0);
    const [billedAmount, setBilledAmount] = useState<string>('0');
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingInstallments, setIsEditingInstallments] = useState(false);
    const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
    const [activeFeesView, setActiveFeesView] = useState<'revenue' | 'students'>('revenue');
    const [filters, setFilters] = useState<FilterState>(initialFilters);

    const parseMongoDate = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (typeof date === 'string') return date;
        if (date.$date) return date.$date;
        return new Date().toISOString();
    };

    useEffect(() => {
        const requestId = ++feesRequestIdRef.current;

        const fetchAllFeesLeads = async () => {
            try {
                setIsFetchingFeesLeads(true);

                const limit = 500; // backend caps this to 500
                let page = 1;
                let total = Number.POSITIVE_INFINITY;
                let all: Lead[] = [];

                while (all.length < total) {
                    const res = await apiService.queryLeads({
                        view: 'fees',
                        page,
                        limit,
                        includeStats: false,
                        mode: 'summary',
                        // Fetch all; we do filtering client-side in this view.
                        searchQuery: '',
                        filters: {},
                    });

                    if (requestId !== feesRequestIdRef.current) return;

                    if (!res?.success) break;

                    total = typeof res.total === 'number' ? res.total : all.length + res.leads.length;
                    all = all.concat(res.leads || []);

                    if (!res.leads || res.leads.length < limit) break;
                    page += 1;

                    // Safety guard against runaway pagination if backend total is inconsistent.
                    if (page > 200) break;
                }

                setFeesLeads(all);
            } catch (error) {
                console.error('Failed to fetch fees leads:', error);
                // Fall back to the leads passed from parent (may be partial).
                setFeesLeads(leads);
            } finally {
                if (requestId === feesRequestIdRef.current) setIsFetchingFeesLeads(false);
            }
        };

        void fetchAllFeesLeads();
    }, []);

    // Filter for enrolled students
    const enrolledLeads = feesLeads.filter(l => l.pipeline === 'Enrolled');
    const selectedLead = enrolledLeads.find(l => l._id === selectedLeadId);

    const filteredEnrolledLeads = useMemo(() => {
        return enrolledLeads.filter(lead => {
            const q = (searchQuery || '').trim().toLowerCase();
            const matchesSearch =
                q === '' ||
                (lead.userName || '').toLowerCase().includes(q) ||
                (lead.userNumber || '').toLowerCase().includes(q);
            const matchesCourse = filters.courses.length === 0 || (lead.course && filters.courses.some(c => c.toLowerCase() === lead.course?.toLowerCase()));
            const matchesStatus = filters.statuses.length === 0 || filters.statuses.some(s => s.toLowerCase() === (lead.status || '').toLowerCase());
            const matchesAssigned = filters.assignedUsers.length === 0 || (lead.assignedto && filters.assignedUsers.includes(lead.assignedto));
            const matchesProgram = filters.programTypes.length === 0 || (lead.programType && filters.programTypes.some(p => p.toLowerCase() === lead.programType?.toLowerCase()));
            const matchesSource = filters.sources.length === 0 || filters.sources.some(s => {
                const rawLeadSource = (lead.leadfrom || '').trim().toLowerCase();
                const selLower = s.trim().toLowerCase();
                if (selLower === 'metaads' || selLower === 'meta ads') {
                    return rawLeadSource === selLower;
                }
                return normalizeLeadSource(lead.leadfrom).toLowerCase() === normalizeLeadSource(s).toLowerCase() || rawLeadSource.includes(selLower);
            });
            const matchesProfession = filters.professions.length === 0 || (lead.profession && filters.professions.some(p => p.toLowerCase() === lead.profession?.toLowerCase()));
            const matchesPipeline = filters.pipelines.length === 0 || filters.pipelines.some(p => p.toLowerCase() === (lead.pipeline || '').toLowerCase());

            const leadDate = new Date(parseMongoDate(lead.datecreated)).getTime();
            const matchesFromDate = !filters.fromDate || leadDate >= new Date(filters.fromDate).getTime();
            const matchesToDate = !filters.toDate || leadDate <= new Date(filters.toDate).getTime() + 86400000;

            return matchesSearch && matchesCourse && matchesStatus && matchesAssigned &&
                matchesProgram && matchesSource && matchesProfession && matchesPipeline &&
                matchesFromDate && matchesToDate;
        });
    }, [
        enrolledLeads,
        searchQuery,
        filters.courses,
        filters.programTypes,
        filters.professions,
        filters.sources,
        filters.statuses,
        filters.pipelines,
        filters.assignedUsers,
        filters.fromDate,
        filters.toDate
    ]);

    const hasActiveFilters = useMemo(() => {
        const { statusFilter, fromDate, toDate, courses, programTypes, professions, sources, statuses, pipelines, assignedUsers } = filters;
        const arrayFiltersActive =
            courses.length > 0 ||
            programTypes.length > 0 ||
            professions.length > 0 ||
            sources.length > 0 ||
            statuses.length > 0 ||
            pipelines.length > 0 ||
            assignedUsers.length > 0;
        return arrayFiltersActive || fromDate !== '' || toDate !== '' || statusFilter !== null;
    }, [filters]);

    // Sync state when selected lead changes
    useEffect(() => {
        if (selectedLead) {
            setBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
            setInstallments(selectedLead.fees?.installments || []);
            setIsEditing(false);
            setIsEditingInstallments(false);
        }
    }, [selectedLead]);

    // Get month name from index
    const getMonthName = (monthIndex: number) => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthIndex];
    };

    // Get months for dropdown
    const getMonths = () => {
        const currentYear = new Date().getFullYear();
        const months = [];

        // Current year months
        for (let i = 0; i < 12; i++) {
            months.push({
                value: i,
                label: `${getMonthName(i)} ${currentYear}`,
                year: currentYear
            });
        }

        // Previous year months
        for (let i = 0; i < 12; i++) {
            months.push({
                value: i,
                label: `${getMonthName(i)} ${currentYear - 1}`,
                year: currentYear - 1
            });
        }

        return months;
    };

    // Get years for dropdown
    const getYears = () => {
        const currentYear = new Date().getFullYear();
        return [
            { value: currentYear, label: currentYear.toString() },
            { value: currentYear - 1, label: (currentYear - 1).toString() }
        ];
    };

    // --- Calculations for individual leads ---

    // Normalize money values from API responses; some older records may store amounts as strings.
    const toAmount = (value: unknown): number => {
        const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[,₹\\s]/g, ''));
        return Number.isFinite(amount) ? Math.max(0, amount) : 0;
    };

    const isPaidStatus = (status: unknown) => String(status ?? '').trim().toLowerCase() === 'paid';
    const isPendingStatus = (status: unknown) => String(status ?? '').trim().toLowerCase() === 'pending';

    const getStats = (lead: Lead) => {
        const billed = toAmount(lead.fees?.billedAmount);
        const insts = lead.fees?.installments || [];

        const paid = insts.filter(i => isPaidStatus(i.status))
            .reduce((sum, i) => sum + toAmount(i.amount), 0);
        // Never report a negative balance if installment data exceeds the billed amount.
        const pending = Math.max(0, billed - paid);
        const pendingInstallments = insts.filter(i => isPendingStatus(i.status));
        const overdueInstallments = pendingInstallments.filter(inst => {
            if (!inst?.dueDate || toAmount(inst.amount) <= 0) return false;

            // normalize dueDate
            const dueDateValue =
                typeof inst.dueDate === "string"
                    ? inst.dueDate
                    : inst.dueDate.$date;

            const dueDate = new Date(dueDateValue);
            if (isNaN(dueDate.getTime())) return false;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return dueDate < today;
        });

        return {
            billed,
            paid,
            pending,
            count: insts.length,
            pendingCount: pendingInstallments.length,
            overdueCount: overdueInstallments.length
        };
    };


    // Calculate revenue consistently for a specific calendar month.
    const getLeadMonthStats = (lead: Lead, year: number, month: number): MonthStats => {
        const leadBilled = toAmount(lead.fees?.billedAmount);
        const leadInstallments = lead.fees?.installments || [];
        let paid = 0;
        let pending = 0;
        let installmentCount = 0;

        const getDate = (value: any): Date | null => {
            if (!value) return null;
            const raw = typeof value === 'string' ? value : value?.$date;
            if (!raw) return null;
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        leadInstallments.forEach(inst => {
            const dueDate = getDate(inst.dueDate);
            if (!dueDate || dueDate.getFullYear() !== year || dueDate.getMonth() !== month) return;
            const amount = toAmount(inst.amount);
            installmentCount += 1;
            if (isPaidStatus(inst.status)) paid += amount;
            else if (isPendingStatus(inst.status)) pending += amount;
        });

        // Attribute the billed amount once, to the first installment's month,
        // falling back to the lead creation month when no valid due date exists.
        const firstDueDate = leadInstallments.length ? getDate(leadInstallments[0].dueDate) : null;
        const createdDate = getDate(lead.datecreated);
        const billedDate = firstDueDate || createdDate;
        const billed = billedDate && billedDate.getFullYear() === year && billedDate.getMonth() === month
            ? leadBilled
            : 0;

        return {
            month: `${year}-${String(month + 1).padStart(2, '0')}`,
            year,
            monthName: `${getMonthName(month)} ${year}`,
            billed,
            paid,
            pending,
            installmentCount,
        };
    };

    // The month selector anchors the whole dashboard, including the previous-months table.
    const calculateMonthlyStats = useMemo(() => {
        return Array.from({ length: 6 }, (_, index) => {
            const date = new Date(selectedYear, selectedMonth - index, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const total = filteredEnrolledLeads.reduce((sum, lead) => {
                const stat = getLeadMonthStats(lead, year, month);
                sum.billed += stat.billed;
                sum.paid += stat.paid;
                sum.pending += stat.pending;
                sum.installmentCount += stat.installmentCount;
                return sum;
            }, { billed: 0, paid: 0, pending: 0, installmentCount: 0 });
            return {
                month: `${year}-${String(month + 1).padStart(2, '0')}`,
                year,
                monthName: `${getMonthName(month)} ${year}`,
                ...total,
            };
        });
    }, [filteredEnrolledLeads, selectedMonth, selectedYear]);

    const selectedMonthStats = calculateMonthlyStats[0] || {
        month: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
        year: selectedYear,
        monthName: `${getMonthName(selectedMonth)} ${selectedYear}`,
        billed: 0, paid: 0, pending: 0, installmentCount: 0,
    };

    const monthRevenueRows = useMemo(() => filteredEnrolledLeads.map(lead => ({
        lead,
        stats: getLeadMonthStats(lead, selectedYear, selectedMonth),
    })).filter(({ stats }) => stats.billed > 0 || stats.paid > 0 || stats.pending > 0 || stats.installmentCount > 0),
    [filteredEnrolledLeads, selectedYear, selectedMonth]);

    // --- Calculate Overall Totals ---
    const overallStats = useMemo(() => {
        let totalBilled = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let totalInstallments = 0;

        filteredEnrolledLeads.forEach(lead => {
            const stats = getStats(lead);
            totalBilled += stats.billed;
            totalPaid += stats.paid;
            totalPending += stats.pending;
            totalInstallments += stats.count;
        });

        return {
            billed: totalBilled,
            paid: totalPaid,
            pending: totalPending,
            installmentCount: totalInstallments
        };
    }, [filteredEnrolledLeads]);

    // --- Handlers for Sidebar ---

    const handleAddInstallment = () => {
        const nextNumber = installments.length > 0 ? Math.max(...installments.map(i => i.number)) + 1 : 1;
        setInstallments([
            ...installments,
            {
                number: nextNumber,
                dueDate: new Date().toISOString().split('T')[0],
                amount: 0,
                status: 'Pending'
            }
        ]);
        setIsEditingInstallments(true);
        setIsEditing(true);
    };

    const handleInstallmentChange = async (index: number, field: keyof Installment, value: any) => {
        const newInstallments = [...installments];
        newInstallments[index] = { ...newInstallments[index], [field]: value };
        setInstallments(newInstallments);

        // If status changed, persist immediately so backend reflects Paid status
        if (field === 'status') {
            if (!selectedLeadId) return;
            try {
                setLoading(true);
                const payload = {
                    billedAmount: parseFloat(billedAmount) || 0,
                    installments: newInstallments.map((inst, idx) => ({
                        ...inst,
                        number: idx + 1
                    }))
                };

                const response = await apiService.updateLeadFees(selectedLeadId, payload);
                if (response && response.lead) {
                    onUpdateLead(response.lead);
                    setFeesLeads(prev => {
                        const idx = prev.findIndex(l => l._id === response.lead._id);
                        if (idx === -1) return [response.lead, ...prev];
                        const copy = [...prev];
                        copy[idx] = response.lead;
                        return copy;
                    });
                    setIsEditing(false);
                    setIsEditingInstallments(false);
                } else {
                    // If API didn't return updated lead, still mark as not editing
                    setIsEditing(false);
                    setIsEditingInstallments(false);
                }
            } catch (error) {
                console.error('Failed to update installment status', error);
                alert('Failed to update installment status. Please try saving.');
                // keep editing state so user can retry
                setIsEditingInstallments(true);
                setIsEditing(true);
            } finally {
                setLoading(false);
            }
        } else {
            setIsEditingInstallments(true);
            setIsEditing(true);
        }
    };

    const handleDeleteInstallment = (index: number) => {
        setInstallments(installments.filter((_, i) => i !== index));
        setIsEditingInstallments(true);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!selectedLeadId) return;

        // Don't save if nothing has changed
        if (!isEditing && !isEditingInstallments) return;

        try {
            setLoading(true);

            // Parse billedAmount to number, default to 0 if empty or invalid
            const parsedBilledAmount = parseFloat(billedAmount) || 0;

            const response = await apiService.updateLeadFees(selectedLeadId, {
                billedAmount: parsedBilledAmount,
                installments: installments.map((inst, idx) => ({
                    ...inst,
                    number: idx + 1 // Recalculate numbers after deletions
                }))
            });

            if (response && response.lead) {
                onUpdateLead(response.lead);
                setFeesLeads(prev => {
                    const idx = prev.findIndex(l => l._id === response.lead._id);
                    if (idx === -1) return [response.lead, ...prev];
                    const copy = [...prev];
                    copy[idx] = response.lead;
                    return copy;
                });
                setIsEditing(false);
                setIsEditingInstallments(false);
                alert('Fees updated successfully!');
            } else {
                alert('Fees updated, but could not refresh data automatically. Please reload.');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to update fees.');
        } finally {
            setLoading(false);
        }
    };

    const parseDate = (date: any) => {
        if (!date) return '';
        if (typeof date === 'string') return date.split('T')[0];
        if (date.$date) return date.$date.split('T')[0];
        return '';
    };

    const formatDateTime = (dateValue: any) => {
        if (!dateValue) return '';
        const date = new Date(parseMongoDate(dateValue));
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleGenerateBill = async (index: number, sendEmail = false) => {
        if (!selectedLeadId) return;
        setGeneratingIndex(index);
        try {
            const response = await apiService.generateBill(selectedLeadId, index, sendEmail);

            // Update local installments state with billing info
            const updatedInstallments = installments.map((it, idx) => {
                if (idx === index) {
                    return {
                        ...it,
                        billGenerated: response.billGenerated ?? true,
                        billUrl: response.details?.billUrl || response.details?.billFile || it.billUrl,
                        billGeneratedAt: new Date().toISOString()
                    } as Installment;
                }
                return it;
            });

            setInstallments(updatedInstallments);

            // Notify parent to update lead in list
            if (selectedLead) {
                const updatedLead = {
                    ...selectedLead,
                    fees: {
                        ...(selectedLead.fees || {}),
                        billedAmount: response.totalBilledAmount ?? selectedLead.fees?.billedAmount,
                        installments: updatedInstallments
                    }
                } as Lead;
                onUpdateLead(updatedLead);
                setFeesLeads(prev => {
                    const idx = prev.findIndex(l => l._id === updatedLead._id);
                    if (idx === -1) return [updatedLead, ...prev];
                    const copy = [...prev];
                    copy[idx] = updatedLead;
                    return copy;
                });
            }

            if (response.details?.billUrl) {
                window.open(response.details.billUrl, '_blank', 'noopener');
            }

            alert(response.message || 'Bill generated');
        } catch (error) {
            console.error('Generate bill error', error);
            alert('Failed to generate bill');
        } finally {
            setGeneratingIndex(null);
        }
    };

    // Stats for the currently selected lead (for the sidebar)
    const currentPaid = installments.filter(i => isPaidStatus(i.status)).reduce((sum, i) => sum + toAmount(i.amount), 0);
    const currentBalance = Math.max(0, toAmount(billedAmount) - currentPaid);
    const numericBilled = toAmount(billedAmount);
    const paidPct = numericBilled > 0 ? Math.min(100, Math.round((currentPaid / numericBilled) * 100)) : 0;
    const pendingPct = numericBilled > 0 ? Math.min(100, Math.round((currentBalance / numericBilled) * 100)) : 0;
    const pendingInstallments = installments.filter(i => i.status === 'Pending');
    const overdueInstallments = pendingInstallments.filter(inst => {
        if (!inst.dueDate) return false;
        const dueDate = new Date(parseMongoDate(inst.dueDate));
        return dueDate < new Date() && inst.amount > 0;
    });

    // Billed amount is locked for non-admins once a value has been saved
    const isBilledAmountLocked =
        currentUser?.role !== 'admin' && (selectedLead?.fees?.billedAmount ?? 0) > 0;

    // Handle billed amount change
    const handleBilledAmountChange = (value: string) => {
        if (isBilledAmountLocked) return;
        // Allow empty string (for deletion) or numeric values
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setBilledAmount(value);
            setIsEditing(true);
        }
    };

    // Reset to original values
    const handleCancel = () => {
        if (selectedLead) {
            setBilledAmount(selectedLead.fees?.billedAmount?.toString() || '0');
            setInstallments(selectedLead.fees?.installments || []);
            setIsEditing(false);
            setIsEditingInstallments(false);
        }
    };

    const revenueSources = useMemo(() => {
        const groups = new Map<string, { billed: number; paid: number; pending: number; count: number }>();
        monthRevenueRows.forEach(({ lead, stats }) => {
            const key = normalizeLeadSource((lead.leadfrom || 'Other').trim() || 'Other');
            const current = groups.get(key) || { billed: 0, paid: 0, pending: 0, count: 0 };
            current.billed += stats.billed; current.paid += stats.paid; current.pending += stats.pending; current.count += 1;
            groups.set(key, current);
        });
        return [...groups.entries()].map(([name, stats]) => ({ name, ...stats })).sort((a,b) => b.paid-a.paid);
    }, [monthRevenueRows]);
    const courseRevenue = useMemo(() => {
        const groups = new Map<string, { billed: number; paid: number; pending: number; count: number }>();
        monthRevenueRows.forEach(({ lead, stats }) => {
            const key = (lead.course || 'Other').trim() || 'Other';
            const current = groups.get(key) || { billed: 0, paid: 0, pending: 0, count: 0 };
            current.billed += stats.billed; current.paid += stats.paid; current.pending += stats.pending; current.count += 1;
            groups.set(key, current);
        });
        return [...groups.entries()].map(([name, stats]) => ({ name, ...stats })).sort((a,b) => b.paid-a.paid).slice(0,5);
    }, [monthRevenueRows]);
    const counselorRevenue = useMemo(() => {
        const groups = new Map<string, { billed: number; paid: number; pending: number; count: number }>();
        monthRevenueRows.forEach(({ lead, stats }) => {
            const key = (lead.assignedto || 'Unassigned').trim() || 'Unassigned';
            const current = groups.get(key) || { billed: 0, paid: 0, pending: 0, count: 0 };
            current.billed += stats.billed; current.paid += stats.paid; current.pending += stats.pending; current.count += 1;
            groups.set(key, current);
        });
        return [...groups.entries()].map(([name, stats]) => ({ name, ...stats })).sort((a,b) => b.paid-a.paid).slice(0,5);
    }, [monthRevenueRows]);
    const chartColors = ['#2fa84f','#3478f6','#ff8b3d','#ed5b5b','#a56be0','#55cbd1'];
    const revenueTotal = revenueSources.reduce((sum, item) => sum + item.paid, 0);
    let chartCursor = 0;
    const revenueGradient = revenueSources.length ? `conic-gradient(${revenueSources.map((item, index) => { const start = chartCursor; const part = revenueTotal ? item.paid / revenueTotal * 100 : 100 / revenueSources.length; chartCursor += part; return `${chartColors[index % chartColors.length]} ${start}% ${chartCursor}%`; }).join(', ')})` : 'conic-gradient(#e2e8f0 0% 100%)';
    const money = (value: number) => `₹ ${Math.round(value || 0).toLocaleString('en-IN')}`;

    return (
        <div className="flex h-full min-h-0  overflow-hidden relative">
            <div className={`flex-1 min-w-0 flex flex-col overflow-y-auto ${selectedLeadId ? 'md:mr-[400px]' : ''}`}>
                <header className="px-4 sm:px-6 pt-4 pb-3 flex flex-col gap-3">
                    <div>
                        <h1 className="text-sm font-bold text-slate-900">Revenue Management</h1>
                        <p className="text-xs text-slate-600 mt-0.5">Overview of student fees and payment status.</p>
                        {isFetchingFeesLeads && <span className="text-[10px] font-semibold text-slate-500">Syncing…</span>}
                    </div>
                    <div className="w-full flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white p-1">
                            <button onClick={() => setActiveFeesView('revenue')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold ${activeFeesView === 'revenue' ? 'bg-blue-500 text-white' : 'text-slate-700 hover:bg-blue-50'}`}>
                                <Icons.IndianRupee className="w-4 h-4 shrink-0" /> Revenue
                            </button>
                            <button onClick={() => setActiveFeesView('students')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold ${activeFeesView === 'students' ? 'bg-blue-500 text-white' : 'text-slate-700 hover:bg-blue-50'}`}>
                                <Icons.GraduationCap className="w-4 h-4 shrink-0" /> Students Details
                            </button>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-slate-700 shrink-0">
                            <Icons.Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                            <select aria-label="Revenue month" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent outline-none max-w-28">
                                {getMonths().filter(m => m.year === selectedYear).map(month => <option key={`${month.year}-${month.value}`} value={month.value}>{month.label.split(' ')[0]}</option>)}
                            </select>
                            <select aria-label="Revenue year" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent outline-none">
                                {getYears().map(year => <option key={year.value} value={year.value}>{year.label}</option>)}
                            </select>
                        </div>
                    </div>
                </header>

                {activeFeesView === 'revenue' ? (
                    <main className="px-3 sm:px-6 pb-5 space-y-3 sm:space-y-4">
                        <section className="grid grid-cols-1 min-[430px]:grid-cols-2 xl:grid-cols-4 gap-3">
                            {[
                                { title: 'Total Collection', value: selectedMonthStats.billed, sub: 'Billed this month', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100/70', icon: <Icons.Bank className="w-5 h-5" /> },
                                { title: 'Paid Amount', value: selectedMonthStats.paid, sub: 'Paid this month', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100/70', icon: <Icons.CheckCircle className="w-5 h-5" strokeWidth={2.4} /> },
                                { title: 'Pending Amount', value: selectedMonthStats.pending, sub: 'Due this month', color: 'bg-amber-50 text-[#e27802] border border-amber-100/70', icon: <Icons.PendingAlert className="w-5 h-5" strokeWidth={1.6} /> },
                                { title: 'Installments', value: selectedMonthStats.installmentCount, sub: 'Installments this month', color: 'bg-blue-50 text-blue-600 border border-blue-100/70', icon: <Icons.ScheduleTasks className="w-5 h-5" />, count: true }
                            ].map(card => <div key={card.title} className="min-w-0 rounded-xl border border-blue-100 bg-white p-3 sm:p-4 shadow-[0_3px_8px_rgba(59,130,246,0.12)]">
                                <div className="flex items-center gap-3"><div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${card.color}`}>{card.icon}</div><div className="min-w-0"><p className="text-[11px] text-slate-500">{card.title}</p><p className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">{card.count ? card.value : money(card.value)}</p><p className="text-[9px] text-slate-400">{card.sub}</p></div></div>
                            </div>)}
                        </section>

                        <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3">
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-[0_3px_8px_rgba(59,130,246,0.12)] min-w-0">
                                <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-sm text-slate-900">Revenue Source</h2><span className="text-[10px] text-blue-500">By lead source</span></div>
                                <div className="grid grid-cols-1 sm:grid-cols-[125px_1fr] gap-4 items-center">
                                    <div className="mx-auto relative w-28 h-28 rounded-full" style={{ background: revenueGradient }}><div className="absolute inset-[18px] bg-white rounded-full flex flex-col items-center justify-center text-center"><b className="text-sm text-slate-900">{money(revenueTotal)}</b><span className="text-[9px] text-slate-500">Total Paid</span></div></div>
                                    <div className="overflow-x-auto"><table className="w-full text-left min-w-[360px]"><thead><tr className="text-[10px] text-slate-500 border-b border-slate-100"><th className="py-2">Source</th><th className="py-2">Billed (₹)</th><th className="py-2">Paid (₹)</th><th className="py-2">Pending (₹)</th><th className="py-2">Students</th></tr></thead><tbody>{revenueSources.map((item,index)=><tr key={item.name} className="border-b border-dotted border-slate-200 text-[10px] text-slate-700"><td className="py-2 pr-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{background:chartColors[index%chartColors.length]}} />{item.name}</td><td className="py-2">{Math.round(item.billed).toLocaleString('en-IN')}</td><td className="py-2">{Math.round(item.paid).toLocaleString('en-IN')}</td><td className="py-2">{Math.round(item.pending).toLocaleString('en-IN')}</td><td className="py-2">{item.count}</td></tr>)}{!revenueSources.length && <tr><td colSpan={5} className="py-5 text-center text-xs text-slate-400">No revenue source data</td></tr>}</tbody></table></div>
                                </div>
                            </div>
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-[0_3px_8px_rgba(59,130,246,0.12)] min-w-0">
                                <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-sm text-slate-900">Previous Months</h2><span className="text-[10px] text-blue-500">Previous 3 months</span></div>
                                <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-left"><thead><tr className="text-[10px] text-slate-500 border-b border-slate-100"><th className="py-2">Month</th><th className="py-2">Billed (₹)</th><th className="py-2">Paid (₹)</th><th className="py-2">Pending (₹)</th><th className="py-2">Inst.</th></tr></thead><tbody>{calculateMonthlyStats.slice(1,4).map((stat,index)=><tr key={stat.month} className="border-b border-slate-100 text-[10px] text-slate-700"><td className="py-3">{stat.monthName.split(' ')[0]}</td><td className="py-3">{Math.round(stat.billed).toLocaleString('en-IN')}</td><td className="py-3">{Math.round(stat.paid).toLocaleString('en-IN')}</td><td className="py-3">{Math.round(stat.pending).toLocaleString('en-IN')}</td><td className="py-3">{stat.installmentCount}</td></tr>)}</tbody></table></div>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3">
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-[0_3px_8px_rgba(59,130,246,0.12)] min-w-0">
                                <h2 className="font-bold text-sm text-slate-900 mb-3">Top Revenue-Generating Courses</h2>
                                <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left"><thead className="bg-blue-50"><tr className="text-[10px] text-slate-700"><th className="py-2 px-2 rounded-l-lg">Course</th><th className="py-2 px-2">Billed (₹)</th><th className="py-2 px-2">Paid (₹)</th><th className="py-2 px-2">Pending (₹)</th><th className="py-2 px-2 rounded-r-lg">Students</th></tr></thead><tbody>{courseRevenue.map(item=><tr key={item.name} className="border-b border-slate-100 text-[10px] text-slate-700"><td className="py-2 px-2 font-medium">{item.name}</td><td className="py-2 px-2">{Math.round(item.billed).toLocaleString('en-IN')}</td><td className="py-2 px-2">{Math.round(item.paid).toLocaleString('en-IN')}</td><td className="py-2 px-2">{Math.round(item.pending).toLocaleString('en-IN')}</td><td className="py-2 px-2">{item.count}</td></tr>)}{!courseRevenue.length && <tr><td colSpan={5} className="py-5 text-center text-xs text-slate-400">No course data</td></tr>}</tbody></table></div>
                            </div>
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-[0_3px_8px_rgba(59,130,246,0.12)] min-w-0">
                                <h2 className="font-bold text-sm text-slate-900 mb-3">Counselors</h2>
                                <div className="overflow-x-auto"><table className="w-full min-w-[360px] text-left"><thead className="bg-blue-50"><tr className="text-[10px] text-slate-700"><th className="py-2 px-2 rounded-l-lg">Counselor</th><th className="py-2 px-2">Billed (₹)</th><th className="py-2 px-2">Paid (₹)</th><th className="py-2 px-2">Pending (₹)</th><th className="py-2 px-2 rounded-r-lg">Students</th></tr></thead><tbody>{counselorRevenue.map(item=><tr key={item.name} className="border-b border-slate-100 text-[10px] text-slate-700"><td className="py-3 px-2">{item.name}</td><td className="py-3 px-2">{Math.round(item.billed).toLocaleString('en-IN')}</td><td className="py-3 px-2">{Math.round(item.paid).toLocaleString('en-IN')}</td><td className="py-3 px-2">{Math.round(item.pending).toLocaleString('en-IN')}</td><td className="py-3 px-2">{item.count}</td></tr>)}{!counselorRevenue.length && <tr><td colSpan={5} className="py-5 text-center text-xs text-slate-400">No counselor data</td></tr>}</tbody></table></div>
                            </div>
                        </section>
                    </main>
                ) : (
                    <div className="px-3 sm:px-6 pb-5 flex-1 min-h-0 flex flex-col">
                        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-800">Student Fee Details</p><button onClick={() => setIsFilterOpen(true)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${hasActiveFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-blue-200 text-slate-600 hover:bg-blue-50'}`}><Icons.Filter className="w-4 h-4"/>Filters{hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full"/>}</button></div>
                        <div className="bg-white rounded-xl border border-blue-100 shadow-sm flex-1 min-h-[280px] overflow-hidden"><div className="overflow-auto h-full"><table className="w-full text-left border-collapse min-w-[760px]"><thead className="bg-slate-100 sticky top-0 z-10"><tr>{['Student','Course','Billed Amount','Paid','Pending','Installments','Action'].map(label=><th key={label} className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-blue-100">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredEnrolledLeads.map(lead=>{const stats=getStats(lead);return <tr key={lead._id} className={`hover:bg-blue-50/50 ${selectedLeadId===lead._id?'bg-blue-50 dark:bg-blue-500/[0.08]':''}`}><td className="px-4 py-3"><div className="text-xs font-bold text-black">{lead.userName}</div><div className="text-[10px] text-slate-500 flex items-center gap-2">{lead.userNumber}<span role="button" title="Open in WhatsApp" onClick={e=>{e.stopPropagation();const num=(lead.userNumber||'').replace(/\D/g,'');if(num)window.open(`https://wa.me/${num}`,'_blank','noopener');}} className="text-green-500 cursor-pointer"><Icons.WhatsApp className="w-4 h-4"/></span></div></td><td className="px-4 py-3 text-xs font-medium text-black">{lead.course}</td><td className="px-4 py-3 text-xs font-semibold text-black">{money(stats.billed)}</td><td className="px-4 py-3 text-xs font-semibold text-green-600">{money(stats.paid)}</td><td className="px-4 py-3 text-xs font-semibold text-red-600">{money(stats.pending)}{stats.overdueCount>0&&<div className="text-[10px] text-red-500">{stats.overdueCount} overdue</div>}</td><td className="px-4 py-3 text-xs font-medium text-black">{stats.count}{stats.pendingCount>0&&<div className="text-[10px] text-amber-600">{stats.pendingCount} pending</div>}</td><td className="px-4 py-3"><button onClick={e=>{e.stopPropagation();setSelectedLeadId(lead._id);}} className="text-blue-600 text-xs font-bold hover:underline">Manage Fees</button></td></tr>;})}{filteredEnrolledLeads.length===0&&<tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No enrolled students found.</td></tr>}</tbody></table></div></div>
                    </div>
                )}
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {selectedLeadId && (
                <div
                    className="md:hidden fixed inset-0 bg-black/20 z-[55] backdrop-blur-sm"
                    onClick={() => setSelectedLeadId(null)}
                />
            )}

            {/* Right Sidebar Panel */}
            <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-[60] flex flex-col border-l border-slate-200 ${selectedLeadId ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedLead ? (
                    <>
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{selectedLead.userName}</h2>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                        <span>{selectedLead.userNumber}</span>
                                        <span role="button" title="Open in WhatsApp" onClick={(e) => { e.stopPropagation(); const num = (selectedLead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }} className="text-green-500 hover:text-green-600 cursor-pointer">
                                            <Icons.WhatsApp className="w-4 h-4" />
                                        </span>
                                        <span>•</span>
                                        <span>{selectedLead.course}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedLead.status === 'Hot' ? 'bg-red-100 text-red-700' :
                                            selectedLead.status === 'Warm' ? 'bg-amber-100 text-amber-700' :
                                                'bg-blue-100 text-blue-700'}`}>
                                            {selectedLead.status}
                                        </span>
                                    </div>
                            </div>
                            <button onClick={() => setSelectedLeadId(null)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Lead Details Section */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Lead Details</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Lead Source</label>
                                        <p className="text-xs font-medium text-slate-700">{selectedLead.leadfrom || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Assigned To</label>
                                        <p className="text-xs font-medium text-slate-700">{selectedLead.assignedto || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Program Type</label>
                                        <p className="text-xs font-medium text-slate-700">{selectedLead.programType || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Profession</label>
                                        <p className="text-xs font-medium text-slate-700">{selectedLead.profession || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Location</label>
                                        <p className="text-xs font-medium text-slate-700">{selectedLead.location || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Pipeline</label>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${selectedLead.pipeline === 'Enrolled' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {selectedLead.pipeline}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] text-slate-400 mb-0.5">Date Created</label>
                                        <p className="text-xs font-medium text-slate-700">
                                            {formatDateTime(selectedLead.datecreated)}
                                        </p>
                                    </div>
                                    {selectedLead.remarks && selectedLead.remarks.length > 0 && (
                                        <div className="col-span-2">
                                            <label className="block text-[10px] text-slate-400 mb-0.5">Latest Remark</label>
                                            <p className="text-xs font-medium text-slate-700 bg-slate-100 p-2 rounded">
                                                {selectedLead.remarks[selectedLead.remarks.length - 1].remark}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary Progress Bars matching Reference Image */}
                            <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5 sm:space-y-3">
                                {/* Row 1: Billed */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm font-semibold text-slate-800 w-14 shrink-0">Billed</span>
                                    <span className="text-xs text-slate-400 font-normal shrink-0">( ₹ )</span>
                                    <div className="w-16 sm:w-20 shrink-0 flex items-center gap-1">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={billedAmount}
                                            onChange={(e) => handleBilledAmountChange(e.target.value)}
                                            onFocus={(e) => !isBilledAmountLocked && e.target.select()}
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
                                        {currentPaid.toLocaleString('en-IN')}
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
                                        {currentBalance.toLocaleString('en-IN')}
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
                            {/* Overdue Alert */}
                            {overdueInstallments.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-xs font-bold text-red-700">
                                            {overdueInstallments.length} installment(s) overdue
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Installments List */}
                            <div>
                                <div className="flex items-center justify-between mb-3 pt-2">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800 tracking-tight">Installments details</h3>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                            {installments.length} Total · {pendingInstallments.length} Pending
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {isEditing && (
                                            <button
                                                onClick={handleCancel}
                                                className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition font-bold"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button onClick={handleAddInstallment} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-xs transition-colors flex items-center gap-1.5 active:scale-95">
                                            + Add Installment
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {installments.map((inst, index) => {
                                        const isOverdue = inst.status === 'Pending' && inst.dueDate && new Date(parseMongoDate(inst.dueDate)) < new Date() && inst.amount > 0;
                                        return (
                                            <div key={index} className={`p-4 sm:p-5 rounded-3xl border ${isOverdue ? 'border-red-300 bg-red-50/40' : 'border-blue-100/80'} bg-white shadow-xs space-y-3.5 hover:border-blue-200 transition-colors`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-900 underline underline-offset-4 decoration-slate-300">
                                                            {index === 0 ? '1st Installment' : index === 1 ? '2nd Installment' : index === 2 ? '3rd Installment' : `${index + 1}th Installment`}
                                                        </span>
                                                        {isOverdue && (
                                                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                                                Overdue
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteInstallment(index)}
                                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                                        title="Delete installment"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M3 6h18" />
                                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between gap-4">
                                                    <label className="text-xs font-semibold text-slate-700">Due Date:</label>
                                                    <div className="relative flex-1 max-w-[200px]">
                                                        <input
                                                            type="date"
                                                            value={parseDate(inst.dueDate)}
                                                            onChange={(e) => handleInstallmentChange(index, 'dueDate', e.target.value)}
                                                            className="w-full text-right pr-3 pl-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl outline-none focus:border-blue-500 transition-colors"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-4">
                                                    <label className="text-xs font-semibold text-slate-700">Amount:</label>
                                                    <div className="relative flex-1 max-w-[200px]">
                                                        <input
                                                            type="number"
                                                            value={inst.amount}
                                                            onChange={(e) => handleInstallmentChange(index, 'amount', Number(e.target.value))}
                                                            className="w-full text-right pr-7 pl-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl outline-none focus:border-blue-500 transition-colors"
                                                        />
                                                        <span className="text-xs font-bold text-blue-500 absolute right-2.5 top-1.5 pointer-events-none">₹</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-4">
                                                    <label className="text-xs font-semibold text-slate-700">Status:</label>
                                                    <div className="relative flex-1 max-w-[200px]">
                                                        <select
                                                            value={inst.status}
                                                            onChange={(e) => handleInstallmentChange(index, 'status', e.target.value)}
                                                            className={`w-full text-right pr-3 pl-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200/80 outline-none transition-colors ${inst.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                                                        >
                                                            <option value="Pending">Pending</option>
                                                            <option value="Paid">Paid</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100">
                                                    {inst.billGenerated ? (
                                                        inst.billUrl ? (
                                                            <a onClick={(e)=>e.stopPropagation()} href={inst.billUrl} target="_blank" rel="noopener" className="text-xs text-blue-600 font-bold hover:underline">View Bill</a>
                                                        ) : (
                                                            <span className="text-xs text-slate-500">Bill generated</span>
                                                        )
                                                    ) : (
                                                        inst.status === 'Paid' ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleGenerateBill(index, false); }}
                                                                disabled={generatingIndex === index}
                                                                className={`text-xs px-3 py-1 rounded-full font-bold shadow-xs transition-all ${generatingIndex === index ? 'bg-slate-300 text-slate-600' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}
                                                            >
                                                                {generatingIndex === index ? 'Generating...' : 'Generate Bill'}
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">Mark as Paid to generate bill</span>
                                                        )
                                                    )}
                                                    {inst.billGenerated && inst.billGeneratedAt && (
                                                        <div className="text-[10px] text-slate-400">{formatDateTime(String(inst.billGeneratedAt))}</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {installments.length === 0 && (
                                        <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
                                            No installments added yet. Click "+ Add Installment" above.
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={handleSave}
                                disabled={loading || !isEditing}
                                className={`w-full py-3 font-bold rounded-xl shadow-md transition-all text-sm uppercase tracking-wider ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400">
                        <p>Select a student to manage fees</p>
                    </div>
                )}
            </div>

            <FilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                filters={filters}
                users={users}
                onFilterChange={setFilters}
                onReset={() => setFilters(initialFilters)}
            />

        </div>
    );
};

export default FeesView;
