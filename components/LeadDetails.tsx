import React, { useState, useEffect, useRef } from 'react';
import { Lead, User } from '../types';
import { Icons } from './Icons';
import { apiService } from '../services/api';

interface LeadDetailsProps {
  lead: Lead;
  users: User[];
  currentUserRole?: string;
  onUpdate: (updatedLead: Lead) => void;
  onDelete: (id: string) => void;
  onEdit: (lead: Lead) => void;
  onClose: () => void;
}

const LeadDetails: React.FC<LeadDetailsProps> = ({ lead, users, currentUserRole, onUpdate, onDelete, onEdit, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'remarks' | 'campaign' | 'analysis'>('info');
  const [activeStrategy, setActiveStrategy] = useState<'A' | 'B'>('A');
  const [loading, setLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const summarizeTriedRef = useRef<Set<string>>(new Set());
  const leadRef = useRef(lead);
  leadRef.current = lead;
  const isAdmin = currentUserRole === 'admin';

  useEffect(() => {
    if (activeTab !== 'remarks') return;
    const id = lead._id;
    if (!id) return;
    if (lead.aiConversationSummary?.text) return;
    if (!lead.conversations || lead.conversations.length === 0) return;
    if (summarizeTriedRef.current.has(id)) return;
    summarizeTriedRef.current.add(id);

    let cancelled = false;
    (async () => {
      try {
        setSummarizing(true);
        const res = await apiService.summarizeLeadConversation(id);
        if (!cancelled && res?.lead?.aiConversationSummary && leadRef.current._id === id) {
          onUpdate({ ...leadRef.current, aiConversationSummary: res.lead.aiConversationSummary });
        }
      } catch (err) {
        console.error('Conversation summary failed:', err);
      } finally {
        if (!cancelled) setSummarizing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab, lead._id, lead.aiConversationSummary?.text]);

  const parseMongoDate = (date: any): string => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    if (date.$date) return date.$date;
    return '';
  };

  const handleAssign = async (username: string) => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const updated = await apiService.updateLead({ _id: lead._id, assignedto: username });
      onUpdate(updated);
    } catch (err) { alert('Assignment failed'); } finally { setLoading(false); }
  };

  const formatReminderForInput = (date: any): string => {
    const parsed = parseMongoDate(date);
    if (!parsed) return '';
    const d = new Date(parsed);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleReminderChange = async (date: string) => {
    try {
      setLoading(true);
      const updated = await apiService.updateLead({ _id: lead._id, reminder: date || null });
      onUpdate(updated);
    } catch (err) { alert('Reminder update failed'); } finally { setLoading(false); }
  };

  const handleAddRemark = async () => {
    if (!newRemark.trim()) return;
    try {
      setLoading(true);
      const updated = await apiService.addRemark(lead._id, newRemark);
      onUpdate(updated);
      setNewRemark('');
    } catch (err) { alert('Failed to add remark'); } finally { setLoading(false); }
  };

  
  const handleSendToMeta = async () => {
    try {
      setLoading(true);
      const result = await apiService.sendLeadToMeta(lead._id);
      if (result.lead) onUpdate(result.lead);
      alert(result.message || (result.success ? 'Sent to Meta.' : 'Failed to send to Meta.'));
    } catch (err) { alert('Failed to send to Meta'); } finally { setLoading(false); }
  };

  const handleDeleteRemark = async (remarkId: string) => {
    try {
      setLoading(true);
      const updated = await apiService.deleteRemark(lead._id, remarkId);
      onUpdate(updated);
    } catch (err) { alert('Failed to delete remark'); } finally { setLoading(false); }
  };

  const formatDate = (date: any) => {
    const d = parseMongoDate(date);
    if (!d) return 'N/A';
    return new Date(d).toLocaleString();
  };

  const toDateObject = (date: any): Date | null => {
    const parsed = parseMongoDate(date);
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

  const chatTimeline = (() => {
    const sorted = [...(lead.conversations || [])].sort((a, b) => {
      const aTime = toDateObject(a.timestamp)?.getTime() || 0;
      const bTime = toDateObject(b.timestamp)?.getTime() || 0;
      return aTime - bTime;
    });

    const grouped: { dayKey: string; dayLabel: string; items: typeof sorted }[] = [];
    sorted.forEach((conversation) => {
      const conversationDate = toDateObject(conversation.timestamp);
      const dayKey = conversationDate
        ? `${conversationDate.getFullYear()}-${conversationDate.getMonth()}-${conversationDate.getDate()}`
        : 'unknown';
      const dayLabel = conversationDate ? formatChatDayLabel(conversationDate) : 'Unknown Date';

      const existingGroup = grouped.find(group => group.dayKey === dayKey);
      if (existingGroup) {
        existingGroup.items.push(conversation);
      } else {
        grouped.push({ dayKey, dayLabel, items: [conversation] });
      }
    });

    return grouped;
  })();

  const handleGenerateAnalysis = async () => {
    try {
      setLoading(true);
      const result = await apiService.analyzeLead(lead._id);
      if (result.success && result.analysis) {
        onUpdate({ ...lead, aiAnalysis: result.analysis });
      }
    } catch (err) {
      alert('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const renderAnalysisContent = () => {
    if (!lead.aiAnalysis || (!lead.aiAnalysis.solutionA && !lead.aiAnalysis.solutionB)) {
      return (
        <div className="text-center py-12 px-6">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-400 dark:text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-900/40">
            <Icons.Settings className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Dual-Strategy Insight</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Analyze this lead to generate a <b className="dark:text-slate-200">Soft Re-Engagement</b> strategy and a <b className="dark:text-slate-200">Career Push</b> strategy.</p>
          <button
            onClick={handleGenerateAnalysis}
            disabled={loading}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-indigo-900/20 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing Profiles...' : 'Generate AI Strategies'}
          </button>
        </div>
      );
    }

    const current = activeStrategy === 'A' ? lead.aiAnalysis.solutionA : lead.aiAnalysis.solutionB;
    if (!current) return null;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveStrategy('A')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeStrategy === 'A' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            Solution A: Soft
          </button>
          <button 
            onClick={() => setActiveStrategy('B')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeStrategy === 'B' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            Solution B: Push
          </button>
        </div>

        <div className="space-y-5">
          <div className="bg-gradient-to-br from-white to-indigo-50/30 p-4 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-tighter">{current.title}</h4>
              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${parseInt(current.probability) > 60 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {current.probability || 'N/A'} PROBABILITY
              </span>
            </div>
            <p className="text-xs text-indigo-800 font-medium leading-relaxed italic">
              " {current.why || 'No details provided'} "
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>Behaviour & Psychology
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium">
                {current.psychology || 'No details provided'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div> Market Trend Injection
              </label>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-800 font-medium">
                {current.marketTrend || 'No details provided'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div> ROI & Placement Framing
              </label>
              <div className="p-3 bg-green-50/50 rounded-xl border border-green-100 text-xs text-green-800 font-medium">
                {current.roi || 'No details provided'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                <Icons.Chat className="w-3 h-3" /> WhatsApp Template
              </label>
              <div className="relative group">
                <div className="p-4 bg-white rounded-xl border-2 border-indigo-100 text-xs text-slate-800 font-semibold italic whitespace-pre-line leading-relaxed">
                  {current.whatsapp || 'No details provided'}
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(current.whatsapp);
                    alert('Template copied to clipboard!');
                  }}
                  className="absolute bottom-2 right-2 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100 shadow-sm border border-indigo-200"
                >
                  <Icons.Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-indigo-600 rounded-2xl shadow-md shadow-indigo-900/20 dark:shadow-none">
              <label className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1 block">Recommended Next Action</label>
              <p className="text-sm text-white font-bold flex items-center gap-2">
                <Icons.Check className="w-4 h-4 bg-white/20 rounded p-0.5" />
                {current.nextAction || 'No details provided'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const latestRemark = lead.remarks && lead.remarks.length > 0 ? [...lead.remarks].reverse()[0] : null;

  return (
    <div className="flex flex-col h-full max-h-full min-w-0 w-full bg-white border border-slate-200/90 rounded-[28px] shadow-xl overflow-hidden text-left animate-in slide-in-from-right duration-300">
      
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shadow-sm shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base uppercase shadow-md flex-shrink-0">
            {lead.userName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-slate-900 text-sm truncate">{lead.userName}</h2>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>{lead.userNumber}</span>
              <span
                role="button"
                title="Open in WhatsApp"
                onClick={(e) => { e.stopPropagation(); const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                className="text-green-500 hover:text-green-600 cursor-pointer"
              >
                <Icons.WhatsApp className="w-3.5 h-3.5" />
              </span>
            </p>
          </div>
        </div>

        {/* Staff Dropdown & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            disabled={!isAdmin}
            value={lead.assignedto || ''}
            onChange={e => handleAssign(e.target.value)}
            className="max-w-[110px] sm:max-w-[130px] min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
          </select>

          {isAdmin && (
            <button onClick={() => onDelete(lead._id)} className="p-2 shrink-0 hover:bg-red-50 rounded-xl text-red-500 transition-colors border border-slate-200 shadow-sm" title="Delete">
              <Icons.Trash className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onEdit(lead)} className="p-2 shrink-0 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors border border-slate-200 shadow-sm" title="Edit">
            <Icons.Edit className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 shrink-0 hover:bg-red-50 rounded-xl text-red-500 bg-white transition-colors border border-red-200 shadow-sm" title="Close student details" aria-label="Close student details">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="mx-4 mt-3.5 grid grid-cols-5 gap-1.5 rounded-xl bg-slate-50 p-1 border border-slate-200/80 shrink-0">
        {([
          { id: 'info', label: 'Information' },
          { id: 'chat', label: 'History' },
          { id: 'remarks', label: 'Remarks' },
          { id: 'campaign', label: 'Campaign' },
          { id: 'analysis', label: 'AI Strategy' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-w-0 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 truncate ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-blue-700'
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content with overflow-y-auto and pb-20 to ensure reminder picker dropdown is fully scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 pb-20 space-y-4 custom-scrollbar">
        {activeTab === 'info' && (
          <div className="space-y-3.5 text-xs">
            
            {/* Name */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Name :</span>
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold">
                {lead.userName}
              </div>
            </div>

            {/* Contact Number */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Contact Number :</span>
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold flex items-center justify-between">
                <span>{lead.userNumber}</span>
                <span
                  role="button"
                  onClick={() => { const num = (lead.userNumber || '').replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener'); }}
                  className="text-green-500 cursor-pointer"
                >
                  <Icons.WhatsApp className="w-4 h-4" />
                </span>
              </div>
            </div>

            {/* Course Of Interest */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Course Of Interest :</span>
              <div className="flex-1 flex gap-2">
                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold truncate">
                  {lead.course || 'General Enquiry'}
                </div>
                {lead.programType && (
                  <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-semibold shrink-0">
                    {lead.programType}
                  </div>
                )}
              </div>
            </div>

            {/* Source */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Source :</span>
              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 font-semibold">
                  <Icons.Phone className="w-3.5 h-3.5" /> {lead.leadfrom || 'Calls'}
                </span>
              </div>
            </div>

            {/* Pipeline */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Pipeline :</span>
              <div className="flex-1">
                <span className="inline-block px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold">
                  {lead.status || lead.pipeline || 'Warm'}
                </span>
              </div>
            </div>

            {/* Next Follow up (Fully scrollable & accessible calendar/time picker) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Next Follow up :</span>
              <div className="flex-1">
                <input
                  type="datetime-local"
                  value={formatReminderForInput(lead.reminder)}
                  onChange={(e) => handleReminderChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* History */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">History :</span>
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold flex items-center justify-between">
                <span className="truncate">Created on {formatDate(lead.datecreated)}</span>
                <Icons.MoreHorizontal className="w-4 h-4 text-blue-500 shrink-0 cursor-pointer" />
              </div>
            </div>

            {/* Remarks */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Remarks :</span>
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-medium truncate">
                {latestRemark ? latestRemark.remark : 'N/A'}
              </div>
            </div>

            {/* Campaigns */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-500 w-36">Campaigns :</span>
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-medium truncate">
                {lead.campaignHistory && lead.campaignHistory.length > 0 ? lead.campaignHistory[lead.campaignHistory.length - 1].campaignName : 'N/A'}
              </div>
            </div>

            {/* AI Strategy */}
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold text-slate-500 w-36">AI Strategy :</span>
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-medium truncate">
                {lead.aiAnalysis?.solutionA?.title || 'N/A'}
              </div>
            </div>


            {(lead.pipeline === 'Pre-Enrollment' || lead.pipeline === 'Enrolled') && (
              <div className="pt-2">
                <button
                  onClick={handleSendToMeta}
                  disabled={loading || !lead.leadgenId}
                  title={!lead.leadgenId ? 'This lead has no Meta lead ID' : undefined}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  <Icons.Send className="w-3.5 h-3.5" />
                  {lead.pipeline === 'Enrolled' ? 'Send Converted Lead to Meta' : 'Send Qualified Lead to Meta'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="space-y-4 pb-4">
            {lead.conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 italic text-xs">
                <Icons.Chat className="w-10 h-10 mb-2 opacity-10" />
                <p>No conversation history found</p>
              </div>
            ) : (
              chatTimeline.map((group) => (
                <div key={group.dayKey} className="space-y-3">
                  <div className="flex justify-center sticky top-0 z-10 py-1">
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 uppercase tracking-wide shadow-sm">
                      {group.dayLabel}
                    </span>
                  </div>
                  {group.items.map((c, i) => {
                    const msgDate = toDateObject(c.timestamp);
                    const timeLabel = formatChatTime(msgDate);
                    return (
                      <div key={`${group.dayKey}-${i}`} className="space-y-2">
                        {c.userMsg && (
                          <div className="flex flex-col items-end">
                            <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none text-xs max-w-[90%] shadow-sm leading-relaxed">
                              {c.userMsg}
                              {timeLabel && <div className="text-[9px] text-blue-100 mt-1 text-right">{timeLabel}</div>}
                            </div>
                          </div>
                        )}
                        {c.botReply && (
                          <div className="flex flex-col items-start">
                            <div className="bg-slate-100 text-slate-700 p-3 rounded-2xl rounded-tl-none text-xs max-w-[90%] border border-slate-200 shadow-sm leading-relaxed">
                              {c.botReply.split('\n').map((l, j) => <p key={j} className="mb-1 last:mb-0">{l}</p>)}
                              {timeLabel && <div className="text-[9px] text-slate-400 mt-1 text-right">{timeLabel}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'remarks' && (
          <div className="space-y-4 pb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New remark..."
                value={newRemark}
                onChange={e => setNewRemark(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddRemark}
                disabled={!newRemark.trim() || loading}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Icons.Plus className="w-5 h-5" />
              </button>
            </div>

            {(summarizing || lead.aiConversationSummary?.text) && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icons.Bot className="w-4 h-4 text-indigo-600" />
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">AI Conversation Summary</p>
                </div>
                {summarizing && !lead.aiConversationSummary?.text ? (
                  <p className="text-xs text-indigo-500 italic animate-pulse">Summarizing WhatsApp conversation…</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{lead.aiConversationSummary?.text}</p>
                    {lead.aiConversationSummary?.generatedAt && (
                      <p className="text-[9px] text-slate-400 mt-1.5 font-bold">
                        Generated {formatDate(lead.aiConversationSummary.generatedAt)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              {lead.remarks.length === 0 ? (
                <p className="text-center text-slate-400 text-xs italic py-10">No remarks yet</p>
              ) : (
                [...lead.remarks].reverse().map(r => (
                  <div key={r._id} className="group p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between gap-3 items-start transition-all hover:border-blue-200">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-700 leading-normal">{r.remark}</p>
                      <p className="text-[9px] text-slate-400 mt-1 font-bold">{formatDate(r.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteRemark(r._id)}
                      className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'campaign' && (
          <div className="space-y-3 pb-4">
            <h3 className="text-sm font-bold text-slate-800">Campaign History</h3>
            {lead.campaignHistory && lead.campaignHistory.length > 0 ? (
              [...lead.campaignHistory].reverse().map((campaign: any, index: number) => (
                <div
                  key={campaign._id || `${campaign.campaignName || 'campaign'}-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-xs font-bold text-slate-800">{campaign.campaignName || 'Campaign'}</p>
                  {(campaign.timestamp || campaign.date || campaign.createdAt) && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {formatDate(campaign.timestamp || campaign.date || campaign.createdAt)}
                    </p>
                  )}
                  {campaign.status && <p className="mt-1 text-xs text-slate-600">Status: {campaign.status}</p>}
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-xs italic text-slate-400">No campaign history found</p>
            )}
          </div>
        )}

        {activeTab === 'analysis' && renderAnalysisContent()}
      </div>

    </div>
  );
};

export default LeadDetails;