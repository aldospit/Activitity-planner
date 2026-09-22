import React from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  User, Briefcase, Plus, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { SharedCalendarEvent, SharedCalendar } from '../../types';
import { getISOWeek, formatDateString } from '../../utils/dateUtils';
import { getMonthNames, getDayNames, CALENDAR_COLORS, STATUS_META } from './calendarHelpers';

interface CalendarYearViewProps {
  currentDate: Date;
  events: SharedCalendarEvent[];
  calendar: SharedCalendar;
  onSelectEvent: (event: SharedCalendarEvent) => void;
  onSelectDate: (date: Date) => void;
  onSlotClick: (dateStr: string) => void;
  lang: 'nl' | 'en';
}

export const CalendarYearView: React.FC<CalendarYearViewProps> = ({
  currentDate,
  events,
  calendar,
  onSelectEvent,
  onSelectDate,
  onSlotClick,
  lang
}) => {
  const year = currentDate.getFullYear();
  const monthNames = getMonthNames(lang);
  const dayNamesShort = getDayNames(lang, true);
  const todayStr = formatDateString(new Date());

  // Aggregate stats
  const handlerCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};

  events.forEach(e => {
    if (e.productService) {
      productCounts[e.productService] = (productCounts[e.productService] || 0) + 1;
    }
    (e.handlers || []).forEach(h => {
      handlerCounts[h] = (handlerCounts[h] || 0) + 1;
    });
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" id="calendar-year-view">
      
      {/* Year Banner */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-500/30">
            {year}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {lang === 'nl' ? 'Jaarkalender & Jaaroverzicht' : 'Year Calendar & Annual Overview'}: {year}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {events.length} {lang === 'nl' ? 'totaal geregistreerde afspraken en werkzaamheden' : 'total scheduled appointments'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <span className="w-3 h-3 rounded-full bg-indigo-600" />
          <span>{lang === 'nl' ? 'Gedeelde Agenda' : 'Shared Agenda'}: {calendar.name}</span>
        </div>
      </div>

      {/* 12 Months Heatmap Matrix */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {Array.from({ length: 12 }).map((_, mIdx) => {
          const mName = monthNames[mIdx];
          const firstDay = new Date(year, mIdx, 1);
          const lastDay = new Date(year, mIdx + 1, 0);
          const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Mon = 0
          const daysInMonth = lastDay.getDate();

          const monthStartStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-01`;
          const monthEndStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
          
          const monthEvents = events.filter(e => {
            return (e.startDate <= monthEndStr && (e.endDate || e.startDate) >= monthStartStr);
          });

          // Build cells
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDayOfWeek; i++) {
            cells.push(null);
          }
          for (let d = 1; d <= daysInMonth; d++) {
            cells.push(d);
          }

          return (
            <div key={mIdx} className="p-3.5 bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => onSelectDate(new Date(year, mIdx, 1))}
                    className="text-xs font-black text-slate-800 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{mName}</span>
                    <ChevronRight className="h-3 w-3 text-slate-400" />
                  </button>
                  {monthEvents.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                      {monthEvents.length}
                    </span>
                  )}
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {dayNamesShort.map(dn => (
                    <span key={dn} className="text-[9px] font-black text-slate-400 uppercase">{dn.substring(0, 1)}</span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {cells.map((dayNum, idx) => {
                    if (!dayNum) {
                      return <div key={`empty-${idx}`} className="h-5" />;
                    }

                    const cellDateStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayEvts = events.filter(e => cellDateStr >= e.startDate && cellDateStr <= (e.endDate || e.startDate));
                    const hasEvents = dayEvts.length > 0;
                    const isToday = cellDateStr === todayStr;

                    return (
                      <button
                        key={cellDateStr}
                        onClick={() => onSlotClick(cellDateStr)}
                        className={`h-5.5 rounded text-[10px] font-bold flex items-center justify-center relative transition-all cursor-pointer ${
                          isToday 
                            ? 'bg-indigo-600 text-white font-black' 
                            : hasEvents 
                              ? 'bg-indigo-200 text-indigo-900 font-black hover:bg-indigo-300' 
                              : 'text-slate-600 hover:bg-slate-200'
                        }`}
                        title={hasEvents ? `${cellDateStr}: ${dayEvts.length} afspraak/afspraken` : cellDateStr}
                      >
                        <span>{dayNum}</span>
                        {hasEvents && !isToday && (
                          <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-indigo-700" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Year Statistics & Handler Summary */}
      <div className="p-6 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Handlers breakdown */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {lang === 'nl' ? 'Afspraken per Behandelaar' : 'Appointments per Handler'}
          </span>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {Object.keys(handlerCounts).length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {lang === 'nl' ? 'Nog geen behandelaren geregistreerd' : 'No handlers assigned'}
              </p>
            ) : (
              Object.entries(handlerCounts).map(([hName, count]) => (
                <div key={hName} className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-50 text-xs">
                  <span className="font-semibold text-slate-800">{hName}</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold">
                    {count} {lang === 'nl' ? 'afspraken' : 'events'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Product/Service breakdown */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {lang === 'nl' ? 'Afspraken per Product / Dienst' : 'Appointments per Product / Service'}
          </span>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {Object.keys(productCounts).length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {lang === 'nl' ? 'Nog geen diensten gekoppeld' : 'No services logged'}
              </p>
            ) : (
              Object.entries(productCounts).map(([pName, count]) => (
                <div key={pName} className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-50 text-xs">
                  <span className="font-semibold text-slate-800 truncate max-w-[220px]">{pName}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold">
                    {count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
