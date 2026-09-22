import React from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  User, Briefcase, Plus 
} from 'lucide-react';
import { SharedCalendarEvent, SharedCalendar } from '../../types';
import { getISOWeek, formatDateString } from '../../utils/dateUtils';
import { getDayNames, CALENDAR_COLORS, STATUS_META } from './calendarHelpers';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: SharedCalendarEvent[];
  calendar: SharedCalendar;
  onSelectEvent: (event: SharedCalendarEvent) => void;
  onSelectDate: (date: Date) => void;
  onSlotClick: (dateStr: string) => void;
  lang: 'nl' | 'en';
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  events,
  calendar,
  onSelectEvent,
  onSelectDate,
  onSlotClick,
  lang
}) => {
  const dayNames = getDayNames(lang, true);
  const todayStr = formatDateString(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate 6-week matrix for the month starting Monday
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week for 1st of month: 0=Sun, 1=Mon, ..., 6=Sat -> convert to Monday=0
  const firstDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const startDate = new Date(year, month, 1 - firstDayOfWeek);
  
  const calendarWeeks: { weekNum: number; days: Date[] }[] = [];
  let curr = new Date(startDate);

  for (let w = 0; w < 6; w++) {
    const weekDays: Date[] = [];
    const weekNum = getISOWeek(curr);
    for (let d = 0; d < 7; d++) {
      weekDays.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    calendarWeeks.push({ weekNum, days: weekDays });
    // If the next week is completely in the next month, we can stop at 5 weeks if desired
    if (curr.getMonth() !== month && w >= 4) {
      break;
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" id="calendar-month-view">
      
      {/* Month Header Banner */}
      <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white tracking-wide">
            {currentDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'long', year: 'numeric' })}
          </span>
          <span className="text-xs text-indigo-400 font-mono font-semibold">
            {calendarWeeks.length} {lang === 'nl' ? 'ISO Weken' : 'ISO Weeks'}
          </span>
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">
          {events.length} {lang === 'nl' ? 'totaal afspraken deze periode' : 'total events this period'}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          
          {/* Days of Week Header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
            {/* Left gutter label for ISO week */}
            <div className="p-3 text-center border-r border-slate-200 bg-slate-100/60 font-black text-[10px] text-slate-400 uppercase tracking-wider">
              ISO W
            </div>
            {dayNames.map((name, i) => (
              <div key={name} className="p-3 text-center border-r border-slate-200 last:border-r-0 font-bold text-xs text-slate-600 uppercase">
                {name}
              </div>
            ))}
          </div>

          {/* Week rows */}
          <div className="divide-y divide-slate-200">
            {calendarWeeks.map(({ weekNum, days }) => (
              <div key={`w-${weekNum}`} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[110px]">
                
                {/* Left Gutter: ISO Week Badge */}
                <div 
                  className="p-2 border-r border-slate-200 bg-slate-50/70 flex flex-col items-center justify-start pt-3 select-none"
                  title={`ISO Week ${weekNum}`}
                >
                  <span className="text-[10px] font-black text-slate-400 uppercase">WK</span>
                  <span className="text-xs font-black text-indigo-700 font-mono mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                    {weekNum}
                  </span>
                </div>

                {/* 7 Days of this week */}
                {days.map((d) => {
                  const dateStr = formatDateString(d);
                  const isCurrentMonth = d.getMonth() === month;
                  const isToday = dateStr === todayStr;

                  // Find events matching this day
                  const dayEvents = events.filter(e => {
                    return dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate);
                  });

                  return (
                    <div
                      key={dateStr}
                      onClick={() => onSlotClick(dateStr)}
                      className={`p-1.5 border-r border-slate-200 last:border-r-0 flex flex-col transition-colors cursor-pointer group hover:bg-indigo-50/30 ${
                        !isCurrentMonth ? 'bg-slate-50/40 text-slate-400' : 'bg-white text-slate-800'
                      } ${isToday ? 'bg-indigo-50/40' : ''}`}
                    >
                      {/* Day number & today tag */}
                      <div className="flex items-center justify-between mb-1">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isToday 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                            : isCurrentMonth 
                              ? 'text-slate-700 group-hover:bg-slate-200' 
                              : 'text-slate-400'
                        }`}>
                          {d.getDate()}
                        </span>

                        {isToday && (
                          <span className="text-[8px] font-black text-indigo-600 uppercase">
                            {lang === 'nl' ? 'Vandaag' : 'Today'}
                          </span>
                        )}

                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 font-bold">
                          +
                        </span>
                      </div>

                      {/* Stacked Event Pills */}
                      <div className="space-y-1 overflow-hidden flex-1">
                        {dayEvents.slice(0, 3).map(evt => {
                          const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
                          const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

                          return (
                            <div
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(evt);
                              }}
                              className={`p-1 px-1.5 rounded-lg border text-[11px] font-bold truncate transition-all hover:scale-[1.02] shadow-2xs ${colorTheme.badge}`}
                              title={`${evt.title} (${evt.startTime || 'Hele dag'}) - ${evt.handlers?.join(', ') || ''}`}
                            >
                              <div className="flex items-center gap-1 truncate">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusMeta.dotColor}`} />
                                {!evt.isAllDay && evt.startTime && (
                                  <span className="font-mono text-[9px] opacity-80 shrink-0">{evt.startTime}</span>
                                )}
                                <span className="truncate">{evt.title}</span>
                              </div>
                            </div>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <div className="text-[9px] font-bold text-indigo-700 bg-indigo-50/80 px-1 py-0.5 rounded text-center">
                            +{dayEvents.length - 3} {lang === 'nl' ? 'meer...' : 'more...'}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};
