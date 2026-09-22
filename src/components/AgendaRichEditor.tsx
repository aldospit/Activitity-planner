import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  List, 
  ListOrdered, 
  Heading2, 
  Heading3, 
  AlignLeft, 
  AlignCenter, 
  Image as ImageIcon, 
  Clock, 
  Sparkles, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckSquare, 
  Quote, 
  Minus, 
  Maximize2, 
  Minimize2,
  Upload,
  Link as LinkIcon,
  X
} from 'lucide-react';
import { Language, AgendaTemplate } from '../types';
import { agendaTemplateService } from '../services/agendaTemplateService';
import AgendaTemplateManagerModal from './AgendaTemplateManagerModal';

interface AgendaRichEditorProps {
  value: string;
  onChange: (htmlContent: string) => void;
  lang: Language;
  agendaStatus?: 'concept' | 'definitief' | 'verzonden';
  onStatusChange?: (status: 'concept' | 'definitief' | 'verzonden') => void;
  meetingTitle?: string;
  meetingDate?: string;
  meetingTime?: string;
}

export const AgendaRichEditor: React.FC<AgendaRichEditorProps> = ({
  value,
  onChange,
  lang,
  agendaStatus = 'concept',
  onStatusChange,
  meetingTitle,
  meetingDate,
  meetingTime
}) => {
  const isNl = lang === 'nl';
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templatesList, setTemplatesList] = useState<AgendaTemplate[]>(() => agendaTemplateService.getTemplates());
  const [showTemplateManagerModal, setShowTemplateManagerModal] = useState(false);
  const [saveCurrentToTemplate, setSaveCurrentToTemplate] = useState(false);

  // Sync templates from service periodically or when active
  useEffect(() => {
    setTemplatesList(agendaTemplateService.getTemplates());
  }, [showTemplateMenu, showTemplateManagerModal]);

  // Sync initial content to editor when tab changes to edit
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value, activeTab]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (command: string, arg?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, arg);
    handleEditorInput();
  };

  const insertHeading = (level: 'h2' | 'h3' | 'p') => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('formatBlock', false, `<${level}>`);
    handleEditorInput();
  };

  const insertTimeBadge = () => {
    const timePrompt = prompt(
      isNl ? 'Tijdsduur van het agendapunt (bijv. "15 min" of "10:00 - 10:30"):' : 'Time duration (e.g. "15 min" or "10:00 - 10:30"):',
      '15 min'
    );
    if (!timePrompt) return;

    const badgeHtml = `&nbsp;<span style="display:inline-block; background-color:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; vertical-align:middle; border:1px solid #c7d2fe;">⏱️ ${timePrompt}</span>&nbsp;`;
    execCmd('insertHTML', badgeHtml);
  };

  const insertCalloutBox = () => {
    const calloutHtml = `
      <div style="background-color:#f8fafc; border-left:4px solid #4f46e5; padding:12px 16px; margin:14px 0; border-radius:0 8px 8px 0; color:#1e293b;">
        <strong>💡 Belangrijke voorbereiding / Toelichting:</strong>
        <p style="margin:4px 0 0 0; color:#475569; font-size:13px;">Typ hier eventuele leesstukken, documentverwijzingen of acties die deelnemers vooraf moeten doornemen.</p>
      </div><p></p>
    `;
    execCmd('insertHTML', calloutHtml);
  };

  const insertDivider = () => {
    execCmd('insertHorizontalRule');
  };

  // Image Upload and Processing
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert(isNl ? 'Selecteer a.u.b. een geldig afbeeldingsbestand (PNG, JPEG, WebP, GIF).' : 'Please select a valid image file.');
      return;
    }

    setImageUploading(true);
    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      const rawDataUrl = loadEvent.target?.result as string;
      
      // Compress and scale down image via canvas to keep Firestore document size small (< 400KB)
      const img = new Image();
      img.onload = () => {
        const maxWidth = 960;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          insertImageIntoEditor(compressedDataUrl, file.name.replace(/\.[^/.]+$/, ''));
          setImageUploading(false);
          setShowImageModal(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          insertImageIntoEditor(rawDataUrl, file.name);
          setImageUploading(false);
          setShowImageModal(false);
        }
      };
      img.onerror = () => {
        setImageUploading(false);
        alert(isNl ? 'Afbeelding kon niet worden geladen.' : 'Could not process image.');
      };
      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  };

  const handleInsertUrlImage = () => {
    if (!imageUrlInput.trim()) return;
    insertImageIntoEditor(imageUrlInput.trim(), imageCaptionInput.trim());
    setImageUrlInput('');
    setImageCaptionInput('');
    setShowImageModal(false);
  };

  const insertImageIntoEditor = (src: string, caption?: string) => {
    const captionHtml = caption ? `<figcaption style="text-align:center; font-size:12px; color:#64748b; margin-top:6px; font-style:italic;">${caption}</figcaption>` : '';
    const imageBlockHtml = `
      <figure style="margin:16px auto; max-width:100%; text-align:center;" class="agenda-image-figure">
        <img src="${src}" alt="${caption || 'Agenda afbeelding'}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid #e2e8f0; display:inline-block;" />
        ${captionHtml}
      </figure><p></p>
    `;
    execCmd('insertHTML', imageBlockHtml);
  };

  const handleApplyTemplate = (templateHtml: string) => {
    if (value && value.trim().length > 20) {
      if (!window.confirm(isNl 
        ? 'Weet u zeker dat u een nieuw sjabloon wilt toepassen? Uw huidige agendatekst wordt vervangen.' 
        : 'Are you sure you want to apply this template? Your current agenda text will be replaced.')) {
        return;
      }
    }
    onChange(templateHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = templateHtml;
    }
    setShowTemplateMenu(false);
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col transition-all ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'w-full'}`}>
      {/* Top Header & Status Bar */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
            <Edit3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {isNl ? 'Overleg Agenda Opstellen' : 'Prepare Meeting Agenda'}
              {meetingTitle && (
                <span className="text-slate-400 font-normal">| {meetingTitle}</span>
              )}
            </h3>
            {meetingDate && (
              <p className="text-[11px] text-slate-500">
                {meetingDate} {meetingTime ? `om ${meetingTime}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Selection */}
          {onStatusChange && (
            <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-slate-400 font-medium text-[11px]">
                {isNl ? 'Status:' : 'Status:'}
              </span>
              <select
                value={agendaStatus}
                onChange={(e) => onStatusChange(e.target.value as any)}
                className="bg-transparent font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
              >
                <option value="concept">{isNl ? '🟡 Concept' : '🟡 Draft'}</option>
                <option value="definitief">{isNl ? '🔵 Definitief' : '🔵 Final'}</option>
                <option value="verzonden">{isNl ? '🟢 Verzonden' : '🟢 Sent'}</option>
              </select>
            </div>
          )}

          {/* Quick Template Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>{isNl ? 'Sjablonen' : 'Templates'}</span>
            </button>

            {showTemplateMenu && (
              <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-40 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{isNl ? 'Kies een agendamodel' : 'Choose agenda model'}</span>
                  <span className="text-[10px] text-indigo-600 lowercase">{templatesList.length} items</span>
                </div>

                <div className="py-1 space-y-0.5 max-h-56 overflow-y-auto">
                  {templatesList.map(tmpl => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl.html)}
                      className="w-full text-left px-2.5 py-2 hover:bg-indigo-50 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{tmpl.icon || '📋'}</span>
                        <span className="truncate group-hover:text-indigo-900 font-semibold">{isNl ? tmpl.nameNl : (tmpl.nameEn || tmpl.nameNl)}</span>
                      </div>
                      {tmpl.isCustom && (
                        <span className="text-[9px] bg-sky-100 text-sky-700 font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                          {isNl ? 'Eigen' : 'Custom'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-2 mt-1 border-t border-slate-100 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateMenu(false);
                      setSaveCurrentToTemplate(false);
                      setShowTemplateManagerModal(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>⚙️</span>
                    <span>{isNl ? 'Beheer alle sjablonen...' : 'Manage all templates...'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateMenu(false);
                      setSaveCurrentToTemplate(true);
                      setShowTemplateManagerModal(true);
                    }}
                    disabled={!value || value.trim().length < 15}
                    className="w-full text-left px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    title={isNl ? 'Sla de huidige agenda-inhoud op als nieuw herbruikbaar sjabloon' : 'Save current agenda as reusable template'}
                  >
                    <span>💾</span>
                    <span>{isNl ? 'Huidige agenda opslaan als sjabloon...' : 'Save current agenda as template...'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Edit / Preview Tabs */}
          <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'edit' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="h-3 w-3" />
              {isNl ? 'Bewerken' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'preview' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3 w-3" />
              {isNl ? 'Voorbeeld' : 'Preview'}
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
            title={isFullscreen ? (isNl ? 'Sluit volledig scherm' : 'Exit fullscreen') : (isNl ? 'Volledig scherm' : 'Fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Formatting Toolbar (Only in Edit mode) */}
      {activeTab === 'edit' && (
        <div className="p-2 border-b border-slate-100 bg-white flex flex-wrap items-center gap-1 text-xs">
          {/* Text Structure */}
          <div className="flex items-center border-r border-slate-200 pr-1.5 mr-1 gap-0.5">
            <button
              type="button"
              onClick={() => insertHeading('h2')}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-700 font-bold flex items-center gap-0.5"
              title={isNl ? 'Kop 2 (Titel agendapunt)' : 'Heading 2'}
            >
              <Heading2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[11px]">Kop 2</span>
            </button>
            <button
              type="button"
              onClick={() => insertHeading('h3')}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-700 font-semibold flex items-center gap-0.5"
              title={isNl ? 'Kop 3 (Deelonderwerp)' : 'Heading 3'}
            >
              <Heading3 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[11px]">Kop 3</span>
            </button>
            <button
              type="button"
              onClick={() => insertHeading('p')}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 text-[11px]"
              title={isNl ? 'Standaard tekst' : 'Paragraph'}
            >
              Tekst
            </button>
          </div>

          {/* Inline Styling */}
          <div className="flex items-center border-r border-slate-200 pr-1.5 mr-1 gap-0.5">
            <button
              type="button"
              onClick={() => execCmd('bold')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Vetgedrukt (Ctrl+B)' : 'Bold'}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('italic')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Cursief (Ctrl+I)' : 'Italic'}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('underline')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Onderstreept (Ctrl+U)' : 'Underline'}
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('strikeThrough')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Doorhalen' : 'Strikethrough'}
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center border-r border-slate-200 pr-1.5 mr-1 gap-0.5">
            <button
              type="button"
              onClick={() => execCmd('insertUnorderedList')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Opsommingstekens' : 'Bullet List'}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('insertOrderedList')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Genummerde lijst' : 'Numbered List'}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Components: Image, Time badge, Callout, Divider */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title={isNl ? 'Plaatje of schema toevoegen aan de agenda' : 'Add image or diagram to agenda'}
            >
              <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
              <span>{isNl ? 'Plaatje toevoegen' : 'Add Image'}</span>
            </button>

            <button
              type="button"
              onClick={insertTimeBadge}
              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title={isNl ? 'Tijdstip of duur invoegen (bijv. 15 min)' : 'Insert time tag'}
            >
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              <span>{isNl ? 'Tijdsindicatie' : 'Time tag'}</span>
            </button>

            <button
              type="button"
              onClick={insertCalloutBox}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Voorbereidingsbox / Toelichtingsblok invoegen' : 'Callout box'}
            >
              <Quote className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={insertDivider}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
              title={isNl ? 'Scheidingslijn invoegen' : 'Horizontal line'}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Body or Preview Body */}
      <div className="flex-1 min-h-[300px] max-h-[600px] overflow-y-auto p-4 md:p-6 bg-white">
        {activeTab === 'edit' ? (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            className="outline-none min-h-[260px] text-sm text-slate-800 leading-relaxed font-sans prose prose-slate max-w-none focus:ring-0 [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-indigo-950 [&>h2]:mt-4 [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-slate-800 [&>h3]:mt-3 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:my-1.5 [&>hr]:my-3 [&>hr]:border-slate-200"
            data-placeholder={isNl ? 'Typ hier uw agenda... Gebruik Kop 2 voor agendapunten, voeg tijden toe en sleep plaatjes naar de editor.' : 'Type your meeting agenda here...'}
          />
        ) : (
          <div className="prose prose-slate max-w-none text-sm leading-relaxed">
            {value ? (
              <div 
                dangerouslySetInnerHTML={{ __html: value }}
                className="[&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-indigo-950 [&>h2]:mt-4 [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-bold [&>h3]:text-slate-800 [&>h3]:mt-3 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:my-2 [&>hr]:my-4 [&>hr]:border-slate-200"
              />
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Edit3 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p>{isNl ? 'Er is nog geen agenda opgesteld voor dit overleg.' : 'No agenda has been prepared yet.'}</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-indigo-700"
                >
                  {isNl ? 'Start met agenda opstellen' : 'Start preparing agenda'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Footer Help / Stats */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex flex-wrap items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            {isNl ? '💡 Tip: Voeg per agendapunt een tijdsindicatie toe om de meeting strak te timen.' : '💡 Tip: Add time indicators per item to keep the meeting on schedule.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>{value ? value.replace(/<[^>]*>?/gm, '').length : 0} {isNl ? 'tekens' : 'chars'}</span>
        </div>
      </div>

      {/* Image Insertion Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-indigo-600" />
                {isNl ? 'Plaatje of Schema Toevoegen' : 'Add Image or Diagram'}
              </h3>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Option 1: File Upload */}
              <div className="p-4 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-xl text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                  className="hidden"
                  id="agenda-image-upload-input"
                />
                <label htmlFor="agenda-image-upload-input" className="cursor-pointer block">
                  <Upload className="h-8 w-8 text-indigo-600 mx-auto mb-1" />
                  <span className="text-xs font-bold text-indigo-900 block">
                    {imageUploading 
                      ? (isNl ? 'Bezig met verwerken & comprimeren...' : 'Processing...') 
                      : (isNl ? 'Klik om een plaatje te uploaden' : 'Click to upload an image')}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    PNG, JPG, WebP of GIF (automatisch geoptimaliseerd)
                  </span>
                </label>
              </div>

              <div className="relative text-center my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <span className="relative bg-white px-2 text-[11px] text-slate-400 font-medium uppercase">
                  {isNl ? 'Of via weblink' : 'Or via web link'}
                </span>
              </div>

              {/* Option 2: Image URL */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isNl ? 'Afbeeldings-URL (https://...)' : 'Image URL'}
                  </label>
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/schema-rdng.png"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isNl ? 'Bijschrift / Onderschrift (optioneel)' : 'Caption (optional)'}
                  </label>
                  <input
                    type="text"
                    value={imageCaptionInput}
                    onChange={(e) => setImageCaptionInput(e.target.value)}
                    placeholder={isNl ? 'Bijv. Architectuur diagram fase 2' : 'e.g. Phase 2 diagram'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {isNl ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleInsertUrlImage}
                  disabled={!imageUrlInput.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {isNl ? 'Invoegen' : 'Insert'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agenda Template Manager Modal */}
      <AgendaTemplateManagerModal
        isOpen={showTemplateManagerModal}
        onClose={() => {
          setShowTemplateManagerModal(false);
          setSaveCurrentToTemplate(false);
          setTemplatesList(agendaTemplateService.getTemplates());
        }}
        lang={lang}
        onSelectTemplate={(html) => handleApplyTemplate(html)}
        currentAgendaHtmlToSave={saveCurrentToTemplate ? value : undefined}
      />
    </div>
  );
};

export default AgendaRichEditor;
