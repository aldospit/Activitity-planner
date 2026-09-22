import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, 
  Share2, Settings, Download, ExternalLink, Search, Filter, 
  Layers, Check, Copy, AlertCircle, RefreshCw, Briefcase, 
  Clock, MapPin, User, ChevronDown, Sparkles
} from 'lucide-react';
import { SharedCalendar, SharedCalendarEvent } from '../types';
import { dbService } from '../services/db';
import { getPublicOrigin } from '../utils/url';
import { getISOWeek, getWeekDates, formatDateString } from '../utils/dateUtils';
import { getMonthNames, CALENDAR_COLORS } from './sharedCalendar/calendarHelpers';
import { CalendarDayView } from './sharedCalendar/CalendarDayView';
import { CalendarWeekView } from './sharedCalendar/CalendarWeekView';
import { CalendarMonthView } from './sharedCalendar/CalendarMonthView';
import { CalendarQuarterView } from './sharedCalendar/CalendarQuarterView';
import { CalendarYearView } from './sharedCalendar/CalendarYearView';
import { CalendarEventsList } from './sharedCalendar/CalendarEventsList';
import { CalendarEventModal } from './sharedCalendar/CalendarEventModal';
import { CalendarManageModal } from './sharedCalendar/CalendarManageModal';

interface SharedCalendarViewProps {
  lang: 'nl' | 'en';
  isStandalonePublic?: boolean;
  initialCalendarSlugOrId?: string;
}

type CalendarViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const SharedCalendarView: React.FC<SharedCalendarViewProps> = ({
  lang,
  isStandalonePublic = false,
  initialCalendarSlugOrId
}) => {
  // Calendar data
  const [calendars, setCalendars] = useState<SharedCalendar[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState<string>('');
  const [events, setEvents] = useState<SharedCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Date & View Mode
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<SharedCalendarEvent | null>(null);
  const [eventInitialDate, setEventInitialDate] = useState<string | undefined>(undefined);
  const [eventInitialTime, setEventInitialTime] = useState<string | undefined>(undefined);

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to Shared Calendars
  useEffect(() => {
    const unsub = dbService.subscribeToSharedCalendars((allCals) => {
      setCalendars(allCals);
      setIsLoading(false);

      if (allCals.length > 0) {
        // If initial slug or id is provided, select it
        if (initialCalendarSlugOrId) {
          const match = allCals.find(c => c.slug === initialCalendarSlugOrId || c.id === initialCalendarSlugOrId);
          if (match) {
            setActiveCalendarId(match.id);
            return;
          }
        }

        // If current active is still valid, keep it
        if (activeCalendarId && allCals.some(c => c.id === activeCalendarId)) {
          return;
        }

        // Otherwise select first
        setActiveCalendarId(allCals[0].id);
      }
    });

    return () => unsub();
  }, [initialCalendarSlugOrId]);

  // Active Calendar Object
  const activeCalendar = useMemo(() => {
    return calendars.find(c => c.id === activeCalendarId) || calendars[0] || null;
  }, [calendars, activeCalendarId]);

  // Subscribe to Events of active calendar
  useEffect(() => {
    if (!activeCalendar) {
      setEvents([]);
      return;
    }

    const unsub = dbService.subscribeToSharedCalendarEvents(activeCalendar.id, (calEvents) => {
      setEvents(calEvents);
    });

    return () => unsub();
  }, [activeCalendar?.id]);

  // Show quick toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Date Navigation Calculations
  const isoWeekNum = getISOWeek(currentDate);
  const weekDates = useMemo(() => {
    return getWeekDates(currentDate.getFullYear(), isoWeekNum);
  }, [currentDate, isoWeekNum]);

  const monthNames = getMonthNames(lang);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'quarter') {
      d.setMonth(d.getMonth() - 3);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'quarter') {
      d.setMonth(d.getMonth() + 3);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Add Event Modal for a specific date and time slot
  const handleOpenAddEvent = (dateStr?: string, timeStr?: string) => {
    setEventToEdit(null);
    setEventInitialDate(dateStr || formatDateString(currentDate));
    setEventInitialTime(timeStr || '09:00');
    setIsEventModalOpen(true);
  };

  // Open Edit Event Modal
  const handleOpenEditEvent = (evt: SharedCalendarEvent) => {
    setEventToEdit(evt);
    setEventInitialDate(undefined);
    setEventInitialTime(undefined);
    setIsEventModalOpen(true);
  };

  // Save Event handler
  const handleSaveEvent = async (eventData: SharedCalendarEvent) => {
    await dbService.saveSharedCalendarEvent(eventData);
    showToast(lang === 'nl' ? 'Afspraak succesvol opgeslagen!' : 'Appointment saved successfully!');
  };

  // Delete Event handler
  const handleDeleteEvent = async (id: string) => {
    await dbService.deleteSharedCalendarEvent(id);
    showToast(lang === 'nl' ? 'Afspraak verwijderd.' : 'Appointment deleted.');
  };

  // Save Calendar handler
  const handleSaveCalendar = async (calData: SharedCalendar) => {
    await dbService.saveSharedCalendar(calData);
    setActiveCalendarId(calData.id);
    showToast(lang === 'nl' ? 'Agenda opgeslagen!' : 'Calendar saved!');
  };

  // Delete Calendar handler
  const handleDeleteCalendar = async (id: string) => {
    await dbService.deleteSharedCalendar(id);
    showToast(lang === 'nl' ? 'Agenda verwijderd.' : 'Calendar deleted.');
  };

  // Copy shareable link for current active calendar
  const handleCopyCalendarShareUrl = () => {
    if (!activeCalendar) return;
    const origin = getPublicOrigin();
    const url = `${origin}${window.location.pathname}?sharedCalendar=${encodeURIComponent(activeCalendar.slug || activeCalendar.id)}`;
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    showToast(lang === 'nl' ? 'Unieke agenda URL gekopieerd!' : 'Unique calendar URL copied!');
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  // Formatted date period header string
  const periodHeaderLabel = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (viewMode === 'day') {
      return currentDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    if (viewMode === 'week') {
      const start = weekDates[0].toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' });
      const end = weekDates[6].toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${lang === 'nl' ? 'Week' : 'Week'} ${isoWeekNum} (${start} – ${end})`;
    }
    if (viewMode === 'month') {
      return `${monthNames[m]} ${y}`;
    }
    if (viewMode === 'quarter') {
      const qNum = Math.floor(m / 3) + 1;
      return `Kwartaal ${qNum} (Q${qNum}) ${y}`;
    }
    return `${lang === 'nl' ? 'Jaar' : 'Year'} ${y}`;
  }, [currentDate, viewMode, weekDates, isoWeekNum, monthNames, lang]);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-indigo-600 font-bold text-sm animate-pulse">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>{lang === 'nl' ? 'Gedeelde agenda laden...' : 'Loading shared calendar...'}</span>
        </div>
      </div>
    );
  }

  if (!activeCalendar) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4">
        <CalendarIcon className="h-12 w-12 text-slate-300 stroke-1" />
        <h3 className="text-lg font-bold text-slate-800">
          {lang === 'nl' ? 'Geen gedeelde agenda gevonden' : 'No shared calendar found'}
        </h3>
        <p className="text-xs text-slate-500 max-w-md">
          {lang === 'nl' 
            ? 'Er is nog geen gedeelde agenda aangemaakt voor dit product of deze unieke link.' 
            : 'No shared calendar exists for this product or unique link yet.'}
        </p>
        <button
          onClick={() => setIsManageModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer"
        >
          + {lang === 'nl' ? 'Eerste Gedeelde Agenda Aanmaken' : 'Create First Shared Calendar'}
        </button>
      </div>
    );
  }

  const calColor = CALENDAR_COLORS[activeCalendar.color] || CALENDAR_COLORS.indigo;

  return (
    <div className="space-y-6" id="shared-calendar-container">
      
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex items-center gap-3 animate-slide-in">
          <div className="bg-emerald-500 rounded-lg p-1 text-white">
            <Check className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold text-slate-100">{toastMessage}</p>
        </div>
      )}

      {/* Top Banner for Standalone Public View */}
      {isStandalonePublic && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-indigo-900 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in" id="standalone-calendar-header">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/30">
                <CalendarIcon className="h-4 w-4" />
              </span>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>{activeCalendar.name}</span>
              </h1>
              <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase rounded-lg tracking-wider border border-indigo-400/30">
                {activeCalendar.productService || 'Gedeelde Dienst'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium max-w-2xl">
              {activeCalendar.description || (lang === 'nl'
                ? 'Welkom op deze gedeelde agenda. Iedereen met deze link kan direct afspraken inzien, aanmaken, wijzigen of verwijderen.'
                : 'Welcome to this shared calendar. Anyone with this unique link can view, schedule, and manage appointments.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleCopyCalendarShareUrl}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
              id="standalone-share-btn"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{copiedShareLink ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Deel deze Agenda' : 'Share Calendar')}</span>
            </button>

            <a
              href={`${window.location.origin}${window.location.pathname}`}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <span>{lang === 'nl' ? 'Naar Hoofdplatform' : 'Main Platform'}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Main Outlook Toolbar & Calendar Switcher */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4" id="calendar-main-toolbar">
        
        {/* Left: Agenda Selector & Manage Button */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Calendar Dropdown Selector */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-1 pr-3 transition-all">
              <div className={`w-3.5 h-3.5 rounded-full ml-2.5 shrink-0 ${calColor.bg}`} />
              <select
                value={activeCalendar.id}
                onChange={(e) => setActiveCalendarId(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-extrabold text-slate-800 focus:outline-none cursor-pointer pr-2 py-1"
                id="active-calendar-select"
              >
                {calendars.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.productService || 'Dienst'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Manage / Create Agenda Button */}
          <button
            onClick={() => setIsManageModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
            title={lang === 'nl' ? 'Beheer gedeelde agenda’s en maak nieuwe aan' : 'Manage shared calendars'}
            id="manage-calendars-btn"
          >
            <Settings className="h-3.5 w-3.5 text-indigo-600" />
            <span>{lang === 'nl' ? 'Beheer Agenda’s' : 'Manage'}</span>
          </button>

          {/* Copy Share URL Button */}
          <button
            onClick={handleCopyCalendarShareUrl}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              copiedShareLink 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title={lang === 'nl' ? 'Kopieer unieke deelbare URL van deze agenda' : 'Copy unique shareable URL'}
            id="copy-calendar-url-btn"
          >
            {copiedShareLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-indigo-600" />}
            <span>{copiedShareLink ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Deelbare URL' : 'Share Link')}</span>
          </button>
        </div>

        {/* Center: Outlook Date Navigation */}
        <div className="flex items-center justify-center gap-2">
          
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Vorige"
            id="cal-prev-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            onClick={handleToday}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors cursor-pointer"
            id="cal-today-btn"
          >
            {lang === 'nl' ? 'Vandaag' : 'Today'}
          </button>

          <button
            onClick={handleNext}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Volgende"
            id="cal-next-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Current Period Display with ISO Week Badge */}
          <div className="flex items-center gap-2 pl-2">
            <span className="text-xs sm:text-sm font-black text-slate-900 font-sans whitespace-nowrap">
              {periodHeaderLabel}
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] font-black font-mono">
              ISO W{isoWeekNum}
            </span>
          </div>

        </div>

        {/* Right: View Switcher (Day, Week, Month, Quarter, Year) + Add Event Button */}
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          
          {/* Outlook View Switcher Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'day' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="view-mode-day"
            >
              {lang === 'nl' ? 'Dag' : 'Day'}
            </button>

            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'week' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="view-mode-week"
            >
              {lang === 'nl' ? 'Week' : 'Week'}
            </button>

            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'month' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="view-mode-month"
            >
              {lang === 'nl' ? 'Maand' : 'Month'}
            </button>

            <button
              onClick={() => setViewMode('quarter')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'quarter' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="view-mode-quarter"
            >
              {lang === 'nl' ? 'Kwartaal' : 'Quarter'}
            </button>

            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'year' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              id="view-mode-year"
            >
              {lang === 'nl' ? 'Jaar' : 'Year'}
            </button>

          </div>

          {/* Primary Add Event Button */}
          <button
            onClick={() => handleOpenAddEvent()}
            className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all cursor-pointer"
            id="toolbar-add-event-btn"
          >
            <Plus className="h-4 w-4" />
            <span>{lang === 'nl' ? '+ Nieuwe Afspraak' : '+ New Event'}</span>
          </button>

        </div>
      </div>

      {/* Main Calendar View Rendering */}
      {viewMode === 'day' && (
        <CalendarDayView
          currentDate={currentDate}
          events={events}
          calendar={activeCalendar}
          onSelectEvent={handleOpenEditEvent}
          onSlotClick={(dateStr, timeStr) => handleOpenAddEvent(dateStr, timeStr)}
          lang={lang}
        />
      )}

      {viewMode === 'week' && (
        <CalendarWeekView
          currentDate={currentDate}
          weekDates={weekDates}
          events={events}
          calendar={activeCalendar}
          onSelectEvent={handleOpenEditEvent}
          onSlotClick={(dateStr, timeStr) => handleOpenAddEvent(dateStr, timeStr)}
          lang={lang}
        />
      )}

      {viewMode === 'month' && (
        <CalendarMonthView
          currentDate={currentDate}
          events={events}
          calendar={activeCalendar}
          onSelectEvent={handleOpenEditEvent}
          onSelectDate={(d) => {
            setCurrentDate(d);
            setViewMode('day');
          }}
          onSlotClick={(dateStr) => handleOpenAddEvent(dateStr)}
          lang={lang}
        />
      )}

      {viewMode === 'quarter' && (
        <CalendarQuarterView
          currentDate={currentDate}
          events={events}
          calendar={activeCalendar}
          onSelectEvent={handleOpenEditEvent}
          onSelectDate={(d) => {
            setCurrentDate(d);
            setViewMode('month');
          }}
          onSlotClick={(dateStr) => handleOpenAddEvent(dateStr)}
          lang={lang}
        />
      )}

      {viewMode === 'year' && (
        <CalendarYearView
          currentDate={currentDate}
          events={events}
          calendar={activeCalendar}
          onSelectEvent={handleOpenEditEvent}
          onSelectDate={(d) => {
            setCurrentDate(d);
            setViewMode('month');
          }}
          onSlotClick={(dateStr) => handleOpenAddEvent(dateStr)}
          lang={lang}
        />
      )}

      {/* Structured Events List Table placed below the calendar */}
      <CalendarEventsList
        events={events}
        calendar={activeCalendar}
        onSelectEvent={handleOpenEditEvent}
        onNewEvent={() => handleOpenAddEvent()}
        onDeleteEvent={handleDeleteEvent}
        lang={lang}
      />

      {/* Appointment Create/Edit Modal */}
      <CalendarEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        eventToEdit={eventToEdit}
        calendar={activeCalendar}
        initialDate={eventInitialDate}
        initialTime={eventInitialTime}
        lang={lang}
      />

      {/* Calendar Management Modal */}
      <CalendarManageModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        calendars={calendars}
        activeCalendarId={activeCalendar.id}
        onSelectCalendar={(id) => setActiveCalendarId(id)}
        onSaveCalendar={handleSaveCalendar}
        onDeleteCalendar={handleDeleteCalendar}
        lang={lang}
      />

    </div>
  );
};
