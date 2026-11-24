import React, { useEffect, useState } from 'react';
import { TemplatesList } from './TemplatesList';
import { TemplateBuilder } from './TemplateBuilder';
import { TemplateDetailsView } from './TemplateDetailsView';
import { PhoneNumbersTab } from './PhoneNumbersTab';
import { BusinessProfileTab } from './BusinessProfileTab';
import WhatsAppBillingView from './WhatsAppBillingView';
import BulkMsgView from '../BulkMsgView';
import { User, WaTemplate } from '../../types';
import { Icons } from '../Icons';

export type WhatsAppManagerTab = 'templates' | 'builder' | 'bulk' | 'phone_numbers' | 'profile' | 'billing';

interface WhatsAppManagerViewProps {
  currentUser?: User | null;
  initialTab?: WhatsAppManagerTab;
}

export const WhatsAppManagerView: React.FC<WhatsAppManagerViewProps> = ({ currentUser, initialTab = 'templates' }) => {
  // Templates / phone numbers / profile / billing call admin-only endpoints; other roles only get Bulk WhatsApp.
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<WhatsAppManagerTab>(isAdmin ? initialTab : 'bulk');
  const [builderTemplate, setBuilderTemplate] = useState<WaTemplate | null>(null);
  const [builderMode, setBuilderMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [selectedDetailTemplateId, setSelectedDetailTemplateId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(isAdmin ? initialTab : 'bulk');
  }, [initialTab, isAdmin]);

  const handleStartCreate = () => {
    setSelectedDetailTemplateId(null);
    setBuilderTemplate(null);
    setBuilderMode('create');
    setActiveTab('builder');
  };

  const handleStartEdit = (tpl: WaTemplate) => {
    setSelectedDetailTemplateId(null);
    setBuilderTemplate(tpl);
    setBuilderMode('edit');
    setActiveTab('builder');
  };

  const handleStartDuplicate = (tpl: WaTemplate) => {
    setSelectedDetailTemplateId(null);
    setBuilderTemplate(tpl);
    setBuilderMode('duplicate');
    setActiveTab('builder');
  };

  const handleBuilderFinished = () => {
    setBuilderTemplate(null);
    setBuilderMode('create');
    setActiveTab('templates');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
              <Icons.WhatsApp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                WhatsApp Manager
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin ? 'Manage message templates, send bulk campaigns, phone numbers, and profile analytics' : 'Send bulk WhatsApp campaigns'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main View: Either Template Details View or Tab Shell */}
      {selectedDetailTemplateId ? (
        <TemplateDetailsView
          templateId={selectedDetailTemplateId}
          onBack={() => setSelectedDetailTemplateId(null)}
          onEdit={(tpl) => handleStartEdit(tpl)}
          onDuplicate={(tpl) => handleStartDuplicate(tpl)}
          onViewAccountInsights={() => {
            setSelectedDetailTemplateId(null);
            setActiveTab('billing');
          }}
        />
      ) : (
        <>
          {/* Tabs */}
          {isAdmin && (
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-px">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icons.Chat className="w-4 h-4" />
              <span>Message Templates</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBuilderTemplate(null);
                setBuilderMode('create');
                setActiveTab('builder');
              }}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'builder'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icons.Plus className="w-4 h-4" />
              <span>
                {builderMode === 'edit'
                  ? 'Edit Template'
                  : builderMode === 'duplicate'
                  ? 'Duplicate Template'
                  : 'Template Builder'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'bulk'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icons.WhatsApp className="w-4 h-4 text-[#25D366]" />
              <span>Bulk WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('phone_numbers')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'phone_numbers'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icons.Phone className="w-4 h-4" />
              <span>Phone Numbers & Quality</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icons.User className="w-4 h-4" />
              <span>Business Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'billing'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icons.Settings className="w-4 h-4" />
              <span>Analytics & Billing</span>
            </button>
          </div>

          )}

          {/* Tab Panels */}
          {activeTab === 'templates' && (
            <TemplatesList
              onCreateClick={handleStartCreate}
              onEdit={handleStartEdit}
              onDuplicate={handleStartDuplicate}
              onViewDetails={(tpl) => setSelectedDetailTemplateId(tpl._id)}
            />
          )}

          {activeTab === 'builder' && (
            <TemplateBuilder
              initialTemplate={builderTemplate}
              mode={builderMode}
              onSuccess={handleBuilderFinished}
              onCancel={handleBuilderFinished}
            />
          )}

          {activeTab === 'bulk' && (
            <div className="pt-2">
              <BulkMsgView currentUser={currentUser ?? null} embedded={true} />
            </div>
          )}

          {activeTab === 'phone_numbers' && (
            <PhoneNumbersTab />
          )}

          {activeTab === 'profile' && (
            <BusinessProfileTab />
          )}

          {activeTab === 'billing' && (
            <div className="pt-2">
              <WhatsAppBillingView />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WhatsAppManagerView;
