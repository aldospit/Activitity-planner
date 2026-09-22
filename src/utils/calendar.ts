/**
 * Utilities for Google Calendar and Outlook Calendar integrations
 */

// Helper to format ISO strings or local dates into UTC formatted string for Google Calendar: YYYYMMDDTHHMMSSZ
export function formatUTCForGoogle(dateStr: string, durationMin: number): { start: string; end: string } {
  try {
    const startObj = new Date(dateStr);
    const endObj = new Date(startObj.getTime() + durationMin * 60 * 1000);

    const pad = (num: number) => num.toString().padStart(2, '0');

    const format = (d: Date) => {
      return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
      );
    };

    return {
      start: format(startObj),
      end: format(endObj),
    };
  } catch (error) {
    console.error('Error formatting UTC date for Google', error);
    return { start: '', end: '' };
  }
}

// Generate Google Calendar Link
export function generateGoogleCalendarLink(title: string, description: string, dateTime: string, durationMin: number): string {
  const { start, end } = formatUTCForGoogle(dateTime, durationMin);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&sf=true&output=xml`;
}

// Generate Outlook Calendar Link (Live Web client)
export function generateOutlookLink(title: string, description: string, dateTime: string, durationMin: number): string {
  try {
    const startObj = new Date(dateTime);
    const endObj = new Date(startObj.getTime() + durationMin * 60 * 1000);
    const isoStart = startObj.toISOString();
    const isoEnd = endObj.toISOString();
    return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(isoStart)}&enddt=${encodeURIComponent(isoEnd)}&body=${encodeURIComponent(description)}`;
  } catch {
    return '#';
  }
}

// Download ICS File
export function downloadIcsFile(title: string, description: string, dateTime: string, durationMin: number): void {
  try {
    const startObj = new Date(dateTime);
    const endObj = new Date(startObj.getTime() + durationMin * 60 * 1000);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const formatICS = (d: Date) => {
      return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
      );
    };

    const startStr = formatICS(startObj);
    const endStr = formatICS(endObj);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DatumprikkerApplet//NONSGML v1.0//NL',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating ICS file', error);
  }
}
