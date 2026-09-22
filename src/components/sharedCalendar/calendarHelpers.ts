import { SharedCalendarEvent, CalendarEventStatus } from '../../types';
import { getISOWeek, formatDateString } from '../../utils/dateUtils';

export const CALENDAR_COLORS: Record<string, { bg: string; text: string; border: string; badge: string; lightBg: string }> = {
  indigo: {
    bg: 'bg-indigo-600',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    lightBg: 'bg-indigo-50/70'
  },
  emerald: {
    bg: 'bg-emerald-600',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    lightBg: 'bg-emerald-50/70'
  },
  blue: {
    bg: 'bg-blue-600',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    lightBg: 'bg-blue-50/70'
  },
  sky: {
    bg: 'bg-sky-600',
    text: 'text-sky-700',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    lightBg: 'bg-sky-50/70'
  },
  amber: {
    bg: 'bg-amber-600',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    lightBg: 'bg-amber-50/70'
  },
  rose: {
    bg: 'bg-rose-600',
    text: 'text-rose-700',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    lightBg: 'bg-rose-50/70'
  },
  purple: {
    bg: 'bg-purple-600',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    lightBg: 'bg-purple-50/70'
  },
  slate: {
    bg: 'bg-slate-700',
    text: 'text-slate-700',
    border: 'border-slate-300',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    lightBg: 'bg-slate-50'
  }
};

export const STATUS_META: Record<CalendarEventStatus, { labelNl: string; labelEn: string; color: string; dotColor: string }> = {
  scheduled: {
    labelNl: 'Gepland',
    labelEn: 'Scheduled',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500'
  },
  confirmed: {
    labelNl: 'Bevestigd',
    labelEn: 'Confirmed',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500'
  },
  in_progress: {
    labelNl: 'In behandeling',
    labelEn: 'In Progress',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500'
  },
  completed: {
    labelNl: 'Afgerond',
    labelEn: 'Completed',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-500'
  },
  cancelled: {
    labelNl: 'Geannuleerd',
    labelEn: 'Cancelled',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    dotColor: 'bg-rose-500'
  }
};

export const DEFAULT_PRODUCT_SERVICES = [
  'Cloud Werkplekken & M365',
  'Support & IT Beheer Dienstverlening',
  'NDIX Netwerkverbindingen',
  'Security & MFA Implementatie',
  'Hardware & Werkplekinrichting',
  'VoIP & Telefonie Diensten',
  'Server & Cloud Backup Beheer',
  'Overig / Algemeen'
];

export function getMonthNames(lang: 'nl' | 'en'): string[] {
  if (lang === 'nl') {
    return [
      'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
      'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
    ];
  }
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
}

export function getShortMonthNames(lang: 'nl' | 'en'): string[] {
  if (lang === 'nl') {
    return ['Jan', 'Feb', 'Maa', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  }
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

export function getDayNames(lang: 'nl' | 'en', short = false): string[] {
  if (lang === 'nl') {
    return short 
      ? ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
      : ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  }
  return short
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
}

/**
 * Generate iCalendar (.ics) export content for a list of events
 */
export function generateICS(events: SharedCalendarEvent[], calendarName: string): string {
  const formatICSDate = (dateStr: string, timeStr?: string, isAllDay = false): string => {
    const cleanDate = dateStr.replace(/-/g, '');
    if (isAllDay || !timeStr) {
      return `VALUE=DATE:${cleanDate}`;
    }
    const cleanTime = timeStr.replace(/:/g, '') + '00';
    return `${cleanDate}T${cleanTime}`;
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IT Platform Twente//Shared Calendar//NL',
    `X-WR-CALNAME:${calendarName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach(evt => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id}@itpt.nl`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    
    if (evt.isAllDay) {
      lines.push(`DTSTART;${formatICSDate(evt.startDate, undefined, true)}`);
      // For all-day events, DTEND is exclusive so next day
      const nextDay = new Date(evt.endDate || evt.startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      lines.push(`DTEND;${formatICSDate(formatDateString(nextDay), undefined, true)}`);
    } else {
      lines.push(`DTSTART:${formatICSDate(evt.startDate, evt.startTime || '09:00')}`);
      lines.push(`DTEND:${formatICSDate(evt.endDate || evt.startDate, evt.endTime || '10:00')}`);
    }

    lines.push(`SUMMARY:${evt.title.replace(/,/g, '\\,')}`);
    
    const descParts = [];
    if (evt.productService) descParts.push(`Product/Dienst: ${evt.productService}`);
    if (evt.handlers && evt.handlers.length > 0) descParts.push(`Behandelaar(en): ${evt.handlers.join(', ')}`);
    if (evt.contactPerson) descParts.push(`Contact: ${evt.contactPerson} (${evt.contactEmail || ''} ${evt.contactPhone || ''})`);
    if (evt.description) descParts.push(`\n${evt.description}`);
    
    lines.push(`DESCRIPTION:${descParts.join('\\n').replace(/,/g, '\\,')}`);
    if (evt.location) lines.push(`LOCATION:${evt.location.replace(/,/g, '\\,')}`);
    lines.push(`STATUS:${evt.status === 'confirmed' ? 'CONFIRMED' : evt.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Generate CSV export content for a list of events
 */
export function generateCSV(events: SharedCalendarEvent[]): string {
  const headers = ['ID', 'Titel', 'Product/Dienst', 'Startdatum', 'Starttijd', 'Einddatum', 'Eindtijd', 'Hele dag', 'Behandelaar(en)', 'Status', 'Locatie', 'Contactpersoon', 'Email', 'Telefoon', 'Omschrijving'];
  
  const rows = events.map(evt => [
    `"${evt.id}"`,
    `"${(evt.title || '').replace(/"/g, '""')}"`,
    `"${(evt.productService || '').replace(/"/g, '""')}"`,
    `"${evt.startDate}"`,
    `"${evt.startTime || ''}"`,
    `"${evt.endDate || evt.startDate}"`,
    `"${evt.endTime || ''}"`,
    `"${evt.isAllDay ? 'Ja' : 'Nee'}"`,
    `"${(evt.handlers || []).join('; ')}"`,
    `"${evt.status}"`,
    `"${(evt.location || '').replace(/"/g, '""')}"`,
    `"${(evt.contactPerson || '').replace(/"/g, '""')}"`,
    `"${evt.contactEmail || ''}"`,
    `"${evt.contactPhone || ''}"`,
    `"${(evt.description || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Download a file in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
