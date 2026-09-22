import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Plus, Link, Copy, Check, ExternalLink, 
  Trash2, ShieldCheck, Tag, Users, Sparkles, Briefcase, Share2
} from 'lucide-react';
import { SharedCalendar } from '../../types';
import { CALENDAR_COLORS, DEFAULT_PRODUCT_SERVICES } from './calendarHelpers';
import { getPublicOrigin } from '../../utils/url';

interface CalendarManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendars: SharedCalendar[];
  activeCalendarId: string;
  onSelectCalendar: (id: string) => void;
  onSaveCalendar: (calendar: SharedCalendar) => Promise<void>;
  onDeleteCalendar: (id: string) => Promise<void>;
  lang: 'nl' | 'en';
}

export const CalendarManageModal: React.FC<CalendarManageModalProps> = ({
  isOpen,
  onClose,
  calendars,
  activeCalendarId,
  onSelectCalendar,
  onSaveCalendar,
  onDeleteCalendar,
  lang
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'create' | 'share'>('manage');
  const [editingCalendar, setEditingCalendar] = useState<SharedCalendar | null>(null);

  // Form states for creating/editing a shared calendar
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [productService, setProductService] = useState('');
  const [customProductInput, setCustomProductInput] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('indigo');
  const [defaultHandlers, setDefaultHandlers] = useState<string[]>([]);
  const [handlerInput, setHandlerInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (editingCalendar) {
      setName(editingCalendar.name || '');
      setSlug(editingCalendar.slug || '');
      const ps = editingCalendar.productService || '';
      if (DEFAULT_PRODUCT_SERVICES.includes(ps)) {
        setProductService(ps);
        setCustomProductInput('');
      } else if (ps) {
        setProductService('custom');
        setCustomProductInput(ps);
      } else {
        setProductService(DEFAULT_PRODUCT_SERVICES[0]);
        setCustomProductInput('');
      }
      setDescription(editingCalendar.description || '');
      setColor(editingCalendar.color || 'indigo');
      setDefaultHandlers(editingCalendar.defaultHandlers ? [...editingCalendar.defaultHandlers] : []);
    } else {
      setName('');
      setSlug('');
      setProductService(DEFAULT_PRODUCT_SERVICES[0]);
      setCustomProductInput('');
      setDescription('');
      setColor('indigo');
      setDefaultHandlers(['Aldo Spit', 'Jan-Willem de Groot', 'Support Desk']);
    }
  }, [editingCalendar]);

  if (!isOpen) return null;

  const generateSlugFromName = (input: string) => {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCalendar) {
      setSlug(generateSlugFromName(val));
    }
  };

  const handleAddHandler = () => {
    const trimmed = handlerInput.trim();
    if (trimmed && !defaultHandlers.includes(trimmed)) {
      setDefaultHandlers([...defaultHandlers, trimmed]);
      setHandlerInput('');
    }
  };

  const handleRemoveHandler = (item: string) => {
    setDefaultHandlers(defaultHandlers.filter(h => h !== item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(lang === 'nl' ? 'Geef de agenda een naam.' : 'Please give the calendar a name.');
      return;
    }

    const finalSlug = (slug.trim() || generateSlugFromName(name)) || `agenda-${Date.now()}`;
    const finalProduct = productService === 'custom' ? customProductInput.trim() : productService;

    setIsSaving(true);
    try {
      const calendarToSave: SharedCalendar = {
        id: editingCalendar ? editingCalendar.id : `sc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        slug: finalSlug,
        name: name.trim(),
        productService: finalProduct || 'ITPT Diensten',
        description: description.trim(),
        color,
        defaultHandlers,
        createdAt: editingCalendar?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveCalendar(calendarToSave);
      onSelectCalendar(calendarToSave.id);
      setEditingCalendar(null);
      setActiveSubTab('manage');
    } catch (err) {
      console.error("Error saving calendar:", err);
      alert(lang === 'nl' ? 'Fout bij opslaan agenda.' : 'Error saving calendar.');
    } finally {
      setIsSaving(false);
    }
  };

  const getCalendarUrl = (cal: SharedCalendar) => {
    const origin = getPublicOrigin();
    return `${origin}${window.location.pathname}?sharedCalendar=${encodeURIComponent(cal.slug || cal.id)}`;
  };

  const handleCopyLink = (cal: SharedCalendar) => {
    const url = getCalendarUrl(cal);
    navigator.clipboard.writeText(url);
    setCopiedId(cal.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in" id="calendar-manage-modal">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {lang === 'nl' ? 'Beheer Gedeelde Agenda’s' : 'Manage Shared Calendars'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {lang === 'nl' 
                  ? 'Creëer en beheer aparte agenda’s per product, dienst of afdeling met unieke deelbare URLs'
                  : 'Create & manage individual calendars per product or service with unique shareable links'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            id="close-manage-modal-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            onClick={() => {
              setActiveSubTab('manage');
              setEditingCalendar(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeSubTab === 'manage' && !editingCalendar
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{lang === 'nl' ? 'Alle Agenda’s' : 'All Calendars'} ({calendars.length})</span>
          </button>

          <button
            onClick={() => {
              setEditingCalendar(null);
              setActiveSubTab('create');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeSubTab === 'create' || editingCalendar
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
            id="create-new-calendar-tab-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{editingCalendar ? (lang === 'nl' ? 'Agenda Bewerken' : 'Edit Calendar') : (lang === 'nl' ? '+ Nieuwe Agenda Aanmaken' : '+ Create New Calendar')}</span>
          </button>
        </div>

        {/* Tab 1: Manage Existing Calendars */}
        {activeSubTab === 'manage' && !editingCalendar && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {lang === 'nl' ? 'Beschikbare Gedeelde Agenda’s' : 'Available Shared Calendars'}
              </span>
              <button
                onClick={() => {
                  setEditingCalendar(null);
                  setActiveSubTab('create');
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'nl' ? 'Nieuwe Agenda' : 'New Calendar'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {calendars.map(cal => {
                const isActive = cal.id === activeCalendarId;
                const calColor = CALENDAR_COLORS[cal.color] || CALENDAR_COLORS.indigo;
                const shareUrl = getCalendarUrl(cal);

                return (
                  <div
                    key={cal.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-indigo-50/40 border-indigo-300 ring-2 ring-indigo-100 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-3.5 h-3.5 rounded-full mt-1 shrink-0 ${calColor.bg}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{cal.name}</h4>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider">
                                {lang === 'nl' ? 'Actief geselecteerd' : 'Active'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-indigo-700 font-semibold mt-0.5 flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            <span>{cal.productService || 'Algemene Dienst'}</span>
                          </p>
                          {cal.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{cal.description}</p>
                          )}
                          {cal.defaultHandlers && cal.defaultHandlers.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-2">
                              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Behandelaren:</span>
                              {cal.defaultHandlers.map(h => (
                                <span key={h} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Open Button */}
                        {!isActive && (
                          <button
                            onClick={() => {
                              onSelectCalendar(cal.id);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                          >
                            {lang === 'nl' ? 'Open Agenda' : 'Open'}
                          </button>
                        )}

                        {/* Copy Share URL Button */}
                        <button
                          onClick={() => handleCopyLink(cal)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            copiedId === cal.id 
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs' 
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                          title={shareUrl}
                        >
                          {copiedId === cal.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedId === cal.id ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Deelbare URL' : 'Share Link')}</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingCalendar(cal);
                            setActiveSubTab('create');
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                          title="Bewerken"
                        >
                          {lang === 'nl' ? 'Bewerken' : 'Edit'}
                        </button>

                        {/* Delete Button */}
                        {calendars.length > 1 && (
                          confirmDeleteId === cal.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  await onDeleteCalendar(cal.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                              >
                                {lang === 'nl' ? 'Ja, wis' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(cal.id)}
                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                              title="Verwijderen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Quick direct link display */}
                    <div className="mt-3 pt-2.5 border-t border-slate-150 flex items-center justify-between text-[11px] text-slate-500 font-mono overflow-hidden">
                      <span className="truncate max-w-md select-all text-indigo-900 bg-slate-100/80 px-2 py-0.5 rounded">
                        {shareUrl}
                      </span>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-indigo-600 hover:underline flex items-center gap-1 shrink-0 font-sans font-semibold"
                      >
                        <span>{lang === 'nl' ? 'Test URL' : 'Test Link'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Create or Edit Calendar Form */}
        {(activeSubTab === 'create' || editingCalendar) && (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {lang === 'nl' ? 'Naam van de Agenda *' : 'Calendar Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={lang === 'nl' ? 'Bijv. Cloud Werkplekken & M365 Dienstverlening' : 'e.g. Cloud Workspaces & M365 Services'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-semibold text-slate-900"
                  id="manage-calendar-name-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {lang === 'nl' ? 'Product en/of Dienst' : 'Product / Service'}
                  </label>
                  <select
                    value={productService}
                    onChange={(e) => setProductService(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 text-xs font-semibold text-slate-800 bg-white"
                  >
                    {DEFAULT_PRODUCT_SERVICES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="custom">{lang === 'nl' ? '✏️ Ander product / dienst...' : '✏️ Other product / service...'}</option>
                  </select>
                  {productService === 'custom' && (
                    <input
                      type="text"
                      value={customProductInput}
                      onChange={(e) => setCustomProductInput(e.target.value)}
                      placeholder={lang === 'nl' ? 'Typ naam van dienst' : 'Type service name'}
                      className="w-full mt-2 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-medium text-slate-800 bg-indigo-50/40"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {lang === 'nl' ? 'Unieke URL Slug / Alias' : 'Unique URL Slug'}
                  </label>
                  <div className="flex items-center">
                    <span className="px-2.5 py-2 bg-slate-100 border border-r-0 border-slate-200 text-slate-500 text-xs rounded-l-xl font-mono">
                      ?sharedCalendar=
                    </span>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="cloud-werkplekken"
                      className="w-full px-3 py-2 rounded-r-xl border border-slate-200 focus:border-indigo-500 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {lang === 'nl' ? 'Toelichting / Doel van deze Agenda' : 'Description / Goal'}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={lang === 'nl' ? 'Gedeelde agenda voor afspraken, intakes en opleveringen rondom Cloud Werkplekken...' : 'Shared agenda for appointments and deliveries...'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              {/* Color Theme */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{lang === 'nl' ? 'Themakleur' : 'Theme Color'}</span>
                </label>
                <div className="flex items-center gap-2">
                  {Object.keys(CALENDAR_COLORS).map(cKey => (
                    <button
                      type="button"
                      key={cKey}
                      onClick={() => setColor(cKey)}
                      className={`w-7 h-7 rounded-full ${CALENDAR_COLORS[cKey].bg} transition-all cursor-pointer flex items-center justify-center ${
                        color === cKey ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={cKey}
                    >
                      {color === cKey && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Handlers */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{lang === 'nl' ? 'Standaard Behandelaren van dit Product/Dienst' : 'Default Handlers'}</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  {lang === 'nl' 
                    ? 'Deze namen worden als snelkeuze getoond bij het inplannen van nieuwe afspraken.'
                    : 'These names will be pre-suggested when scheduling appointments.'}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 min-h-8 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  {defaultHandlers.map(h => (
                    <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs">
                      <span>{h}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHandler(h)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={handlerInput}
                    onChange={(e) => setHandlerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHandler();
                      }
                    }}
                    placeholder={lang === 'nl' ? 'Naam behandelaar toevoegen (bijv. Aldo Spit)' : 'Add handler name...'}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddHandler}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    + Toevoegen
                  </button>
                </div>
              </div>
            </div>

            {/* Submit / Cancel Footer */}
            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setEditingCalendar(null);
                  setActiveSubTab('manage');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
              >
                {lang === 'nl' ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>{isSaving ? '...' : (lang === 'nl' ? 'Agenda Opslaan' : 'Save Calendar')}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
