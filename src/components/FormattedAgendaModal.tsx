import React, { useState, useRef } from 'react';
import { Meeting, Language } from '../types';
import ITPlatformTwenteLogo from './ITPlatformTwenteLogo';
import { 
  X, 
  Download, 
  Printer, 
  Copy, 
  Send, 
  Check, 
  Sliders, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Sparkles, 
  Eye, 
  Layers,
  Palette,
  Type
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';

interface FormattedAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  lang: Language;
  onSendEmail?: (meeting: Meeting) => void;
}

type BackgroundStyle = 'frosted_light' | 'frosted_dark' | 'ultra_transparent' | 'solid_light' | 'subtle_mesh';
type HeaderGradient = 'itpt_indigo' | 'twente_red' | 'corporate_slate' | 'emerald_modern';
type TextContrast = 'ultra_dark' | 'slate_dark' | 'navy_deep';
type FontSizeScale = 'normal' | 'large' | 'extralarge';

export const FormattedAgendaModal: React.FC<FormattedAgendaModalProps> = ({
  isOpen,
  onClose,
  meeting,
  lang,
  onSendEmail
}) => {
  const isNl = lang === 'nl';
  const exportRef = useRef<HTMLDivElement>(null);

  // Customization state
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>('frosted_light');
  const [headerGradient, setHeaderGradient] = useState<HeaderGradient>('itpt_indigo');
  const [textContrast, setTextContrast] = useState<TextContrast>('ultra_dark');
  const [fontSizeScale, setFontSizeScale] = useState<FontSizeScale>('normal');
  const [glassOpacity, setGlassOpacity] = useState<number>(85); // percentage
  
  // Toggles
  const [showLogo, setShowLogo] = useState(true);
  const [showMeta, setShowMeta] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showFooter, setShowFooter] = useState(true);

  // UI state
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  if (!isOpen || !meeting) return null;

  // Header background gradients
  const HEADER_GRADIENTS: Record<HeaderGradient, { class: string; label: string }> = {
    itpt_indigo: { 
      class: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white border-b-2 border-indigo-500', 
      label: 'ITPT Indigo' 
    },
    twente_red: { 
      class: 'bg-gradient-to-r from-neutral-900 via-neutral-900 to-red-950 text-white border-b-2 border-red-600', 
      label: 'Twente Accent' 
    },
    corporate_slate: { 
      class: 'bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 text-white border-b-2 border-slate-400', 
      label: 'Strak Leisteen' 
    },
    emerald_modern: { 
      class: 'bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white border-b-2 border-emerald-500', 
      label: 'Modern Emerald' 
    }
  };

  // Text contrast color configurations
  const TEXT_CONTRAST_CLASSES: Record<TextContrast, string> = {
    ultra_dark: 'text-neutral-950 font-medium [&>h2]:text-neutral-950 [&>h3]:text-neutral-900 [&>p]:text-neutral-900 [&>ul]:text-neutral-900',
    slate_dark: 'text-slate-900 font-medium [&>h2]:text-slate-950 [&>h3]:text-slate-900 [&>p]:text-slate-800 [&>ul]:text-slate-800',
    navy_deep: 'text-sky-950 font-medium [&>h2]:text-sky-950 [&>h3]:text-sky-900 [&>p]:text-slate-900 [&>ul]:text-slate-900'
  };

  // Font size classes
  const FONT_SIZE_CLASSES: Record<FontSizeScale, string> = {
    normal: 'text-sm [&>h2]:text-base [&>h3]:text-sm',
    large: 'text-base [&>h2]:text-lg [&>h3]:text-base',
    extralarge: 'text-lg [&>h2]:text-xl [&>h3]:text-lg'
  };

  // Background style configuration for the agenda body
  const getGlassStyle = () => {
    const alpha = glassOpacity / 100;
    if (bgStyle === 'frosted_light') {
      return {
        backgroundColor: `rgba(255, 255, 255, ${alpha})`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226, 232, 240, 0.8)'
      };
    }
    if (bgStyle === 'frosted_dark') {
      return {
        backgroundColor: `rgba(15, 23, 42, ${alpha})`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(51, 65, 85, 0.6)',
        color: '#f8fafc'
      };
    }
    if (bgStyle === 'ultra_transparent') {
      return {
        backgroundColor: `rgba(255, 255, 255, ${Math.min(alpha * 0.4, 0.4)})`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.5)'
      };
    }
    if (bgStyle === 'subtle_mesh') {
      return {
        backgroundColor: `rgba(248, 250, 252, ${alpha})`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(203, 213, 225, 0.8)'
      };
    }
    return {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0'
    };
  };

  // Export to PNG using html2canvas-pro
  const handleExportPng = async () => {
    if (!exportRef.current) return;
    setIsExportingPng(true);
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null, // preserve transparency if wanted
        logging: false,
        onclone: (clonedDoc, clonedEl) => {
          const noPrints = clonedEl.querySelectorAll('.no-print-export');
          noPrints.forEach(el => ((el as HTMLElement).style.display = 'none'));
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `ITPT-Agenda-${meeting.title.replace(/[^a-zA-Z0-9]/g, '-')}-${meeting.date}.png`;
      link.click();
    } catch (err: any) {
      console.error('Failed to export agenda image:', err);
      alert(isNl ? `Fout bij het exporteren: ${err?.message || err}` : `Export error: ${err?.message || err}`);
    } finally {
      setIsExportingPng(false);
    }
  };

  // Copy Formatted HTML to clipboard
  const handleCopyHtml = async () => {
    if (!exportRef.current) return;
    try {
      const html = exportRef.current.outerHTML;
      await navigator.clipboard.writeText(html);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch (e) {
      console.error('Failed to copy HTML:', e);
    }
  };

  // Print or trigger PDF save
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-100 rounded-3xl max-w-5xl w-full max-h-[92vh] shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 my-auto">
        {/* Top Control Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                {isNl ? 'Opgemaakte Agenda (IT Platform Twente Formaat)' : 'Formatted Agenda (IT Platform Twente Style)'}
              </h2>
              <p className="text-xs text-slate-400">
                {isNl 
                  ? 'Moderne header met logo, doorzichtige achtergrond en contrasterende tekst' 
                  : 'Modern header with Twente branding, translucent backdrop and high-contrast typography'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPng}
              disabled={isExportingPng}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title={isNl ? 'Exporteer als hoge resolutie afbeelding' : 'Export PNG'}
            >
              <Download className="h-3.5 w-3.5" />
              {isExportingPng ? (isNl ? 'Exporteren...' : 'Exporting...') : 'Afbeelding (PNG)'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title={isNl ? 'Afdrukken of opslaan als PDF' : 'Print or save as PDF'}
            >
              <Printer className="h-3.5 w-3.5" />
              {isNl ? 'PDF / Print' : 'PDF / Print'}
            </button>

            <button
              type="button"
              onClick={handleCopyHtml}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title={isNl ? 'Kopieer opgemaakte HTML' : 'Copy HTML'}
            >
              {copiedHtml ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedHtml ? (isNl ? 'Gekopieerd!' : 'Copied!') : 'HTML'}
            </button>

            {onSendEmail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSendEmail(meeting);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title={isNl ? 'Verstuur direct naar genodigden via e-mail' : 'Send via email'}
              >
                <Send className="h-3.5 w-3.5" />
                {isNl ? 'E-mail Genodigden' : 'Email Attendees'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-2 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Customization Toolbar */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Background Style */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                {isNl ? 'Achtergrond:' : 'Background:'}
              </span>
              <select
                value={bgStyle}
                onChange={(e) => setBgStyle(e.target.value as BackgroundStyle)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="frosted_light">{isNl ? 'Doorschijnend Wit (Frosted Glass)' : 'Frosted Glass Light'}</option>
                <option value="ultra_transparent">{isNl ? 'Volledig Transparant (Ultra Glass)' : 'Ultra Transparent'}</option>
                <option value="subtle_mesh">{isNl ? 'Subtiele Waas (Soft Tint)' : 'Subtle Tint'}</option>
                <option value="solid_light">{isNl ? 'Strak Helder Wit (Effen)' : 'Clean Solid White'}</option>
                <option value="frosted_dark">{isNl ? 'Donker Transparant (Dark Glass)' : 'Dark Glass'}</option>
              </select>
            </div>

            {/* Header Theme */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                <Palette className="h-3.5 w-3.5 text-indigo-600" />
                {isNl ? 'Header Thema:' : 'Header:'}
              </span>
              <select
                value={headerGradient}
                onChange={(e) => setHeaderGradient(e.target.value as HeaderGradient)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="itpt_indigo">ITPT Indigo &amp; Wit</option>
                <option value="twente_red">Twente Rood &amp; Zwart</option>
                <option value="corporate_slate">Strak Leisteen (Slate)</option>
                <option value="emerald_modern">Modern Emerald</option>
              </select>
            </div>

            {/* Contrast Mode */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                <Type className="h-3.5 w-3.5 text-indigo-600" />
                {isNl ? 'Tekstcontrast:' : 'Contrast:'}
              </span>
              <select
                value={textContrast}
                onChange={(e) => setTextContrast(e.target.value as TextContrast)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="ultra_dark">{isNl ? 'Maximaal Hoog Contrast' : 'Maximum High Contrast'}</option>
                <option value="slate_dark">{isNl ? 'Donker Leisteen' : 'Dark Slate'}</option>
                <option value="navy_deep">{isNl ? 'Marineblauw' : 'Deep Navy'}</option>
              </select>
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold text-[11px]">
                {isNl ? 'Lettergrootte:' : 'Size:'}
              </span>
              <select
                value={fontSizeScale}
                onChange={(e) => setFontSizeScale(e.target.value as FontSizeScale)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="normal">{isNl ? 'Normaal (14px)' : 'Normal'}</option>
                <option value="large">{isNl ? 'Groot (16px)' : 'Large'}</option>
                <option value="extralarge">{isNl ? 'Extra Groot (18px)' : 'Extra Large'}</option>
              </select>
            </div>

            {/* Transparency Slider */}
            {bgStyle !== 'solid_light' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-[11px]">
                  {isNl ? 'Dekking:' : 'Opacity:'} {glassOpacity}%
                </span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={glassOpacity}
                  onChange={(e) => setGlassOpacity(Number(e.target.value))}
                  className="w-20 accent-indigo-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Quick Toggles */}
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0"
              />
              <span>{isNl ? 'Logo ITPT' : 'Logo'}</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showMeta}
                onChange={(e) => setShowMeta(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0"
              />
              <span>{isNl ? 'Details' : 'Details'}</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showParticipants}
                onChange={(e) => setShowParticipants(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0"
              />
              <span>{isNl ? 'Genodigden' : 'Attendees'}</span>
            </label>
          </div>
        </div>

        {/* Preview Container with Pattern Background to Demonstrate Transparency */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-br from-slate-200 via-indigo-50/40 to-slate-200 flex justify-center">
          {/* Exportable Document Card */}
          <div 
            ref={exportRef}
            id="itpt-formatted-agenda-card"
            className="w-full max-w-3xl rounded-3xl shadow-xl overflow-hidden border border-slate-300 transition-all"
            style={{ 
              backgroundColor: bgStyle === 'frosted_dark' ? '#0f172a' : 'transparent' 
            }}
          >
            {/* Header Banner */}
            <div className={`p-6 md:p-8 ${HEADER_GRADIENTS[headerGradient].class}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full border border-white/30 backdrop-blur-xs">
                      {meeting.meetingType || (isNl ? 'Overleg Agenda' : 'Meeting Agenda')}
                    </span>
                    {meeting.projectOrSubject && (
                      <span className="text-[10px] font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded-full">
                        {meeting.projectOrSubject}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                    {meeting.title}
                  </h1>
                </div>

                {/* IT Platform Twente Logo */}
                {showLogo && (
                  <div className="p-2.5 bg-white/95 rounded-2xl shadow-md border border-white/50 backdrop-blur-xs shrink-0">
                    <ITPlatformTwenteLogo className="h-9 w-auto" />
                  </div>
                )}
              </div>

              {/* Metadata Bar */}
              {showMeta && (
                <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap items-center gap-4 text-xs font-semibold text-white/90">
                  <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-xs">
                    <Calendar className="h-3.5 w-3.5 text-indigo-300" />
                    <span>{meeting.date}</span>
                  </div>

                  {meeting.time && (
                    <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-xs">
                      <Clock className="h-3.5 w-3.5 text-indigo-300" />
                      <span>{meeting.time} {meeting.durationMinutes ? `(${meeting.durationMinutes} min)` : ''}</span>
                    </div>
                  )}

                  {meeting.location && (
                    <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-xs">
                      <MapPin className="h-3.5 w-3.5 text-indigo-300" />
                      <span>{meeting.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Participants Pill List */}
              {showParticipants && meeting.participants && meeting.participants.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-white/70 flex items-center gap-1 mr-1">
                    <Users className="h-3 w-3" />
                    {isNl ? 'Genodigden:' : 'Attendees:'}
                  </span>
                  {meeting.participants.map((p, idx) => (
                    <span 
                      key={idx}
                      className="text-[11px] font-medium bg-white/15 text-white px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-xs"
                    >
                      {p.name || p.email}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Translucent / Glass Agenda Body */}
            <div 
              className={`p-6 md:p-8 transition-all ${TEXT_CONTRAST_CLASSES[textContrast]} ${FONT_SIZE_CLASSES[fontSizeScale]}`}
              style={getGlassStyle()}
            >
              {meeting.agenda && meeting.agenda.trim().length > 0 ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: meeting.agenda }}
                  className="prose max-w-none leading-relaxed [&>h2]:font-extrabold [&>h2]:mt-4 [&>h2]:mb-2 [&>h3]:font-bold [&>h3]:mt-3 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:my-2 [&>hr]:my-4 [&>hr]:border-slate-300"
                />
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-semibold">{isNl ? 'Geen agenda-inhoud opgesteld voor dit overleg.' : 'No agenda content prepared for this meeting.'}</p>
                </div>
              )}
            </div>

            {/* Branded Footer */}
            {showFooter && (
              <div 
                className="px-6 py-3.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500"
                style={{
                  backgroundColor: bgStyle === 'frosted_dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(248, 250, 252, 0.9)',
                  color: bgStyle === 'frosted_dark' ? '#94a3b8' : '#64748b'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-800" style={{ color: bgStyle === 'frosted_dark' ? '#f1f5f9' : '#1e293b' }}>
                    IT Platform Twente
                  </span>
                  <span>•</span>
                  <span>{isNl ? 'Regionale Samenwerking, Innovatie & Overlegstructuur' : 'Regional Collaboration & Innovation'}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {meeting.agendaUpdatedAt 
                    ? `${isNl ? 'Vastgesteld:' : 'Updated:'} ${new Date(meeting.agendaUpdatedAt).toLocaleDateString()}`
                    : `Datum: ${meeting.date}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormattedAgendaModal;
