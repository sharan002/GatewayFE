import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Icons } from './Icons';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const STORAGE_KEY_NOTES = 'crm_release_notes';
const STORAGE_KEY_ACK = 'crm_acknowledged_release_notes';
const SESSION_KEY_REMIND = 'crm_remind_later_release_notes';

export interface ReleaseNote {
  id: string;
  /** 'YYYY-MM-DD' or ISO timestamp — shows with NEW badge for 2 days, then disappears. */
  date: string;
  version?: string;
  title: string;
  description: string;
  tag?: 'feature' | 'fix' | 'improvement';
}

// ── Default releases matching reference design ──────────────────────────────
export const INITIAL_RELEASE_NOTES: ReleaseNote[] = [
  {
    id: 'whatsapp-lead-capture-v24',
    date: new Date().toISOString(),
    version: 'v2.4',
    title: 'WhatsApp lead capture',
    description: 'Leads from WhatsApp now land in your pipeline automatically.',
    tag: 'feature',
  },
  {
    id: 'lead-source-reports-v24',
    date: new Date().toISOString(),
    version: 'v2.4',
    title: 'Lead source reports',
    description: 'Compare conversions across website, Meta, and Google ads.',
    tag: 'feature',
  },
  {
    id: 'auto-lead-assignment-v24',
    date: new Date().toISOString(),
    version: 'v2.4',
    title: 'Auto lead assignment',
    description: 'Assign new leads to counsellors in round-robin order.',
    tag: 'feature',
  },
];

export function getStoredReleaseNotes(): ReleaseNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(INITIAL_RELEASE_NOTES));
      return INITIAL_RELEASE_NOTES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_RELEASE_NOTES;
  } catch {
    return INITIAL_RELEASE_NOTES;
  }
}

export function saveStoredReleaseNotes(notes: ReleaseNote[]) {
  try {
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    // Clear acknowledged status so new updates are seen by users
    localStorage.removeItem(STORAGE_KEY_ACK);
    sessionStorage.removeItem(SESSION_KEY_REMIND);
    window.dispatchEvent(new Event('crm_release_notes_updated'));
  } catch (err) {
    console.error('Failed to save release notes', err);
  }
}

export function getCurrentUserKey(): string {
  try {
    const raw = localStorage.getItem('crm_user');
    if (!raw) return 'anonymous';
    const user = JSON.parse(raw);
    return user._id || user.useremail || user.username || 'default_user';
  } catch {
    return 'default_user';
  }
}

export function getAcknowledgedIds(): string[] {
  try {
    const userKey = getCurrentUserKey();
    const raw = localStorage.getItem(`${STORAGE_KEY_ACK}_${userKey}`);
    if (raw) return JSON.parse(raw);
    const genericRaw = localStorage.getItem(STORAGE_KEY_ACK);
    return genericRaw ? JSON.parse(genericRaw) : [];
  } catch {
    return [];
  }
}

export function acknowledgeReleaseNotes(noteIds: string[]) {
  try {
    const userKey = getCurrentUserKey();
    const existing = getAcknowledgedIds();
    const updated = Array.from(new Set([...existing, ...noteIds]));
    localStorage.setItem(`${STORAGE_KEY_ACK}_${userKey}`, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY_ACK, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to acknowledge release notes', err);
  }
}

function getSessionRemindKey(): string {
  const userKey = getCurrentUserKey();
  return `${SESSION_KEY_REMIND}_${userKey}`;
}

export function getActiveReleaseNotes(): ReleaseNote[] {
  const notes = getStoredReleaseNotes();
  const now = Date.now();
  return notes
    .filter(n => now - new Date(n.date).getTime() < TWO_DAYS_MS)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Returns true when there is at least one note within the 2-day window. */
export function hasActiveReleaseNotes(): boolean {
  if (typeof window !== 'undefined') {
    setTimeout(mountNewFeaturesPopupIfNeeded, 200);
  }
  return getActiveReleaseNotes().length > 0;
}

export const RELEASE_NOTES: ReleaseNote[] = getStoredReleaseNotes();

const tagStyles: Record<string, string> = {
  feature: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50',
  fix: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50',
  improvement: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50',
};

const tagLabels: Record<string, string> = {
  feature: 'Feature',
  fix: 'Fix',
  improvement: 'Improvement',
};

function formatNoteDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function checkIsAdmin(): boolean {
  try {
    const raw = localStorage.getItem('crm_user');
    if (!raw) return true;
    const user = JSON.parse(raw);
    return user.role === 'admin' || !user.role;
  } catch {
    return true;
  }
}

// ── Image 3: Login Modal / Popup for New Features ──────────────────────────
export const NewFeaturesLoginModal: React.FC<{
  notes: ReleaseNote[];
  onClose: () => void;
  onGotIt?: () => void;
  onRemindLater?: () => void;
}> = ({ notes, onClose, onGotIt, onRemindLater }) => {
  if (!notes || notes.length === 0) return null;

  const version = notes[0]?.version || 'v2.4';
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

  const handleGotIt = () => {
    acknowledgeReleaseNotes(notes.map(n => n.id));
    if (onGotIt) onGotIt();
    onClose();
  };

  const handleRemindLater = () => {
    try {
      sessionStorage.setItem(getSessionRemindKey(), 'true');
    } catch {}
    if (onRemindLater) onRemindLater();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-7 max-w-md w-full relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
          aria-label="Close"
        >
          <Icons.X className="w-4 h-4" />
        </button>

        {/* Header */}
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          New features in your CRM
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Version {cleanVersion} · {notes.length} update{notes.length === 1 ? '' : 's'} added by admin
        </p>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-800 mt-4 mb-4" />

        {/* Feature Items List */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {notes.map((note, index) => (
            <React.Fragment key={note.id}>
              <div className="flex items-start gap-3">
                {/* Blue outlined icon box matching Image 3 */}
                <div className="w-4 h-4 rounded border-2 border-blue-500 dark:border-blue-400 shrink-0 mt-0.5" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {note.title}
                    </span>
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 px-1.5 py-0.2 rounded-md">
                      New
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {note.description}
                  </p>
                </div>
              </div>

              {index < notes.length - 1 && (
                <div className="border-t border-slate-100 dark:border-slate-800" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Footer Action Buttons */}
        <div className="border-t border-slate-100 dark:border-slate-800 mt-5 pt-5 flex items-center">
          <button
            onClick={handleGotIt}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
          >
            Got it
          </button>
          <button
            onClick={handleRemindLater}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline px-3 py-2.5 ml-3 transition-colors cursor-pointer"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Image 2: "Add a new feature" Modal ──────────────────────────────────────
const AddFeatureModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newNote: ReleaseNote) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('v2.4');
  const [tag, setTag] = useState<'feature' | 'fix' | 'improvement'>('feature');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const newNote: ReleaseNote = {
      id: `feature-${Date.now()}`,
      date: new Date().toISOString(),
      version: version.trim() || 'v2.4',
      title: title.trim(),
      description: description.trim(),
      tag,
    };

    onAdd(newNote);
    setTitle('');
    setDescription('');
    setVersion('v2.4');
    setTag('feature');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          aria-label="Close"
        >
          <Icons.X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Add a new feature
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          It will be shown to all users for 2 days.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Feature title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. WhatsApp lead capture"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Details
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this feature does..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="v2.4"
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Type
              </label>
              <select
                value={tag}
                onChange={e => setTag(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="feature">Feature</option>
                <option value="fix">Fix</option>
                <option value="improvement">Improvement</option>
              </select>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Publish feature
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Global auto-mounter for login popup across all views ─────────────────────
let globalPopupContainer: HTMLDivElement | null = null;
let globalPopupRoot: any = null;
let isPopupMounted = false;

export function mountNewFeaturesPopupIfNeeded() {
  if (typeof document === 'undefined') return;
  if (isPopupMounted) return;

  // Don't show to unauthenticated visitors on the login screen
  const hasUser = !!localStorage.getItem('crm_user') || !!localStorage.getItem('crm_token');
  if (!hasUser) return;

  const active = getActiveReleaseNotes();
  if (active.length === 0) return;

  const ackIds = getAcknowledgedIds();
  const hasUnseen = active.some(n => !ackIds.includes(n.id));
  if (!hasUnseen) return;

  try {
    if (sessionStorage.getItem(getSessionRemindKey()) === 'true') return;
  } catch {}

  if (!globalPopupContainer) {
    let container = document.getElementById('crm-new-features-popup-root') as HTMLDivElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'crm-new-features-popup-root';
      document.body.appendChild(container);
    }
    globalPopupContainer = container;
  }

  if (!globalPopupRoot && globalPopupContainer) {
    globalPopupRoot = createRoot(globalPopupContainer);
  }

  const handleClose = () => {
    isPopupMounted = false;
    if (globalPopupRoot && globalPopupContainer) {
      globalPopupRoot.render(null);
    }
  };

  if (globalPopupRoot) {
    isPopupMounted = true;
    globalPopupRoot.render(<NewFeaturesLoginModal notes={active} onClose={handleClose} />);
  }
}

// Auto-check on script load
if (typeof window !== 'undefined') {
  setTimeout(mountNewFeaturesPopupIfNeeded, 600);
  window.addEventListener('crm_release_notes_updated', () => {
    isPopupMounted = false;
    setTimeout(mountNewFeaturesPopupIfNeeded, 100);
  });
}

// ── Main Page View ─────────────────────────────────────────────────────────
interface ReleaseNotesViewProps {
  currentUser?: { role?: string } | null;
}

const ReleaseNotesView: React.FC<ReleaseNotesViewProps> = ({ currentUser }) => {
  const [allNotes, setAllNotes] = useState<ReleaseNote[]>(() => getStoredReleaseNotes());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isAdmin = useMemo(() => {
    if (currentUser?.role) return currentUser.role === 'admin';
    return checkIsAdmin();
  }, [currentUser]);

  const activeNotes = useMemo(() => {
    const now = Date.now();
    return allNotes
      .filter(n => now - new Date(n.date).getTime() < TWO_DAYS_MS)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allNotes]);

  const handleAddFeature = (newNote: ReleaseNote) => {
    const updated = [newNote, ...allNotes];
    setAllNotes(updated);
    saveStoredReleaseNotes(updated);
  };

  // Re-read storage on event
  useEffect(() => {
    const handleUpdate = () => {
      setAllNotes(getStoredReleaseNotes());
    };
    window.addEventListener('crm_release_notes_updated', handleUpdate);
    return () => window.removeEventListener('crm_release_notes_updated', handleUpdate);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0b0f19] transition-colors">
      {/* Header matching Image 1 */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#8b5cf6] flex items-center justify-center shrink-0 shadow-xs text-white">
            <Icons.FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">
                What's New
              </h3>
              {activeNotes.length > 0 && (
                <span className="bg-purple-600 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                  NEW
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Latest feature releases — visible for 2 days from release date
            </p>
          </div>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {activeNotes.length > 0 && (
            <button
              onClick={() => setIsPreviewOpen(true)}
              title="Preview Login Popup"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors cursor-pointer"
            >
              Preview Popup
            </button>
          )}

          {/* Plus Add Button matching Image 1 */}
          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              title="Add a new feature"
              className="w-10 h-10 rounded-xl bg-[#8b5cf6] hover:bg-purple-700 active:scale-95 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
            >
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {activeNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 dark:text-slate-500 py-20">
            <Icons.FileText className="w-12 h-12 opacity-20" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              No new releases active
            </p>
            <p className="text-xs opacity-70">
              Features are visible for 2 days after publication.
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#8b5cf6] hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Icons.Plus className="w-4 h-4" /> Add your first feature
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3 max-w-2xl mx-auto sm:mx-0">
            {activeNotes.map(note => (
              <li
                key={note.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4.5 flex gap-4 transition-colors"
              >
                {/* Left accent bar */}
                <div className="w-1.5 rounded-full bg-purple-500 shrink-0" />

                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-bold text-slate-800 dark:text-white text-sm">
                      {note.title}
                    </span>
                    {note.version && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800">
                        {note.version}
                      </span>
                    )}
                    <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider border border-purple-200/50 dark:border-purple-800/50">
                      NEW
                    </span>
                    {note.tag && (
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${tagStyles[note.tag] || ''}`}>
                        {tagLabels[note.tag] || note.tag}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {note.description}
                  </p>

                  {/* Date */}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2.5 font-medium">
                    Released {formatNoteDate(note.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Image 2: Add a new feature Modal */}
      <AddFeatureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddFeature}
      />

      {/* Image 3: Login Modal Preview for Admin / Review */}
      {isPreviewOpen && (
        <NewFeaturesLoginModal
          notes={activeNotes}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default ReleaseNotesView;
