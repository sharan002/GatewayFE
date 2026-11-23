import React, { useState, useLayoutEffect } from 'react';
import { Icons } from './Icons';
import { Lead, normalizeLeadSource } from '../types';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: Partial<Lead>) => void;
  initialData?: Lead | null;
  title: string;
  currentUserRole?: string;
  branches?: string[]; // when provided (admin), a Branch picker is shown for new leads
}

const COURSES = [
  "GEN AI",
  "Prompt Engineering",
  "AIoT",
  "Embedded Systems & IoT",
  "Mobile App Development",
  "Cyber Security",
  "SOC Analyst",
  "Python Full Stack",
  "Java Full Stack & AEM Full Stack",
  ".NET Full Stack",
  "Angular and React Full Stack",
  "MERN Stack Development",
  "Data Analytics",
  "Data Science & AI",
  "Digital Marketing",
  "Software Testing"
];

const LeadFormModal: React.FC<LeadFormModalProps> = ({ isOpen, onClose, onSubmit, initialData, title, currentUserRole, branches }) => {
  // Non-admins cannot change the program type once it has already been set on this lead.
  const isProgramTypeLocked = currentUserRole !== 'admin' && !!initialData?.programType;
  // Lead Status is set automatically by AI; manual edits are disabled once a lead already exists.
  const isStatusLocked = !!initialData;
  const [formData, setFormData] = useState<Partial<Lead>>(() =>
    initialData
      ? { ...initialData }
      : { userName: '', userNumber: '', course: '', location: '', leadfrom: '', profession: '', status: '', programType: '', pipeline: '', branch: '' }
  );

  useLayoutEffect(() => {
    if (initialData) {
      const statusOptions = ['Hot', 'Warm', 'Cold'];
      const normalizeToOption = (value: string | null | undefined, options: string[]) => {
        if (!value) return value ?? '';
        return options.find(o => o.toLowerCase() === value.toLowerCase()) ?? value;
      };
      setFormData({
        ...initialData,
        status: normalizeToOption(initialData.status, statusOptions),
        leadfrom: normalizeLeadSource(initialData.leadfrom),
      });
    } else {
      setFormData({
        userName: '',
        userNumber: '',
        course: '',
        location: '',
        leadfrom: '',
        profession: '',
        status: '',
        programType: '',
        pipeline: '',
        branch: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Determine theme mode (Internship Teal vs Standard Royal Purple)
  const isInternship =
    (formData.course || '').toLowerCase().includes('internship') ||
    (initialData?.course || '').toLowerCase().includes('internship');

  // Dynamic Theme Styling
  const inputBorderClass = isInternship ? 'border-teal-200/90' : 'border-slate-200/90';
  const focusRingClass = isInternship
    ? 'focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
    : 'focus:outline-none focus:border-[#51228d] focus:ring-2 focus:ring-[#51228d]/20';
  const labelColorClass = isInternship ? 'text-teal-900/70' : 'text-slate-500';
  const chevronColorClass = isInternship ? 'text-teal-600' : 'text-purple-600';
  const cancelBtnClass = isInternship
    ? 'bg-teal-50 hover:bg-teal-100 text-teal-800'
    : 'bg-purple-100/70 hover:bg-purple-100 text-purple-900';
  const primaryBtnClass = isInternship
    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20'
    : 'bg-[#51228d] hover:bg-[#431a77] text-white shadow-md shadow-purple-900/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-['Inter',sans-serif]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
            {isInternship && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/80">
                College Internship
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            title="Close"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student Name */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Student Name :
              </label>
              <input
                type="text"
                name="userName"
                value={formData.userName || ''}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold placeholder:text-slate-400 ${focusRingClass} transition-all`}
                placeholder="Enter name"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Phone Number :
              </label>
              <input
                type="text"
                name="userNumber"
                value={formData.userNumber || ''}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold placeholder:text-slate-400 ${focusRingClass} transition-all`}
                placeholder="Ex: 9876543210"
              />
            </div>

            {/* Course Title */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Course Title :
              </label>
              <div className="relative">
                <select
                  name="course"
                  value={formData.course || ''}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                >
                  <option value="">Select Course</option>
                  {COURSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                  <Icons.ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Program Type */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Program Type :
              </label>
              {isProgramTypeLocked ? (
                <div
                  title="Only admins can change the program type once it has been set"
                  className={`w-full px-4 py-3 border rounded-2xl text-slate-800 text-sm font-bold flex items-center justify-between select-none ${
                    isInternship ? 'bg-[#f0fdfa] border-teal-100/90 text-teal-900' : 'bg-[#f8fafc] border-slate-200/90 text-slate-700'
                  }`}
                >
                  <span>{formData.programType || 'Select'}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                    Locked
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    name="programType"
                    value={formData.programType || ''}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                  >
                    <option value="">Select</option>
                    <option value="8 Hours">8 Hours</option>
                    <option value="2 Hours">2 Hours</option>
                  </select>
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                    <Icons.ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Profession */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Profession :
              </label>
              <div className="relative">
                <select
                  name="profession"
                  value={formData.profession || ''}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                >
                  <option value="">Select</option>
                  <option value="Job Seeker">Job Seeker</option>
                  <option value="Student">Student</option>
                  <option value="Working Professional">Working Professional</option>
                </select>
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                  <Icons.ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Lead Source */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Lead Source :
              </label>
              <div className="relative">
                <select
                  name="leadfrom"
                  value={formData.leadfrom || ''}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                >
                  <option value="">Select Source</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Website">Website</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Call">Call</option>
                  <option value="Referral">Referral</option>
                  <option value="Bulk Message">Bulk Message</option>
                </select>
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                  <Icons.ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Branch (admin only, for new leads) */}
            {Array.isArray(branches) && branches.length > 0 && !initialData && (
              <div className="space-y-1.5">
                <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                  Branch :
                </label>
                <div className="relative">
                  <select
                    name="branch"
                    value={formData.branch || ''}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                    <Icons.ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Lead Status */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Lead Status :
              </label>
              {isStatusLocked ? (
                <div
                  title="Lead Status is set automatically by AI and cannot be changed manually"
                  className={`w-full px-4 py-3 border rounded-2xl text-slate-800 text-sm font-bold flex items-center justify-between select-none ${
                    isInternship ? 'bg-[#f0fdfa] border-teal-100/90 text-teal-900' : 'bg-[#f8fafc] border-slate-200/90 text-slate-700'
                  }`}
                >
                  <span>{formData.status || 'Cold'}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                    AI Locked
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status || ''}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                  >
                    <option value="">Select Status</option>
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                  </select>
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                    <Icons.ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline Stage */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Pipeline Stage :
              </label>
              <div className="relative">
                <select
                  name="pipeline"
                  value={formData.pipeline || ''}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pr-10 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold appearance-none ${focusRingClass} transition-all cursor-pointer`}
                >
                  <option value="">Select Stage</option>
                  <option value="New">New</option>
                  <option value="RNR">RNR</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Asked Time">Asked Time</option>
                  <option value="Demo Scheduled">Demo Scheduled</option>
                  <option value="Pre-Enrollment">Pre-Enrollment</option>
                  <option value="Enrolled">Enrolled</option>
                  <option value="Looking for job">Looking for job</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Irrelevant">Irrelevant</option>
                </select>
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${chevronColorClass}`}>
                  <Icons.ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5 md:col-span-2">
              <label className={`text-[11px] font-bold ${labelColorClass} uppercase tracking-wider block`}>
                Location :
              </label>
              <input
                type="text"
                name="location"
                value={formData.location || ''}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white border ${inputBorderClass} rounded-2xl text-slate-900 text-sm font-bold placeholder:text-slate-400 ${focusRingClass} transition-all`}
                placeholder="City / Region"
              />
            </div>
          </div>
        </form>

        {/* Footer with full-width side-by-side action buttons */}
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-white">
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-3.5 font-bold text-sm rounded-2xl transition-all active:scale-95 text-center ${cancelBtnClass}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              style={{ color: '#ffffff' }}
              className={`w-full py-3.5 text-white !text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95 text-center flex items-center justify-center gap-2 ${primaryBtnClass}`}
            >
              {initialData ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadFormModal;
