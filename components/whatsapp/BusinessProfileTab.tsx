import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { WaBusinessProfile } from '../../types';
import { Icons } from '../Icons';

const VERTICAL_OPTIONS = [
  { value: 'EDUCATION', label: 'Education' },
  { value: 'PROF_SERVICES', label: 'Professional Services' },
  { value: 'TECH', label: 'Technology / Software' },
  { value: 'FINANCE', label: 'Finance & Banking' },
  { value: 'RETAIL', label: 'Retail & Shopping' },
  { value: 'HEALTH', label: 'Healthcare & Medical' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'NON_PROFIT', label: 'Non-profit' },
  { value: 'OTHER', label: 'Other' },
];

export const BusinessProfileTab: React.FC = () => {
  const [profile, setProfile] = useState<WaBusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [about, setAbout] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [vertical, setVertical] = useState('EDUCATION');
  const [website1, setWebsite1] = useState('');
  const [website2, setWebsite2] = useState('');

  const fetchProfile = async () => {
    try {
      setError(null);
      const res = await apiService.fetchWhatsAppBusinessProfile();
      const p = res.profile || {};
      setProfile(p);
      setAbout(p.about || '');
      setDescription(p.description || '');
      setAddress(p.address || '');
      setEmail(p.email || '');
      setVertical(p.vertical || 'EDUCATION');
      const sites = p.websites || [];
      setWebsite1(sites[0] || '');
      setWebsite2(sites[1] || '');
    } catch (err: any) {
      console.error('Failed to load WhatsApp business profile:', err);
      setError(err.message || 'Failed to fetch WhatsApp profile from Meta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const websites = [website1.trim(), website2.trim()].filter(Boolean);

      const res = await apiService.updateWhatsAppBusinessProfile({
        about: about.trim(),
        description: description.trim(),
        address: address.trim(),
        email: email.trim(),
        vertical,
        websites,
      });

      setSuccess(res.message || 'WhatsApp business profile updated successfully on Meta!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error('Failed to update business profile:', err);
      setError(err.message || 'Failed to save business profile to Meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            WhatsApp Business Profile
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Public Customer Profile
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how your educational institute appears to students in the WhatsApp app.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchProfile}
          disabled={loading || saving}
          className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <Icons.RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5">
          <Icons.CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-center gap-2.5">
          <Icons.AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Icons.RefreshCcw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Fetching business profile from Meta Cloud API...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form */}
          <form onSubmit={handleSave} className="lg:col-span-7 space-y-5">
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Profile Details
              </h3>

              {/* About / Status */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    About / Status (max 139 chars)
                  </label>
                  <span className="text-[11px] text-slate-400">{about.length}/139</span>
                </div>
                <input
                  type="text"
                  maxLength={139}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="e.g. Leading IT & Software Training Institute"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Business Description (max 512 chars)
                  </label>
                  <span className="text-[11px] text-slate-400">{description.length}/512</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={512}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your academy, available courses, admissions support, and timings..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* Address */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Physical Address (max 256 chars)
                  </label>
                  <span className="text-[11px] text-slate-400">{address.length}/256</span>
                </div>
                <input
                  type="text"
                  maxLength={256}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Campus address, street, city, pin code"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email & Industry Vertical */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    maxLength={128}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admissions@yourschool.com"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Industry Category
                  </label>
                  <select
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VERTICAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Websites */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Websites (up to 2 links)
                </label>
                <input
                  type="url"
                  value={website1}
                  onChange={(e) => setWebsite1(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="url"
                  value={website2}
                  onChange={(e) => setWebsite2(e.target.value)}
                  placeholder="https://courses.yourwebsite.com"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Icons.RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>Saving to Meta...</span>
                </>
              ) : (
                <>
                  <Icons.CheckCircle className="w-4 h-4" />
                  <span>Save Changes to Meta</span>
                </>
              )}
            </button>
          </form>

          {/* Right Column: WhatsApp Customer Profile Mockup */}
          <div className="lg:col-span-5 sticky top-6">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              WhatsApp App Preview
            </div>

            <div className="w-[300px] sm:w-[320px] mx-auto rounded-[38px] p-3.5 bg-slate-900 text-white shadow-2xl border-4 border-slate-800">
              <div className="rounded-[28px] overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
                {/* Header Profile Photo Banner */}
                <div className="bg-[#075E54] p-5 text-white text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-white/20 mx-auto flex items-center justify-center text-2xl font-black border-2 border-white/50 overflow-hidden shadow-inner">
                    {profile?.profile_picture_url ? (
                      <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Icons.WhatsApp className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold flex items-center justify-center gap-1">
                      Business Account
                      <span className="text-emerald-400 text-xs">✓</span>
                    </div>
                    <div className="text-[10px] text-white/80 uppercase tracking-wider">
                      {VERTICAL_OPTIONS.find(v => v.value === vertical)?.label || 'Education'}
                    </div>
                  </div>
                </div>

                {/* Profile Information List */}
                <div className="p-4 space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                  {/* About */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">About</span>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{about || 'No status set'}</p>
                  </div>

                  {/* Description */}
                  {description && (
                    <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Description</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-snug">{description}</p>
                    </div>
                  )}

                  {/* Address */}
                  {address && (
                    <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Address</span>
                      <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Icons.MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>{address}</span>
                      </p>
                    </div>
                  )}

                  {/* Email */}
                  {email && (
                    <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Email</span>
                      <p className="text-blue-600 dark:text-blue-400">{email}</p>
                    </div>
                  )}

                  {/* Websites */}
                  {(website1 || website2) && (
                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Websites</span>
                      {website1 && <p className="text-blue-600 dark:text-blue-400 truncate">{website1}</p>}
                      {website2 && <p className="text-blue-600 dark:text-blue-400 truncate">{website2}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
