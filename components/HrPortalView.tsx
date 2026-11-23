import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { Icons } from './Icons';

// ── Types (local — the HR portal is self-contained) ─────────────────────────
interface HrDocument {
  _id: string;
  docType: string;
  label?: string;
  fileName: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
}
interface HrEducation {
  qualification?: string;
  institution?: string;
  specialization?: string;
  yearOfPassing?: string;
  percentage?: string;
}
interface HrPreviousOrg {
  organization?: string;
  designation?: string;
  fromDate?: string;
  toDate?: string;
  lastCtc?: string;
  reasonForLeaving?: string;
}
interface HrBankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  bankName?: string;
  branch?: string;
  ifsc?: string;
}
interface HrEmployee {
  _id: string;
  name: string;
  dateOfBirth?: string | null;
  designation?: string;
  dateOfJoining?: string | null;
  sex?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  age?: number | null;
  idCardNumber?: string;
  email?: string;
  contactNumber?: string;
  emergencyContactNumber?: string;
  aadharNumber?: string;
  panNumber?: string;
  bankDetails?: HrBankDetails;
  previousOrganizations?: HrPreviousOrg[];
  education?: HrEducation[];
  photo?: { key?: string; contentType?: string; uploadedAt?: string | null };
  documents?: HrDocument[];
  notes?: string;
  active?: boolean;
}
interface HrEmployeeListItem {
  _id: string;
  name: string;
  designation?: string;
  email?: string;
  contactNumber?: string;
  dateOfJoining?: string | null;
  idCardNumber?: string;
  active?: boolean;
  hasPhoto?: boolean;
  documentCount?: number;
  updatedAt?: string;
}

// Dedicated document "slots" that get their own paper-clip attach button.
const SLOT = {
  aadhar: 'Aadhar Card',
  pan: 'PAN Card',
  bank: 'Bank Document',
  prevOrg: 'Previous Organization Document',
  education: 'Educational Document',
} as const;
const SLOT_TYPES: string[] = Object.values(SLOT);
const ADDITIONAL_TYPE = 'Additional Document';

const emptyForm = (): Partial<HrEmployee> => ({
  name: '',
  dateOfBirth: '',
  designation: '',
  dateOfJoining: '',
  sex: '',
  maritalStatus: '',
  bloodGroup: '',
  age: null,
  idCardNumber: '',
  email: '',
  contactNumber: '',
  emergencyContactNumber: '',
  aadharNumber: '',
  panNumber: '',
  bankDetails: { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
  previousOrganizations: [],
  education: [],
  notes: '',
  active: true,
});

const toDateInput = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtSize = (n?: number): string => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

// ── Inline paper-clip icon ────────────────────────────────────────────────
const Clip = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

// ── Small field helpers ────────────────────────────────────────────────────
const Field = ({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2 min-h-[18px]">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {action}
    </div>
    {children}
  </div>
);

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-[#be185d] dark:focus:border-[#ec4899] hover:border-slate-300 dark:hover:border-slate-600 transition-all';

// ═══════════════════════════════════════════════════════════════════════════
const HrPortalView: React.FC<{ currentUser?: { username?: string; role?: string } | null }> = () => {
  const [list, setList] = useState<HrEmployeeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = new
  const [form, setForm] = useState<Partial<HrEmployee>>(emptyForm());
  const [fullRecord, setFullRecord] = useState<HrEmployee | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');

  const [photoUrl, setPhotoUrl] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Additional documents
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docTitle, setDocTitle] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Slot (paper-clip) attachments
  const slotInputRef = useRef<HTMLInputElement>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [slotBusy, setSlotBusy] = useState<string | null>(null);

  // In-app preview overlay
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3000);
  };

  const loadList = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const rows = await apiService.hrListEmployees(q);
      setList(rows);
    } catch (err: any) {
      showToast(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const t = window.setTimeout(() => loadList(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search, loadList]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFullRecord(null);
    setEditorError('');
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl('');
    setEditorOpen(true);
  };

  const openEdit = async (id: string) => {
    setEditingId(id);
    setEditorError('');
    setEditorOpen(true);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl('');
    try {
      const emp = await apiService.hrGetEmployee(id);
      setFullRecord(emp);
      setForm({
        ...emptyForm(),
        ...emp,
        dateOfBirth: toDateInput(emp.dateOfBirth),
        dateOfJoining: toDateInput(emp.dateOfJoining),
        bankDetails: { ...emptyForm().bankDetails, ...(emp.bankDetails || {}) },
        previousOrganizations: emp.previousOrganizations || [],
        education: emp.education || [],
      });
      if (emp.photo && emp.photo.key) {
        try {
          const url = await apiService.hrFetchFile(`/hr/employees/${id}/photo`);
          setPhotoUrl(url);
        } catch {
          /* ignore photo load errors */
        }
      }
    } catch (err: any) {
      setEditorError(err.message || 'Failed to load employee');
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setFullRecord(null);
    setEditorError('');
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl('');
    closePreview();
  };

  const setField = (k: keyof HrEmployee, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const setBank = (k: keyof HrBankDetails, v: string) =>
    setForm((p) => ({ ...p, bankDetails: { ...(p.bankDetails || {}), [k]: v } }));

  const flagError = (msg: string) => {
    setEditorError(msg);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildPayload = () => ({
    name: (form.name || '').trim(),
    dateOfBirth: form.dateOfBirth || '',
    designation: form.designation || '',
    dateOfJoining: form.dateOfJoining || '',
    sex: form.sex || '',
    maritalStatus: form.maritalStatus || '',
    bloodGroup: form.bloodGroup || '',
    age: form.age === null || form.age === undefined || (form.age as any) === '' ? '' : Number(form.age),
    idCardNumber: form.idCardNumber || '',
    email: form.email || '',
    contactNumber: form.contactNumber || '',
    emergencyContactNumber: form.emergencyContactNumber || '',
    aadharNumber: form.aadharNumber || '',
    panNumber: form.panNumber || '',
    bankDetails: form.bankDetails || {},
    previousOrganizations: (form.previousOrganizations || []).filter((o) => o.organization || o.designation),
    education: (form.education || []).filter((e) => e.qualification || e.institution),
    notes: form.notes || '',
    active: form.active !== false,
  });

  const handleSave = async () => {
    if (!(form.name || '').trim()) {
      flagError('Name is required');
      return;
    }
    setSaving(true);
    setEditorError('');
    try {
      const payload = buildPayload();
      if (editingId) {
        await apiService.hrUpdateEmployee(editingId, payload);
        showToast('Employee updated');
      } else {
        const created = await apiService.hrCreateEmployee(payload);
        setEditingId(created._id);
        setFullRecord(created);
        showToast('Employee created — you can now attach photo & documents');
      }
      await loadList(search.trim());
    } catch (err: any) {
      flagError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete employee "${name}"? This also removes all their documents.`)) return;
    try {
      await apiService.hrDeleteEmployee(id);
      showToast('Employee deleted');
      if (editingId === id) closeEditor();
      await loadList(search.trim());
    } catch (err: any) {
      showToast(err.message || 'Failed to delete');
    }
  };

  const refreshRecord = async () => {
    if (!editingId) return;
    const emp = await apiService.hrGetEmployee(editingId);
    setFullRecord(emp);
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingId) return;
    setUploadingPhoto(true);
    try {
      await apiService.hrUploadPhoto(editingId, file);
      const url = await apiService.hrFetchFile(`/hr/employees/${editingId}/photo?ts=${Date.now()}`);
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(url);
      showToast('Photo updated');
      await loadList(search.trim());
    } catch (err: any) {
      showToast(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── document slots ────────────────────────────────────────────────────
  const docsByType = (t: string): HrDocument[] =>
    (fullRecord?.documents || []).filter((d) => d.docType === t);

  const additionalDocs = (): HrDocument[] =>
    (fullRecord?.documents || []).filter((d) => !SLOT_TYPES.includes(d.docType));

  const pickForSlot = (slotType: string) => {
    if (!editingId) {
      flagError('Create the employee first, then attach documents.');
      return;
    }
    setPendingSlot(slotType);
    slotInputRef.current?.click();
  };

  const handleSlotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const slotType = pendingSlot;
    setPendingSlot(null);
    if (!file || !editingId || !slotType) return;
    setSlotBusy(slotType);
    try {
      for (const d of docsByType(slotType)) {
        await apiService.hrDeleteDocument(editingId, d._id);
      }
      await apiService.hrUploadDocument(editingId, file, slotType, slotType);
      await refreshRecord();
      await loadList(search.trim());
      showToast(`${slotType} attached`);
    } catch (err: any) {
      showToast(err.message || 'Failed to attach document');
    } finally {
      setSlotBusy(null);
    }
  };

  const removeDoc = async (doc: HrDocument) => {
    if (!editingId) return;
    if (!window.confirm(`Remove "${doc.label || doc.fileName}"?`)) return;
    try {
      await apiService.hrDeleteDocument(editingId, doc._id);
      await refreshRecord();
      await loadList(search.trim());
      showToast('Document removed');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove document');
    }
  };

  // ── additional documents ─────────────────────────────────────────────
  const handleDocPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingId) return;
    if (!docTitle.trim()) {
      showToast('Enter a title for the document first');
      return;
    }
    setUploadingDoc(true);
    try {
      await apiService.hrUploadDocument(editingId, file, ADDITIONAL_TYPE, docTitle.trim());
      setDocTitle('');
      await refreshRecord();
      await loadList(search.trim());
      showToast('Document uploaded');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  // ── preview ──────────────────────────────────────────────────────────
  const openPreview = async (doc: HrDocument) => {
    if (!editingId) return;
    try {
      const url = await apiService.hrFetchFile(`/hr/employees/${editingId}/documents/${doc._id}?inline=1`);
      setPreview({ url, type: doc.contentType || '', name: doc.label || doc.fileName });
    } catch (err: any) {
      showToast(err.message || 'Failed to load preview');
    }
  };

  const closePreview = () => {
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p.url);
      return null;
    });
  };

  const downloadDoc = async (doc: HrDocument) => {
    if (!editingId) return;
    try {
      const url = await apiService.hrFetchFile(`/hr/employees/${editingId}/documents/${doc._id}`);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err: any) {
      showToast(err.message || 'Failed to download');
    }
  };

  // ── array field editors ──────────────────────────────────────────────
  const addOrg = () =>
    setForm((p) => ({
      ...p,
      previousOrganizations: [...(p.previousOrganizations || []), { organization: '', designation: '' }],
    }));
  const setOrg = (i: number, k: keyof HrPreviousOrg, v: string) =>
    setForm((p) => {
      const arr = [...(p.previousOrganizations || [])];
      arr[i] = { ...arr[i], [k]: v };
      return { ...p, previousOrganizations: arr };
    });
  const rmOrg = (i: number) =>
    setForm((p) => ({
      ...p,
      previousOrganizations: (p.previousOrganizations || []).filter((_, idx) => idx !== i),
    }));

  const addEdu = () =>
    setForm((p) => ({ ...p, education: [...(p.education || []), { qualification: '', institution: '' }] }));
  const setEdu = (i: number, k: keyof HrEducation, v: string) =>
    setForm((p) => {
      const arr = [...(p.education || [])];
      arr[i] = { ...arr[i], [k]: v };
      return { ...p, education: arr };
    });
  const rmEdu = (i: number) =>
    setForm((p) => ({ ...p, education: (p.education || []).filter((_, idx) => idx !== i) }));

  // ── attach-slot button ───────────────────────────────────────────────
  const SlotButton = ({ slotType }: { slotType: string }) => {
    const docs = docsByType(slotType);
    const doc = docs[0];
    const busy = slotBusy === slotType;
    return (
      <span className="inline-flex items-center">
        {doc ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px]">
            <button
              type="button"
              onClick={() => openPreview(doc)}
              title="Preview attached document"
              className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-colors"
            >
              <Icons.Check className="w-3 h-3" /> Attached
            </button>
            <span className="text-emerald-300 dark:text-emerald-800">|</span>
            <button
              type="button"
              onClick={() => pickForSlot(slotType)}
              disabled={busy}
              title="Replace document"
              className="p-0.5 rounded text-slate-400 hover:text-[#be185d] dark:hover:text-pink-400 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {busy ? <Icons.RefreshCcw className="w-3 h-3 animate-spin" /> : <Icons.Upload className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => removeDoc(doc)}
              title="Remove document"
              className="p-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
            >
              <Icons.Trash className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => pickForSlot(slotType)}
            disabled={busy}
            title={editingId ? 'Attach a document' : 'Create the employee first'}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-[#fdf2f8] hover:text-[#be185d] dark:hover:bg-pink-950/50 dark:hover:text-pink-300 border border-slate-200/80 dark:border-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {busy ? (
              <Icons.RefreshCcw className="w-3 h-3 animate-spin" />
            ) : (
              <Clip className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Attach</span>
          </button>
        )}
      </span>
    );
  };

  // ═══════════════════════════ RENDER ═══════════════════════════
  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 transition-colors">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[10002] bg-slate-800 text-white text-xs font-semibold px-5 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">HR Portal</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Employee records &amp; document management.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#be185d] hover:bg-[#9d174d] text-white text-xs font-bold transition shadow-xs"
        >
          <Icons.Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, designation, phone, ID…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-[#be185d] shadow-2xs"
        />
      </div>

      {/* Employee List Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <Icons.RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <Icons.User className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No employees yet</p>
          <p className="text-xs opacity-70 mt-1">Click “Add Employee” to create the first record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((e) => (
            <div
              key={e._id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-pink-200 dark:hover:border-pink-900/60 transition-all p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#fdf2f8] dark:bg-pink-950/60 text-[#be185d] dark:text-pink-300 font-extrabold flex items-center justify-center text-sm shrink-0 border border-pink-100 dark:border-pink-900/50">
                      {e.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate">{e.name}</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">{e.designation || '—'}</p>
                    </div>
                  </div>
                  {!e.active && (
                    <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 font-medium">
                  {e.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Icons.FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {e.email}
                    </div>
                  )}
                  {e.contactNumber && (
                    <div className="flex items-center gap-2">
                      <Icons.Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {e.contactNumber}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Icons.Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> Joined {fmtDate(e.dateOfJoining)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800 text-xs">
                <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                  <Icons.FileText className="w-3.5 h-3.5 text-slate-400" /> {e.documentCount || 0} Documents
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(e._id)}
                    className="p-1.5 rounded-lg text-[#be185d] dark:text-pink-400 hover:bg-[#fdf2f8] dark:hover:bg-pink-950/40 transition-colors"
                    title="Edit"
                  >
                    <Icons.Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(e._id, e.name)}
                    className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Editor modal ──────────────────────────────────────────── */}
      {editorOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-xs flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl flex flex-col sm:max-h-[92vh] overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#be185d] to-[#ec4899] text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  {form.name ? form.name.trim().charAt(0).toUpperCase() : <Icons.User className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                      {editingId ? form.name || 'Edit Employee' : 'New Employee'}
                    </h2>
                    {form.active !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          form.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {form.active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
                    {form.designation ? `${form.designation} • ` : ''}{editingId ? 'Employee Profile & Documents' : 'Fill details to add employee'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#be185d] hover:bg-[#9d174d] text-white text-xs font-bold disabled:opacity-60 shadow-xs hover:shadow transition-all"
                >
                  {saving ? <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                  {editingId ? 'Save' : 'Create'}
                </button>
                <button onClick={closeEditor} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {editorError && (
              <div className="shrink-0 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold px-5 py-2.5 flex items-center justify-between gap-3">
                <span>{editorError}</span>
                <button onClick={() => setEditorError('')} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 shrink-0">
                  <Icons.X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/70 dark:bg-slate-950/70">
              {/* Photo + basics */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Basic Information</h3>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center">
                      {photoUrl ? (
                        <img src={photoUrl} alt="employee" className="w-full h-full object-cover" />
                      ) : (
                        <Icons.User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={!editingId || uploadingPhoto}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#be185d] dark:text-pink-300 bg-[#fdf2f8] dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 disabled:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800 transition-colors"
                    >
                      {uploadingPhoto ? <Icons.RefreshCcw className="w-3 h-3 animate-spin" /> : <Icons.Upload className="w-3 h-3" />}
                      {photoUrl ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Field label="Name *">
                      <input className={inputCls} value={form.name || ''} onChange={(e) => setField('name', e.target.value)} />
                    </Field>
                    <Field label="Designation">
                      <input className={inputCls} value={form.designation || ''} onChange={(e) => setField('designation', e.target.value)} />
                    </Field>
                    <Field label="Date of Birth">
                      <input type="date" className={inputCls} value={(form.dateOfBirth as string) || ''} onChange={(e) => setField('dateOfBirth', e.target.value)} />
                    </Field>
                    <Field label="Date of Joining">
                      <input type="date" className={inputCls} value={(form.dateOfJoining as string) || ''} onChange={(e) => setField('dateOfJoining', e.target.value)} />
                    </Field>
                    <Field label="Sex">
                      <select className={inputCls} value={form.sex || ''} onChange={(e) => setField('sex', e.target.value)}>
                        <option value="" className="dark:bg-slate-900">—</option>
                        <option value="male" className="dark:bg-slate-900">Male</option>
                        <option value="female" className="dark:bg-slate-900">Female</option>
                      </select>
                    </Field>
                    <Field label="Age">
                      <input type="number" min={0} className={inputCls} value={form.age ?? ''} onChange={(e) => setField('age', e.target.value === '' ? null : Number(e.target.value))} />
                    </Field>
                    <Field label="Marital Status">
                      <select className={inputCls} value={form.maritalStatus || ''} onChange={(e) => setField('maritalStatus', e.target.value)}>
                        <option value="" className="dark:bg-slate-900">—</option>
                        <option value="Single" className="dark:bg-slate-900">Single</option>
                        <option value="Married" className="dark:bg-slate-900">Married</option>
                        <option value="Divorced" className="dark:bg-slate-900">Divorced</option>
                        <option value="Widowed" className="dark:bg-slate-900">Widowed</option>
                      </select>
                    </Field>
                    <Field label="Blood Group">
                      <input className={inputCls} value={form.bloodGroup || ''} onChange={(e) => setField('bloodGroup', e.target.value)} placeholder="e.g. O+" />
                    </Field>
                    <Field label="Active">
                      <select className={inputCls} value={form.active === false ? 'no' : 'yes'} onChange={(e) => setField('active', e.target.value === 'yes')}>
                        <option value="yes" className="dark:bg-slate-900">Active</option>
                        <option value="no" className="dark:bg-slate-900">Inactive</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </section>

              {/* Contact & IDs */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Contact &amp; Identification</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Email">
                    <input className={inputCls} value={form.email || ''} onChange={(e) => setField('email', e.target.value)} />
                  </Field>
                  <Field label="ID Card Number">
                    <input className={inputCls} value={form.idCardNumber || ''} onChange={(e) => setField('idCardNumber', e.target.value)} />
                  </Field>
                  <Field label="Contact Number">
                    <input className={inputCls} value={form.contactNumber || ''} onChange={(e) => setField('contactNumber', e.target.value)} />
                  </Field>
                  <Field label="Emergency Contact Number">
                    <input className={inputCls} value={form.emergencyContactNumber || ''} onChange={(e) => setField('emergencyContactNumber', e.target.value)} />
                  </Field>
                  <Field label="Aadhar Card Number" action={<SlotButton slotType={SLOT.aadhar} />}>
                    <input className={inputCls} value={form.aadharNumber || ''} onChange={(e) => setField('aadharNumber', e.target.value)} />
                  </Field>
                  <Field label="PAN Card Number" action={<SlotButton slotType={SLOT.pan} />}>
                    <input className={inputCls} value={form.panNumber || ''} onChange={(e) => setField('panNumber', e.target.value)} />
                  </Field>
                </div>
              </section>

              {/* Bank details */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Bank Details</h3>
                  </div>
                  <SlotButton slotType={SLOT.bank} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Account Holder Name">
                    <input className={inputCls} value={form.bankDetails?.accountHolderName || ''} onChange={(e) => setBank('accountHolderName', e.target.value)} />
                  </Field>
                  <Field label="Account Number">
                    <input className={inputCls} value={form.bankDetails?.accountNumber || ''} onChange={(e) => setBank('accountNumber', e.target.value)} />
                  </Field>
                  <Field label="Bank Name">
                    <input className={inputCls} value={form.bankDetails?.bankName || ''} onChange={(e) => setBank('bankName', e.target.value)} />
                  </Field>
                  <Field label="Branch">
                    <input className={inputCls} value={form.bankDetails?.branch || ''} onChange={(e) => setBank('branch', e.target.value)} />
                  </Field>
                  <Field label="IFSC">
                    <input className={inputCls} value={form.bankDetails?.ifsc || ''} onChange={(e) => setBank('ifsc', e.target.value)} />
                  </Field>
                </div>
              </section>

              {/* Previous organizations */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Previous Organization Details</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <SlotButton slotType={SLOT.prevOrg} />
                    <button
                      type="button"
                      onClick={addOrg}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#be185d] dark:text-pink-300 bg-[#fdf2f8] dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 border border-pink-200/70 dark:border-pink-900/60 transition-all cursor-pointer"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
                {(form.previousOrganizations || []).length === 0 && (
                  <p className="text-xs text-slate-400 italic">No previous organizations added.</p>
                )}
                <div className="space-y-3">
                  {(form.previousOrganizations || []).map((o, i) => (
                    <div key={i} className="border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 relative bg-slate-50/70 dark:bg-slate-950/60">
                      <button onClick={() => rmOrg(i)} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
                        <Icons.Trash className="w-3.5 h-3.5" />
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Field label="Organization">
                          <input className={inputCls} value={o.organization || ''} onChange={(e) => setOrg(i, 'organization', e.target.value)} />
                        </Field>
                        <Field label="Designation">
                          <input className={inputCls} value={o.designation || ''} onChange={(e) => setOrg(i, 'designation', e.target.value)} />
                        </Field>
                        <Field label="From">
                          <input className={inputCls} value={o.fromDate || ''} onChange={(e) => setOrg(i, 'fromDate', e.target.value)} placeholder="MM/YYYY" />
                        </Field>
                        <Field label="To">
                          <input className={inputCls} value={o.toDate || ''} onChange={(e) => setOrg(i, 'toDate', e.target.value)} placeholder="MM/YYYY" />
                        </Field>
                        <Field label="Last CTC">
                          <input className={inputCls} value={o.lastCtc || ''} onChange={(e) => setOrg(i, 'lastCtc', e.target.value)} />
                        </Field>
                        <Field label="Reason for Leaving">
                          <input className={inputCls} value={o.reasonForLeaving || ''} onChange={(e) => setOrg(i, 'reasonForLeaving', e.target.value)} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Education */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Educational Details</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <SlotButton slotType={SLOT.education} />
                    <button
                      type="button"
                      onClick={addEdu}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#be185d] dark:text-pink-300 bg-[#fdf2f8] dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 border border-pink-200/70 dark:border-pink-900/60 transition-all cursor-pointer"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
                {(form.education || []).length === 0 && <p className="text-xs text-slate-400 italic">No education records added.</p>}
                <div className="space-y-3">
                  {(form.education || []).map((ed, i) => (
                    <div key={i} className="border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 relative bg-slate-50/70 dark:bg-slate-950/60">
                      <button onClick={() => rmEdu(i)} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
                        <Icons.Trash className="w-3.5 h-3.5" />
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Field label="Qualification">
                          <input className={inputCls} value={ed.qualification || ''} onChange={(e) => setEdu(i, 'qualification', e.target.value)} placeholder="e.g. B.E CSE" />
                        </Field>
                        <Field label="Institution">
                          <input className={inputCls} value={ed.institution || ''} onChange={(e) => setEdu(i, 'institution', e.target.value)} />
                        </Field>
                        <Field label="Specialization">
                          <input className={inputCls} value={ed.specialization || ''} onChange={(e) => setEdu(i, 'specialization', e.target.value)} />
                        </Field>
                        <Field label="Year of Passing">
                          <input className={inputCls} value={ed.yearOfPassing || ''} onChange={(e) => setEdu(i, 'yearOfPassing', e.target.value)} />
                        </Field>
                        <Field label="Percentage / CGPA">
                          <input className={inputCls} value={ed.percentage || ''} onChange={(e) => setEdu(i, 'percentage', e.target.value)} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Notes */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Notes &amp; Remarks</h3>
                  </div>
                </div>
                <Field label="Notes">
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={form.notes || ''}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Add any relevant notes or employee remarks..."
                  />
                </Field>
              </section>

              {/* Additional Documents */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Additional Documents</h3>
                  </div>
                </div>
                {!editingId ? (
                  <p className="text-xs text-slate-400 italic">Save the employee first, then attach documents.</p>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex-1">
                        <Field label="Title">
                          <input className={inputCls} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. 10th Marksheet, Experience Letter" />
                        </Field>
                      </div>
                      <input ref={docInputRef} type="file" className="hidden" onChange={handleDocPick} />
                      <button
                        onClick={() => {
                          if (!docTitle.trim()) {
                            showToast('Enter a title for the document first');
                            return;
                          }
                          docInputRef.current?.click();
                        }}
                        disabled={uploadingDoc}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#be185d] hover:bg-[#9d174d] text-white text-xs font-bold disabled:opacity-60 whitespace-nowrap shadow-xs hover:shadow transition-all"
                      >
                        {uploadingDoc ? <Icons.RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Clip className="w-3.5 h-3.5" />}
                        Attach
                      </button>
                    </div>

                    {additionalDocs().length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No additional documents uploaded.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {additionalDocs().map((doc) => (
                          <div key={doc._id} className="flex items-center gap-3 py-2.5">
                            <Icons.FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{doc.label || doc.fileName}</p>
                              <p className="text-[10px] text-slate-400">
                                {doc.fileName}
                                {doc.size ? ` · ${fmtSize(doc.size)}` : ''} · {fmtDate(doc.uploadedAt)}
                              </p>
                            </div>
                            <button onClick={() => openPreview(doc)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Preview">
                              <Icons.Search className="w-4 h-4" />
                            </button>
                            <button onClick={() => downloadDoc(doc)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Download">
                              <Icons.Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeDoc(doc)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600" title="Delete">
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {editingId && (fullRecord?.documents || []).length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-[#be185d] dark:bg-[#ec4899]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">All Attached Documents</h3>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(fullRecord?.documents || []).map((doc) => (
                      <div key={doc._id} className="flex items-center gap-3 py-2 text-xs">
                        <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded whitespace-nowrap">
                          {doc.docType}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 truncate flex-1 font-medium">{doc.label || doc.fileName}</span>
                        <button onClick={() => openPreview(doc)} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Preview">
                          <Icons.Search className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => downloadDoc(doc)} className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Download">
                          <Icons.Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {editingId && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(editingId, form.name || 'this employee')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Icons.Trash className="w-3.5 h-3.5" /> Delete Employee
                  </button>
                </div>
              )}
            </div>
          </div>

          <input ref={slotInputRef} type="file" className="hidden" onChange={handleSlotFile} />
        </div>
      )}

      {/* ── Document preview overlay ──────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-[10001] bg-black/70 flex flex-col" onClick={closePreview}>
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-bold truncate pr-3">{preview.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <a href={preview.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-white/10" title="Open in new tab">
                <Icons.Upload className="w-4 h-4 rotate-90" />
              </a>
              <button onClick={closePreview} className="p-2 rounded-lg hover:bg-white/10" title="Close">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-4 pt-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {preview.type.startsWith('image/') ? (
              <img src={preview.url} alt={preview.name} className="max-w-full max-h-full object-contain rounded-xl bg-white" />
            ) : preview.type === 'application/pdf' ? (
              <iframe title={preview.name} src={preview.url} className="w-full h-full rounded-xl bg-white" />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center max-w-sm shadow-xl border border-slate-200 dark:border-slate-800">
                <Icons.FileText className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 font-medium">Preview isn’t available for this file type.</p>
                <a href={preview.url} download={preview.name} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#be185d] hover:bg-[#9d174d] text-white text-xs font-bold transition-all shadow-xs">
                  <Icons.Download className="w-3.5 h-3.5" /> Download
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HrPortalView;
