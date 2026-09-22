import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Share2, 
  Printer, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  Check, 
  ArrowLeft,
  FileText,
  AlertCircle,
  Video,
  Building2,
  CalendarPlus,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Meeting, MeetingAgreement, MeetingActionItem, Language } from '../types';
import { dbService } from '../services/db';
import { generateGoogleCalendarLink, generateOutlookLink, downloadIcsFile } from '../utils/calendar';
import { getPublicOrigin } from '../utils/url';
import ITPlatformTwenteLogo from './ITPlatformTwenteLogo';

interface MeetingAgendaPageProps {
  meetingId: string;
  lang?: Language;
  onBackToApp?: () => void;
}

const MEETING_TYPE_LABELS: Record<string, { nl: string; en: string; color: string }> = {
  stuurgroep: { nl: 'Stuurgroep', en: 'Steering Committee', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  bila: { nl: 'Bila (1-op-1)', en: '1-on-1', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  eenmalig: { nl: 'Eenmalige afspraak', en: 'One-off Meeting', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  afdelingsoverleg: { nl: 'Afdelingsoverleg', en: 'Department Meeting', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  projectteam: { nl: 'Projectteam', en: 'Project Team', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  overig: { nl: 'Overig overleg', en: 'Other Meeting', color: 'bg-slate-100 text-slate-800 border-slate-200' }
};

export const MeetingAgendaPage: React.FC<MeetingAgendaPageProps> = ({
  meetingId,
  lang = 'nl',
  onBackToApp
}) => {
  const isNl = lang === 'nl';
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agreements, setAgreements] = useState<MeetingAgreement[]>([]);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const details = await dbService.fetchMeetingDetailsAsync(meetingId);
        if (isMounted) {
          setMeeting(details.meeting);
          setAgreements(details.agreements);
          setActionItems(details.actionItems);
        }
      } catch (err) {
        console.error("Error loading meeting details:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [meetingId]);

  const handleCopyPublicUrl = () => {
    const fullUrl = `${getPublicOrigin()}?meeting_agenda=${meetingId}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 2500);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="animate-spin h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">
            {isNl ? 'Agenda wordt opgehaald...' : 'Loading meeting agenda...'}
          </p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="p-3 bg-red-50 text-red-600 rounded-full w-fit mx-auto mb-3">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            {isNl ? 'Overleg niet gevonden' : 'Meeting not found'}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            {isNl 
              ? 'Het opgevraagde overleg bestaat niet meer of de unieke link is onjuist.' 
              : 'The requested meeting does not exist or the link is invalid.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            {isNl ? 'Naar hoofdpagina' : 'Go to main page'}
          </a>
        </div>
      </div>
    );
  }

  // Calendar Links preparation
  const meetingDateTimeStr = `${meeting.date}T${meeting.time || '10:00'}:00`;
  const durationMin = meeting.durationMinutes || 60;
  const calendarDescription = `Overleg: ${meeting.title}\nProject: ${meeting.projectOrSubject}\nLocatie: ${meeting.location || 'Online'}\nBekijk agenda online: ${getPublicOrigin()}?meeting_agenda=${meeting.id}`;

  const googleCalLink = generateGoogleCalendarLink(
    meeting.title,
    calendarDescription,
    meetingDateTimeStr,
    durationMin
  );

  const outlookCalLink = generateOutlookLink(
    meeting.title,
    calendarDescription,
    meetingDateTimeStr,
    durationMin
  );

  const handleDownloadIcs = () => {
    downloadIcsFile(
      meeting.title,
      calendarDescription,
      meetingDateTimeStr,
      durationMin
    );
  };

  const isTeamsMeeting = meeting.location?.toLowerCase().includes('teams');
  const isMeetMeeting = meeting.location?.toLowerCase().includes('meet');
  const isZoomMeeting = meeting.location?.toLowerCase().includes('zoom');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 print:bg-white print:p-0 print:pb-0" id="meeting-agenda-page">
      {/* Top Navbar / Branding */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToApp ? (
              <button
                type="button"
                onClick={onBackToApp}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title={isNl ? 'Terug naar overlegbeheer' : 'Back to meetings'}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <a
                href="/"
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
                title={isNl ? 'Naar applicatie' : 'To app'}
              >
                <ArrowLeft className="h-5 w-5" />
              </a>
            )}

            <div className="flex items-center gap-2.5">
              <ITPlatformTwenteLogo className="h-7 w-auto" />
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider hidden sm:inline">
                {isNl ? 'Overleg & Agenda' : 'Meeting Agenda'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPublicUrl}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isNl ? 'Kopieer unieke weblink' : 'Copy link'}
            >
              {hasCopiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{hasCopiedLink ? (isNl ? 'Gekopieerd!' : 'Copied!') : (isNl ? 'Deel Link' : 'Share Link')}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isNl ? 'Afdrukken / PDF' : 'Print / PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 print:max-w-none print:px-0 print:pt-0">
        {/* Print-only Header */}
        <div className="hidden print:block mb-6 pb-4 border-b border-slate-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{meeting.title}</h1>
              <p className="text-sm text-slate-600">
                {meeting.projectOrSubject} | {meeting.date} om {meeting.time || '10:00'} ({meeting.location || 'Online'})
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              IT Platform Twente Overleg Agenda
            </div>
          </div>
        </div>

        {/* Meeting Header Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs mb-6 relative overflow-hidden print:border-none print:shadow-none print:p-0">
          {/* Subtle gradient banner top */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 print:hidden" />

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${MEETING_TYPE_LABELS[meeting.meetingType]?.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {MEETING_TYPE_LABELS[meeting.meetingType]?.nl || meeting.meetingType}
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg">
                {meeting.projectOrSubject}
              </span>
            </div>

            {/* Agenda Status Pill */}
            <div>
              {meeting.agendaStatus === 'definitief' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  {isNl ? 'Definitieve Agenda' : 'Final Agenda'}
                </span>
              ) : meeting.agendaStatus === 'verzonden' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {isNl ? 'Agenda Verzonden' : 'Agenda Sent'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {isNl ? 'Concept Agenda' : 'Draft Agenda'}
                </span>
              )}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">
            {meeting.title}
          </h1>

          {/* Key Meeting Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isNl ? 'Datum' : 'Date'}
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {new Date(meeting.date + 'T00:00:00').toLocaleDateString(isNl ? 'nl-NL' : 'en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isNl ? 'Tijdstip & Duur' : 'Time & Duration'}
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {meeting.time || '10:00'} uur ({durationMin} min)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                {isTeamsMeeting || isMeetMeeting || isZoomMeeting ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isNl ? 'Locatie / Verbinding' : 'Location / Video'}
                </p>
                <p className="text-sm font-bold text-slate-800 truncate max-w-[180px]">
                  {meeting.location || 'Online'}
                </p>
              </div>
            </div>
          </div>

          {/* Calendar Quick Add Bar (for attendees) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 print:hidden">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <CalendarPlus className="h-4 w-4 text-indigo-600" />
              {isNl ? 'Voeg toe aan persoonlijke agenda:' : 'Add to your calendar:'}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={googleCalLink}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Google Agenda</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>

              <a
                href={outlookCalLink}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Outlook Live</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>

              <button
                type="button"
                onClick={handleDownloadIcs}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>.ICS Bestand</span>
              </button>
            </div>
          </div>
        </div>

        {/* Participants section */}
        {meeting.participants && meeting.participants.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs mb-6 print:border-none print:shadow-none print:p-0">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-indigo-600" />
              {isNl ? 'Genodigden & Deelnemers' : 'Participants & Invitees'} ({meeting.participants.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {meeting.participants.map((p, idx) => (
                <div 
                  key={idx} 
                  className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{p.email}</p>
                    {p.organization && (
                      <p className="text-[10px] text-indigo-600 font-medium truncate flex items-center gap-0.5 mt-0.5">
                        <Building2 className="h-2.5 w-2.5" />
                        {p.organization}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Prepared Agenda Body */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs mb-8 print:border-none print:shadow-none print:p-0">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              {isNl ? 'Voorbereide Agenda' : 'Meeting Agenda'}
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {meeting.agendaUpdatedAt 
                ? `${isNl ? 'Laatst bijgewerkt' : 'Updated'}: ${new Date(meeting.agendaUpdatedAt).toLocaleDateString()}` 
                : ''}
            </span>
          </div>

          {meeting.agenda && meeting.agenda.trim().length > 0 ? (
            <div 
              dangerouslySetInnerHTML={{ __html: meeting.agenda }}
              className="prose prose-indigo max-w-none text-slate-800 text-sm sm:text-base leading-relaxed font-sans
                [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-indigo-950 [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:border-b [&>h2]:border-slate-100 [&>h2]:pb-2
                [&>h3]:text-base [&>h3]:font-bold [&>h3]:text-slate-800 [&>h3]:mt-4 [&>h3]:mb-2
                [&>p]:my-2.5
                [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:my-3 [&>ul>li]:my-1
                [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:my-3 [&>ol>li]:my-1
                [&>hr]:my-6 [&>hr]:border-slate-200
                [&>figure]:my-6 [&>figure]:text-center
                [&>figure>img]:max-w-full [&>figure>img]:rounded-xl [&>figure>img]:border [&>figure>img]:border-slate-200 [&>figure>img]:shadow-sm [&>figure>img]:cursor-pointer [&>figure>img]:hover:opacity-95"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  const src = (target as HTMLImageElement).src;
                  if (src) setLightboxImage(src);
                }
              }}
            />
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">
                {isNl ? 'Agenda is in voorbereiding' : 'Agenda is being prepared'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {isNl 
                  ? 'De organisator heeft nog geen inhoudelijke agenda gepubliceerd voor deze bijeenkomst. Controleer deze pagina later opnieuw.' 
                  : 'The organizer has not yet published an agenda. Please check back later.'}
              </p>
            </div>
          )}
        </div>

        {/* Action Items / Previous Agreements Context (if present) */}
        {(agreements.length > 0 || actionItems.length > 0) && (
          <div className="space-y-6 mb-8 print:break-before-page">
            {/* Action Items */}
            {actionItems.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {isNl ? 'Gekoppelde Actiepunten' : 'Action Items'} ({actionItems.length})
                </h3>
                <div className="space-y-2">
                  {actionItems.map(act => (
                    <div 
                      key={act.id} 
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">{act.title}</p>
                        {act.description && <p className="text-[11px] text-slate-500 mt-0.5">{act.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400">
                            {isNl ? 'Actiehouder(s):' : 'Assignee(s):'} {act.assignees.map(a => a.name).join(', ') || 'Niet toegewezen'}
                          </span>
                          <span className="text-[10px] text-slate-400">|</span>
                          <span className="text-[10px] font-semibold text-indigo-600">
                            {isNl ? 'Deadline:' : 'Due:'} {act.dueDate}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        act.status === 'gereed' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {act.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer info and secure link */}
        <div className="text-center py-6 text-xs text-slate-400 print:hidden">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
            {isNl 
              ? 'Unieke beveiligde overlegpagina • IT Platform Twente Planner' 
              : 'Secure unique meeting page • IT Platform Twente Planner'}
          </p>
        </div>
      </main>

      {/* Lightbox for clicked agenda images */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-2 bg-white rounded-2xl shadow-2xl">
            <img 
              src={lightboxImage} 
              alt="Uitvergroot agendafiguur" 
              className="max-h-[85vh] max-w-full rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-700 shadow-md"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingAgendaPage;
