import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { WaAccountInfo, WaPhoneNumber } from '../../types';
import { Icons } from '../Icons';

export const PhoneNumbersTab: React.FC = () => {
  const [account, setAccount] = useState<WaAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = async () => {
    try {
      setError(null);
      const res = await apiService.fetchWhatsAppAccount();
      setAccount(res.account);
    } catch (err: any) {
      console.error('Failed to load WhatsApp account:', err);
      setError(err.message || 'Failed to fetch WhatsApp account data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAccount();
  };

  const getQualityBadge = (rating: string) => {
    const r = (rating || '').toUpperCase();
    if (r === 'GREEN') {
      return {
        label: 'High Quality',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      };
    }
    if (r === 'YELLOW') {
      return {
        label: 'Medium Quality',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    }
    if (r === 'RED') {
      return {
        label: 'Low Quality',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500',
      };
    }
    return {
      label: 'Unknown',
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    };
  };

  const formatTier = (tier: string) => {
    switch (tier) {
      case 'TIER_250':
        return 'Tier 250 (250 msgs / 24h)';
      case 'TIER_1K':
        return 'Tier 1K (1,000 msgs / 24h)';
      case 'TIER_10K':
        return 'Tier 10K (10,000 msgs / 24h)';
      case 'TIER_100K':
        return 'Tier 100K (100,000 msgs / 24h)';
      case 'TIER_UNLIMITED':
        return 'Tier Unlimited';
      default:
        return tier || 'Standard Tier';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Phone Numbers & Account Health
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Meta Cloud API
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time quality ratings, messaging tier limits, and phone number verification statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          <Icons.RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh from Meta'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-center gap-2.5">
          <Icons.AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Icons.RefreshCcw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Fetching WhatsApp phone numbers from Meta...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Business Account</div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                {account?.name || 'WhatsApp Business'}
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate">WABA ID: {account?.id}</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Currency & Timezone</div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {account?.currency || 'USD'}
              </div>
              <div className="text-[11px] text-slate-400">Timezone ID: {account?.timezoneId || 'UTC'}</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Template Namespace</div>
              <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                {account?.namespace || 'Default'}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold">Active Meta Verification</div>
            </div>
          </div>

          {/* Registered Phone Numbers List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Registered Numbers ({account?.phoneNumbers?.length || 0})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phone numbers authorized to send WhatsApp templates and interactive messages
                </p>
              </div>
            </div>

            {(account?.phoneNumbers || []).length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <Icons.Phone className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Phone Numbers Found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Ensure your Meta WhatsApp Business Account has at least one registered phone number in Meta Business Manager.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {account?.phoneNumbers.map((num: WaPhoneNumber) => {
                  const quality = getQualityBadge(num.quality_rating);
                  return (
                    <div key={num.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Number & Verified Name */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                              {num.display_phone_number}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              {num.status || 'CONNECTED'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Verified Name:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {num.verified_name || 'Business Account'}
                            </span>
                            {num.name_status && (
                              <span className="text-[10px] text-slate-400 font-mono">({num.name_status})</span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">Phone ID: {num.id}</div>
                        </div>

                        {/* Health & Tiers */}
                        <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2">
                          {/* Quality Rating */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Quality Rating:</span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${quality.bg} ${quality.text} ${quality.border}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${quality.dot}`} />
                              {quality.label}
                            </span>
                          </div>

                          {/* Messaging Limit Tier */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Daily Limit:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatTier(num.messaging_limit_tier)}
                            </span>
                          </div>

                          {/* Throughput */}
                          {num.throughput?.level && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>Throughput:</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                {num.throughput.level}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
