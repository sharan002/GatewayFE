import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { User, TempLead } from '../types';
import { apiService } from '../services/api';
import { Icons } from './Icons';

interface Props {
  currentUser: User | null;
  embedded?: boolean;
}

interface ParsedContact {
  userName?: string;
  userNumber: string;
}

function parseContactsFromWorkbook(buf: ArrayBuffer): ParsedContact[] {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
  if (!aoa.length) return [];

  const headerRow = aoa[0].map(h => String(h).trim().toLowerCase());
  const phoneColIdx = headerRow.findIndex(h => /phone|number|mobile/.test(h));
  const nameColIdx = headerRow.findIndex(h => /name/.test(h));
  const hasHeader = phoneColIdx !== -1;

  const dataRows = hasHeader ? aoa.slice(1) : aoa;
  const effectivePhoneCol = hasHeader ? phoneColIdx : 0;
  const effectiveNameCol = hasHeader ? nameColIdx : (dataRows[0]?.length > 1 ? 1 : -1);

  const contacts: ParsedContact[] = [];
  for (const row of dataRows) {
    const rawNumber = String(row[effectivePhoneCol] ?? '').trim();
    const digits = rawNumber.replace(/\D/g, '');
    if (!digits) continue;
    const userName = effectiveNameCol !== -1 ? String(row[effectiveNameCol] ?? '').trim() : '';
    contacts.push({ userNumber: digits, userName: userName || undefined });
  }
  return contacts;
}

function formatDate(v: string | { $date: string } | undefined | null) {
  if (!v) return '-';
  const raw = typeof v === 'string' ? v : v.$date;
  return new Date(raw).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const BulkMsgView: React.FC<Props> = ({ currentUser, embedded = false }) => {
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [fileName, setFileName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [tempLeads, setTempLeads] = useState<TempLead[]>([]);
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProspects = async () => {
    setIsLoadingProspects(true);
    try {
      setTempLeads(await apiService.getTempCampaignLeads());
    } finally {
      setIsLoadingProspects(false);
    }
  };

  useEffect(() => {
    apiService.getCampaignNames().then(setCampaignNames);
    loadProspects();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseContactsFromWorkbook(buf);
      setContacts(parsed);
      setFileName(file.name);
    } catch (err) {
      console.error('Failed to parse Excel file', err);
      alert('Could not read that file. Please upload a valid .xlsx, .xls or .csv file.');
    } finally {
      e.target.value = '';
    }
  };

  const clearUpload = () => {
    setContacts([]);
    setFileName('');
  };

  const handleSend = async () => {
    if (!contacts.length || !message.trim() || !campaignName.trim()) return;
    setIsSending(true);
    try {
      const result = await apiService.sendBulkCampaign(contacts, message.trim(), campaignName.trim());
      alert(
        `Campaign "${campaignName.trim()}"\n\n` +
        `Sent: ${result.sent}\nFailed: ${result.failed}\nSkipped (already a lead): ${result.skippedExisting}\nTotal uploaded: ${result.total}`
      );
      clearUpload();
      setMessage('');
      setCampaignName('');
      apiService.getCampaignNames().then(setCampaignNames);
      loadProspects();
    } catch (err) {
      console.error('Bulk campaign send failed', err);
      alert('Failed to send bulk campaign. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={embedded ? 'w-full text-slate-700' : 'flex-1 min-h-0 min-w-0 overflow-y-auto p-3 sm:p-6 text-slate-700 flex flex-col'}>
      <div className={embedded ? 'w-full space-y-5' : 'max-w-7xl w-full mx-auto space-y-5'}>

      

        {/* ── Bulk WhatsApp Title Banner ── */}
        {!embedded && (
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="text-[#25D366] shrink-0">
            <Icons.WhatsApp className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Bulk WhatsApp</h1>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Upload an Excel of new contacts, send a WhatsApp campaign, and they'll automatically become leads once they reply.
            </p>
          </div>
        </div>
        )}

        {/* ── Main Form Container (Redesigned according to reference image) ── */}
        <div className="bg-white rounded-3xl border border-white shadow-sm p-5 sm:p-8 space-y-6">
          
          {/* 1. Upload Excel */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800">1. Upload Excel</h3>
            <p className="text-[11px] text-slate-400">
              A "Phone"/"Number" column is required; a "Name" column is optional.
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#f0fdf4] dark:bg-green-950/40 hover:bg-green-100 dark:hover:bg-green-900/60 text-[#15803d] dark:text-green-300 font-bold text-xs rounded-xl border border-green-200/80 dark:border-green-800/80 transition-all shadow-2xs cursor-pointer"
              >
                <Icons.Upload className="w-4 h-4 text-[#15803d] dark:text-green-300" />
                <span>Choose File</span>
              </button>
              {fileName && (
                <div className="flex items-center gap-2 text-xs text-[#15803d] dark:text-green-300 bg-[#f0fdf4] dark:bg-green-950/40 px-3 py-2 rounded-xl border border-green-200/80 dark:border-green-800/80">
                  <Icons.FileText className="w-4 h-4 text-[#25D366]" />
                  <span className="font-semibold">{fileName}</span>
                  <span className="text-[#15803d]/70 dark:text-green-400/70">({contacts.length} contact{contacts.length === 1 ? '' : 's'})</span>
                  <button onClick={clearUpload} className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer"><Icons.X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>

          {/* Uploaded Contacts Preview Table */}
          {contacts.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-w-xl">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 50).map((c, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-600">{c.userName || <span className="text-slate-300">-</span>}</td>
                        <td className="px-3 py-1.5 text-slate-800 font-semibold">{c.userNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {contacts.length > 50 && (
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] text-slate-400 border-t border-slate-100">…and {contacts.length - 50} more</div>
              )}
            </div>
          )}

          {/* 2. Campaign Name */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-slate-800">2. Campaign Name</h3>
            <input
              list="bulk-campaign-name-options"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. August Cold Outreach"
              disabled={isSending}
              className="w-full max-w-xl p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
            />
            <datalist id="bulk-campaign-name-options">
              {campaignNames.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* 3. Message */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-slate-800">3. Message</h3>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your campaign message here..."
              disabled={isSending}
              className="w-full max-w-xl h-32 p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all resize-none"
            />
          </div>

          {/* Send Button */}
          <div className="pt-2">
            <button
              onClick={handleSend}
              disabled={!contacts.length || !message.trim() || !campaignName.trim() || isSending}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all disabled:bg-slate-100 dark:disabled:bg-slate-800/80 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border disabled:border-slate-200 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed bg-[#16a34a] hover:bg-[#15803d] active:bg-[#166534] text-white shadow-xs hover:shadow-md cursor-pointer"
            >
              {isSending ? (
                <Icons.RefreshCcw className="w-4 h-4 animate-spin text-current" />
              ) : (
                <Icons.Send className="w-4 h-4 text-current" />
              )}
              <span>{isSending ? 'Sending...' : `Send to ${contacts.length} Contact${contacts.length === 1 ? '' : 's'}`}</span>
            </button>
          </div>

          {/* ── Prospects Awaiting Reply Section ── */}
          <div className="pt-4">
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Prospects Awaiting Reply</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Contacts sent a campaign message but not yet replied. Once they reply, they become a lead and drop off this list.
                  </p>
                </div>
                <button 
                  onClick={loadProspects} 
                  className="p-2 hover:bg-green-50 dark:hover:bg-green-950/40 rounded-xl text-slate-400 hover:text-[#15803d] dark:hover:text-green-400 transition-colors cursor-pointer" 
                  title="Refresh"
                >
                  <Icons.RefreshCcw className={`w-4 h-4 ${isLoadingProspects ? 'animate-spin text-[#25D366]' : ''}`} />
                </button>
              </div>

              {tempLeads.length === 0 ? (
                <div className="py-6 text-slate-300 text-center text-xs">
                  {/* Empty space matching reference image container */}
                </div>
              ) : (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Name</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Number</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Campaign</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Sent</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tempLeads.map(t => (
                        <tr key={t._id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700 text-[14px] font-semibold">{t.userName}</td>
                          <td className="px-3 py-2 text-slate-600">{t.userNumber}</td>
                          <td className="px-3 py-2 text-slate-600">{t.campaignName}</td>
                          <td className="px-3 py-2 text-slate-500 text-[11px]">{formatDate(t.sentAt)}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${t.status === 'sent' ? 'bg-[#f0fdf4] dark:bg-green-950/50 text-[#15803d] dark:text-green-300 border border-green-200/80 dark:border-green-800' : 'bg-red-50 text-red-600'}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default BulkMsgView;