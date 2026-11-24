import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { COURSES } from './FilterPanel';

// Click-to-WhatsApp Ads manager. Everything Ads Manager offers for CTWA (campaign, budget,
// schedule, audience, placements, creative, welcome message, insights, pause/edit) — plus the
// CRM-only part: pick the course the ad is for so leads skip course selection on WhatsApp.

const api = apiService.ctwa.bind(apiService);

const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
const labelCls = 'block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';
const cardCls = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5';
const btnPrimary = 'px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50';
const btnGhost = 'px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const makeMoney = (currency: string) => (v: number) => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v || 0); }
  catch { return `${currency} ${(v || 0).toFixed(2)}`; }
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  CAMPAIGN_PAUSED: 'bg-amber-50 text-amber-700',
  ADSET_PAUSED: 'bg-amber-50 text-amber-700',
  PENDING_REVIEW: 'bg-blue-50 text-blue-700',
  IN_PROCESS: 'bg-blue-50 text-blue-700',
  DISAPPROVED: 'bg-red-50 text-red-700',
  WITH_ISSUES: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
  DELETED: 'bg-slate-100 text-slate-600',
};

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_ENGAGEMENT: 'Engagement (messages)',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_TRAFFIC: 'Traffic',
};
const GOAL_LABELS: Record<string, string> = {
  CONVERSATIONS: 'Maximize conversations',
  LINK_CLICKS: 'Maximize link clicks',
  LANDING_PAGE_VIEWS: 'Maximize landing page views',
  IMPRESSIONS: 'Maximize impressions',
  REACH: 'Maximize reach',
  POST_ENGAGEMENT: 'Maximize post engagement',
};
const BID_LABELS: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: 'Highest volume (lowest cost)',
  LOWEST_COST_WITH_BID_CAP: 'Bid cap',
  COST_CAP: 'Cost per result goal',
};
const SPECIAL_CATEGORIES = [
  ['CREDIT', 'Credit'], ['EMPLOYMENT', 'Employment'], ['HOUSING', 'Housing'], ['ISSUES_ELECTIONS_POLITICS', 'Social issues, elections or politics'],
];
const PLACEMENTS: Record<string, { label: string; key: string; positions: [string, string][] }> = {
  facebook: { label: 'Facebook', key: 'facebookPositions', positions: [['feed', 'Feed'], ['story', 'Stories'], ['facebook_reels', 'Reels'], ['video_feeds', 'Video feeds'], ['marketplace', 'Marketplace'], ['right_hand_column', 'Right column'], ['search', 'Search results']] },
  instagram: { label: 'Instagram', key: 'instagramPositions', positions: [['stream', 'Feed'], ['story', 'Stories'], ['reels', 'Reels'], ['explore', 'Explore'], ['profile_feed', 'Profile feed']] },
  messenger: { label: 'Messenger', key: 'messengerPositions', positions: [['messenger_home', 'Inbox'], ['story', 'Stories']] },
};
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Reusable bits ──────────────────────────────────────────────────────────

const Badge = ({ status }: { status: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
    {(status || '-').replace(/_/g, ' ')}
  </span>
);

const Stat = ({ label, value, tone }: { label: string; value: string | number; tone: string }) => (
  <div className={`rounded-xl p-4 ${tone}`}>
    <p className="text-[11px] font-black uppercase tracking-wider opacity-70">{label}</p>
    <p className="mt-1 text-xl font-black">{value}</p>
  </div>
);

const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div className={`bg-white dark:bg-slate-900 rounded-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto p-6`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
      </div>
      {children}
    </div>
  </div>
);

// Search Meta targeting (interests, behaviors, languages, locations) and pick many.
interface PickItem { id?: string; key?: string; name: string; type?: string; country_code?: string; country_name?: string; radius?: number }
const SearchPicker = ({ label, type, klass, country, selected, onChange, placeholder }: {
  label: string; type: string; klass?: string; country?: string; selected: PickItem[]; onChange: (v: PickItem[]) => void; placeholder?: string;
}) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickItem[]>([]);
  const [busy, setBusy] = useState(false);
  const idOf = (i: PickItem) => String(i.id ?? i.key);

  useEffect(() => {
    if (q.trim().length < 2 && type !== 'adTargetingCategory') { setResults([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const qs = new URLSearchParams({ type, q: q.trim(), ...(klass ? { class: klass } : {}), ...(country ? { country } : {}) });
        const d = await api('GET', `/targeting/search?${qs}`);
        setResults(d.data || []);
      } catch { setResults([]); } finally { setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, type, klass, country]);

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map(s => (
          <span key={idOf(s)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
            {s.name}{s.type && s.type !== 'country' ? ` (${s.type})` : ''}
            {s.type === 'city' && (
              <input type="number" min={17} max={80} title="Radius (km)" value={s.radius ?? ''} placeholder="km"
                onChange={e => onChange(selected.map(x => idOf(x) === idOf(s) ? { ...x, radius: Number(e.target.value) || undefined } : x))}
                className="w-12 text-[11px] rounded border border-emerald-200 px-1 bg-white" />
            )}
            <button onClick={() => onChange(selected.filter(x => idOf(x) !== idOf(s)))} className="text-emerald-700 hover:text-red-600">×</button>
          </span>
        ))}
      </div>
      <input className={inputCls} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder || 'Type to search…'} />
      {(results.length > 0 || busy) && (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {busy && <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>}
          {results.filter(r => !selected.some(s => idOf(s) === idOf(r))).map(r => (
            <button key={idOf(r)} type="button"
              onClick={() => { onChange([...selected, r.type === 'city' ? { ...r, radius: 25 } : r]); setQ(''); setResults([]); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200">
              {r.name}
              <span className="text-xs text-slate-400">
                {r.type ? ` · ${r.type}` : ''}{(r as any).region ? ` · ${(r as any).region}` : ''}{r.country_name ? ` · ${r.country_name}` : ''}
                {(r as any).audience_size_lower_bound ? ` · ~${fmt((r as any).audience_size_lower_bound)}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Create form ────────────────────────────────────────────────────────────

const emptyForm = () => ({
  course: '', name: '', adName: '',
  objective: 'OUTCOME_ENGAGEMENT', optimizationGoal: 'CONVERSATIONS', specialAdCategories: [] as string[],
  budgetType: 'DAILY', budgetAmount: '', bidStrategy: 'LOWEST_COST_WITHOUT_CAP', bidAmount: '',
  startTime: '', endTime: '', scheduleOn: false,
  adSchedule: [] as { days: number[]; startHour: number; endHour: number }[],
  geo: [{ key: 'IN', name: 'India', type: 'country' }] as PickItem[],
  ageMin: 18, ageMax: 65, gender: 'all', locales: [] as PickItem[],
  interests: [] as PickItem[], behaviors: [] as PickItem[], demographics: [] as PickItem[],
  customAudiences: [] as string[], excludedCustomAudiences: [] as string[], advantageAudience: false,
  placementsAutomatic: true, publisherPlatforms: ['facebook', 'instagram'] as string[],
  facebookPositions: ['feed', 'story', 'facebook_reels'] as string[], instagramPositions: ['stream', 'story', 'reels'] as string[], messengerPositions: [] as string[],
  primaryText: '', headline: '', description: '', enhancements: false,
  welcomeText: '', prefill: '', iceBreakers: ['', '', ''],
  imageHash: '', videoId: '', thumbnailHash: '', mediaPreview: '', mediaKind: '' as '' | 'image' | 'video',
  greeting: '', skipCourseSelection: true,
  pageId: '', whatsappNumber: '', assignedTo: '',
});
type Form = ReturnType<typeof emptyForm>;

const buildPayload = (f: Form) => {
  const countries = f.geo.filter(g => g.type === 'country').map(g => String(g.key));
  return {
    course: f.course, name: f.name, adName: f.adName,
    objective: f.objective, optimizationGoal: f.optimizationGoal, specialAdCategories: f.specialAdCategories,
    budget: { type: f.budgetType, amount: Number(f.budgetAmount) },
    bidStrategy: f.bidStrategy, bidAmount: Number(f.bidAmount) || undefined,
    schedule: { startTime: f.startTime || undefined, endTime: f.endTime || undefined },
    adSchedule: f.budgetType === 'LIFETIME' ? f.adSchedule.map(s => ({ days: s.days, startMinute: s.startHour * 60, endMinute: s.endHour * 60 })) : undefined,
    targeting: {
      countries,
      regions: f.geo.filter(g => g.type === 'region').map(g => ({ key: g.key, countryCode: g.country_code })),
      cities: f.geo.filter(g => g.type === 'city').map(g => ({ key: g.key, radius: g.radius, countryCode: g.country_code })),
      ageMin: f.ageMin, ageMax: f.ageMax,
      genders: f.gender === 'male' ? [1] : f.gender === 'female' ? [2] : [],
      locales: f.locales.map(l => l.key ?? l.id),
      interests: f.interests, behaviors: f.behaviors, demographics: f.demographics,
      customAudiences: f.customAudiences, excludedCustomAudiences: f.excludedCustomAudiences,
      advantageAudience: f.advantageAudience,
    },
    placements: {
      automatic: f.placementsAutomatic,
      publisherPlatforms: f.publisherPlatforms,
      facebookPositions: f.publisherPlatforms.includes('facebook') ? f.facebookPositions : [],
      instagramPositions: f.publisherPlatforms.includes('instagram') ? f.instagramPositions : [],
      messengerPositions: f.publisherPlatforms.includes('messenger') ? f.messengerPositions : [],
    },
    creative: {
      primaryText: f.primaryText, headline: f.headline, description: f.description, enhancements: f.enhancements,
      imageHash: f.imageHash || undefined, videoId: f.videoId || undefined, thumbnailHash: f.thumbnailHash || undefined,
      welcome: { text: f.welcomeText, prefill: f.prefill, iceBreakers: f.iceBreakers },
    },
    greeting: f.greeting, skipCourseSelection: f.skipCourseSelection,
    pageId: f.pageId || undefined, whatsappNumber: f.whatsappNumber || undefined,
    assignedTo: f.assignedTo || undefined,
  };
};

const MediaUploader = ({ f, set }: { f: Form; set: (p: Partial<Form>) => void }) => {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const upload = async (file: File, asThumb = false) => {
    setBusy(asThumb ? 'thumb' : 'media'); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const d = await api('POST', '/upload-media', fd);
      if (asThumb) set({ thumbnailHash: d.imageHash });
      else if (d.type === 'image') set({ imageHash: d.imageHash, videoId: '', thumbnailHash: '', mediaKind: 'image', mediaPreview: URL.createObjectURL(file) });
      else set({ videoId: d.videoId, imageHash: '', mediaKind: 'video', mediaPreview: URL.createObjectURL(file) });
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  return (
    <div>
      <label className={labelCls}>Ad media (image or video) *</label>
      <input type="file" accept="image/*,video/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} className="text-sm" />
      {busy === 'media' && <p className="text-xs text-slate-500 mt-1">Uploading to Meta…</p>}
      {f.mediaKind === 'image' && f.mediaPreview && <img src={f.mediaPreview} className="mt-2 h-32 rounded-lg border" />}
      {f.mediaKind === 'video' && (
        <div className="mt-2 space-y-2">
          <video src={f.mediaPreview} className="h-32 rounded-lg border" controls />
          <div>
            <label className={labelCls}>Video thumbnail image *</label>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0], true)} className="text-sm" />
            {f.thumbnailHash && <span className="text-xs text-green-600 ml-2">✓ uploaded</span>}
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
};

const Section = ({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) => (
  <section className={cardCls}>
  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4">{n ? <span className="text-emerald-600 mr-2">{n}.</span> : null}{title}</h3>
  <div className="space-y-4">{children}</div>
  </section>
);

// Click-to-fill suggestions under a text input.
const ChipSuggest = ({ items, value, onPick }: { items: { value: string; label: string; hint?: string }[]; value: string; onPick: (v: string) => void }) => (
  items.length ? (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map(i => (
        <button key={i.value} type="button" onClick={() => onPick(i.value)} title={i.value}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${value === i.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'}`}>
          {i.label}{i.hint ? <span className="opacity-70"> · {i.hint}</span> : null}
        </button>
      ))}
    </div>
  ) : null
);

const CreateForm = ({ config, audiences, onCreated }: { config: any; audiences: any[]; onCreated: () => void }) => {
  const [f, setF] = useState<Form>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [estimate, setEstimate] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [counsellors, setCounsellors] = useState<string[]>([]);
  useEffect(() => {
    api('GET', '/pages').then(d => setPages(d.pages || [])).catch(() => {});
    api('GET', '/whatsapp-numbers').then(d => setNumbers(d.numbers || [])).catch(() => {});
    api('GET', '/counsellors').then(d => setCounsellors(d.counsellors || [])).catch(() => {});
    setF(prev => ({ ...prev, pageId: prev.pageId || config?.pageId || '', whatsappNumber: prev.whatsappNumber || config?.whatsappNumber || '' }));
  }, [config]);
  const set = (p: Partial<Form>) => setF(prev => ({ ...prev, ...p }));
  const goals: string[] = config?.goalsByObjective?.[f.objective] || ['CONVERSATIONS'];
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const waNumber = f.whatsappNumber || config?.whatsappNumber;
  const prefillDefault = f.course ? `Hi, I want to know more about ${f.course}` : 'Hi, I want to know more';

  const runEstimate = async () => {
    setEstimate(null);
    try {
      const p = buildPayload(f);
      const d = await api('POST', '/estimate', { targeting: p.targeting, placements: p.placements, optimizationGoal: f.optimizationGoal });
      setEstimate(d.estimate || { none: true });
    } catch (e: any) { setEstimate({ error: e.message }); }
  };

  const submit = async () => {
    setError('');
    if (!f.course) return setError('Select the course this ad is for');
    if (!f.name.trim()) return setError('Enter a campaign name');
    if (!(Number(f.budgetAmount) > 0)) return setError('Enter a budget');
    if (f.budgetType === 'LIFETIME' && !f.endTime) return setError('A lifetime budget needs an end date');
    if (!f.imageHash && !f.videoId) return setError('Upload the ad image or video');
    if (f.videoId && !f.thumbnailHash) return setError('Upload a thumbnail for the video');
    if (!f.publisherPlatforms.length && !f.placementsAutomatic) return setError('Pick at least one placement');
    setBusy(true);
    try {
      await api('POST', '/campaigns', { ...buildPayload(f), status: 'PAUSED' });
      setF(emptyForm());
      onCreated();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <Section title="Required">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Course this ad is for *</label>
            <select className={inputCls} value={f.course} onChange={e => set({ course: e.target.value, name: f.name || `CTWA - ${e.target.value}` })}>
              <option value="">Select course…</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Leads from this ad skip the course list on WhatsApp and start on this course.</p>
          </div>
          <div>
            <label className={labelCls}>Campaign name *</label>
            <input className={inputCls} value={f.name} onChange={e => set({ name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Daily budget ({config?.account?.currency || 'INR'}) *</label>
            <input type="number" min="1" className={inputCls} value={f.budgetAmount} onChange={e => set({ budgetAmount: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Assign leads of this ad to</label>
            <select className={inputCls} value={f.assignedTo} onChange={e => set({ assignedTo: e.target.value })}>
              <option value="">Automatic (round robin)</option>
              {counsellors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Every lead from this ad goes to this counsellor only.</p>
          </div>
          <div>
            <label className={labelCls}>Facebook Page</label>
            <input className={inputCls} value={f.pageId} onChange={e => set({ pageId: e.target.value })} placeholder={config?.pageId || 'Page ID'} />
            <ChipSuggest value={f.pageId} onPick={v => set({ pageId: v })}
              items={pages.map(p => ({ value: String(p.id), label: p.name, hint: String(p.id) === String(config?.pageId) ? 'default' : undefined }))} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp number</label>
            <input className={inputCls} value={f.whatsappNumber} onChange={e => set({ whatsappNumber: e.target.value })} placeholder={config?.whatsappNumber || '+91…'} />
            <ChipSuggest value={f.whatsappNumber} onPick={v => set({ whatsappNumber: v })}
              items={numbers.map((n: any) => ({ value: n.number, label: n.number, hint: n.isDefault ? 'default' : n.name }))} />
            <p className="text-[11px] text-slate-500 mt-1">Only numbers linked to your ad account work in Meta.</p>
          </div>
        </div>
        <MediaUploader f={f} set={set} />
        <p className="text-[11px] text-slate-500">The ad is created <b>paused</b> with the WhatsApp button and welcome message ready. Audience, placements, text, schedule and the rest can be set in Meta Ads Manager — or in the optional settings below.</p>
      </Section>

      <details>
        <summary className="cursor-pointer select-none text-sm font-bold text-emerald-700 mb-4">Optional settings (also editable in Meta Ads Manager)</summary>
        <div className="space-y-5 mt-4">
      <Section title="Campaign">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Ad name</label>
            <input className={inputCls} value={f.adName} onChange={e => set({ adName: e.target.value })} placeholder="Defaults to campaign name | Ad" />
          </div>
          <div>
            <label className={labelCls}>Campaign objective</label>
            <select className={inputCls} value={f.objective} onChange={e => set({ objective: e.target.value, optimizationGoal: 'CONVERSATIONS' })}>
              {(config?.objectives || []).map((o: string) => <option key={o} value={o}>{OBJECTIVE_LABELS[o] || o}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Special ad categories</label>
          <div className="flex flex-wrap gap-3 text-sm">
            {SPECIAL_CATEGORIES.map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5"><input type="checkbox" checked={f.specialAdCategories.includes(v)} onChange={() => set({ specialAdCategories: toggle(f.specialAdCategories, v) })} />{l}</label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Conversion, budget & schedule">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Conversion location</label>
            <input className={inputCls} value="WhatsApp" disabled />
          </div>
          <div>
            <label className={labelCls}>Performance goal</label>
            <select className={inputCls} value={f.optimizationGoal} onChange={e => set({ optimizationGoal: e.target.value })}>
              {goals.map(g => <option key={g} value={g}>{GOAL_LABELS[g] || g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Budget type</label>
            <select className={inputCls} value={f.budgetType} onChange={e => set({ budgetType: e.target.value })}>
              <option value="DAILY">Daily budget</option>
              <option value="LIFETIME">Lifetime budget</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Bid strategy</label>
            <select className={inputCls} value={f.bidStrategy} onChange={e => set({ bidStrategy: e.target.value })}>
              {(config?.bidStrategies || []).map((b: string) => <option key={b} value={b}>{BID_LABELS[b] || b}</option>)}
            </select>
          </div>
          {f.bidStrategy !== 'LOWEST_COST_WITHOUT_CAP' && (
            <div>
              <label className={labelCls}>{f.bidStrategy === 'COST_CAP' ? 'Cost per result goal' : 'Bid cap'} *</label>
              <input type="number" min="1" className={inputCls} value={f.bidAmount} onChange={e => set({ bidAmount: e.target.value })} />
            </div>
          )}
          <div>
            <label className={labelCls}>Start date & time</label>
            <input type="datetime-local" className={inputCls} value={f.startTime} onChange={e => set({ startTime: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>End date & time{f.budgetType === 'LIFETIME' ? ' *' : ''}</label>
            <input type="datetime-local" className={inputCls} value={f.endTime} onChange={e => set({ endTime: e.target.value })} />
          </div>
        </div>
        {f.budgetType === 'LIFETIME' && (
          <div>
            <label className={labelCls}>Ad scheduling (run only on selected days / hours)</label>
            {f.adSchedule.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                {DAY_LABELS.map((d, di) => (
                  <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={s.days.includes(di)}
                    onChange={() => setF(p => ({ ...p, adSchedule: p.adSchedule.map((x, xi) => xi === i ? { ...x, days: x.days.includes(di) ? x.days.filter(v => v !== di) : [...x.days, di] } : x) }))} />{d}</label>
                ))}
                <input type="number" min={0} max={23} value={s.startHour} className="w-14 rounded border px-1 py-0.5" onChange={e => setF(p => ({ ...p, adSchedule: p.adSchedule.map((x, xi) => xi === i ? { ...x, startHour: Number(e.target.value) } : x) }))} />
                to
                <input type="number" min={1} max={24} value={s.endHour} className="w-14 rounded border px-1 py-0.5" onChange={e => setF(p => ({ ...p, adSchedule: p.adSchedule.map((x, xi) => xi === i ? { ...x, endHour: Number(e.target.value) } : x) }))} />
                <button onClick={() => setF(p => ({ ...p, adSchedule: p.adSchedule.filter((_, xi) => xi !== i) }))} className="text-red-600">remove</button>
              </div>
            ))}
            <button type="button" className={btnGhost} onClick={() => setF(p => ({ ...p, adSchedule: [...p.adSchedule, { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 21 }] }))}>+ Add time window</button>
          </div>
        )}
      </Section>

      <Section title="Audience">
        <SearchPicker label="Locations (country / state / city)" type="adgeolocation" selected={f.geo} onChange={v => set({ geo: v })} placeholder="Search e.g. Coimbatore, Tamil Nadu…" />
        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className={labelCls}>Min age</label><input type="number" min={18} max={65} className={inputCls} value={f.ageMin} onChange={e => set({ ageMin: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Max age</label><input type="number" min={18} max={65} className={inputCls} value={f.ageMax} onChange={e => set({ ageMax: Number(e.target.value) })} /></div>
          <div>
            <label className={labelCls}>Gender</label>
            <select className={inputCls} value={f.gender} onChange={e => set({ gender: e.target.value })}>
              <option value="all">All</option><option value="male">Men</option><option value="female">Women</option>
            </select>
          </div>
        </div>
        <SearchPicker label="Languages" type="adlocale" selected={f.locales} onChange={v => set({ locales: v })} placeholder="Search a language…" />
        <SearchPicker label="Detailed targeting — interests" type="adinterest" selected={f.interests} onChange={v => set({ interests: v })} placeholder="e.g. Python, Web development, Engineering…" />
        <SearchPicker label="Detailed targeting — behaviors" type="adTargetingCategory" klass="behaviors" selected={f.behaviors} onChange={v => set({ behaviors: v })} placeholder="Filter behaviors…" />
        <SearchPicker label="Detailed targeting — demographics" type="adTargetingCategory" klass="demographics" selected={f.demographics} onChange={v => set({ demographics: v })} placeholder="Filter demographics (education, job…)" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Custom audiences (include)</label>
            <select multiple className={`${inputCls} h-24`} value={f.customAudiences} onChange={e => set({ customAudiences: Array.from(e.target.selectedOptions).map(o => o.value) })}>
              {audiences.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Custom audiences (exclude)</label>
            <select multiple className={`${inputCls} h-24`} value={f.excludedCustomAudiences} onChange={e => set({ excludedCustomAudiences: Array.from(e.target.selectedOptions).map(o => o.value) })}>
              {audiences.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.advantageAudience} onChange={e => set({ advantageAudience: e.target.checked })} />Advantage+ audience (let Meta expand beyond your targeting)</label>
        <div className="flex items-center gap-3">
          <button type="button" className={btnGhost} onClick={runEstimate}>Estimate audience size</button>
          {estimate && (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {estimate.error ? `Estimate unavailable: ${estimate.error}` : estimate.none ? 'No estimate returned' :
                `Daily reach ≈ ${fmt(estimate.estimate_mau_lower_bound ?? 0)} – ${fmt(estimate.estimate_mau_upper_bound ?? 0)} people`}
            </span>
          )}
        </div>
      </Section>

      <Section title="Placements">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={f.placementsAutomatic} onChange={() => set({ placementsAutomatic: true })} />Advantage+ placements (recommended)</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={!f.placementsAutomatic} onChange={() => set({ placementsAutomatic: false })} />Manual placements</label>
        </div>
        {!f.placementsAutomatic && (
          <div className="grid sm:grid-cols-3 gap-4">
            {Object.entries(PLACEMENTS).map(([plat, def]) => (
              <div key={plat} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <label className="flex items-center gap-1.5 text-sm font-bold mb-2">
                  <input type="checkbox" checked={f.publisherPlatforms.includes(plat)} onChange={() => set({ publisherPlatforms: toggle(f.publisherPlatforms, plat) })} />{def.label}
                </label>
                {f.publisherPlatforms.includes(plat) && def.positions.map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-xs ml-4 mb-1">
                    <input type="checkbox" checked={(f as any)[def.key].includes(v)} onChange={() => set({ [def.key]: toggle((f as any)[def.key], v) } as any)} />{l}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Ad creative">
        <div>
          <label className={labelCls}>Primary text</label>
          <textarea rows={3} className={inputCls} value={f.primaryText} onChange={e => set({ primaryText: e.target.value })} placeholder="e.g. Become a job-ready Python Full Stack developer. Placement support included." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Headline</label><input className={inputCls} value={f.headline} onChange={e => set({ headline: e.target.value })} /></div>
          <div><label className={labelCls}>Description</label><input className={inputCls} value={f.description} onChange={e => set({ description: e.target.value })} /></div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300">
          Call to action: <b>Send WhatsApp message</b>{waNumber ? <> → {waNumber}</> : null}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enhancements} onChange={e => set({ enhancements: e.target.checked })} />Advantage+ creative enhancements</label>
      </Section>

      <Section title="WhatsApp welcome experience">
        <div>
          <label className={labelCls}>Greeting shown in the chat before the lead messages</label>
          <textarea rows={2} className={inputCls} value={f.welcomeText} onChange={e => set({ welcomeText: e.target.value })} placeholder={f.course ? `Hi! Thanks for your interest in ${f.course}. How can we help you?` : 'Hi! How can we help you?'} />
        </div>
        <div>
          <label className={labelCls}>Pre-filled message the lead sends</label>
          <input className={inputCls} value={f.prefill} onChange={e => set({ prefill: e.target.value })} placeholder={prefillDefault} />
        </div>
        <div>
          <label className={labelCls}>Ice breakers (up to 4 quick-reply questions — replaces the pre-filled message)</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {f.iceBreakers.map((q, i) => (
              <input key={i} maxLength={80} className={inputCls} value={q} placeholder={`Question ${i + 1}`}
                onChange={e => set({ iceBreakers: f.iceBreakers.map((x, xi) => xi === i ? e.target.value : x) })} />
            ))}
            {f.iceBreakers.length < 4 && <button type="button" className={btnGhost} onClick={() => set({ iceBreakers: [...f.iceBreakers, ''] })}>+ Add question</button>}
          </div>
        </div>
      </Section>

      <Section title="CRM chatbot behaviour">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.skipCourseSelection} onChange={e => set({ skipCourseSelection: e.target.checked })} />
          Skip course selection — start chat directly on <span className="text-emerald-700">{f.course || 'the selected course'}</span>
        </label>
        <div>
          <label className={labelCls}>First bot reply to the lead (optional — use {'{{name}}'} and {'{{course}}'})</label>
          <textarea rows={3} className={inputCls} value={f.greeting} onChange={e => set({ greeting: e.target.value })} placeholder="Leave empty to use the default bot greeting" />
        </div>
      </Section>
        </div>
      </details>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      <div className="flex items-center gap-4">
        <button className={btnPrimary} disabled={busy} onClick={submit}>{busy ? 'Creating on Meta…' : 'Create paused ad (review in Meta)'}</button>
      </div>
    </div>
  );
};

// ─── Link existing (already running) Meta ads ───────────────────────────────

const LinkExistingForm = ({ onLinked }: { onLinked: () => void }) => {
  const [ads, setAds] = useState<any[] | null>(null);
  const [counsellors, setCounsellors] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [course, setCourse] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [skip, setSkip] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setAds(null); setError('');
    api('GET', '/meta-ads').then(d => setAds(d.ads || [])).catch(e => { setAds([]); setError(e.message); });
  }, []);
  useEffect(() => { load(); api('GET', '/counsellors').then(d => setCounsellors(d.counsellors || [])).catch(() => {}); }, [load]);

  const shown = (ads || []).filter(a => `${a.name} ${a.campaignName}`.toLowerCase().includes(filter.toLowerCase()));
  const toggleAd = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const submit = async () => {
    setError('');
    if (!selected.length) return setError('Select at least one ad');
    if (!course) return setError('Select the course for these ads');
    setBusy(true);
    try {
      await api('POST', '/link', { metaAdIds: selected, course, assignedTo: assignedTo || undefined, skipCourseSelection: skip, greeting });
      onLinked();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <Section title="Pick running ads">
        <p className="text-[11px] text-slate-500">Existing WhatsApp ads from your Meta ad account. Linking changes nothing on Meta — leads from these ads just start using the course and counsellor you choose below.</p>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Search by ad or campaign name…" value={filter} onChange={e => setFilter(e.target.value)} />
          <button type="button" className={btnGhost} onClick={load}>Reload</button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          {ads === null && <p className="px-3 py-3 text-sm text-slate-500">Loading ads from Meta…</p>}
          {ads && shown.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No unlinked WhatsApp ads found.</p>}
          {shown.map(a => (
            <label key={a.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <input type="checkbox" className="mt-1" checked={selected.includes(a.id)} onChange={() => toggleAd(a.id)} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{a.name}</span>
                <span className="block text-xs text-slate-500 truncate">{a.campaignName} · ad {a.id}</span>
              </span>
              <Badge status={a.status} />
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">{selected.length} selected</p>
      </Section>

      <Section title="Course & counsellor">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Course *</label>
            <select className={inputCls} value={course} onChange={e => setCourse(e.target.value)}>
              <option value="">Select course…</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Leads skip the course list on WhatsApp and start on this course.</p>
          </div>
          <div>
            <label className={labelCls}>Assign leads to</label>
            <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">Automatic (round robin)</option>
              {counsellors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Every lead from these ads goes to this counsellor only.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} />
          Skip course selection on WhatsApp
        </label>
        <div>
          <label className={labelCls}>First bot reply (optional — use {'{{name}}'} and {'{{course}}'})</label>
          <textarea rows={3} className={inputCls} value={greeting} onChange={e => setGreeting(e.target.value)} placeholder="Leave empty to use the default bot greeting" />
        </div>
      </Section>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      <button className={btnPrimary} disabled={busy} onClick={submit}>{busy ? 'Linking…' : `Link ${selected.length || ''} ad${selected.length === 1 ? '' : 's'}`}</button>
    </div>
  );
};

// ─── Detail modals ──────────────────────────────────────────────────────────

const MiniBars = ({ rows, field, money }: { rows: any[]; field: string; money?: (n: number) => string }) => {
  if (!rows.length) return <p className="text-xs text-slate-400">No data for this range.</p>;
  const max = Math.max(0.0001, ...rows.map(r => r[field] || 0));
  return (
    <div className="flex items-end gap-1 h-28">
      {rows.map((r, i) => (
        <div key={i} className="flex-1 min-w-[4px] bg-emerald-500/80 rounded-t" style={{ height: `${Math.max(2, (r[field] / max) * 100)}%` }}
          title={`${r.date}: ${money ? money(r[field]) : fmt(r[field])}`} />
      ))}
    </div>
  );
};

const InsightsModal = ({ row, currency, range, onClose }: { row: any; currency: string; range: string; onClose: () => void }) => {
  const money = useMemo(() => makeMoney(currency), [currency]);
  const [daily, setDaily] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState('age');
  const [bd, setBd] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { api('GET', `/campaigns/${row._id}/insights?datePreset=${range}`).then(d => setDaily(d.rows)).catch(e => setErr(e.message)); }, [row._id, range]);
  useEffect(() => { api('GET', `/campaigns/${row._id}/insights?datePreset=${range}&breakdown=${breakdown}`).then(d => setBd(d.rows)).catch(e => setErr(e.message)); }, [row._id, range, breakdown]);
  return (
    <Modal title={`${row.adName || row.name} — insights`} onClose={onClose} wide>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="grid sm:grid-cols-2 gap-6">
        <div><p className={labelCls}>Spend per day</p><MiniBars rows={daily} field="spend" money={money} /></div>
        <div><p className={labelCls}>Conversations started per day</p><MiniBars rows={daily} field="conversations" /></div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <p className={`${labelCls} !mb-0`}>Breakdown</p>
        <select className={`${inputCls} !w-auto`} value={breakdown} onChange={e => setBreakdown(e.target.value)}>
          {['age', 'gender', 'publisher_platform', 'platform_position', 'region', 'device_platform'].map(b => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
        </select>
      </div>
      <table className="w-full text-sm mt-3">
        <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="py-1">{breakdown.replace('_', ' ')}</th><th>Spend</th><th>Impr.</th><th>Clicks</th><th>Conv.</th><th>Cost/conv.</th></tr></thead>
        <tbody>
          {bd.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5">{r.breakdown}</td><td>{money(r.spend)}</td><td>{fmt(r.impressions)}</td><td>{fmt(r.clicks)}</td><td>{fmt(r.conversations)}</td><td>{r.conversations ? money(r.costPerConversation) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
};

const LeadsModal = ({ row, onClose }: { row: any; onClose: () => void }) => {
  const [leads, setLeads] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('GET', `/campaigns/${row._id}/leads`).then(d => setLeads(d.leads)).catch(e => setErr(e.message)); }, [row._id]);
  return (
    <Modal title={`Leads from "${row.name}"`} onClose={onClose} wide>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!leads && !err && <p className="text-sm text-slate-500">Loading…</p>}
      {leads && (leads.length === 0 ? <p className="text-sm text-slate-500">No leads yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="py-1">Name</th><th>Number</th><th>Course</th><th>Pipeline</th><th>Counsellor</th><th>Date</th></tr></thead>
          <tbody>{leads.map(l => (
            <tr key={l._id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5">{l.userName}</td><td>{l.userNumber}</td><td>{l.course}</td><td>{l.pipeline}</td><td>{l.assignedto || '-'}</td><td>{l.datecreated ? new Date(l.datecreated).toLocaleDateString('en-IN') : ''}</td>
            </tr>))}</tbody>
        </table>
      ))}
    </Modal>
  );
};

const PreviewModal = ({ row, onClose }: { row: any; onClose: () => void }) => {
  const [html, setHtml] = useState('');
  const [fmtSel, setFmtSel] = useState('MOBILE_FEED_STANDARD');
  const [err, setErr] = useState('');
  useEffect(() => { setHtml(''); api('GET', `/campaigns/${row._id}/preview?format=${fmtSel}`).then(d => setHtml(d.html)).catch(e => setErr(e.message)); }, [row._id, fmtSel]);
  return (
    <Modal title="Ad preview" onClose={onClose}>
      <select className={`${inputCls} !w-auto mb-3`} value={fmtSel} onChange={e => setFmtSel(e.target.value)}>
        <option value="MOBILE_FEED_STANDARD">Facebook feed</option><option value="INSTAGRAM_STANDARD">Instagram feed</option>
        <option value="INSTAGRAM_STORY">Instagram story</option><option value="FACEBOOK_STORY_MOBILE">Facebook story</option>
      </select>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: html }} />
    </Modal>
  );
};

const EditModal = ({ row, currency, onClose, onSaved }: { row: any; currency: string; onClose: () => void; onSaved: () => void }) => {
  const [name, setName] = useState(row.name);
  const [course, setCourse] = useState(row.course);
  const [greeting, setGreeting] = useState(row.greeting || '');
  const [skip, setSkip] = useState(row.skipCourseSelection !== false);
  const [assignedTo, setAssignedTo] = useState<string>(row.assignedTo || '');
  const [counsellors, setCounsellors] = useState<string[]>([]);
  useEffect(() => { api('GET', '/counsellors').then(d => setCounsellors(d.counsellors || [])).catch(() => {}); }, []);
  const [budget, setBudget] = useState(row.budget ? String(row.budget.amount) : '');
  const [endTime, setEndTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api('PATCH', `/campaigns/${row._id}`, {
        name, course, greeting, skipCourseSelection: skip, assignedTo,
        budget: Number(budget) > 0 && Number(budget) !== row.budget?.amount ? { type: row.budget?.type || 'DAILY', amount: Number(budget) } : undefined,
        schedule: endTime ? { endTime } : undefined,
      });
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Edit campaign" onClose={onClose}>
      <div className="space-y-3">
        <div><label className={labelCls}>Campaign name</label><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></div>
        <div>
          <label className={labelCls}>{row.linked ? 'Course' : 'Course (applies to all ads in this campaign)'}</label>
          <select className={inputCls} value={course} onChange={e => setCourse(e.target.value)}>
            {[...new Set([course, ...COURSES])].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Assign leads to counsellor</label>
          <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">Automatic (round robin)</option>
            {[...new Set([assignedTo, ...counsellors].filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>{row.budget?.type === 'LIFETIME' ? 'Lifetime' : 'Daily'} budget ({currency})</label><input type="number" className={inputCls} value={budget} onChange={e => setBudget(e.target.value)} /></div>
        <div><label className={labelCls}>New end date & time</label><input type="datetime-local" className={inputCls} value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} />Skip course selection on WhatsApp</label>
        <div><label className={labelCls}>First bot reply ({'{{name}}'}, {'{{course}}'})</label><textarea rows={3} className={inputCls} value={greeting} onChange={e => setGreeting(e.target.value)} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </Modal>
  );
};

const AddAdModal = ({ row, onClose, onSaved }: { row: any; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState<Form>({ ...emptyForm(), course: row.course });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<Form>) => setF(prev => ({ ...prev, ...p }));
  const save = async () => {
    setErr('');
    if (!f.adName.trim()) return setErr('Enter an ad name');
    if (!f.imageHash && !f.videoId) return setErr('Upload the ad image or video');
    if (f.videoId && !f.thumbnailHash) return setErr('Upload a thumbnail for the video');
    setBusy(true);
    try { const p = buildPayload(f); await api('POST', `/campaigns/${row._id}/ads`, { adName: f.adName, creative: p.creative }); onSaved(); onClose(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Add another ad to "${row.name}"`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Same course, audience and budget — useful for A/B testing creatives. Created paused.</p>
        <div><label className={labelCls}>Ad name *</label><input className={inputCls} value={f.adName} onChange={e => set({ adName: e.target.value })} /></div>
        <MediaUploader f={f} set={set} />
        <div><label className={labelCls}>Primary text</label><textarea rows={3} className={inputCls} value={f.primaryText} onChange={e => set({ primaryText: e.target.value })} /></div>
        <div><label className={labelCls}>Headline</label><input className={inputCls} value={f.headline} onChange={e => set({ headline: e.target.value })} /></div>
        <div><label className={labelCls}>Pre-filled message</label><input className={inputCls} value={f.prefill} onChange={e => set({ prefill: e.target.value })} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Creating…' : 'Add ad'}</button>
      </div>
    </Modal>
  );
};

// ─── Main view ──────────────────────────────────────────────────────────────

const DATE_PRESETS: [string, string][] = [['today', 'Today'], ['yesterday', 'Yesterday'], ['last_7d', 'Last 7 days'], ['last_14d', 'Last 14 days'], ['last_30d', 'Last 30 days'], ['this_month', 'This month'], ['last_month', 'Last month'], ['maximum', 'Lifetime']];

const CtwaAdsView: React.FC = () => {
  const [tab, setTab] = useState<'campaigns' | 'create' | 'link'>('campaigns');
  const [config, setConfig] = useState<any>(null);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState('last_7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ kind: 'insights' | 'leads' | 'preview' | 'edit' | 'add'; row: any } | null>(null);
  const [busyId, setBusyId] = useState('');
  const loadedConfig = useRef(false);

  const money = useMemo(() => makeMoney(data?.currency || config?.account?.currency || 'INR'), [data, config]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api('GET', `/campaigns?datePreset=${range}`)); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [range]);

  useEffect(() => {
    if (loadedConfig.current) return;
    loadedConfig.current = true;
    api('GET', '/config').then(c => {
      setConfig(c);
      if (c.configured) api('GET', '/audiences').then(a => setAudiences(a.audiences || [])).catch(() => {});
    }).catch(e => setError(e.message));
  }, []);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const toggleStatus = async (row: any) => {
    const next = row.effectiveStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    if (next === 'ACTIVE' && !window.confirm('Resume this campaign? It will start spending budget.')) return;
    setBusyId(row._id);
    try { await api('PATCH', `/campaigns/${row._id}/status`, { status: next }); await loadCampaigns(); }
    catch (e: any) { alert(e.message); } finally { setBusyId(''); }
  };
  const archive = async (row: any) => {
    const msg = row.linked
      ? `Unlink "${row.adName || row.name}" from the CRM? The ad keeps running on Meta, but its leads will no longer skip course selection or go to a fixed counsellor.`
      : `Archive "${row.name}"? Delivery stops. Existing leads keep their attribution.`;
    if (!window.confirm(msg)) return;
    setBusyId(row._id);
    try { await api('DELETE', `/campaigns/${row._id}`); await loadCampaigns(); }
    catch (e: any) { alert(e.message); } finally { setBusyId(''); }
  };

  const t = data?.totals;
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Meta Ads Manager</h2>
          <p className="text-xs text-slate-500">Create and manage Meta Click-to-WhatsApp ads per course. Leads skip course selection and chat straight away.</p>
        </div>
        <div className="flex gap-2">
          {(['campaigns', 'link', 'create'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === k ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {k === 'campaigns' ? 'Campaigns' : k === 'link' ? 'Link running ad' : '+ Create ad'}
            </button>
          ))}
        </div>
      </div>

      {config && !config.configured && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4">
          Meta isn't fully configured. Add to the CRM backend <code>.env</code>: <b>{config.missing.join(', ')}</b>
          {' '}(token needs <i>ads_management, ads_read, pages_show_list</i>), then restart the server.
        </div>
      )}
      {config?.accountError && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-4">Meta account error: {config.accountError}</div>}
      {config?.account && (
        <p className="text-xs text-slate-500">Ad account: <b>{config.account.name}</b> · {config.account.currency} · {config.account.timezone}</p>
      )}

      {tab === 'create' && config?.configured && <CreateForm config={config} audiences={audiences} onCreated={() => { setTab('campaigns'); loadCampaigns(); }} />}

      {tab === 'link' && config?.configured && <LinkExistingForm onLinked={() => { setTab('campaigns'); loadCampaigns(); }} />}

      {tab === 'campaigns' && (
        <>
          <div className="flex items-center gap-3">
            <select className={`${inputCls} !w-auto`} value={range} onChange={e => setRange(e.target.value)}>
              {DATE_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className={btnGhost} onClick={loadCampaigns} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          </div>
          {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
          {data?.warning && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">Live Meta data unavailable: {data.warning}</div>}

          {t && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Stat label="Spend" value={money(t.spend)} tone="bg-emerald-50 text-emerald-800" />
              <Stat label="Reach" value={fmt(t.reach)} tone="bg-blue-50 text-blue-800" />
              <Stat label="Clicks" value={fmt(t.clicks)} tone="bg-indigo-50 text-indigo-800" />
              <Stat label="Conversations" value={fmt(t.conversations)} tone="bg-green-50 text-green-800" />
              <Stat label="Cost / conv." value={t.conversations ? money(t.spend / t.conversations) : '-'} tone="bg-amber-50 text-amber-800" />
              <Stat label="CRM leads" value={fmt(t.leads)} tone="bg-purple-50 text-purple-800" />
              <Stat label="Enrolled" value={`${fmt(t.enrolled)}${t.enrolled ? ` · ${money(t.spend / t.enrolled)}` : ''}`} tone="bg-rose-50 text-rose-800" />
            </div>
          )}

          <div className={`${cardCls} !p-0 overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                  {['Campaign / ad', 'Course', 'Status', 'Budget', 'Spend', 'Reach', 'Conv.', 'Cost/conv.', 'CRM leads', 'Enrolled', 'Cost/lead', 'Actions'].map(h => <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((r: any) => (
                  <tr key={r._id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                    <td className="px-3 py-3 min-w-[180px]"><p className="font-bold text-slate-800 dark:text-slate-100">{r.name}</p><p className="text-xs text-slate-500">{r.adName}</p><p className="text-[10px] text-slate-400">{OBJECTIVE_LABELS[r.objective] || r.objective} · ad {r.metaAdId}</p></td>
                    <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold whitespace-nowrap">{r.course}</span>{r.linked && <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">LINKED</span>}<p className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">{r.assignedTo ? `→ ${r.assignedTo}` : 'Round robin'}</p></td>
                    <td className="px-3 py-3"><Badge status={r.effectiveStatus} /></td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.budget ? `${money(r.budget.amount)} ${r.budget.type === 'DAILY' ? '/day' : 'total'}` : '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{money(r.insights.spend)}</td>
                    <td className="px-3 py-3">{fmt(r.insights.reach)}</td>
                    <td className="px-3 py-3 font-bold">{fmt(r.insights.conversations)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.insights.conversations ? money(r.insights.costPerConversation) : '-'}</td>
                    <td className="px-3 py-3 font-bold">{fmt(r.crm.leads)}</td>
                    <td className="px-3 py-3">{fmt(r.crm.enrolled)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.crm.leads ? money(r.crm.costPerLead) : '-'}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5 min-w-[220px]">
                        {['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'].includes(r.effectiveStatus) && (
                          <button className={btnGhost} disabled={busyId === r._id} onClick={() => toggleStatus(r)}>{r.effectiveStatus === 'ACTIVE' ? 'Pause' : 'Resume'}</button>
                        )}
                        <button className={btnGhost} onClick={() => setModal({ kind: 'insights', row: r })}>Insights</button>
                        <button className={btnGhost} onClick={() => setModal({ kind: 'leads', row: r })}>Leads</button>
                        <button className={btnGhost} onClick={() => setModal({ kind: 'preview', row: r })}>Preview</button>
                        <button className={btnGhost} onClick={() => setModal({ kind: 'edit', row: r })}>Edit</button>
                        <button className={btnGhost} onClick={() => setModal({ kind: 'add', row: r })}>+ Ad</button>
                        <button className={`${btnGhost} !text-red-600`} disabled={busyId === r._id} onClick={() => archive(r)}>{r.linked ? 'Unlink' : 'Archive'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data && data.rows.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-500">No CTWA ads yet. Click “+ Create ad” to raise your first one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal?.kind === 'insights' && <InsightsModal row={modal.row} currency={data?.currency || 'INR'} range={range} onClose={() => setModal(null)} />}
      {modal?.kind === 'leads' && <LeadsModal row={modal.row} onClose={() => setModal(null)} />}
      {modal?.kind === 'preview' && <PreviewModal row={modal.row} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <EditModal row={modal.row} currency={data?.currency || 'INR'} onClose={() => setModal(null)} onSaved={loadCampaigns} />}
      {modal?.kind === 'add' && <AddAdModal row={modal.row} onClose={() => setModal(null)} onSaved={loadCampaigns} />}
    </div>
  );
};

export default CtwaAdsView;
