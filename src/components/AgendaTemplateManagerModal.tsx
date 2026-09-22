import React, { useState, useEffect } from 'react';
import { AgendaTemplate, Language } from '../types';
import { agendaTemplateService } from '../services/agendaTemplateService';
import { 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  RotateCcw, 
  Check, 
  Search, 
  Sparkles, 
  BookOpen, 
  FileText, 
  Eye, 
  Save, 
  Layers,
  ChevronRight,
  HelpCircle,
  Tag
} from 'lucide-react';

interface AgendaTemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSelectTemplate?: (templateHtml: string) => void;
  initialSelectedId?: string;
  currentAgendaHtmlToSave?: string;
}

const CATEGORY_LABELS: Record<string, { nl: string; en: string; color: string }> = {
  all: { nl: 'Alle Sjablonen', en: 'All Templates', color: 'bg-slate-100 text-slate-700' },
  stuurgroep: { nl: 'Stuurgroep & Directie', en: 'Steering Committee', color: 'bg-purple-100 text-purple-700' },
  kenniskring: { nl: 'Kenniskringen & CoP', en: 'Knowledge Circles', color: 'bg-amber-100 text-amber-700' },
  projectteam: { nl: 'Projectteam & Expertteam', en: 'Project Team', color: 'bg-indigo-100 text-indigo-700' },
  bila: { nl: 'Bila (1-op-1)', en: '1-on-1', color: 'bg-blue-100 text-blue-700' },
  brainstorm: { nl: 'Brainstorm & Workshop', en: 'Brainstorm', color: 'bg-rose-100 text-rose-700' },
  kickoff: { nl: 'Kick-off Overleg', en: 'Kick-off', color: 'bg-emerald-100 text-emerald-700' },
  retro: { nl: 'Retrospective & Evaluatie', en: 'Retrospective', color: 'bg-teal-100 text-teal-700' },
  algemeen: { nl: 'Algemeen Overleg', en: 'General', color: 'bg-slate-100 text-slate-700' },
  custom: { nl: 'Eigen Sjablonen', en: 'Custom Templates', color: 'bg-sky-100 text-sky-700' }
};

export const AgendaTemplateManagerModal: React.FC<AgendaTemplateManagerModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSelectTemplate,
  initialSelectedId,
  currentAgendaHtmlToSave
}) => {
  const isNl = lang === 'nl';
  const [templates, setTemplates] = useState<AgendaTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit / Create mode
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editId, setEditId] = useState('');
  const [editNameNl, setEditNameNl] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editIcon, setEditIcon] = useState('📋');
  const [editCategory, setEditCategory] = useState<AgendaTemplate['category']>('custom');
  const [editDescriptionNl, setEditDescriptionNl] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  // Load templates on open
  useEffect(() => {
    if (isOpen) {
      const list = agendaTemplateService.getTemplates();
      setTemplates(list);
      if (initialSelectedId && list.some(t => t.id === initialSelectedId)) {
        setSelectedTemplateId(initialSelectedId);
      } else if (list.length > 0) {
        setSelectedTemplateId(list[0].id);
      }

      // If user provided agenda content to save as new template
      if (currentAgendaHtmlToSave && currentAgendaHtmlToSave.trim().length > 10) {
        startNewTemplateFromContent(currentAgendaHtmlToSave);
      } else {
        setIsEditing(false);
        setIsCreatingNew(false);
      }
    }
  }, [isOpen, initialSelectedId, currentAgendaHtmlToSave]);

  if (!isOpen) return null;

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const filteredTemplates = templates.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (t.nameNl || '').toLowerCase().includes(q) || (t.nameEn || '').toLowerCase().includes(q);
      const matchDesc = (t.descriptionNl || '').toLowerCase().includes(q) || (t.descriptionEn || '').toLowerCase().includes(q);
      const matchHtml = (t.html || '').toLowerCase().includes(q);
      return matchName || matchDesc || matchHtml;
    }
    return true;
  });

  const handleStartEdit = (t: AgendaTemplate) => {
    setIsEditing(true);
    setIsCreatingNew(false);
    setEditId(t.id);
    setEditNameNl(t.nameNl);
    setEditNameEn(t.nameEn || t.nameNl);
    setEditIcon(t.icon || '📋');
    setEditCategory(t.category || 'custom');
    setEditDescriptionNl(t.descriptionNl || '');
    setEditHtml(t.html);
  };

  const startNewTemplateFromContent = (contentHtml?: string) => {
    setIsEditing(true);
    setIsCreatingNew(true);
    const newId = `custom-tmpl-${Date.now()}`;
    setEditId(newId);
    setEditNameNl(isNl ? 'Mijn Nieuwe Overleg Agenda' : 'My New Meeting Agenda');
    setEditNameEn('My New Meeting Agenda');
    setEditIcon('✨');
    setEditCategory('custom');
    setEditDescriptionNl(isNl ? 'Zelf samengesteld sjabloon voor periodiek overleg.' : 'Customized meeting template.');
    setEditHtml(contentHtml || `<h2>Nieuwe Agenda</h2>\n<p><em>Doel van dit overleg...</em></p>\n<hr/>\n<h3>1. Opening &amp; Mededelingen</h3>\n<p>Toelichting...</p>\n<h3>2. Hoofdonderwerp</h3>\n<p>Inhoudelijke bespreking...</p>\n<h3>3. Acties &amp; Afspraken</h3>\n<p>Wie pakt wat op?</p>`);
  };

  const handleSaveEdit = () => {
    if (!editNameNl.trim()) {
      alert(isNl ? 'Vul a.u.b. een naam in voor het sjabloon.' : 'Please enter a name for the template.');
      return;
    }
    if (!editHtml.trim()) {
      alert(isNl ? 'Het sjabloon mag niet leeg zijn.' : 'The template content cannot be empty.');
      return;
    }

    const updated: AgendaTemplate = {
      id: editId,
      nameNl: editNameNl.trim(),
      nameEn: editNameEn.trim() || editNameNl.trim(),
      icon: editIcon || '📋',
      category: editCategory || 'custom',
      descriptionNl: editDescriptionNl.trim(),
      descriptionEn: editDescriptionNl.trim(),
      html: editHtml,
      isCustom: true
    };

    const nextList = agendaTemplateService.saveTemplate(updated);
    setTemplates(nextList);
    setSelectedTemplateId(updated.id);
    setIsEditing(false);
    setIsCreatingNew(false);

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    if (!window.confirm(isNl 
      ? `Weet u zeker dat u het sjabloon "${name}" wilt verwijderen?` 
      : `Are you sure you want to delete template "${name}"?`)) {
      return;
    }

    const nextList = agendaTemplateService.deleteTemplate(id);
    setTemplates(nextList);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(nextList.length > 0 ? nextList[0].id : null);
    }
    if (editId === id) {
      setIsEditing(false);
      setIsCreatingNew(false);
    }
  };

  const handleDuplicateTemplate = (t: AgendaTemplate) => {
    const dup: AgendaTemplate = {
      ...t,
      id: `copy-${Date.now()}`,
      nameNl: `${t.nameNl} (${isNl ? 'Kopie' : 'Copy'})`,
      nameEn: `${t.nameEn} (Copy)`,
      isCustom: true,
      category: 'custom'
    };
    const nextList = agendaTemplateService.saveTemplate(dup);
    setTemplates(nextList);
    setSelectedTemplateId(dup.id);
    handleStartEdit(dup);
  };

  const handleResetDefaults = () => {
    if (!window.confirm(isNl
      ? 'Weet u zeker dat u alle standaardsjablonen wilt herstellen? Uw eigen aangemaakte sjablonen kunnen hierdoor worden overschreven of teruggezet naar fabrieksinstellingen.'
      : 'Are you sure you want to reset templates to defaults?')) {
      return;
    }
    const resetList = agendaTemplateService.resetToDefaults();
    setTemplates(resetList);
    setSelectedTemplateId(resetList[0]?.id || null);
    setIsEditing(false);
    setIsCreatingNew(false);
  };

  const handleApply = (html: string) => {
    if (onSelectTemplate) {
      onSelectTemplate(html);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
      <div className="bg-white rounded-2xl max-w-5xl w-full h-[90vh] max-h-[850px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                {isNl ? 'Agenda Sjablonen Beheer' : 'Meeting Agenda Templates'}
                <span className="text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                  {templates.length} {isNl ? 'beschikbaar' : 'available'}
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                {isNl 
                  ? 'Kies, beheer, bewerk en creëer overlegagenda\'s (Stuurgroepen, Kenniskringen, Projectteams, Bila\'s etc.)'
                  : 'Manage and customize meeting agenda templates for steering groups, knowledge circles, project teams, etc.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startNewTemplateFromContent()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {isNl ? 'Nieuw Sjabloon' : 'New Template'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isNl ? 'Zoek op sjabloonnaam, thema of inhoud...' : 'Search templates...'}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Pill Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            {Object.entries(CATEGORY_LABELS).map(([catKey, info]) => {
              const count = catKey === 'all' 
                ? templates.length 
                : templates.filter(t => t.category === catKey).length;
              if (count === 0 && catKey !== 'all' && catKey !== 'custom') return null;

              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setActiveCategory(catKey)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === catKey
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isNl ? info.nl : info.en} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-2 py-1 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
              title={isNl ? 'Herstel standaardsjablonen naar fabrieksinstellingen' : 'Reset to default templates'}
            >
              <RotateCcw className="h-3 w-3" />
              {isNl ? 'Herstel Fabrieksinstellingen' : 'Reset Defaults'}
            </button>
          </div>
        </div>

        {/* Main Content Area: Left Sidebar (List) + Right Pane (Preview or Editor) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left: Template List */}
          <div className="w-full md:w-80 border-r border-slate-200 overflow-y-auto bg-slate-50/50 flex flex-col">
            {filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold">{isNl ? 'Geen sjablonen gevonden' : 'No templates found'}</p>
                <button
                  type="button"
                  onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                  className="mt-2 text-[11px] text-indigo-600 font-bold hover:underline"
                >
                  {isNl ? 'Filters wissen' : 'Clear filters'}
                </button>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {filteredTemplates.map((t) => {
                  const isSelected = selectedTemplateId === t.id && !isCreatingNew;
                  const catLabel = CATEGORY_LABELS[t.category || 'algemeen'] || CATEGORY_LABELS['algemeen'];

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        if (isEditing) {
                          setIsEditing(false);
                          setIsCreatingNew(false);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/20'
                          : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{t.icon || '📋'}</span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                              {isNl ? t.nameNl : (t.nameEn || t.nameNl)}
                            </h4>
                            <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded mt-0.5 ${catLabel.color}`}>
                              {isNl ? catLabel.nl : catLabel.en}
                            </span>
                          </div>
                        </div>

                        {t.isCustom && (
                          <span className="text-[9px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.5 rounded-full">
                            {isNl ? 'Eigen' : 'Custom'}
                          </span>
                        )}
                      </div>

                      {t.descriptionNl && (
                        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-tight">
                          {isNl ? t.descriptionNl : (t.descriptionEn || t.descriptionNl)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Preview or Editor */}
          <div className="flex-1 overflow-y-auto bg-white flex flex-col p-4 md:p-6">
            {savedNotice && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Check className="h-4 w-4 text-emerald-600" />
                {isNl ? 'Sjabloon succesvol opgeslagen!' : 'Template saved successfully!'}
              </div>
            )}

            {isEditing ? (
              /* --- Edit Mode --- */
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-indigo-600" />
                    {isCreatingNew 
                      ? (isNl ? 'Nieuw Agenda Sjabloon Creëren' : 'Create New Agenda Template')
                      : (isNl ? `Sjabloon Aanpassen: ${editNameNl}` : `Edit Template: ${editNameNl}`)}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsEditing(false); setIsCreatingNew(false); }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                    >
                      {isNl ? 'Annuleren' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isNl ? 'Opslaan & Toepassen' : 'Save & Apply'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isNl ? 'Pictogram / Emoji' : 'Icon / Emoji'}
                    </label>
                    <input
                      type="text"
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      maxLength={4}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isNl ? 'Naam van het sjabloon *' : 'Template Name *'}
                    </label>
                    <input
                      type="text"
                      value={editNameNl}
                      onChange={(e) => setEditNameNl(e.target.value)}
                      placeholder={isNl ? 'Bijv. Stuurgroep RDNG / Bila Kwartaal' : 'e.g. Steering committee'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isNl ? 'Categorie' : 'Category'}
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="stuurgroep">{isNl ? '🏛️ Stuurgroep & Directie' : 'Steering Committee'}</option>
                      <option value="kenniskring">{isNl ? '💡 Kenniskringen & CoP' : 'Knowledge Circles'}</option>
                      <option value="projectteam">{isNl ? '👥 Projectteam & Expertteam' : 'Project Team'}</option>
                      <option value="bila">{isNl ? '🤝 Bila (1-op-1)' : '1-on-1'}</option>
                      <option value="brainstorm">{isNl ? '🚀 Brainstorm & Innovatie' : 'Brainstorm'}</option>
                      <option value="kickoff">{isNl ? '🎯 Kick-off Overleg' : 'Kick-off'}</option>
                      <option value="retro">{isNl ? '🔄 Retrospective & Evaluatie' : 'Retrospective'}</option>
                      <option value="algemeen">{isNl ? '📋 Algemeen Overleg' : 'General'}</option>
                      <option value="custom">{isNl ? '⭐ Eigen Sjabloon' : 'Custom'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {isNl ? 'Korte Toelichting / Doel' : 'Short Description / Goal'}
                    </label>
                    <input
                      type="text"
                      value={editDescriptionNl}
                      onChange={(e) => setEditDescriptionNl(e.target.value)}
                      placeholder={isNl ? 'Waarvoor dient dit overlegsjabloon?' : 'What is this template for?'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {isNl ? 'Inhoud Agenda (HTML / Tekst)' : 'Agenda Content (HTML / Text)'}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {isNl ? 'Ondersteunt <h2>, <h3>, <ul>, <li>, <p> en tijdsbadges' : 'Supports standard HTML tags'}
                    </span>
                  </div>
                  <textarea
                    rows={12}
                    value={editHtml}
                    onChange={(e) => setEditHtml(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-400 leading-relaxed"
                  />
                </div>
              </div>
            ) : selectedTemplate ? (
              /* --- Preview Mode --- */
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Title & Action Bar */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 mb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{selectedTemplate.icon || '📋'}</span>
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {isNl ? selectedTemplate.nameNl : (selectedTemplate.nameEn || selectedTemplate.nameNl)}
                        </h3>
                        {selectedTemplate.isCustom && (
                          <span className="text-[10px] bg-sky-100 text-sky-800 font-extrabold px-2 py-0.5 rounded-full">
                            {isNl ? 'Eigen sjabloon' : 'Custom template'}
                          </span>
                        )}
                      </div>
                      {selectedTemplate.descriptionNl && (
                        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                          {isNl ? selectedTemplate.descriptionNl : (selectedTemplate.descriptionEn || selectedTemplate.descriptionNl)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(selectedTemplate)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={isNl ? 'Pas dit sjabloon aan' : 'Edit this template'}
                      >
                        <Edit3 className="h-3.5 w-3.5 text-slate-600" />
                        {isNl ? 'Aanpassen' : 'Edit'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateTemplate(selectedTemplate)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={isNl ? 'Dupliceer en maak een kopie' : 'Duplicate template'}
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-600" />
                        {isNl ? 'Dupliceren' : 'Duplicate'}
                      </button>

                      {selectedTemplate.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(selectedTemplate.id, selectedTemplate.nameNl)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={isNl ? 'Verwijder dit sjabloon' : 'Delete template'}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          {isNl ? 'Verwijderen' : 'Delete'}
                        </button>
                      )}

                      {onSelectTemplate && (
                        <button
                          type="button"
                          onClick={() => handleApply(selectedTemplate.html)}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {isNl ? 'Toepassen in Agenda' : 'Use in Agenda'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rendered Template Preview Card */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 shadow-inner">
                    <div className="max-w-none prose prose-slate text-sm leading-relaxed [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-indigo-950 [&>h2]:mt-2 [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-slate-800 [&>h3]:mt-3 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:my-1.5 [&>hr]:my-3 [&>hr]:border-slate-200">
                      <div dangerouslySetInnerHTML={{ __html: selectedTemplate.html }} />
                    </div>
                  </div>
                </div>

                {/* Bottom Footer Callout */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    {isNl 
                      ? 'Tip: Pas elk sjabloon naar eigen inzicht aan of sla uw huidige agenda op als nieuw herbruikbaar sjabloon.'
                      : 'Tip: Customize any template or save your current agenda as a new reusable template.'}
                  </span>

                  {onSelectTemplate && (
                    <button
                      type="button"
                      onClick={() => handleApply(selectedTemplate.html)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Check className="h-4 w-4" />
                      {isNl ? 'Kies dit sjabloon' : 'Select this template'}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgendaTemplateManagerModal;
