import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Palmtree,
  Sun,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Send,
  Building,
  Check,
  AlertCircle
} from 'lucide-react';
import {
  VacationCalendar,
  VacationCalendarMember,
  VacationEntry,
  VacationLeaveType,
  VacationLeaveStatus
} from '../types';
import { dbService } from '../services/db';
import { getDaysInMonth, formatDateString } from '../utils/dateUtils';

interface VacationCalendarSharePageProps {
  calendarIdOrSlug: string;
  onBackToApp?: () => void;
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

export const VacationCalendarSharePage: React.FC<VacationCalendarSharePageProps> = ({
  calendarIdOrSlug,
  onBackToApp
}) => {
  const [calendar, setCalendar] = useState<VacationCalendar | null>(null);
  const [entries, setEntries] = useState<VacationEntry[]>([]);
  const [selectedMember, setSelectedMember] = useState<VacationCalendarMember | null>(null);

  // Month navigation
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());

  // Input mode: click days vs date range
  const [inputMode, setInputMode] = useState<'click' | 'range'>('click');
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [rangeLeaveType, setRangeLeaveType] = useState<VacationLeaveType>('vakantie');
  const [rangeNotes, setRangeNotes] = useState('');

  // Active leave type for 1-click clicking
  const [activeLeaveType, setActiveLeaveType] = useState<VacationLeaveType>('vakantie');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load calendar & entries
  const reloadData = () => {
    const cal = dbService.getVacationCalendar(calendarIdOrSlug);
    if (cal) {
      setCalendar(cal);
      setCurrentYear(cal.year || new Date().getFullYear());
      setEntries(dbService.getVacationEntries(cal.id));
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = dbService.subscribe(reloadData);
    return () => unsub();
  }, [calendarIdOrSlug]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Entries filtered for this member
  const memberEntries = useMemo(() => {
    if (!selectedMember || !calendar) return [];
    return entries.filter(e => e.calendarId === calendar.id && e.memberId === selectedMember.id);
  }, [entries, selectedMember, calendar]);

  // Set of all selected dates for this member
  const memberDatesMap = useMemo(() => {
    const map = new Map<string, { entry: VacationEntry; type: VacationLeaveType }>();
    memberEntries.forEach(entry => {
      (entry.dates || []).forEach(d => {
        map.set(d, { entry, type: entry.type });
      });
    });
    return map;
  }, [memberEntries]);

  // Calculate total days booked by this member
  const totalDaysBooked = useMemo(() => {
    let count = 0;
    memberEntries.forEach(e => {
      count += (e.dates || []).length || e.daysCount || 0;
    });
    return count;
  }, [memberEntries]);

  // Handle single day click
  const handleDayClick = async (dateStr: string) => {
    if (!selectedMember || !calendar) return;

    // Check if weekend (optional warning or allowed)
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const existing = memberDatesMap.get(dateStr);

    if (existing) {
      // Toggle off / remove date from this entry
      const entry = existing.entry;
      const updatedDates = (entry.dates || []).filter(d => d !== dateStr);

      if (updatedDates.length === 0) {
        // Delete entry
        await dbService.deleteVacationEntry(entry.id);
        showToast(`Dag ${dateStr} verwijderd.`);
      } else {
        // Update entry
        const updatedEntry: VacationEntry = {
          ...entry,
          dates: updatedDates,
          daysCount: updatedDates.length,
          startDate: updatedDates.sort()[0],
          endDate: updatedDates.sort()[updatedDates.length - 1]
        };
        await dbService.saveVacationEntry(updatedEntry);
        showToast(`Dag ${dateStr} verwijderd.`);
      }
    } else {
      // Add date to entry
      const newEntry: VacationEntry = {
        id: 've-' + Math.random().toString(36).substr(2, 9),
        calendarId: calendar.id,
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        memberEmail: selectedMember.email,
        startDate: dateStr,
        endDate: dateStr,
        dates: [dateStr],
        type: activeLeaveType,
        status: 'bevestigd',
        notes: '',
        daysCount: 1,
        createdAt: new Date().toISOString()
      };
      await dbService.saveVacationEntry(newEntry);
      showToast(`Dag ${dateStr} (${activeLeaveType}) vastgelegd!`);
    }
  };

  // Handle range submission
  const handleRangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !calendar || !rangeStartDate || !rangeEndDate) return;

    if (rangeStartDate > rangeEndDate) {
      alert('De startdatum kan niet na de einddatum liggen.');
      return;
    }

    // Generate dates excluding weekends
    const dates: string[] = [];
    const curr = new Date(rangeStartDate);
    const end = new Date(rangeEndDate);

    while (curr <= end) {
      const day = curr.getDay();
      // Skip weekends
      if (day !== 0 && day !== 6) {
        dates.push(formatDateString(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (dates.length === 0) {
      alert('De geselecteerde periode bevat enkel weekenddagen.');
      return;
    }

    const newEntry: VacationEntry = {
      id: 've-' + Math.random().toString(36).substr(2, 9),
      calendarId: calendar.id,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      memberEmail: selectedMember.email,
      startDate: rangeStartDate,
      endDate: rangeEndDate,
      dates,
      type: rangeLeaveType,
      status: 'bevestigd',
      notes: rangeNotes.trim(),
      daysCount: dates.length,
      createdAt: new Date().toISOString()
    };

    await dbService.saveVacationEntry(newEntry);
    showToast(`Periode van ${rangeStartDate} t/m ${rangeEndDate} (${dates.length} werkdagen) succesvol opgeslagen!`);
    setRangeStartDate('');
    setRangeEndDate('');
    setRangeNotes('');
  };

  // Delete an entire entry
  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm('Wilt u deze verlofperiode verwijderen?')) {
      await dbService.deleteVacationEntry(entryId);
      showToast('Verlofperiode verwijderd.');
    }
  };

  if (!calendar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Kalender niet gevonden</h2>
          <p className="text-xs text-slate-500">
            De opgevraagde vakantiekalender kon niet worden geladen. Controleer of de link correct is.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
            >
              Naar de hoofdapplicatie
            </button>
          )}
        </div>
      </div>
    );
  }

  // Days in selected month
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonthIndex, 1).getDay(); // 0 is Sunday
  // Convert so Monday is 0
  const mondayOffset = (firstDayOfWeek + 6) % 7;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 text-slate-800 p-3 sm:p-6 md:p-8">
      {/* Top Header & Branding */}
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-black">
                <Palmtree className="h-5 w-5" />
              </span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                Vakantie-, Verlof- & Afwezigheidskalender
              </span>
              {calendar.department && (
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" />
                  {calendar.department}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              {calendar.name} ({calendar.year})
            </h1>
            {calendar.description && (
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                {calendar.description}
              </p>
            )}
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start md:self-auto"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Terug naar Applicatie</span>
            </button>
          )}
        </div>

        {/* Toast alert */}
        {successToast && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-200 hover:text-white">✕</button>
          </div>
        )}

        {/* STEP 1: PARTICIPANT SELECTION */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                1
              </span>
              <span>Selecteer uw naam uit de deelnemerslijst:</span>
            </h2>
            {selectedMember && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                Geselecteerd: {selectedMember.name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
            {(calendar.members || []).map(member => {
              const isSelected = selectedMember?.id === member.id;
              const count = entries.filter(e => e.calendarId === calendar.id && e.memberId === member.id)
                .reduce((acc, curr) => acc + (curr.dates?.length || curr.daysCount || 0), 0);

              return (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 truncate">{member.name}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  </div>
                  {member.department && (
                    <span className="text-[10px] text-slate-500 truncate">{member.department}</span>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>{count} dagen gepland</span>
                    {member.yearlyAllowanceDays && (
                      <span>van {member.yearlyAllowanceDays}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: PLAN DAYS (ONLY WHEN MEMBER SELECTED) */}
        {!selectedMember ? (
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 text-center text-amber-900 space-y-2">
            <User className="h-8 w-8 text-amber-600 mx-auto" />
            <h3 className="font-bold text-sm">Selecteer eerst uw naam hierboven</h3>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              Kies uw naam uit de deelnemerslijst om uw vakantiedagen, verlof of afwezigheid in te vullen of te bewerken.
            </p>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
            {/* Action Bar: Type selector & Input Mode Switcher */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                    2
                  </span>
                  <h3 className="text-sm font-black text-slate-800">
                    Vakantiedagen invoeren voor <span className="text-indigo-600">{selectedMember.name}</span>
                  </h3>
                </div>

                {/* Mode toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                  <button
                    onClick={() => setInputMode('click')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      inputMode === 'click' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <span>🖱️ Dagen Aanklikken</span>
                  </button>
                  <button
                    onClick={() => setInputMode('range')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      inputMode === 'range' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <span>📅 Van - Tot Periode</span>
                  </button>
                </div>
              </div>

              {/* Leave Type selector for clicking */}
              {inputMode === 'click' ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide block">
                    Kies het verloftype om op kalenderdagen te klikken:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEAVE_TYPES.map(lt => (
                      <button
                        key={lt.type}
                        onClick={() => setActiveLeaveType(lt.type)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          activeLeaveType === lt.type
                            ? `${lt.bg} ${lt.text} ${lt.border} ring-2 ring-offset-1 ring-indigo-500/20 font-black shadow-2xs`
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{lt.icon}</span>
                        <span>{lt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Date range form */
                <form onSubmit={handleRangeSubmit} className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 text-[10px] uppercase block mb-1">
                        Van datum *
                      </label>
                      <input
                        type="date"
                        required
                        value={rangeStartDate}
                        onChange={(e) => setRangeStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 text-[10px] uppercase block mb-1">
                        Tot en met datum *
                      </label>
                      <input
                        type="date"
                        required
                        value={rangeEndDate}
                        onChange={(e) => setRangeEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 text-[10px] uppercase block mb-1">
                        Type afwezigheid *
                      </label>
                      <select
                        value={rangeLeaveType}
                        onChange={(e) => setRangeLeaveType(e.target.value as VacationLeaveType)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                      >
                        {LEAVE_TYPES.map(lt => (
                          <option key={lt.type} value={lt.type}>
                            {lt.icon} {lt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Toelichting / Notitie (optioneel, bijv. Zomervakantie twee weken)..."
                      value={rangeNotes}
                      onChange={(e) => setRangeNotes(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Periode Opslaan</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* INTERACTIVE MONTH CALENDAR */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              {/* Month Navigation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800">
                    {MONTH_NAMES_NL[currentMonthIndex]} {currentYear}
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">
                    (Klik op een werkdag om verlof in te vullen of te wissen)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (currentMonthIndex === 0) {
                        setCurrentMonthIndex(11);
                        setCurrentYear(currentYear - 1);
                      } else {
                        setCurrentMonthIndex(currentMonthIndex - 1);
                      }
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <select
                    value={currentMonthIndex}
                    onChange={(e) => setCurrentMonthIndex(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    {MONTH_NAMES_NL.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      if (currentMonthIndex === 11) {
                        setCurrentMonthIndex(0);
                        setCurrentYear(currentYear + 1);
                      } else {
                        setCurrentMonthIndex(currentMonthIndex + 1);
                      }
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day Labels (Ma t/m Zo) */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 pb-1">
                <span>Ma</span>
                <span>Di</span>
                <span>Wo</span>
                <span>Do</span>
                <span>Vr</span>
                <span className="text-slate-300">Za</span>
                <span className="text-slate-300">Zo</span>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {/* Empty offset padding */}
                {Array.from({ length: mondayOffset }).map((_, i) => (
                  <div key={`offset-${i}`} className="h-16 rounded-xl bg-slate-50/30" />
                ))}

                {/* Actual Month Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const monthStr = String(currentMonthIndex + 1).padStart(2, '0');
                  const dayStr = String(dayNum).padStart(2, '0');
                  const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

                  const dateObj = new Date(currentYear, currentMonthIndex, dayNum);
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  const existing = memberDatesMap.get(dateStr);
                  const ltConfig = existing ? LEAVE_TYPES.find(l => l.type === existing.type) : null;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDayClick(dateStr)}
                      className={`h-16 p-1.5 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                        existing
                          ? `${ltConfig?.bg || 'bg-emerald-100'} ${ltConfig?.border || 'border-emerald-300'} ring-1 ring-emerald-500/20 font-bold shadow-2xs`
                          : isWeekend
                          ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span>{dayNum}</span>
                        {existing && (
                          <span className="text-xs">{ltConfig?.icon || '🏖️'}</span>
                        )}
                      </div>

                      {existing ? (
                        <span className={`text-[9px] truncate font-black ${ltConfig?.text || 'text-emerald-800'}`}>
                          {ltConfig?.label || 'Verlof'}
                        </span>
                      ) : isWeekend ? (
                        <span className="text-[9px] text-slate-300 font-normal">Weekend</span>
                      ) : (
                        <span className="text-[9px] text-slate-400 group-hover:text-indigo-600 font-medium">Vrij?</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OVERVIEW OF PLANNED PERIODS */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-indigo-600" />
                  <span>Vastgelegde verlof- en vakantieperiodes van {selectedMember.name}</span>
                </h3>
                <span className="text-xs font-black px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                  Totaal {totalDaysBooked} dagen ingepland
                </span>
              </div>

              {memberEntries.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Nog geen vakantie of verlof geregistreerd voor {selectedMember.name}. Klik op de kalender hierboven om dagen in te vullen.
                </div>
              ) : (
                <div className="space-y-2">
                  {memberEntries.map(entry => {
                    const lt = LEAVE_TYPES.find(l => l.type === entry.type);
                    return (
                      <div
                        key={entry.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{lt?.icon || '🏖️'}</span>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              <span>{entry.startDate} {entry.endDate && entry.endDate !== entry.startDate ? `t/m ${entry.endDate}` : ''}</span>
                              <span className={`px-2 py-0.2 rounded text-[10px] font-extrabold border ${lt?.bg} ${lt?.text} ${lt?.border}`}>
                                {lt?.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{(entry.dates || []).length || entry.daysCount} werkdagen</span>
                              {entry.notes && <span>• {entry.notes}</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VacationCalendarSharePage;
