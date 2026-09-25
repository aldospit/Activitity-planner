import React, { useState, useEffect, useMemo } from 'react';
import {
  Palmtree,
  Calendar,
  Users,
  Plus,
  Share2,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  Building,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  UserPlus,
  Clock,
  Sparkles,
  Sun,
  ShieldCheck,
  AlertCircle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  List
} from 'lucide-react';
import {
  VacationCalendar,
  VacationCalendarMember,
  VacationEntry,
  VacationLeaveType,
  VacationLeaveStatus,
  Contact,
  Language
} from '../types';
import { dbService } from '../services/db';
import { formatDateString } from '../utils/dateUtils';

interface VacationPlannerProps {
  lang?: Language;
  onOpenShareUrl?: (slugOrId: string) => void;
}

const MONTH_NAMES_NL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

const LEAVE_TYPES: { type: VacationLeaveType; label: string; icon: string; bg: string; text: string; border: string }[] = [
  { type: 'vakantie', label: 'Vakantie', icon: '🏖️', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  { type: 'verlof', label: 'Verlof / ADV', icon: '🌴', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  { type: 'bijzonder_verlof', label: 'Bijzonder verlof', icon: '⭐', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  { type: 'ziek', label: 'Ziekte / Doktersbezoek', icon: '🏥', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  { type: 'opleiding', label: 'Opleiding / Training', icon: '🎓', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  { type: 'overig', label: 'Overige afwezigheid', icon: '📋', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' }
];

export const VacationPlanner: React.FC<VacationPlannerProps> = ({
  lang = 'nl',
  onOpenShareUrl
}) => {
  const isNl = lang === 'nl';

  // Core Data
  const [calendars, setCalendars] = useState<VacationCalendar[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState<string>('');
  const [entries, setEntries] = useState<VacationEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Views & Controls
  const [viewMode, setViewMode] = useState<'matrix' | 'calendar' | 'members'>('matrix');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [searchMember, setSearchMember] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Modals
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<VacationCalendar | null>(null);

  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);

  // Calendar form
  const [calName, setCalName] = useState('');
  const [calSlug, setCalSlug] = useState('');
  const [calDescription, setCalDescription] = useState('');
  const [calDepartment, setCalDepartment] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calColor, setCalColor] = useState('indigo');

  // Member management form inside calendar modal
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isAddingNewContact, setIsAddingNewContact] = useState(false);
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactDept, setNewContactDept] = useState('');

  // Manual entry modal form
  const [entryMemberId, setEntryMemberId] = useState('');
  const [entryStartDate, setEntryStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryEndDate, setEntryEndDate] = useState('');
  const [entryType, setEntryType] = useState<VacationLeaveType>('vakantie');
  const [entryNotes, setEntryNotes] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load data & subscribe
  const loadData = () => {
    const cals = dbService.getVacationCalendars();
    setCalendars(cals);
    setContacts(dbService.getContacts());

    if (cals.length > 0) {
      if (!activeCalendarId || !cals.some(c => c.id === activeCalendarId)) {
        setActiveCalendarId(cals[0].id);
        setCurrentYear(cals[0].year || new Date().getFullYear());
      }
    }
    setEntries(dbService.getVacationEntries());
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return () => unsub();
  }, []);

  const activeCalendar = useMemo(() => {
    return calendars.find(c => c.id === activeCalendarId) || calendars[0] || null;
  }, [calendars, activeCalendarId]);

  const activeEntries = useMemo(() => {
    if (!activeCalendar) return [];
    return entries.filter(e => e.calendarId === activeCalendar.id);
  }, [entries, activeCalendar]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Copy share URL to clipboard
  const handleCopyShareUrl = (cal: VacationCalendar) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const shareUrl = `${origin}${pathname}?vacation_cal=${cal.slug || cal.id}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(isNl ? 'Unieke kalender-URL gekopieerd naar klembord!' : 'Unique calendar URL copied to clipboard!');
    }).catch(() => {
      prompt(isNl ? 'Kopieer deze unieke deelbare URL:' : 'Copy this URL:', shareUrl);
    });
  };

  // Open calendar edit modal
  const handleOpenEditCalendar = (cal?: VacationCalendar) => {
    if (cal) {
      setEditingCalendar(cal);
      setCalName(cal.name);
      setCalSlug(cal.slug);
      setCalDescription(cal.description || '');
      setCalDepartment(cal.department || '');
      setCalYear(cal.year || new Date().getFullYear());
      setCalColor(cal.color || 'indigo');
      setSelectedContactIds((cal.members || []).map(m => m.contactId).filter(Boolean) as string[]);
    } else {
      setEditingCalendar(null);
      setCalName('');
      setCalSlug('');
      setCalDescription('');
      setCalDepartment('');
      setCalYear(new Date().getFullYear());
      setCalColor('indigo');
      setSelectedContactIds([]);
    }
    setIsAddingNewContact(false);
    setIsCalendarModalOpen(true);
  };

  // Save calendar
  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calName.trim()) return;

    const baseSlug = (calSlug.trim() || calName.trim())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const finalSlug = baseSlug || 'vakantiekalender-' + Date.now();

    // Map selected contacts to calendar members
    const existingMembers = editingCalendar?.members || [];
    const members: VacationCalendarMember[] = selectedContactIds.map(contactId => {
      const contact = contacts.find(c => c.id === contactId);
      const existing = existingMembers.find(m => m.contactId === contactId);

      return {
        id: existing?.id || 'vcm-' + Math.random().toString(36).substr(2, 9),
        contactId,
        name: contact ? `${contact.firstName} ${contact.lastName}`.trim() : (existing?.name || 'Deelnemer'),
        email: contact?.email || existing?.email || '',
        department: calDepartment || existing?.department,
        yearlyAllowanceDays: existing?.yearlyAllowanceDays || 25
      };
    });

    const newCal: VacationCalendar = {
      id: editingCalendar?.id || 'vc-' + Math.random().toString(36).substr(2, 9),
      name: calName.trim(),
      slug: finalSlug,
      description: calDescription.trim(),
      department: calDepartment.trim(),
      year: calYear,
      color: calColor,
      members,
      createdAt: editingCalendar?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveVacationCalendar(newCal);
    setActiveCalendarId(newCal.id);
    setIsCalendarModalOpen(false);
    showToast(isNl ? 'Vakantiekalender succesvol opgeslagen!' : 'Calendar saved successfully!');
  };

  // Delete calendar
  const handleDeleteCalendar = async (calId: string) => {
    if (window.confirm(isNl ? 'Weet u zeker dat u deze vakantiekalender en alle bijbehorende verlofregistraties wilt verwijderen?' : 'Delete this calendar?')) {
      await dbService.deleteVacationCalendar(calId);
      showToast(isNl ? 'Vakantiekalender verwijderd.' : 'Calendar deleted.');
    }
  };

  // Add brand new contact inline and select immediately
  const handleCreateContactInline = async () => {
    if (!newContactFirstName.trim() || !newContactEmail.trim()) return;

    const newContact: Contact = {
      id: 'c-' + Math.random().toString(36).substr(2, 9),
      firstName: newContactFirstName.trim(),
      lastName: newContactLastName.trim(),
      email: newContactEmail.trim()
    };

    await dbService.saveContact(newContact);
    setContacts(dbService.getContacts());
    setSelectedContactIds(prev => [...prev, newContact.id]);

    setNewContactFirstName('');
    setNewContactLastName('');
    setNewContactEmail('');
    setIsAddingNewContact(false);
    showToast(isNl ? 'Contactpersoon opgeslagen in adresboek en toegevoegd!' : 'Contact saved and added!');
  };

  // Save manual entry from manager view
  const handleSaveEntryModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCalendar || !entryMemberId || !entryStartDate) return;

    const member = activeCalendar.members.find(m => m.id === entryMemberId);
    if (!member) return;

    const endDate = entryEndDate || entryStartDate;
    if (entryStartDate > endDate) {
      alert('Startdatum kan niet na einddatum liggen.');
      return;
    }

    // Generate dates
    const dates: string[] = [];
    const curr = new Date(entryStartDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
        dates.push(formatDateString(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (dates.length === 0) {
      alert('De periode bevat enkel weekenddagen.');
      return;
    }

    const newEntry: VacationEntry = {
      id: 've-' + Math.random().toString(36).substr(2, 9),
      calendarId: activeCalendar.id,
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      startDate: entryStartDate,
      endDate,
      dates,
      type: entryType,
      status: 'bevestigd',
      notes: entryNotes.trim(),
      daysCount: dates.length,
      createdAt: new Date().toISOString()
    };

    await dbService.saveVacationEntry(newEntry);
    setIsAddEntryModalOpen(false);
    setEntryNotes('');
    setEntryEndDate('');
    showToast(isNl ? 'Verlofperiode geregistreerd!' : 'Leave entry saved!');
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (!activeCalendar) return [];
    return (activeCalendar.members || []).filter(m => {
      if (searchMember.trim()) {
        const q = searchMember.toLowerCase();
        return m.name.toLowerCase().includes(q) || (m.department || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeCalendar, searchMember]);

  // Days in month for selected month
  const daysInCurrentMonth = useMemo(() => {
    return new Date(currentYear, selectedMonth + 1, 0).getDate();
  }, [currentYear, selectedMonth]);

  return (
    <div className="space-y-5 animate-fade-in" id="vacation-planner-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-3.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-emerald-200 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Top Banner / Calendar Switcher */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl font-black">
              <Palmtree className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {isNl ? 'Vakantie-, Verlof- & Afwezigheidsplanner' : 'Vacation & Leave Planner'}
            </h1>
            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold rounded-full">
              {calendars.length} {isNl ? 'kalenders' : 'calendars'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {isNl
              ? 'Maak vakantiekalenders aan per organisatie of afdeling/team. Deel de unieke link zodat medewerkers online hun eigen naam selecteren en dagen aanklikken of van/tot datums opgeven.'
              : 'Create vacation calendars per organization, department or team with shareable online input links.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* New Calendar Button */}
          <button
            onClick={() => handleOpenEditCalendar()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition-all cursor-pointer flex-1 sm:flex-none justify-center"
          >
            <Plus className="h-4 w-4" />
            <span>{isNl ? '+ Nieuwe Vakantiekalender' : '+ New Calendar'}</span>
          </button>
        </div>
      </div>

      {/* CALENDAR TABS & ACTIVE CALENDAR HEADER */}
      {calendars.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/70 shadow-xs">
          <Palmtree className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">{isNl ? 'Nog geen vakantiekalenders aangemaakt' : 'No calendars yet'}</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {isNl
              ? 'Maak een vakantiekalender aan voor uw kernteam, een specifieke afdeling of de hele organisatie om direct te starten met plannen.'
              : 'Create a calendar to get started.'}
          </p>
          <button
            onClick={() => handleOpenEditCalendar()}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-xs"
          >
            {isNl ? '+ Eerste Kalender Aanmaken' : '+ Create First Calendar'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Calendar Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {calendars.map(cal => {
              const isActive = cal.id === activeCalendarId;
              return (
                <button
                  key={cal.id}
                  onClick={() => {
                    setActiveCalendarId(cal.id);
                    setCurrentYear(cal.year || new Date().getFullYear());
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <Palmtree className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{cal.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {(cal.members || []).length} {isNl ? 'pers.' : 'pers.'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE CALENDAR CARD & SHARE LINK */}
          {activeCalendar && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-slate-800">{activeCalendar.name}</h2>
                    {activeCalendar.department && (
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1">
                        <Building className="h-3 w-3 text-slate-500" />
                        {activeCalendar.department}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold rounded-md">
                      Jaar {activeCalendar.year}
                    </span>
                  </div>
                  {activeCalendar.description && (
                    <p className="text-xs text-slate-500">{activeCalendar.description}</p>
                  )}
                </div>

                {/* UNIQUE SHARE URL & ACTIONS */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Share button with copy link */}
                  <button
                    onClick={() => handleCopyShareUrl(activeCalendar)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title={isNl ? 'Kopieer unieke deelbare link voor deelnemers' : 'Copy share URL'}
                  >
                    <Share2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isNl ? 'Kopieer Deelbare Link' : 'Copy Share Link'}</span>
                  </button>

                  {/* Open Public / Participant View */}
                  <button
                    onClick={() => {
                      if (onOpenShareUrl) {
                        onOpenShareUrl(activeCalendar.slug || activeCalendar.id);
                      } else {
                        const url = `${window.location.origin}${window.location.pathname}?vacation_cal=${activeCalendar.slug || activeCalendar.id}`;
                        window.location.href = url;
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title={isNl ? 'Open de online invulpagina voor deelnemers' : 'Open participant page'}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    <span>{isNl ? 'Open Deelnemerspagina' : 'Open Participant View'}</span>
                  </button>

                  {/* Edit Calendar */}
                  <button
                    onClick={() => handleOpenEditCalendar(activeCalendar)}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
                    title={isNl ? 'Kalender & Deelnemers bewerken' : 'Edit calendar'}
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  {/* Delete Calendar */}
                  <button
                    onClick={() => handleDeleteCalendar(activeCalendar.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                    title={isNl ? 'Kalender verwijderen' : 'Delete calendar'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* View Switcher & Month Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* View switcher */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
                  <button
                    onClick={() => setViewMode('matrix')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'matrix' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isNl ? 'Team Tijdlijn Matrix' : 'Timeline Matrix'}</span>
                  </button>

                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'calendar' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isNl ? 'Maand Kalender' : 'Month View'}</span>
                  </button>

                  <button
                    onClick={() => setViewMode('members')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'members' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isNl ? 'Deelnemers & Saldo' : 'Members & Balances'}</span>
                  </button>
                </div>

                {/* Controls: Month selector & Add Entry button */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
                    <button
                      onClick={() => {
                        if (selectedMonth === 0) {
                          setSelectedMonth(11);
                          setCurrentYear(currentYear - 1);
                        } else {
                          setSelectedMonth(selectedMonth - 1);
                        }
                      }}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {MONTH_NAMES_NL.map((m, i) => (
                        <option key={i} value={i}>{m} {currentYear}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedMonth === 11) {
                          setSelectedMonth(0);
                          setCurrentYear(currentYear + 1);
                        } else {
                          setSelectedMonth(selectedMonth + 1);
                        }
                      }}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (activeCalendar.members.length > 0) {
                        setEntryMemberId(activeCalendar.members[0].id);
                      }
                      setIsAddEntryModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isNl ? '+ Verlof Registreren' : '+ Log Leave'}</span>
                  </button>
                </div>
              </div>

              {/* VIEW 1: MATRIX / TIMELINE VIEW (TEAM VS DAYS OF MONTH) */}
              {viewMode === 'matrix' && (
                <div className="overflow-x-auto pt-2 border border-slate-200/80 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="p-3 font-extrabold w-48 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                          {isNl ? 'Deelnemer / Teamlid' : 'Member'}
                        </th>
                        {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const dateObj = new Date(currentYear, selectedMonth, dayNum);
                          const dayOfWeek = dateObj.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                          return (
                            <th
                              key={dayNum}
                              className={`p-1.5 text-center font-bold min-w-[28px] border-r border-slate-100 ${
                                isWeekend ? 'bg-slate-100/70 text-slate-400' : 'text-slate-700'
                              }`}
                            >
                              <div className="text-[10px] uppercase font-mono">
                                {['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'][dayOfWeek]}
                              </div>
                              <div className="text-xs font-black">{dayNum}</div>
                            </th>
                          );
                        })}
                        <th className="p-3 font-extrabold text-center bg-slate-50 z-10 border-l border-slate-200">
                          {isNl ? 'Dagen' : 'Days'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.map(member => {
                        const memberEntries = activeEntries.filter(e => e.memberId === member.id);
                        const memberDates = new Set<string>();
                        const memberTypeMap = new Map<string, VacationLeaveType>();

                        memberEntries.forEach(entry => {
                          (entry.dates || []).forEach(d => {
                            memberDates.add(d);
                            memberTypeMap.set(d, entry.type);
                          });
                        });

                        const monthDaysBooked = Array.from({ length: daysInCurrentMonth }).filter((_, i) => {
                          const dayNum = i + 1;
                          const mStr = String(selectedMonth + 1).padStart(2, '0');
                          const dStr = String(dayNum).padStart(2, '0');
                          return memberDates.has(`${currentYear}-${mStr}-${dStr}`);
                        }).length;

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 font-bold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-200">
                              <div className="truncate max-w-[170px]">{member.name}</div>
                              {member.department && (
                                <div className="text-[10px] text-slate-400 font-normal truncate">{member.department}</div>
                              )}
                            </td>

                            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                              const dayNum = i + 1;
                              const mStr = String(selectedMonth + 1).padStart(2, '0');
                              const dStr = String(dayNum).padStart(2, '0');
                              const dateStr = `${currentYear}-${mStr}-${dStr}`;

                              const dateObj = new Date(currentYear, selectedMonth, dayNum);
                              const dayOfWeek = dateObj.getDay();
                              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                              const isBooked = memberDates.has(dateStr);
                              const lType = memberTypeMap.get(dateStr);
                              const ltConfig = lType ? LEAVE_TYPES.find(l => l.type === lType) : null;

                              return (
                                <td
                                  key={dayNum}
                                  className={`p-0 text-center border-r border-slate-100 ${
                                    isWeekend ? 'bg-slate-50/50' : ''
                                  }`}
                                >
                                  {isBooked ? (
                                    <div
                                      className={`h-7 w-full flex items-center justify-center font-bold text-xs ${ltConfig?.bg || 'bg-emerald-100'} ${ltConfig?.text || 'text-emerald-800'}`}
                                      title={`${member.name} - ${ltConfig?.label || 'Verlof'} op ${dateStr}`}
                                    >
                                      {ltConfig?.icon || '🏖️'}
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}

                            <td className="p-2 text-center font-black text-slate-700 bg-slate-50/50 border-l border-slate-200">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px]">
                                {monthDaysBooked}d
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 2: CALENDAR VIEW */}
              {viewMode === 'calendar' && (
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 pb-1">
                    <span>Ma</span>
                    <span>Di</span>
                    <span>Wo</span>
                    <span>Do</span>
                    <span>Vr</span>
                    <span className="text-slate-400">Za</span>
                    <span className="text-slate-400">Zo</span>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {/* Monday offset */}
                    {Array.from({ length: (new Date(currentYear, selectedMonth, 1).getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`offset-${i}`} className="h-24 bg-white/40 rounded-xl border border-dashed border-slate-200" />
                    ))}

                    {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const mStr = String(selectedMonth + 1).padStart(2, '0');
                      const dStr = String(dayNum).padStart(2, '0');
                      const dateStr = `${currentYear}-${mStr}-${dStr}`;

                      const dateObj = new Date(currentYear, selectedMonth, dayNum);
                      const dayOfWeek = dateObj.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      // Find all entries for this date
                      const dayEntries = activeEntries.filter(e => (e.dates || []).includes(dateStr));

                      return (
                        <div
                          key={dateStr}
                          className={`h-24 p-1.5 rounded-xl border flex flex-col justify-between overflow-hidden ${
                            isWeekend ? 'bg-slate-100/60 border-slate-200/60 text-slate-400' : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-extrabold">
                            <span>{dayNum}</span>
                            {dayEntries.length > 0 && (
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black">
                                {dayEntries.length} vrij
                              </span>
                            )}
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-0.5">
                            {dayEntries.map(e => (
                              <div
                                key={e.id}
                                className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold truncate"
                                title={`${e.memberName} (${e.type}): ${e.notes || ''}`}
                              >
                                {e.memberName}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIEW 3: MEMBERS & BALANCES */}
              {viewMode === 'members' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMembers.map(member => {
                      const memberEntries = activeEntries.filter(e => e.memberId === member.id);
                      const totalBooked = memberEntries.reduce((acc, curr) => acc + (curr.dates?.length || curr.daysCount || 0), 0);
                      const allowance = member.yearlyAllowanceDays || 25;
                      const remaining = allowance - totalBooked;

                      return (
                        <div
                          key={member.id}
                          className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-2.5"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800">{member.name}</h4>
                              <p className="text-[11px] text-slate-500">{member.email}</p>
                            </div>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600">
                              {member.department || 'Algemeen'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-600">{totalBooked} van {allowance} dagen opgenomen</span>
                              <span className={remaining >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                {remaining} dagen resterend
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${remaining >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, (totalBooked / allowance) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Entries count */}
                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                            <span>{memberEntries.length} verlofperiodes</span>
                            <button
                              onClick={() => {
                                setEntryMemberId(member.id);
                                setIsAddEntryModalOpen(true);
                              }}
                              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
                            >
                              + Verlof inboeken
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE / EDIT CALENDAR */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 my-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Palmtree className="h-4 w-4 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingCalendar ? (isNl ? 'Vakantiekalender Bewerken' : 'Edit Calendar') : (isNl ? 'Nieuwe Vakantiekalender Aanmaken' : 'Create Vacation Calendar')}
                </h3>
              </div>
              <button onClick={() => setIsCalendarModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCalendar} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Naam van de kalender *' : 'Calendar Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isNl ? 'Bijv. Kernteam IT Platform Twente of Afdeling Software' : 'Calendar name...'}
                  value={calName}
                  onChange={(e) => setCalName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Afdeling / Team' : 'Department / Team'}
                  </label>
                  <input
                    type="text"
                    placeholder={isNl ? 'Bijv. IT Beheer of Directie' : 'Department...'}
                    value={calDepartment}
                    onChange={(e) => setCalDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Kalenderjaar *' : 'Year *'}
                  </label>
                  <input
                    type="number"
                    required
                    value={calYear}
                    onChange={(e) => setCalYear(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Unieke URL-naam / Slug (voor deelbare link)' : 'URL Slug'}
                </label>
                <input
                  type="text"
                  placeholder={isNl ? 'Bijv. software-innovatie-2026' : 'slug...'}
                  value={calSlug}
                  onChange={(e) => setCalSlug(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium"
                />
                <p className="text-[10px] text-slate-400">
                  {isNl
                    ? 'Iedere kalender krijgt een eigen unieke URL die gedeeld kan worden zodat deelnemers zelf hun vakantiedagen kunnen aanklikken.'
                    : 'Each calendar has its own shareable link.'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Toelichting of afspraken' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isNl ? 'Afspraken rondom bezetting, piekdagen of aanvraagtermijnen...' : 'Description...'}
                  value={calDescription}
                  onChange={(e) => setCalDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* MEMBERS SELECTION & NEW CONTACT CREATION */}
              <div className="space-y-2 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isNl ? 'Deelnemers selecteren uit Contactpersonen' : 'Select Members from Contacts'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewContact(!isAddingNewContact)}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-extrabold cursor-pointer"
                  >
                    {isAddingNewContact ? (isNl ? 'Annuleer' : 'Cancel') : (isNl ? '+ Nieuw Contact Toevoegen' : '+ Add New Contact')}
                  </button>
                </div>

                {/* Inline contact creation */}
                {isAddingNewContact && (
                  <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-900 block">
                      {isNl ? 'Nieuw contact toevoegen (wordt opgeslagen in algemene contactpersonenlijst):' : 'Add new contact:'}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder={isNl ? 'Voornaam *' : 'First Name *'}
                        value={newContactFirstName}
                        onChange={(e) => setNewContactFirstName(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder={isNl ? 'Achternaam' : 'Last Name'}
                        value={newContactLastName}
                        onChange={(e) => setNewContactLastName(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder={isNl ? 'E-mailadres *' : 'Email *'}
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleCreateContactInline}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        {isNl ? 'Toevoegen' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contacts List */}
                <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                  {contacts.map(c => {
                    const isSelected = selectedContactIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' : 'hover:bg-slate-50 border-transparent text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContactIds(prev => [...prev, c.id]);
                              } else {
                                setSelectedContactIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{c.firstName} {c.lastName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{c.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {isNl ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all cursor-pointer"
                >
                  {editingCalendar ? (isNl ? 'Opslaan' : 'Save') : (isNl ? 'Kalender Aanmaken' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ADD LEAVE ENTRY */}
      {isAddEntryModalOpen && activeCalendar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-800">
                  {isNl ? 'Verlofperiode Registreren' : 'Log Leave Period'}
                </h3>
              </div>
              <button onClick={() => setIsAddEntryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntryModal} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Deelnemer / Persoon *' : 'Member *'}
                </label>
                <select
                  required
                  value={entryMemberId}
                  onChange={(e) => setEntryMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  {activeCalendar.members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Van datum *' : 'From Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={entryStartDate}
                    onChange={(e) => setEntryStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Tot en met datum' : 'To Date'}
                  </label>
                  <input
                    type="date"
                    value={entryEndDate}
                    onChange={(e) => setEntryEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Type afwezigheid *' : 'Type *'}
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as VacationLeaveType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  {LEAVE_TYPES.map(lt => (
                    <option key={lt.type} value={lt.type}>{lt.icon} {lt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Toelichting / Notitie' : 'Notes'}
                </label>
                <input
                  type="text"
                  placeholder={isNl ? 'Bijv. Zomervakantie twee weken...' : 'Notes...'}
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEntryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  {isNl ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100"
                >
                  {isNl ? 'Opslaan' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VacationPlanner;
