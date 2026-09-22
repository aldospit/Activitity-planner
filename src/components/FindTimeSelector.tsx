import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface FindTimeSelectorProps {
  lang: 'nl' | 'en';
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedSlots: { dateTime: string; durationMin: number }[]) => void;
  initialSlots: { dateTime: string; durationMin: number }[];
}

export default function FindTimeSelector({
  lang,
  isOpen,
  onClose,
  onSelect,
  initialSlots
}: FindTimeSelectorProps) {
  // State for calendar month navigation
  const [currentDate, setCurrentDate] = useState(() => new Date());
  // Active selected day in calendar
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  // List of selected slots
  const [selectedSlots, setSelectedSlots] = useState<{ dateTime: string; durationMin: number }[]>([]);
  // Meeting duration setting (applies to newly clicked slots)
  const [duration, setDuration] = useState<number>(60);
  // Custom time text input state
  const [customTime, setCustomTime] = useState<string>('');

  // Synchronize initial slots when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedSlots([...initialSlots]);
      // If there are initial slots, set calendar/selected day to the first slot's date
      if (initialSlots.length > 0) {
        try {
          const firstDate = new Date(initialSlots[0].dateTime);
          if (!isNaN(firstDate.getTime())) {
            setSelectedDay(firstDate);
            setCurrentDate(firstDate);
          }
        } catch (e) {
          // ignore parsing fallback
        }
      } else {
        setSelectedDay(new Date());
        setCurrentDate(new Date());
      }
    }
  }, [isOpen, initialSlots]);

  if (!isOpen) return null;

  const monthsNl = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const months = lang === 'nl' ? monthsNl : monthsEn;

  const weekdaysNl = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const weekdaysEn = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const weekdays = lang === 'nl' ? weekdaysNl : weekdaysEn;

  // Generate days for standard calendar month view (6 weeks grid, Monday-based)
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1
    // Adjust to Monday-based (Monday=0, ..., Sunday=6)
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarGrid: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prev month overflow days
    for (let i = startOffset - 1; i >= 0; i--) {
      calendarGrid.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      calendarGrid.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month overflow days
    const remainingSlots = 42 - calendarGrid.length; // 6 rows * 7 days = 42
    for (let i = 1; i <= remainingSlots; i++) {
      calendarGrid.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return calendarGrid;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Check if two dates are the same day
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Helper to format Date to 'YYYY-MM-DD'
  const formatDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Standard predefined time slots
  const standardTimeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '21:00'
  ];

  // Check if a specific time is selected for the active day
  const getSlotForDayAndTime = (date: Date, timeStr: string) => {
    const targetStr = `${formatDateString(date)}T${timeStr}`;
    return selectedSlots.find(s => s.dateTime.startsWith(targetStr));
  };

  // Count selected slots on a specific date
  const countSlotsOnDate = (date: Date) => {
    const prefix = formatDateString(date);
    return selectedSlots.filter(s => s.dateTime.startsWith(prefix)).length;
  };

  // Toggle a time slot
  const handleToggleSlot = (timeStr: string) => {
    const formattedDate = formatDateString(selectedDay);
    const fullDateTime = `${formattedDate}T${timeStr}`;

    const existingIndex = selectedSlots.findIndex(s => s.dateTime === fullDateTime);
    if (existingIndex > -1) {
      // Remove
      setSelectedSlots(selectedSlots.filter((_, idx) => idx !== existingIndex));
    } else {
      // Add
      setSelectedSlots([...selectedSlots, { dateTime: fullDateTime, durationMin: duration }]);
    }
  };

  // Add custom time
  const handleAddCustomTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTime.trim()) return;

    // Validate HH:MM or H:MM format
    const match = customTime.trim().match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);
    if (!match) {
      alert(lang === 'nl' ? 'Voer een geldige tijd in (bijv. 14:15)' : 'Enter a valid time format (e.g., 14:15)');
      return;
    }

    let timeStr = customTime.trim();
    if (timeStr.length === 4) {
      timeStr = '0' + timeStr; // Normalize to HH:MM
    }

    const formattedDate = formatDateString(selectedDay);
    const fullDateTime = `${formattedDate}T${timeStr}`;

    if (selectedSlots.some(s => s.dateTime === fullDateTime)) {
      alert(lang === 'nl' ? 'Tijdstip is al toegevoegd.' : 'Time slot is already added.');
      return;
    }

    setSelectedSlots([...selectedSlots, { dateTime: fullDateTime, durationMin: duration }]);
    setCustomTime('');
  };

  // Remove a selected slot by full dateTime reference
  const handleRemoveSelectedSlot = (dateTime: string) => {
    setSelectedSlots(selectedSlots.filter(s => s.dateTime !== dateTime));
  };

  // Quick helper to format display date of a slot (e.g., "Ma 30 jun, 09:00")
  const formatSlotDisplay = (dateTimeStr: string) => {
    try {
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      
      const dayName = d.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' });
      const timePart = dateTimeStr.split('T')[1] || '';
      return `${dayName} ${dayNum} ${monthName}, ${timePart}`;
    } catch (e) {
      return dateTimeStr;
    }
  };

  // Submit all selected slots to the parent component
  const handleSubmit = () => {
    onSelect(selectedSlots);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'nl' ? 'Outlook-stijl Tijdstippen Voorstellen' : 'Outlook-style Time Proposals'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {lang === 'nl' 
                  ? 'Kies een datum uit de kalender en vink vervolgens de gewenste tijdstippen aan.'
                  : 'Select a date from the calendar and toggle the desired time slots.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/70 rounded-full text-slate-400 hover:text-slate-600 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Setting Panel: Meeting Duration */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-600">
              {lang === 'nl' ? 'Standaard duur voorstelling:' : 'Default proposal duration:'}
            </span>
          </div>
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[15, 30, 45, 60, 90, 120].map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => setDuration(dur)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  duration === dur 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {dur} min
              </button>
            ))}
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Column 1: The Month Calendar Grid (6 cols) */}
          <div className="md:col-span-6 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
            <div>
              {/* Month Selector Controls */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black text-slate-800">
                  {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {weekdays.map((day, idx) => (
                  <span key={idx} className="text-[10px] font-bold uppercase text-slate-400 py-1">
                    {day}
                  </span>
                ))}
              </div>

              {/* Grid of Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map(({ date, isCurrentMonth }, idx) => {
                  const active = isSameDay(date, selectedDay);
                  const today = isSameDay(date, new Date());
                  const slotsCount = countSlotsOnDate(date);
                  const isPast = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDay(date)}
                      className={`h-11 rounded-xl relative flex flex-col items-center justify-center transition-all focus:outline-none ${
                        active 
                          ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-100 ring-2 ring-indigo-300' 
                          : today
                            ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                            : isCurrentMonth 
                              ? 'bg-white hover:bg-slate-100 text-slate-700 font-medium' 
                              : 'bg-slate-100/40 hover:bg-slate-100 text-slate-400'
                      } ${isPast ? 'opacity-80' : ''}`}
                    >
                      <span className="text-[11px]">{date.getDate()}</span>
                      
                      {/* Count badge for selected slots on this day */}
                      {slotsCount > 0 && (
                        <span className={`absolute bottom-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                          active ? 'bg-white text-indigo-700' : 'bg-emerald-500 text-white'
                        }`}>
                          {slotsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Banner */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 text-center">
              <p className="text-[10px] text-slate-500 font-semibold italic">
                {lang === 'nl' 
                  ? '💡 Selecteer eerst een dag links, vink dan tijden rechts aan.' 
                  : '💡 First select a date on the left, then toggle times on the right.'}
              </p>
            </div>
          </div>

          {/* Column 2: Time Slots List for active day (6 cols) */}
          <div className="md:col-span-6 bg-white border border-slate-200 p-4 rounded-2xl flex flex-col max-h-[380px]">
            <div className="border-b pb-2 mb-3">
              <h4 className="text-xs font-black text-slate-700 flex items-center justify-between">
                <span>
                  ⏰ {lang === 'nl' ? 'Tijdstippen voor' : 'Times for'}{' '}
                  <span className="text-indigo-600 font-bold">
                    {selectedDay.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </span>
                {countSlotsOnDate(selectedDay) > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {countSlotsOnDate(selectedDay)} {lang === 'nl' ? 'gekozen' : 'selected'}
                  </span>
                )}
              </h4>
            </div>

            {/* Grid of standard times */}
            <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 pr-1 min-h-[160px]">
              {standardTimeSlots.map((timeStr) => {
                const isSelected = !!getSlotForDayAndTime(selectedDay, timeStr);
                return (
                  <button
                    key={timeStr}
                    type="button"
                    onClick={() => handleToggleSlot(timeStr)}
                    className={`p-2 rounded-xl text-center text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-550 border-emerald-550 text-white hover:bg-emerald-600 shadow-sm' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span>{timeStr}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Time Form */}
            <form onSubmit={handleAddCustomTime} className="mt-3 pt-3 border-t border-slate-100 flex gap-1.5">
              <input
                type="text"
                placeholder={lang === 'nl' ? 'Ander tijdstip (bijv. 14:15)' : 'Custom time (e.g. 14:15)'}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white p-2 rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'nl' ? 'Voeg toe' : 'Add'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Selected proposals track bar */}
        {selectedSlots.length > 0 && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/60 max-h-[160px] overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              📋 {lang === 'nl' ? 'Totaal geselecteerde voorstellen' : 'Total selected proposals'} ({selectedSlots.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedSlots.map((slot) => (
                <div
                  key={slot.dateTime}
                  className="bg-indigo-50/75 border border-indigo-150/70 text-indigo-850 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5"
                >
                  <span>{formatSlotDisplay(slot.dateTime)}</span>
                  <span className="text-[9px] text-indigo-400">({slot.durationMin}m)</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSelectedSlot(slot.dateTime)}
                    className="text-indigo-400 hover:text-rose-500 font-bold ml-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/60 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'nl' ? 'Geselecteerd:' : 'Selected:'}{' '}
            <span className="text-indigo-600 font-black text-sm">{selectedSlots.length}</span>{' '}
            {lang === 'nl' ? 'voorstellen' : 'proposals'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              {lang === 'nl' ? 'Sluiten' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              {lang === 'nl' ? 'Voorstellen Toevoegen' : 'Add Proposed Slots'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
