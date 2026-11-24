import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../../services/api';
import { WaTemplate } from '../../types';
import { Icons } from '../Icons';

interface Props {
  initialTemplate?: WaTemplate | null;
  mode?: 'create' | 'edit' | 'duplicate';
  onSuccess?: () => void;
  onCancel?: () => void;
}

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
type CategoryType = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

interface ButtonConfig {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

const COMMON_LANGUAGES = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'ta', label: 'Tamil' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
];

export const TemplateBuilder: React.FC<Props> = ({
  initialTemplate,
  mode = 'create',
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryType>('UTILITY');
  const [language, setLanguage] = useState('en_US');

  // Header
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerSample, setHeaderSample] = useState('');
  const [mediaHandle, setMediaHandle] = useState<string | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Body
  const [bodyText, setBodyText] = useState('');
  const [bodySamples, setBodySamples] = useState<Record<number, string>>({});

  // Footer
  const [footerText, setFooterText] = useState('');

  // Buttons
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load from initialTemplate when editing or duplicating
  useEffect(() => {
    if (initialTemplate) {
      if (mode === 'duplicate') {
        setName(`${initialTemplate.name}_copy`.replace(/[^a-z0-9_]/g, '').slice(0, 512));
      } else {
        setName(initialTemplate.name || '');
      }
      setCategory((initialTemplate.category as CategoryType) || 'UTILITY');
      setLanguage(initialTemplate.language || 'en_US');

      const comps = initialTemplate.components || [];

      // Header
      const header = comps.find((c: any) => c.type === 'HEADER');
      if (header) {
        if (header.format === 'TEXT') {
          setHeaderType('TEXT');
          setHeaderText(header.text || '');
          if (header.example?.header_text?.[0]) {
            setHeaderSample(header.example.header_text[0]);
          }
        } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(header.format || '')) {
          setHeaderType((header.format as HeaderType) || 'NONE');
          if (header.example?.header_handle?.[0]) {
            setMediaHandle(header.example.header_handle[0]);
          }
        }
      } else {
        setHeaderType('NONE');
        setHeaderText('');
        setHeaderSample('');
        setMediaHandle(null);
      }

      // Body
      const body = comps.find((c: any) => c.type === 'BODY');
      if (body) {
        setBodyText(body.text || '');
        const samples = body.example?.body_text?.[0] || [];
        const sampleMap: Record<number, string> = {};
        samples.forEach((val: string, idx: number) => {
          sampleMap[idx + 1] = val;
        });
        setBodySamples(sampleMap);
      } else {
        setBodyText('');
        setBodySamples({});
      }

      // Footer
      const footer = comps.find((c: any) => c.type === 'FOOTER');
      if (footer) {
        setFooterText(footer.text || '');
      } else {
        setFooterText('');
      }

      // Buttons
      const btnsComp = comps.find((c: any) => c.type === 'BUTTONS');
      if (btnsComp && Array.isArray(btnsComp.buttons)) {
        setButtons(
          btnsComp.buttons.map((b: any) => ({
            type: b.type,
            text: b.text || '',
            url: b.url,
            phone_number: b.phone_number,
          }))
        );
      } else {
        setButtons([]);
      }
    }
  }, [initialTemplate, mode]);

  // Auto-slugify name
  const handleNameChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 512);
    setName(slug);
  };

  // Detect body variables {{1}}, {{2}}, ...
  const detectedVariables = useMemo(() => {
    const matches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1], 10));
    return Array.from(new Set(matches)).sort((a, b) => a - b);
  }, [bodyText]);

  // Next variable helper
  const handleInsertVariable = () => {
    const nextNum = detectedVariables.length > 0 ? Math.max(...detectedVariables) + 1 : 1;
    setBodyText(prev => `${prev}{{${nextNum}}}`);
  };

  const handleBodySampleChange = (varNum: number, value: string) => {
    setBodySamples(prev => ({
      ...prev,
      [varNum]: value,
    }));
  };

  // Media file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingMedia(true);
      setErrorMsg(null);

      // Local preview URL
      if (file.type.startsWith('image/')) {
        setMediaPreviewUrl(URL.createObjectURL(file));
      } else {
        setMediaPreviewUrl(null);
      }

      const res = await apiService.uploadWhatsAppMedia(file);
      setMediaHandle(res.handle);
      setMediaFileName(file.name);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload media sample');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Button management
  const handleAddButton = (type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER') => {
    if (buttons.length >= 10) return;
    setButtons(prev => [
      ...prev,
      {
        type,
        text: type === 'QUICK_REPLY' ? 'Quick Reply' : type === 'URL' ? 'Visit Website' : 'Call Support',
        url: type === 'URL' ? 'https://example.com' : undefined,
        phone_number: type === 'PHONE_NUMBER' ? '+91' : undefined,
      },
    ]);
  };

  const handleRemoveButton = (idx: number) => {
    setButtons(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateButton = (idx: number, patch: Partial<ButtonConfig>) => {
    setButtons(prev => prev.map((btn, i) => (i === idx ? { ...btn, ...patch } : btn)));
  };

  // Preview Body: replace {{1}}, {{2}} with actual sample values in real time
  const renderedPreviewBody = useMemo(() => {
    if (!bodyText) return 'Type your template body text in the form...';
    let result = bodyText;
    detectedVariables.forEach(v => {
      const sample = bodySamples[v];
      const replacement = sample && sample.trim() ? sample.trim() : `[Sample {{${v}}}]`;
      result = result.replaceAll(`{{${v}}}`, replacement);
    });
    return result;
  }, [bodyText, detectedVariables, bodySamples]);

  // Client-side quick check
  const localCheckErrors = useMemo(() => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Template name is required.');
    if (!bodyText.trim()) errs.push('Body text is required.');
    if (bodyText.length > 1024) errs.push(`Body text exceeds 1024 chars (${bodyText.length}).`);
    if (/^\{\{\d+\}\}/.test(bodyText.trim())) errs.push('Meta rule: Body cannot start with a variable.');
    if (/\{\{\d+\}\}$/.test(bodyText.trim())) errs.push('Meta rule: Body cannot end with a variable.');

    // Check sequential
    for (let i = 0; i < detectedVariables.length; i++) {
      if (detectedVariables[i] !== i + 1) {
        errs.push(`Variables must be sequential starting from {{1}}. Found {{${detectedVariables[i]}}}.`);
        break;
      }
    }

    // Check sample values
    detectedVariables.forEach(v => {
      if (!bodySamples[v] || !bodySamples[v].trim()) {
        errs.push(`Sample value for {{${v}}} is missing.`);
      }
    });

    if (headerType !== 'NONE' && headerType !== 'TEXT' && !mediaHandle) {
      errs.push(`Sample file upload required for ${headerType} header.`);
    }

    return errs;
  }, [name, bodyText, detectedVariables, bodySamples, headerType, mediaHandle]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localCheckErrors.length > 0) {
      setValidationErrors(localCheckErrors);
      setErrorMsg('Please resolve all validation errors before submitting to Meta.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setValidationErrors([]);
      setSuccessMsg(null);

      // Build components payload
      const components: any[] = [];

      // 1. Header component
      if (headerType === 'TEXT' && headerText.trim()) {
        const hasVar = /\{\{1\}\}/.test(headerText);
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText.trim(),
          ...(hasVar && headerSample ? { example: { header_text: [headerSample.trim()] } } : {}),
        });
      } else if (headerType !== 'NONE' && mediaHandle) {
        components.push({
          type: 'HEADER',
          format: headerType,
          example: {
            header_handle: [mediaHandle],
          },
        });
      }

      // 2. Body component
      const sampleArray = detectedVariables.map(v => bodySamples[v]?.trim() || 'sample');
      components.push({
        type: 'BODY',
        text: bodyText.trim(),
        ...(sampleArray.length > 0 ? { example: { body_text: [sampleArray] } } : {}),
      });

      // 3. Footer component
      if (footerText.trim()) {
        components.push({
          type: 'FOOTER',
          text: footerText.trim(),
        });
      }

      // 4. Buttons component
      if (buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: buttons.map(b => {
            if (b.type === 'QUICK_REPLY') {
              return { type: 'QUICK_REPLY', text: b.text.trim() };
            }
            if (b.type === 'URL') {
              return { type: 'URL', text: b.text.trim(), url: b.url?.trim() };
            }
            return { type: 'PHONE_NUMBER', text: b.text.trim(), phone_number: b.phone_number?.trim() };
          }),
        });
      }

      let res;
      if (mode === 'edit' && initialTemplate?._id) {
        res = await apiService.updateWhatsAppTemplate(initialTemplate._id, {
          category,
          components,
        });
        setSuccessMsg(res.message || 'Template updated and resubmitted to Meta!');
      } else {
        const payload = {
          name: name.trim().toLowerCase(),
          language,
          category,
          components,
          parameterFormat: 'POSITIONAL',
        };
        res = await apiService.createWhatsAppTemplate(payload);
        setSuccessMsg(res.message || 'Template submitted successfully to Meta!');
      }

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Template submission error:', err);
      setErrorMsg(err.message || 'Failed to submit template to Meta');
      if (err.errors && Array.isArray(err.errors)) {
        setValidationErrors(err.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {mode === 'edit'
              ? 'Edit & Resubmit Template'
              : mode === 'duplicate'
              ? 'Duplicate WhatsApp Template'
              : 'Create WhatsApp Message Template'}
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {mode === 'edit' ? 'Resubmits to Meta' : 'Auto-Submits for Meta Review'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'edit'
              ? `Modifying "${initialTemplate?.name}" (${initialTemplate?.language}). Meta will re-review components upon submission.`
              : 'Configure your message template and preview live in real-time before sending to Meta.'}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Back to Templates
          </button>
        )}
      </div>

      {mode === 'edit' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
          <Icons.AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Meta Policy:</strong> Template name and language are locked by Meta. Submitting changes to category or components puts the template back into <strong>In Review</strong> (PENDING).
          </span>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in">
          <Icons.CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm font-semibold">{successMsg}</div>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Icons.X className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          {validationErrors.length > 0 && (
            <ul className="list-disc list-inside text-xs space-y-1 text-rose-700 dark:text-rose-300 pl-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Two Column Layout: Left Form + Right Smartphone Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Card: Basic Settings */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Basic Information
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Template Name <span className="text-rose-500">*</span>
                {mode === 'edit' && (
                  <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                    (Locked by Meta)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={name}
                disabled={mode === 'edit'}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. course_enrollment_confirmation"
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl font-mono border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  mode === 'edit'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                }`}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {mode === 'edit'
                  ? 'Template name cannot be modified in Meta after creation.'
                  : 'Lowercase letters, numbers, and underscores only. No spaces or uppercase.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['UTILITY', 'MARKETING', 'AUTHENTICATION'] as CategoryType[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        category === cat
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {cat === 'UTILITY' ? 'Utility' : cat === 'MARKETING' ? 'Marketing' : 'Auth'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Language
                  {mode === 'edit' && (
                    <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                      (Locked by Meta)
                    </span>
                  )}
                </label>
                <select
                  value={language}
                  disabled={mode === 'edit'}
                  onChange={e => setLanguage(e.target.value)}
                  className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    mode === 'edit'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {COMMON_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card: Header Section */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Header (Optional)
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              {(['NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'] as HeaderType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setHeaderType(type);
                    setMediaHandle(null);
                    setMediaFileName(null);
                    setMediaPreviewUrl(null);
                  }}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    headerType === type
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {type === 'NONE' ? 'No Header' : type}
                </button>
              ))}
            </div>

            {headerType === 'TEXT' && (
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Header Text</label>
                    <span className="text-[11px] text-slate-400">{headerText.length}/60</span>
                  </div>
                  <input
                    type="text"
                    maxLength={60}
                    value={headerText}
                    onChange={e => setHeaderText(e.target.value)}
                    placeholder="e.g. Admission Alert {{1}}"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/\{\{1\}\}/.test(headerText) && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Sample Value for Header Variable:
                    </label>
                    <input
                      type="text"
                      value={headerSample}
                      onChange={e => setHeaderSample(e.target.value)}
                      placeholder="e.g. 2026 Batch"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}

            {headerType !== 'NONE' && headerType !== 'TEXT' && (
              <div className="pt-2 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Sample {headerType} File for Meta Review <span className="text-rose-500">*</span>
                </label>
                <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2 hover:border-blue-400 transition-colors">
                  {isUploadingMedia ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
                      <Icons.RefreshCcw className="w-4 h-4 animate-spin" />
                      <span>Uploading to Meta Resumable Upload session...</span>
                    </div>
                  ) : mediaHandle ? (
                    <div className="text-xs space-y-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <div className="flex items-center justify-center gap-1.5">
                        <Icons.CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Uploaded sample: {mediaFileName}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">Handle: {mediaHandle.slice(0, 24)}...</div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-500">
                        Upload sample {headerType.toLowerCase()} to obtain Meta review handle
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors">
                      <Icons.Plus className="w-3.5 h-3.5" />
                      <span>{mediaHandle ? 'Replace File' : 'Select File'}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept={
                          headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'
                        }
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card: Body Section */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Body Text <span className="text-rose-500">*</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertVariable}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <Icons.Plus className="w-3 h-3" />
                  <span>Add Variable</span>
                </button>
                <span className={`text-[11px] font-mono ${bodyText.length > 1024 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                  {bodyText.length}/1024
                </span>
              </div>
            </div>

            <div>
              <textarea
                rows={5}
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                placeholder="Hello {{1}}, your admission for the {{2}} course has been approved! Please find your timetable details attached."
                className="w-full px-3.5 py-3 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                required
              />
            </div>

            {/* In-form Meta Rule warning */}
            {/^\{\{\d+\}\}/.test(bodyText.trim()) && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⚠️ Meta rule: Body text cannot begin directly with a variable. Add introductory text before it.
              </p>
            )}
            {/\{\{\d+\}\}$/.test(bodyText.trim()) && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⚠️ Meta rule: Body text cannot end directly with a variable. Add punctuation or sign-off text after it.
              </p>
            )}

            {/* Detected Variables Sample Inputs */}
            {detectedVariables.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sample Values for Variables (Mandatory for Meta Review):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detectedVariables.map(num => (
                    <div key={num} className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        Value for {'{{' + num + '}}'}:
                      </label>
                      <input
                        type="text"
                        value={bodySamples[num] || ''}
                        onChange={e => handleBodySampleChange(num, e.target.value)}
                        placeholder={`e.g. Sample ${num}`}
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card: Footer Section */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                4. Footer (Optional)
              </h3>
              <span className="text-[11px] text-slate-400">{footerText.length}/60</span>
            </div>
            <input
              type="text"
              maxLength={60}
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              placeholder="e.g. Gateway Admissions Team"
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">Short sign-off or disclaimer text. Variables not allowed.</p>
          </div>

          {/* Card: Buttons Section */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                5. Action Buttons (Optional)
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddButton('QUICK_REPLY')}
                  disabled={buttons.length >= 10}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-50"
                >
                  + Quick Reply
                </button>
                <button
                  type="button"
                  onClick={() => handleAddButton('URL')}
                  disabled={buttons.length >= 10}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-50"
                >
                  + URL
                </button>
                <button
                  type="button"
                  onClick={() => handleAddButton('PHONE_NUMBER')}
                  disabled={buttons.length >= 10}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-50"
                >
                  + Phone
                </button>
              </div>
            </div>

            {buttons.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No buttons added yet. Add quick replies or website links above.</p>
            ) : (
              <div className="space-y-3">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Button #{idx + 1} ({btn.type.replace('_', ' ')})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveButton(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Button Text (max 25 chars)
                        </label>
                        <input
                          type="text"
                          maxLength={25}
                          value={btn.text}
                          onChange={e => handleUpdateButton(idx, { text: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      {btn.type === 'URL' && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                            Website URL
                          </label>
                          <input
                            type="url"
                            value={btn.url || ''}
                            onChange={e => handleUpdateButton(idx, { url: e.target.value })}
                            placeholder="https://yourwebsite.com"
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}

                      {btn.type === 'PHONE_NUMBER' && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={btn.phone_number || ''}
                            onChange={e => handleUpdateButton(idx, { phone_number: e.target.value })}
                            placeholder="+919876543210"
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Icons.RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>{mode === 'edit' ? 'Resubmitting to Meta...' : 'Submitting to Meta...'}</span>
                </>
              ) : (
                <>
                  <Icons.Send className="w-4 h-4" />
                  <span>{mode === 'edit' ? 'Save & Resubmit to Meta' : 'Submit for Meta Review'}</span>
                </>
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Right Column: Live Interactive Smartphone Simulator */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
            <span>Live WhatsApp Preview</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Real-time variables</span>
          </div>

          {/* Phone Shell */}
          <div className="w-full max-w-sm mx-auto rounded-[2.5rem] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700">
            {/* Phone Screen */}
            <div className="rounded-[2rem] overflow-hidden bg-[#EFEAE2] dark:bg-slate-950 flex flex-col h-[520px]">
              {/* WhatsApp App Header */}
              <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>Gateway Tech</span>
                      <span className="text-[10px] text-emerald-300">✓</span>
                    </div>
                    <div className="text-[10px] text-emerald-100/80">Business Account</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <Icons.Phone className="w-3.5 h-3.5" />
                  <Icons.MoreVertical className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Chat Message Scrollable Area */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col justify-end">
                {/* WhatsApp Chat Bubble */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl rounded-tl-sm p-3.5 shadow-sm max-w-[90%] space-y-2 border border-slate-100 dark:border-slate-800/80">
                  {/* Header Preview */}
                  {headerType === 'TEXT' && headerText && (
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-100 dark:border-slate-800">
                      {headerText.replace('{{1}}', headerSample || '[Header Sample]')}
                    </div>
                  )}

                  {headerType !== 'NONE' && headerType !== 'TEXT' && (
                    <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 max-h-36 flex items-center justify-center text-slate-400 text-xs">
                      {mediaPreviewUrl ? (
                        <img src={mediaPreviewUrl} alt="Header Preview" className="w-full h-32 object-cover" />
                      ) : (
                        <div className="py-6 text-center space-y-1">
                          <span className="text-xl">📷</span>
                          <div className="text-[10px] font-medium uppercase tracking-wider">{headerType} Header</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Preview */}
                  <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {renderedPreviewBody}
                  </div>

                  {/* Footer Preview */}
                  {footerText && (
                    <div className="text-[10px] text-slate-400 pt-1">
                      {footerText}
                    </div>
                  )}

                  {/* Timestamp & double checks */}
                  <div className="text-[9px] text-slate-400 text-right flex items-center justify-end gap-1 pt-0.5">
                    <span>10:45 AM</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>

                {/* Buttons Preview */}
                {buttons.length > 0 && (
                  <div className="space-y-1 max-w-[90%]">
                    {buttons.map((btn, i) => (
                      <div
                        key={i}
                        className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 text-xs font-bold text-center border border-slate-200/80 dark:border-slate-800 shadow-sm"
                      >
                        {btn.type === 'PHONE_NUMBER' && '📞 '}
                        {btn.type === 'URL' && '🔗 '}
                        {btn.text || `Button #${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input Bar Dummy */}
              <div className="p-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                  Message...
                </div>
                <div className="w-7 h-7 rounded-full bg-[#075E54] text-white flex items-center justify-center">
                  <Icons.Send className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilder;
