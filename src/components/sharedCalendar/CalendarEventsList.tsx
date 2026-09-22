import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Calendar, Clock, MapPin, User, 
  Briefcase, Download, Printer, Plus, Trash2, Edit3, 
  FileText, Check, ChevronDown, Tag, ArrowUpDown, X
} from 'lucide-react';
import { SharedCalendarEvent, SharedCalendar, CalendarEventStatus } from '../../types';
import { STATUS_META, CALENDAR_COLORS, generateICS, generateCSV, downloadFile } from './calendarHelpers';
import { formatDateString } from '../../utils/dateUtils';

interface CalendarEventsListProps {
  events: SharedCalendarEvent[];
  calendar: SharedCalendar;
  onSelectEvent: (event: SharedCalendarEvent) => void;
  onNewEvent: () => void;
  onDeleteEvent: (id: string) => Promise<void>;
  lang: 'nl' | 'en';
}

export const CalendarEventsList: React.FC<CalendarEventsListProps> = ({
  events,
  calendar,
  onSelectEvent,
  onNewEvent,
  onDeleteEvent,
  lang
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHandlerFilter, setSelectedHandlerFilter] = useState<string>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'upcoming' | 'past' | 'this_month'>('all');
  const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc' | 'title'>('date_asc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const todayStr = formatDateString(new Date());

  // Extract unique handlers from all events
  const allHandlers = useMemo(() => {
    const set = new Set<string>();
    (calendar.defaultHandlers || []).forEach(h => set.add(h));
    events.forEach(e => {
      (e.handlers || []).forEach(h => set.add(h));
    });
    return Array.from(set).sort();
  }, [events, calendar]);

  // Extract unique products/services from all events
  const allProducts = useMemo(() => {
    const set = new Set<string>();
    if (calendar.productService) set.add(calendar.productService);
    events.forEach(e => {
      if (e.productService) set.add(e.productService);
    });
    return Array.from(set).sort();
  }, [events, calendar]);

  // Filtered & sorted events
  const filteredEvents = useMemo(() => {
    let list = events.filter(e => {
      // Search in description, title, product/service, handlers, location, contact
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchDesc = (e.description || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        const matchProduct = (e.productService || '').toLowerCase().includes(q);
        const matchLocation = (e.location || '').toLowerCase().includes(q);
        const matchContact = (e.contactPerson || '').toLowerCase().includes(q);
        const matchHandlers = (e.handlers || []).some(h => h.toLowerCase().includes(q));

        if (!matchTitle && !matchDesc && !matchNotes && !matchProduct && !matchLocation && !matchContact && !matchHandlers) {
          return false;
        }
      }

      // Handler Filter
      if (selectedHandlerFilter !== 'all') {
        if (!e.handlers || !e.handlers.includes(selectedHandlerFilter)) {
          return false;
        }
      }

      // Product/Dienst Filter
      if (selectedProductFilter !== 'all') {
        if (e.productService !== selectedProductFilter) {
          return false;
        }
      }

      // Status Filter
      if (selectedStatusFilter !== 'all') {
        if (e.status !== selectedStatusFilter) {
          return false;
        }
      }

      // Time Range Filter
      if (selectedTimeRange === 'upcoming') {
        if ((e.endDate || e.startDate) < todayStr) return false;
      } else if (selectedTimeRange === 'past') {
        if ((e.endDate || e.startDate) >= todayStr) return false;
      } else if (selectedTimeRange === 'this_month') {
        const curMonth = todayStr.substring(0, 7);
        if (!e.startDate.startsWith(curMonth)) return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'date_asc') {
        const valA = `${a.startDate} ${a.startTime || '00:00'}`;
        const valB = `${b.startDate} ${b.startTime || '00:00'}`;
        return valA.localeCompare(valB);
      } else if (sortBy === 'date_desc') {
        const valA = `${a.startDate} ${a.startTime || '00:00'}`;
        const valB = `${b.startDate} ${b.startTime || '00:00'}`;
        return valB.localeCompare(valA);
      } else {
        return (a.title || '').localeCompare(b.title || '');
      }
    });

    return list;
  }, [events, searchQuery, selectedHandlerFilter, selectedProductFilter, selectedStatusFilter, selectedTimeRange, sortBy, todayStr]);

  const handleExportICS = () => {
    const ics = generateICS(filteredEvents, calendar.name);
    downloadFile(ics, `${calendar.slug || 'agenda'}-events.ics`, 'text/calendar;charset=utf-8;');
  };

  const handleExportCSV = () => {
    const csv = generateCSV(filteredEvents);
    downloadFile(csv, `${calendar.slug || 'agenda'}-events.csv`, 'text/csv;charset=utf-8;');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'nl' ? 'Weet u zeker dat u deze afspraak wilt verwijderen?' : 'Are you sure you want to delete this event?')) {
      return;
    }
    setDeletingId(id);
    try {
      await onDeleteEvent(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-8" id="calendar-events-list-section">
      
      {/* Header with Title & Action Controls */}
      <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <FileText className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-white">
              {lang === 'nl' ? 'Overzicht & Lijst van Afspraken / Events' : 'Appointments & Events List Overview'}
            </h3>
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/30 text-indigo-300 font-mono text-xs font-bold">
              {filteredEvents.length} {lang === 'nl' ? 'resultaten' : 'results'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {lang === 'nl' 
              ? 'Zoek en filter uitgebreid op omschrijving, behandelaar, product of status'
              : 'Search & filter by description, handler, product, or status'}
          </p>
        </div>

        {/* Top Actions: Add Event & Exports */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onNewEvent}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            id="list-add-event-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{lang === 'nl' ? '+ Nieuwe Afspraak' : '+ New Event'}</span>
          </button>

          <button
            onClick={handleExportICS}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="Download iCalendar file (.ics) for Outlook / Apple / Google Calendar"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>iCal / ICS</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="Export to Excel CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            title="Print list"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-3.5">
        
        {/* Main Search Input (Focus on Omschrijving / Description Search) */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'nl' 
              ? '🔍 Zoeken op omschrijving, toelichting, onderwerp, behandelaar of klant...' 
              : '🔍 Search by description, subject, handler, or client...'}
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white text-xs sm:text-sm font-medium text-slate-900 shadow-2xs"
            id="events-list-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Filter: Behandelaar */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <User className="h-3 w-3 text-indigo-600" />
              <span>{lang === 'nl' ? 'Filter op Behandelaar' : 'Filter by Handler'}</span>
            </label>
            <select
              value={selectedHandlerFilter}
              onChange={(e) => setSelectedHandlerFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              id="filter-handler-select"
            >
              <option value="all">{lang === 'nl' ? 'Alle Behandelaren' : 'All Handlers'}</option>
              {allHandlers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Filter: Product / Dienst */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-indigo-600" />
              <span>{lang === 'nl' ? 'Filter op Product / Dienst' : 'Filter by Product / Service'}</span>
            </label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              id="filter-product-select"
            >
              <option value="all">{lang === 'nl' ? 'Alle Producten & Diensten' : 'All Products & Services'}</option>
              {allProducts.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Filter: Status */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Tag className="h-3 w-3 text-indigo-600" />
              <span>Status</span>
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              id="filter-status-select"
            >
              <option value="all">{lang === 'nl' ? 'Alle Statussen' : 'All Statuses'}</option>
              <option value="scheduled">{STATUS_META.scheduled[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
              <option value="confirmed">{STATUS_META.confirmed[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
              <option value="in_progress">{STATUS_META.in_progress[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
              <option value="completed">{STATUS_META.completed[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
              <option value="cancelled">{STATUS_META.cancelled[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
            </select>
          </div>

          {/* Filter: Time Window */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-indigo-600" />
              <span>{lang === 'nl' ? 'Periode' : 'Period'}</span>
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              id="filter-period-select"
            >
              <option value="all">{lang === 'nl' ? 'Alle data' : 'All dates'}</option>
              <option value="upcoming">{lang === 'nl' ? 'Aankomend / Actueel' : 'Upcoming'}</option>
              <option value="this_month">{lang === 'nl' ? 'Deze maand' : 'This Month'}</option>
              <option value="past">{lang === 'nl' ? 'Verleden' : 'Past'}</option>
            </select>
          </div>

        </div>

        {/* Active Filters Summary & Reset */}
        {(searchQuery || selectedHandlerFilter !== 'all' || selectedProductFilter !== 'all' || selectedStatusFilter !== 'all' || selectedTimeRange !== 'all') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
            <span className="text-slate-500 font-medium">
              {lang === 'nl' ? 'Filters actief' : 'Active filters'}: <span className="font-bold text-slate-800">{filteredEvents.length}</span> {lang === 'nl' ? 'van' : 'of'} <span className="font-bold">{events.length}</span>
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedHandlerFilter('all');
                setSelectedProductFilter('all');
                setSelectedStatusFilter('all');
                setSelectedTimeRange('all');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
            >
              {lang === 'nl' ? 'Filters wissen' : 'Clear filters'}
            </button>
          </div>
        )}
      </div>

      {/* Events Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[840px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">{lang === 'nl' ? 'Datum & Tijd' : 'Date & Time'}</th>
              <th className="py-3 px-4">{lang === 'nl' ? 'Onderwerp / Titel' : 'Subject / Title'}</th>
              <th className="py-3 px-4">{lang === 'nl' ? 'Product / Dienst' : 'Product / Service'}</th>
              <th className="py-3 px-4">{lang === 'nl' ? 'Behandelaar(en)' : 'Handler(s)'}</th>
              <th className="py-3 px-4">{lang === 'nl' ? 'Omschrijving' : 'Description'}</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">{lang === 'nl' ? 'Acties' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Calendar className="h-8 w-8 text-slate-300 stroke-1" />
                    <p className="font-semibold text-sm text-slate-600">
                      {lang === 'nl' ? 'Geen afspraken gevonden' : 'No appointments found'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      {lang === 'nl' 
                        ? 'Pas uw zoekopdracht of filters aan, of maak een nieuwe afspraak aan via de knop.'
                        : 'Adjust your search filters or schedule a new event using the button.'}
                    </p>
                    <button
                      onClick={onNewEvent}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs cursor-pointer"
                    >
                      + {lang === 'nl' ? 'Nieuwe afspraak' : 'New event'}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEvents.map(evt => {
                const colorTheme = CALENDAR_COLORS[evt.categoryColor || calendar.color] || CALENDAR_COLORS.indigo;
                const statusMeta = STATUS_META[evt.status] || STATUS_META.scheduled;

                return (
                  <tr
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Date & Time */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{evt.startDate}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{evt.isAllDay ? (lang === 'nl' ? 'Hele dag' : 'All day') : `${evt.startTime || '09:00'} - ${evt.endTime || '10:00'}`}</span>
                      </div>
                    </td>

                    {/* Title */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {evt.title}
                      </div>
                      {evt.location && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                          <span>{evt.location}</span>
                        </div>
                      )}
                      {evt.contactPerson && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-medium text-slate-700">{evt.contactPerson}</span>
                          {evt.contactEmail && <span className="text-slate-400 ml-1">({evt.contactEmail})</span>}
                        </div>
                      )}
                    </td>

                    {/* Product / Service */}
                    <td className="py-3.5 px-4 align-top">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-xs font-semibold border border-indigo-100 max-w-[180px] truncate">
                        <Briefcase className="h-3 w-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{evt.productService || calendar.productService || 'Algemeen'}</span>
                      </span>
                    </td>

                    {/* Handlers */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {evt.handlers && evt.handlers.length > 0 ? (
                          evt.handlers.map(h => (
                            <span key={h} className="px-2 py-0.5 rounded-md bg-white text-slate-800 font-bold text-[11px] border border-slate-200 shadow-2xs">
                              {h}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            {lang === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 align-top max-w-xs">
                      {evt.description ? (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {evt.description}
                        </p>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${statusMeta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                        <span>{statusMeta[lang === 'nl' ? 'labelNl' : 'labelEn']}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(evt);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Bewerken"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(evt.id, e)}
                          disabled={deletingId === evt.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span>
          {lang === 'nl' 
            ? `Totaal ${events.length} afspraken in deze agenda • Realtime gesynchroniseerd` 
            : `Total ${events.length} appointments in this calendar • Synchronized in real-time`}
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          IT Platform Twente • Outlook-Stijl Gedeelde Agenda
        </span>
      </div>

    </div>
  );
};
