import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { apiService } from '../services/api';

// ── Local Safe SVG Icons to prevent missing icon export crashes ──
const SvgIcons = {
  UsersGroup: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="M2.5 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="16.5" cy="6" r="3" />
      <path d="M14.5 13.5c1.8-.7 3.7-.4 5 1.5 1 1.4 1.5 2.8 1.5 4" />
    </svg>
  ),
  BadgeCheckRibbon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m9.5 9 1.8 1.8 3.5-3.5" />
      <path d="m7.5 13.5-1 7.5 5.5-2.5 5.5 2.5-1-7.5" />
    </svg>
  ),
  Stopwatch: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M9.5 2h5" />
      <path d="M12 2v4" />
      <path d="M17.5 5.5l1.8-1.8" />
      <path d="M12 9.5v4" />
    </svg>
  ),
  UserMinus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="7.5" r="3.5" />
      <path d="M2.5 19.5c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <path d="M15.5 12.5h6" />
    </svg>
  ),
  AnalyticsTrendBars: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 13.5l4.5-4.5 4.5 4.5 8.5-8.5" />
      <path d="M16 5h4.5v4.5" />
      <path d="M5 17v4" />
      <path d="M9 14v7" />
      <path d="M13 16v5" />
      <path d="M17 12v9" />
      <path d="M21 9v12" />
    </svg>
  ),

  GraduationCap: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
  ),
  Bot: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h0M16 16h0"/></svg>
  ),
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  Send: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  ),
  RefreshCcw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
  ),
  User: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12"/></svg>
  ),
  X: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  ChevronLeft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="15 18 9 12 15 6"/></svg>
  ),
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="9 18 15 12 9 6"/></svg>
  ),
  Users: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 21v-2a4 4 0 0 1 3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><circle cx="19" cy="11" r="2"/></svg>
  ),
  BarChart: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
  ),
  Monitor: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  )
};

// ── Types (local) ──
interface TrainingQuestion {
  text: string;
  answer?: string;
  score?: number | null;
  feedback?: string;
}
interface TrainingSession {
  _id: string;
  userNumber: string;
  username: string;
  topic: string;
  script: string;
  questions: TrainingQuestion[];
  status: 'in_progress' | 'completed';
  totalScore: number | null;
  startedAt: string;
  completedAt?: string | null;
}
interface DateSummary {
  date: string;
  total: number;
  completed: number;
  inProgress: number;
  avgScore: number | null;
}
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const fmtDate = (d: string): string => {
  const parsed = new Date(`${d}T00:00:00`);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });
};

const fmtTime = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
};

const SessionCard: React.FC<{ session: TrainingSession; showCounsellor: boolean; expanded: boolean; onToggle: () => void }> = ({ session, showCounsellor, expanded, onToggle }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs hover:border-blue-200 dark:hover:border-blue-800 transition-all overflow-hidden p-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {showCounsellor && (
          <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-transparent dark:border-pink-800/40 font-extrabold flex items-center justify-center text-sm flex-shrink-0">
            {(session.username || session.userNumber || 'C').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {showCounsellor && (
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{session.username || session.userNumber}</h3>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate max-w-md">{session.topic}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          {session.questions?.filter(q => !q.answer).length || 0} InProgress
        </span>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
          {session.questions?.filter(q => q.answer).length || 0} Completed
        </span>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
          {session.totalScore !== null ? `${session.totalScore}/5` : '0/5'} Average
        </span>
      </div>
    </div>

    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
      <div className="flex items-center gap-3 flex-wrap">
        <span>• {session.questions?.length || 0} Questions</span>
        {session.startedAt && <span>• Sent at {fmtTime(session.startedAt)}</span>}
        {session.completedAt && <span>• Finished at {fmtTime(session.completedAt)}</span>}
      </div>

      <button onClick={onToggle} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
        {expanded ? 'Hide transcript' : 'View transcript'}
      </button>
    </div>

    {expanded && (
      <div className="mt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-4 space-y-4 max-h-96 overflow-y-auto">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Training script sent</p>
          <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-2xs">{session.script || '(no script recorded)'}</p>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Questions &amp; answers</p>
          {(session.questions || []).map((q, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 text-xs">
              <p className="font-bold text-slate-800 dark:text-slate-100">{i + 1}. {q.text}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-1"><span className="font-semibold text-slate-400">Answer: </span>{q.answer || <span className="italic text-slate-400">No answer yet</span>}</p>
              {q.feedback && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  {q.score === 1 ? <SvgIcons.Check className="w-3.5 h-3.5 text-emerald-600" /> : <SvgIcons.X className="w-3.5 h-3.5 text-rose-500" />}
                  {q.feedback}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Training Assistant Side Panel
const TrainingAssistantPanel: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAsk = async (customQuestion?: string) => {
    const userMessage = customQuestion || question.trim();
    if (!userMessage || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(nextMessages);
    setQuestion('');
    setLoading(true);

    try {
      const res = await apiService.askTrainingAssistant({ question: userMessage, history: nextMessages.slice(-8) });
      if (res.success && res.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not get a response. Please try again.' }]);
      }
    } catch (error) {
      console.error('Training assistant error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred. Please check your connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "Explain today's topic again",
    'How did I score on my last quiz?',
    'Give me an example for this topic',
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-[650px] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <SvgIcons.Bot className="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">Training Assistant</h3>
          <p className="text-[11px] text-slate-400 font-medium">Ask anything about the sales training</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 dark:bg-slate-950/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-400 flex items-center justify-center mb-2">
              <SvgIcons.Bot className="w-5 h-5" />
            </div>
            <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mb-3">Ask a question about the training</p>
            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAsk(q)}
                  className="text-xs bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white font-medium px-3 py-2 rounded-xl transition shadow-2xs text-center"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none shadow-2xs'}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-2xl rounded-bl-none shadow-2xs">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-1.5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your questions here..."
            className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 outline-none"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAsk();
            }}
          />
          <button
            onClick={() => handleAsk()}
            disabled={!question.trim() || loading}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-100 p-2"
          >
            <SvgIcons.Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Admin Training View
const AdminTrainingBrowser: React.FC = () => {
  const [dates, setDates] = useState<DateSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadDates = useCallback(async () => {
    setLoadingDates(true);
    try {
      const rows = await apiService.getSalesTrainingDates();
      setDates(rows);
      if (rows.length > 0) setSelectedDate((prev) => prev || rows[0].date);
    } catch (err: any) {
      setError(err.message || 'Failed to load training dates');
    } finally {
      setLoadingDates(false);
    }
  }, []);

  const loadDay = useCallback(async (date: string) => {
    setLoadingDay(true);
    setError('');
    try {
      const result = await apiService.getSalesTrainingSessions(date);
      setSessions(result.sessions);
    } catch (err: any) {
      setError(err.message || 'Failed to load training sessions');
      setSessions([]);
    } finally {
      setLoadingDay(false);
    }
  }, []);

  useEffect(() => { loadDates(); }, [loadDates]);
  useEffect(() => { if (selectedDate) loadDay(selectedDate); }, [selectedDate, loadDay]);

  const handleTriggerNow = useCallback(async () => {
    setTriggering(true);
    setTriggerMsg('');
    setError('');
    try {
      const result = await apiService.triggerSalesTraining();
      setTriggerMsg(
        result.disabled
          ? 'Sales training is currently paused.'
          : result.started > 0
          ? `Started ${result.started} training session${result.started === 1 ? '' : 's'}`
          : `Nothing to start — today's training was already sent`
      );
      await loadDates();
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      await loadDay(selectedDate || todayIST);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger sales training');
    } finally {
      setTriggering(false);
    }
  }, [loadDates, loadDay, selectedDate]);

  const selectedSummary = dates.find((d) => d.date === selectedDate);

  const scrollDates = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Sales Training</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Daily 3:30 PM WhatsApp training sent to every counsellor — the transcript, quiz questions, their answers, and scores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-xs">
            <SvgIcons.Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleTriggerNow}
            disabled={triggering}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
          >
            {triggering ? <SvgIcons.RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <SvgIcons.Send className="w-3.5 h-3.5" />}
            Start Now
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold px-4 py-2.5 rounded-xl">
          {triggerMsg}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold px-4 py-2.5 rounded-xl">{error}</div>
      )}

      {/* Date Carousel Slider */}
      <div className="relative flex items-center">
        <button onClick={() => scrollDates('left')} className="p-1 rounded-full bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 z-10 mr-2">
          <SvgIcons.ChevronLeft className="w-4 h-4" />
        </button>

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto no-scrollbar py-3 flex-1 scroll-smooth">
          {dates.map((d) => {
            const isSelected = selectedDate === d.date;
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-left transition-all border ${
                  isSelected
                    ? 'bg-pink-500 text-white border-pink-400 shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-pink-400 dark:hover:border-pink-500'
                }`}
              >
                <p className="text-xs font-bold whitespace-nowrap">{fmtDate(d.date)}</p>
                <p className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-pink-100' : 'text-slate-500 dark:text-slate-400'}`}>
                  {d.total} Counsellor{d.total !== 1 ? 's' : ''}
                </p>
              </button>
            );
          })}
        </div>

        <button onClick={() => scrollDates('right')} className="p-1 rounded-full bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 z-10 ml-2">
          <SvgIcons.ChevronRight className="w-4 h-4" />
        </button>
      </div>

{/* Summary Metric Cards */}
{selectedSummary && (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    {/* Card 1: Total Counsellors (Emerald) */}
    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/60 dark:border-emerald-900/40 rounded-2xl p-3.5 flex flex-col justify-between">
      <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center mb-1.5 shadow-2xs">
        <SvgIcons.UsersGroup className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedSummary.total} <span className="text-[10px] font-semibold text-slate-400">Total</span></p>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">Total Counsellors</p>
      </div>
    </div>

    {/* Card 2: Completed (Purple) */}
    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-100/60 dark:border-purple-900/40 rounded-2xl p-3.5 flex flex-col justify-between">
      <div className="w-7 h-7 rounded-lg bg-purple-500 text-white flex items-center justify-center mb-1.5 shadow-2xs">
        <SvgIcons.BadgeCheckRibbon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedSummary.completed} <span className="text-[10px] font-semibold text-slate-400">Done</span></p>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">Completed</p>
      </div>
    </div>

    {/* Card 3: InProgress (Amber) */}
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100/60 dark:border-amber-900/40 rounded-2xl p-3.5 flex flex-col justify-between">
      <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center mb-1.5 shadow-2xs">
        <SvgIcons.Stopwatch className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedSummary.inProgress} <span className="text-[10px] font-semibold text-slate-400">Active</span></p>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">InProgress</p>
      </div>
    </div>

    {/* Card 4: Abandoned (Rose) */}
    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100/60 dark:border-rose-900/40 rounded-2xl p-3.5 flex flex-col justify-between">
      <div className="w-7 h-7 rounded-lg bg-rose-400 text-white flex items-center justify-center mb-1.5 shadow-2xs">
        <SvgIcons.UserMinus className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">0 <span className="text-[10px] font-semibold text-slate-400">Left</span></p>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">Abandoned</p>
      </div>
    </div>

    {/* Card 5: Average Score (Blue) */}
    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-900/40 rounded-2xl p-3.5 flex flex-col justify-between">
      <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center mb-1.5 shadow-2xs">
        <SvgIcons.AnalyticsTrendBars className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedSummary.avgScore !== null ? selectedSummary.avgScore : 0} <span className="text-[10px] font-semibold text-slate-400">/ 5</span></p>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">Average Score</p>
      </div>
    </div>
  </div>
)}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
            <SvgIcons.Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Counsellors Training Session
          </h2>

          {loadingDay ? (
            <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <SvgIcons.RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <SvgIcons.GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No training sent for this date</p>
            </div>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s._id}
                session={s}
                showCounsellor
                expanded={expandedId === s._id}
                onToggle={() => setExpandedId(expandedId === s._id ? null : s._id)}
              />
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          <TrainingAssistantPanel />
        </div>
      </div>
    </div>
  );
};

// Counsellor Training View   
const CounsellorTrainingView: React.FC = () => {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getSalesTrainingHistory()
      .then((rows) => { if (!cancelled) setSessions(rows); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load your training history'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Sales Training</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Your daily 3:30 PM WhatsApp training — past topics, quiz questions, your answers, and scores.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">My training history</p>
          
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold px-4 py-2.5 rounded-xl">{error}</div>
          )}

          {loading ? (
            <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <SvgIcons.RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <SvgIcons.GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No training sessions yet</p>
              <p className="text-xs opacity-70 mt-1">Your first daily training will arrive on WhatsApp at 3:30 PM.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s._id}
                session={s}
                showCounsellor={false}
                expanded={expandedId === s._id}
                onToggle={() => setExpandedId(expandedId === s._id ? null : s._id)}
              />
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          <TrainingAssistantPanel />
        </div>
      </div>
    </div>
  );
};

// Main Export Component
interface SalesTrainingViewProps {
  currentUser: User | null;
}

const SalesTrainingView: React.FC<SalesTrainingViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 h-full p-4 sm:p-6 lg:p-8 transition-colors">
      {isAdmin ? <AdminTrainingBrowser /> : <CounsellorTrainingView />}
    </div>
  );
};

export default SalesTrainingView;