import React from 'react';
import { 
  Clock, MapPin, User, Mail, Phone, AlignLeft, 
  Briefcase, Plus, CheckCircle2, ChevronLeft, ChevronRight, Calendar as CalendarIcon 
} from 'lucide-react';
import { SharedCalendarEvent, SharedCalendar } from '../../types';
import { getISOWeek, formatDateString } from '../../utils/dateUtils';
import { CALENDAR_COLORS, STATUS_META, getDayNames } from './calendarHelpers';

interface CalendarDayViewProps {
  currentDate: Date;
  events: SharedCalendarEvent[];
  calendar: SharedCalendar;
  onSelectEvent: (event: SharedCalendarEvent) => void;
  onSlotClick: (dateStr: string, timeStr?: string) => void;
  lang: 'nl' | 'en';
}

const HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  currentDate,
  events,
  calendar,
  onSelectEvent,
  onSlotClick,
  lang
}) => {
  const dateStr = formatDateString(currentDate);
  const isoWeekNum = getISOWeek(currentDate);
  const dayNames = getDayNames(lang, false);
  const dayIdx = (currentDate.getDay() + 6) % 7; // Monday = 0
  const dayName = dayNames[dayIdx];

  // Events for this specific day
  const dayEvents = events.filter(e => {
    return dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate);
  });

  const allDayEvents = dayEvents.filter(e => e.isAllDay);
  const timedEvents = dayEvents.filter(e => !e.isAllDay);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" id="calendar-day-view">
      
      {/* Outlook Day Header Banner */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-extrabold text-base text-white shadow-md shadow-indigo-500/30">
            {currentDate.getDate()}
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span>{dayName} {currentDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
                ISO W{isoWeekNum}
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {dayEvents.length} {lang === 'nl' ? 'afspraak/afspraken gepland' : 'appointments scheduled'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onSlotClick(dateStr)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{lang === 'nl' ? '+ Nieuwe Afspraak' : '+ New Event'}</span>
        </button>
      </div>

      {/* All-Day Events section */}
      {allDayEvents.length > 0 && (
        <div className="p-4 bg-amber-50/30 border-b border-slate-200 space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            {lang === 'nl' ? 'Hele dag evenementen' : 'All-Day Events'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allDayEvents.map(evt => {
              const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
              const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent(evt)}
                  className={`p-3 rounded-2xl border cursor-pointer hover:shadow-md transition-all ${colorTheme.lightBg} ${colorTheme.border}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs text-slate-900">{evt.title}</h4>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${statusMeta.color}`}>
                      {statusMeta[lang === 'nl' ? 'labelNl' : 'labelEn']}
                    </span>
                  </div>
                  {evt.productService && (
                    <p className="text-xs text-indigo-700 font-semibold mt-1 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      <span>{evt.productService}</span>
                    </p>
                  )}
                  {evt.handlers && evt.handlers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      <span className="text-[10px] text-slate-400 font-bold mr-1">Behandelaar(en):</span>
                      {evt.handlers.map(h => (
                        <span key={h} className="px-1.5 py-0.5 rounded bg-white text-slate-700 text-[10px] font-bold border border-slate-200 shadow-2xs">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hourly Schedule View */}
      <div className="divide-y divide-slate-100 p-2 sm:p-4">
        {HOURS.map(hourStr => {
          const [hNum] = hourStr.split(':').map(Number);
          const slotEvents = timedEvents.filter(evt => {
            const evtHour = evt.startTime ? parseInt(evt.startTime.split(':')[0], 10) : 9;
            return evtHour === hNum;
          });

          return (
            <div key={hourStr} className="grid grid-cols-[80px_1fr] gap-3 min-h-[72px] py-2 group hover:bg-slate-50/60 rounded-xl transition-colors">
              {/* Hour time tag */}
              <div className="text-right pr-3 pt-1">
                <span className="text-xs font-mono font-bold text-slate-500 block">
                  {hourStr}
                </span>
                <button
                  onClick={() => onSlotClick(dateStr, hourStr)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 font-bold hover:underline mt-1 cursor-pointer transition-opacity"
                >
                  + {lang === 'nl' ? 'Plan' : 'Add'}
                </button>
              </div>

              {/* Slot contents */}
              <div 
                onClick={() => {
                  if (slotEvents.length === 0) {
                    onSlotClick(dateStr, hourStr);
                  }
                }}
                className="space-y-2 cursor-pointer"
              >
                {slotEvents.length === 0 ? (
                  <div className="h-full border border-dashed border-transparent group-hover:border-slate-200 rounded-xl flex items-center px-3 text-xs text-slate-300 italic">
                    {lang === 'nl' ? 'Vrij tijdvak' : 'Available slot'}
                  </div>
                ) : (
                  slotEvents.map(evt => {
                    const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
                    const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

                    return (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(evt);
                        }}
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:shadow-lg hover:scale-[1.005] ${colorTheme.lightBg} ${colorTheme.border}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-white font-mono font-bold text-xs text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              <span>{evt.startTime} – {evt.endTime || 'Einde'}</span>
                            </span>
                            <h4 className="font-bold text-sm text-slate-900">{evt.title}</h4>
                          </div>

                          <div className="flex items-center gap-2">
                            {evt.productService && (
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                <span>{evt.productService}</span>
                              </span>
                            )}
                            <span className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] uppercase tracking-wider ${statusMeta.color}`}>
                              {statusMeta[lang === 'nl' ? 'labelNl' : 'labelEn']}
                            </span>
                          </div>
                        </div>

                        {/* Handlers & Location */}
                        <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-slate-600">
                          {evt.handlers && evt.handlers.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span className="font-bold text-slate-700">{lang === 'nl' ? 'Behandelaar(en):' : 'Handler(s):'}</span>
                              <div className="flex flex-wrap gap-1">
                                {evt.handlers.map(h => (
                                  <span key={h} className="px-2 py-0.5 rounded bg-white text-slate-800 font-bold border border-slate-200 shadow-2xs">
                                    {h}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {evt.location && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span className="font-medium">{evt.location}</span>
                            </div>
                          )}

                          {evt.contactPerson && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span>{evt.contactPerson} {evt.contactPhone ? `(${evt.contactPhone})` : ''}</span>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {evt.description && (
                          <p className="text-xs text-slate-600 mt-2.5 pt-2 border-t border-slate-200/60 leading-relaxed">
                            {evt.description}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
