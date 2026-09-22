import React from 'react';
import { 
  Clock, MapPin, User, ChevronLeft, ChevronRight, 
  Calendar as CalendarIcon, Briefcase, Plus 
} from 'lucide-react';
import { SharedCalendarEvent, SharedCalendar } from '../../types';
import { getISOWeek, formatDateString } from '../../utils/dateUtils';
import { getDayNames, CALENDAR_COLORS, STATUS_META } from './calendarHelpers';

interface CalendarWeekViewProps {
  currentDate: Date;
  weekDates: Date[];
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

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  weekDates,
  events,
  calendar,
  onSelectEvent,
  onSlotClick,
  lang
}) => {
  const dayNames = getDayNames(lang, true);
  const fullDayNames = getDayNames(lang, false);
  const todayStr = formatDateString(new Date());

  const isoWeekNum = getISOWeek(currentDate);

  // Filter all-day events vs time-bound events for this week
  const weekStartStr = formatDateString(weekDates[0]);
  const weekEndStr = formatDateString(weekDates[6]);

  const allDayEvents = events.filter(e => {
    if (!e.isAllDay) return false;
    return (e.startDate <= weekEndStr && (e.endDate || e.startDate) >= weekStartStr);
  });

  const timedEvents = events.filter(e => !e.isAllDay);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" id="calendar-week-view">
      
      {/* Top Outlook Week Banner */}
      <div className="bg-slate-900 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-xl bg-indigo-600 font-extrabold text-xs uppercase tracking-wider text-white shadow-xs">
            ISO {lang === 'nl' ? 'Week' : 'Week'} {isoWeekNum}
          </span>
          <span className="text-sm font-semibold text-slate-200">
            {weekDates[0].toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="text-xs text-slate-400 font-medium hidden sm:flex items-center gap-2">
          <span>{lang === 'nl' ? 'Klik op een tijdvak om direct een afspraak in te plannen' : 'Click any slot to schedule an appointment'}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          
          {/* Header Days Row */}
          <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/80 sticky top-0 z-20">
            {/* Week corner cell */}
            <div className="p-3 border-r border-slate-200 flex flex-col items-center justify-center bg-slate-100/70">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">ISO</span>
              <span className="text-xs font-black text-indigo-700">W{isoWeekNum}</span>
            </div>

            {/* 7 Days Columns */}
            {weekDates.map((dateObj, idx) => {
              const dateStr = formatDateString(dateObj);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === formatDateString(currentDate);

              return (
                <div
                  key={dateStr}
                  onClick={() => onSlotClick(dateStr)}
                  className={`p-3 border-r border-slate-200 last:border-r-0 text-center transition-colors cursor-pointer hover:bg-indigo-50/40 ${
                    isToday ? 'bg-indigo-50/70 font-bold' : ''
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    {dayNames[idx]}
                  </span>
                  <div className="mt-1 flex items-center justify-center">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-all ${
                      isToday 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105' 
                        : isSelected 
                          ? 'bg-slate-800 text-white' 
                          : 'text-slate-800 hover:bg-slate-200'
                    }`}>
                      {dateObj.getDate()}
                    </span>
                  </div>
                  {isToday && (
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider block mt-0.5">
                      {lang === 'nl' ? 'Vandaag' : 'Today'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* All-Day Events Section (if any) */}
          {allDayEvents.length > 0 && (
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-slate-200 bg-amber-50/20 text-xs">
              <div className="p-2 border-r border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-center text-center">
                {lang === 'nl' ? 'Hele dag' : 'All day'}
              </div>
              {weekDates.map((dateObj) => {
                const dateStr = formatDateString(dateObj);
                const dayAllDayEvents = allDayEvents.filter(e => dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate));

                return (
                  <div key={`allday-${dateStr}`} className="p-1 border-r border-slate-200 last:border-r-0 space-y-1 min-h-8">
                    {dayAllDayEvents.map(evt => {
                      const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
                      const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(evt);
                          }}
                          className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${colorTheme.badge}`}
                        >
                          <div className="font-bold text-[11px] truncate flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                            <span>{evt.title}</span>
                          </div>
                          {evt.productService && (
                            <span className="text-[9px] text-slate-500 font-medium block truncate">
                              {evt.productService}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Time Slots Grid (07:00 to 20:00) */}
          <div className="divide-y divide-slate-100">
            {HOURS.map((hourStr) => {
              const [hNum] = hourStr.split(':').map(Number);

              return (
                <div key={hourStr} className="grid grid-cols-[70px_repeat(7,1fr)] min-h-[58px] group">
                  
                  {/* Time label */}
                  <div className="p-2 border-r border-slate-200 text-right pr-3 flex items-start justify-end bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      {hourStr}
                    </span>
                  </div>

                  {/* 7 Day hourly cells */}
                  {weekDates.map((dateObj) => {
                    const dateStr = formatDateString(dateObj);
                    const isToday = dateStr === todayStr;

                    // Match events in this hour slot
                    const slotEvents = timedEvents.filter(evt => {
                      if (evt.startDate !== dateStr) return false;
                      const evtHour = evt.startTime ? parseInt(evt.startTime.split(':')[0], 10) : 9;
                      return evtHour === hNum;
                    });

                    return (
                      <div
                        key={`${dateStr}-${hourStr}`}
                        onClick={() => onSlotClick(dateStr, hourStr)}
                        className={`p-1 border-r border-slate-200 last:border-r-0 relative transition-colors cursor-pointer hover:bg-indigo-50/30 ${
                          isToday ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        {slotEvents.map(evt => {
                          const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
                          const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

                          return (
                            <div
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(evt);
                              }}
                              className={`p-2 rounded-xl border text-left cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] mb-1 ${colorTheme.lightBg} ${colorTheme.border}`}
                            >
                              {/* Time & Status header */}
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-mono font-bold text-slate-700 flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  {evt.startTime} {evt.endTime ? `- ${evt.endTime}` : ''}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded font-extrabold text-[8px] uppercase ${statusMeta.color}`}>
                                  {statusMeta[lang === 'nl' ? 'labelNl' : 'labelEn']}
                                </span>
                              </div>

                              {/* Title */}
                              <div className="font-bold text-xs text-slate-900 mt-1 line-clamp-1">
                                {evt.title}
                              </div>

                              {/* Product/Dienst context */}
                              {evt.productService && (
                                <div className="text-[10px] text-indigo-700 font-semibold mt-0.5 flex items-center gap-1 truncate">
                                  <Briefcase className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{evt.productService}</span>
                                </div>
                              )}

                              {/* Handlers chips */}
                              {evt.handlers && evt.handlers.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                  {evt.handlers.map(h => (
                                    <span key={h} className="px-1.5 py-0.5 rounded-md bg-white text-slate-700 text-[9px] font-bold border border-slate-200/80 shadow-2xs truncate max-w-[120px]">
                                      {h}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Location */}
                              {evt.location && (
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                                  <MapPin className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                                  <span className="truncate">{evt.location}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};
