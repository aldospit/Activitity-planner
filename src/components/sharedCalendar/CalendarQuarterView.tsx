import React from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  User, Briefcase, Plus, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { SharedCalendarEvent, SharedCalendar } from '../../types';
import { getISOWeek, formatDateString } from '../../utils/dateUtils';
import { getMonthNames, getDayNames, CALENDAR_COLORS, STATUS_META } from './calendarHelpers';

interface CalendarQuarterViewProps {
  currentDate: Date;
  events: SharedCalendarEvent[];
  calendar: SharedCalendar;
  onSelectEvent: (event: SharedCalendarEvent) => void;
  onSelectDate: (date: Date) => void;
  onSlotClick: (dateStr: string) => void;
  lang: 'nl' | 'en';
}

export const CalendarQuarterView: React.FC<CalendarQuarterViewProps> = ({
  currentDate,
  events,
  calendar,
  onSelectEvent,
  onSelectDate,
  onSlotClick,
  lang
}) => {
  const year = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const quarterIndex = Math.floor(currentMonth / 3); // 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4
  const quarterMonths = [quarterIndex * 3, quarterIndex * 3 + 1, quarterIndex * 3 + 2];
  const monthNames = getMonthNames(lang);
  const dayNamesShort = getDayNames(lang, true);
  const todayStr = formatDateString(new Date());

  const quarterLabel = `Q${quarterIndex + 1} (${monthNames[quarterMonths[0]]} – ${monthNames[quarterMonths[2]]} ${year})`;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" id="calendar-quarter-view">
      
      {/* Quarter Header Banner */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-500/30">
            Q{quarterIndex + 1}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {lang === 'nl' ? 'Kwartaaloverzicht' : 'Quarter Overview'}: {quarterLabel}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {events.length} {lang === 'nl' ? 'afspraken en mijlpalen in dit kwartaal' : 'events and milestones scheduled in this quarter'}
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-xl bg-slate-800 text-indigo-300 font-mono text-xs font-bold border border-slate-700">
          {year}
        </span>
      </div>

      {/* 3 Months Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {quarterMonths.map((mIdx) => {
          const mName = monthNames[mIdx];
          const firstDay = new Date(year, mIdx, 1);
          const lastDay = new Date(year, mIdx + 1, 0);
          const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Mon = 0
          const daysInMonth = lastDay.getDate();

          // Events in this month
          const monthStartStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-01`;
          const monthEndStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
          
          const monthEvents = events.filter(e => {
            return (e.startDate <= monthEndStr && (e.endDate || e.startDate) >= monthStartStr);
          });

          // Build mini calendar days
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDayOfWeek; i++) {
            cells.push(null);
          }
          for (let d = 1; d <= daysInMonth; d++) {
            cells.push(d);
          }

          return (
            <div key={mIdx} className="space-y-4 pt-4 lg:pt-0 lg:px-3 first:pl-0 last:pr-0">
              {/* Month title */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onSelectDate(new Date(year, mIdx, 1))}
                  className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{mName}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
                  {monthEvents.length} {lang === 'nl' ? 'events' : 'events'}
                </span>
              </div>

              {/* Mini Calendar Grid */}
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {dayNamesShort.map(dn => (
                    <span key={dn} className="text-[10px] font-black text-slate-400 uppercase">{dn}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {cells.map((dayNum, idx) => {
                    if (!dayNum) {
                      return <div key={`empty-${idx}`} className="h-6" />;
                    }

                    const cellDateStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const hasEvents = events.some(e => cellDateStr >= e.startDate && cellDateStr <= (e.endDate || e.startDate));
                    const isToday = cellDateStr === todayStr;

                    return (
                      <button
                        key={cellDateStr}
                        onClick={() => onSlotClick(cellDateStr)}
                        className={`h-6 rounded-md text-[11px] font-bold flex items-center justify-center relative transition-all cursor-pointer ${
                          isToday 
                            ? 'bg-indigo-600 text-white font-black' 
                            : hasEvents 
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' 
                              : 'text-slate-600 hover:bg-slate-200'
                        }`}
                        title={hasEvents ? `${cellDateStr} (${lang === 'nl' ? 'Heeft afspraken' : 'Has events'})` : cellDateStr}
                      >
                        <span>{dayNum}</span>
                        {hasEvents && !isToday && (
                          <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-indigo-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Month Events List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'nl' ? 'Afspraken in' : 'Appointments in'} {mName}
                </span>

                {monthEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    {lang === 'nl' ? 'Geen afspraken gepland in deze maand' : 'No appointments in this month'}
                  </p>
                ) : (
                  monthEvents.map(evt => {
                    const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
                    const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

                    return (
                      <div
                        key={evt.id}
                        onClick={() => onSelectEvent(evt)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:shadow-md ${colorTheme.lightBg} ${colorTheme.border}`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-slate-700">
                            {new Date(evt.startDate).getDate()} {mName.substring(0, 3)} {evt.startTime ? `• ${evt.startTime}` : ''}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded font-extrabold text-[8px] uppercase ${statusMeta.color}`}>
                            {statusMeta[lang === 'nl' ? 'labelNl' : 'labelEn']}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-900 mt-0.5 line-clamp-1">{evt.title}</h5>
                        {evt.productService && (
                          <p className="text-[10px] text-indigo-700 font-semibold truncate mt-0.5">{evt.productService}</p>
                        )}
                        {evt.handlers && evt.handlers.length > 0 && (
                          <div className="text-[9px] text-slate-500 font-medium truncate mt-1">
                            {evt.handlers.join(', ')}
                          </div>
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
