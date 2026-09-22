import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { CalendarCategory, YearEvent } from '../types';
import { getPublicOrigin } from '../utils/url';
import { auth } from '../services/firebase';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit, 
  Copy, 
  Printer, 
  Download, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  Check, 
  RefreshCw, 
  Tag, 
  Share2,
  Search,
  ArrowUpDown
} from 'lucide-react';

interface YearCalendarProps {
  lang: 'nl' | 'en';
  isPublicShared?: boolean;
  sharedOwnerId?: string;
  sharedYear?: number;
}

export const YearCalendar: React.FC<YearCalendarProps> = ({ 
  lang, 
  isPublicShared = false, 
  sharedOwnerId,
  sharedYear 
}) => {
  const currentActualYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(sharedYear || 2026);
  const [events, setEvents] = useState<YearEvent[]>([]);
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // UI state
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<YearEvent | null>(null);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  
  // New UI features state for activity view mode, searching, filtering, and sorting
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'list'>('grid');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listCategoryFilter, setListCategoryFilter] = useState('all');
  const [listRecurrenceFilter, setListRecurrenceFilter] = useState('all');
  const [listSortKey, setListSortKey] = useState<'date' | 'title' | 'category'>('date');
  const [listSortDirection, setListSortDirection] = useState<'asc' | 'desc'>('asc');
  const [saveAndClose, setSaveAndClose] = useState(true);

  // Holiday management state
  const [isManagingHolidays, setIsManagingHolidays] = useState(false);
  const [holidayTitle, setHolidayTitle] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  
  // Selected day detail modal
  const [selectedDay, setSelectedDay] = useState<{ dateStr: string; label: string } | null>(null);

  // Form states for new/edit event
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<'one_time' | 'periodic'>('one_time');
  const [formRecurrence, setFormRecurrence] = useState<'weekly' | 'biweekly' | 'monthly' | 'none'>('none');
  const [formRecurrenceEnd, setFormRecurrenceEnd] = useState('');

  // Form states for custom safety category
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Copy success indicator
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Available Tailwind colors for category themes
  const colorOptions = [
    { value: 'indigo', bg: 'bg-indigo-550', border: 'border-indigo-600', text: 'text-indigo-600', dot: 'bg-indigo-500', hex: '#6366f1', bgHex: '#f5f3ff', borderHex: '#c7d2fe' },
    { value: 'rose', bg: 'bg-rose-550', border: 'border-rose-600', text: 'text-rose-600', dot: 'bg-rose-500', hex: '#f43f5e', bgHex: '#fff1f2', borderHex: '#fecdd3' },
    { value: 'emerald', bg: 'bg-emerald-550', border: 'border-emerald-600', text: 'text-emerald-600', dot: 'bg-emerald-500', hex: '#10b981', bgHex: '#ecfdf5', borderHex: '#a7f3d0' },
    { value: 'amber', bg: 'bg-amber-550', border: 'border-amber-600', text: 'text-amber-600', dot: 'bg-amber-500', hex: '#f59e0b', bgHex: '#fffbeb', borderHex: '#fef3c7' },
    { value: 'sky', bg: 'bg-sky-550', border: 'border-sky-600', text: 'text-sky-600', dot: 'bg-sky-500', hex: '#0ea5e9', bgHex: '#f0f9ff', borderHex: '#bae6fd' },
    { value: 'fuchsia', bg: 'bg-fuchsia-550', border: 'border-fuchsia-600', text: 'text-fuchsia-600', dot: 'bg-fuchsia-500', hex: '#d946ef', bgHex: '#fdf4ff', borderHex: '#f5d0fe' },
    { value: 'violet', bg: 'bg-violet-550', border: 'border-violet-600', text: 'text-violet-600', dot: 'bg-violet-500', hex: '#8b5cf6', bgHex: '#f5f3ff', borderHex: '#ddd6fe' }
  ];

  // Map to safely find color mappings
  const getColorClasses = (colorName: string) => {
    return colorOptions.find(o => o.value === colorName) || colorOptions[0];
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubAuth();
  }, []);

  // Fetch / Sync Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isPublicShared && sharedOwnerId) {
        // Guest mode fetching from public db endpoint without subscription
        const res = await dbService.fetchPublicCalendar(sharedOwnerId);
        setEvents(res.events);
        setCategories(res.categories);
      } else {
        // Authenticated or local-first mode
        setEvents(dbService.getYearEvents());
        setCategories(dbService.getCalendarCategories());
      }
    } catch (err) {
      console.error("Error loading year calendar events:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // If fully offline or authenticated subscription update
    if (!isPublicShared) {
      const unsub = dbService.subscribe(() => {
        setEvents(dbService.getYearEvents());
        setCategories(dbService.getCalendarCategories());
      });
      return () => unsub();
    }
  }, [selectedYear, isPublicShared, sharedOwnerId]);

  // ISO Week Number Helper
  const getISOWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };

  // Generate Year's Events Map for Rendering
  const getEventsForDay = (dateStr: string) => {
    const dayEvents: YearEvent[] = [];
    
    events.forEach(e => {
      // Filter by Search Query
      if (listSearchQuery.trim()) {
        const query = listSearchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(query);
        const matchesDesc = (e.description || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return;
      }

      // Filter by Category
      if (listCategoryFilter !== 'all' && e.categoryId !== listCategoryFilter) {
        return;
      }

      // Filter by Recurrence type
      if (listRecurrenceFilter !== 'all') {
        if (listRecurrenceFilter === 'one_time') {
          if (e.type !== 'one_time') return;
        } else if (listRecurrenceFilter === 'periodic') {
          if (e.type !== 'periodic') return;
        } else {
          if (e.type !== 'periodic' || e.recurrence !== listRecurrenceFilter) return;
        }
      }

      // Check exact match
      if (e.date === dateStr) {
        dayEvents.push(e);
        return;
      }

      // Check periodic/recurring rules
      if (e.type === 'periodic' && e.recurrence && e.recurrence !== 'none') {
        const eventDate = new Date(e.date);
        const currentDate = new Date(dateStr);
        
        // Ensure starting constraints
        if (currentDate < eventDate) return;
        
        // Ensure end date constraints
        if (e.recurrenceEnd && currentDate > new Date(e.recurrenceEnd)) return;

        const diffTime = Math.abs(currentDate.getTime() - eventDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (e.recurrence === 'weekly') {
          if (diffDays % 7 === 0) {
            dayEvents.push(e);
          }
        } else if (e.recurrence === 'biweekly') {
          if (diffDays % 14 === 0) {
            dayEvents.push(e);
          }
        } else if (e.recurrence === 'monthly') {
          // Compare dates
          if (currentDate.getDate() === eventDate.getDate()) {
            dayEvents.push(e);
          }
        }
      }
    });

    return dayEvents;
  };

  // Dutch Public Holidays Pre-Seed Data Generator (Calculates mathematically correct Dutch Holidays dynamically)
  const generateDutchHolidays = async () => {
    const year = selectedYear;
    
    // Feestdag category lookup or auto-creation
    let feestdagCat = categories.find(c => c.name.toLowerCase() === 'feestdag' || c.id === 'cc-feestdag');
    if (!feestdagCat) {
      feestdagCat = {
        id: 'cc-feestdag',
        name: 'Feestdag',
        color: 'sky'
      };
      await dbService.saveCalendarCategory(feestdagCat);
    }

    // Dynamic calculation formula for Easter and Christian dependent Dutch holidays
    const getHolidaysForYear = (y: number) => {
      // Computus (Butcher's Algorithm) for Easter
      const a = y % 19;
      const b = Math.floor(y / 100);
      const c = y % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const L = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * L) / 451);
      const month = Math.floor((h + L - 7 * m + 114) / 31); // 3 = March, 4 = April
      const day = ((h + L - 7 * m + 114) % 31) + 1;
      const easterDate = new Date(y, month - 1, day, 12, 0, 0);

      const addDays = (baseDate: Date, numDays: number): string => {
        const copy = new Date(baseDate.getTime());
        copy.setDate(copy.getDate() + numDays);
        const copyY = copy.getFullYear();
        const copyM = String(copy.getMonth() + 1).padStart(2, '0');
        const copyD = String(copy.getDate()).padStart(2, '0');
        return `${copyY}-${copyM}-${copyD}`;
      };

      // Koningsdag rules: April 27th, unless Sunday, then April 26th
      let koningsdagDate = `${y}-04-27`;
      const kDay = new Date(y, 3, 27, 12, 0, 0); // 3 = April in JS 0-indexed Date
      if (kDay.getDay() === 0) { // Sunday
        koningsdagDate = `${y}-04-26`;
      }

      return [
        { title: 'Nieuwjaarsdag', date: `${y}-01-01` },
        { title: 'Goede Vrijdag', date: addDays(easterDate, -2) },
        { title: 'Eerste Paasdag', date: addDays(easterDate, 0) },
        { title: 'Tweede Paasdag', date: addDays(easterDate, 1) },
        { title: 'Koningsdag', date: koningsdagDate },
        { title: 'Bevrijdingsdag', date: `${y}-05-05` },
        { title: 'Hemelvaartsdag', date: addDays(easterDate, 39) },
        { title: 'Eerste Pinksterdag', date: addDays(easterDate, 49) },
        { title: 'Tweede Pinksterdag', date: addDays(easterDate, 50) },
        { title: 'Eerste Kerstdag', date: `${y}-12-25` },
        { title: 'Tweede Kerstdag', date: `${y}-12-26` }
      ];
    };

    const targetHolidays = getHolidaysForYear(year);
    let createdCount = 0;

    for (const h of targetHolidays) {
      // Avoid duplication (independent of isFeestdag flag)
      const alreadyExists = events.some(e => e.date === h.date && e.title.toLowerCase() === h.title.toLowerCase());
      if (!alreadyExists) {
        const id = 'holiday-' + Math.random().toString(36).substr(2, 9);
        const newEv: YearEvent = {
          id,
          year,
          title: h.title,
          description: lang === 'nl' ? 'Nationale feestdag' : 'National holiday',
          categoryId: feestdagCat.id,
          date: h.date,
          type: 'one_time',
          isFeestdag: true
        };
        await dbService.saveYearEvent(newEv);
        createdCount++;
      }
    }

    loadData();
    return createdCount;
  };

  // Copy Events from Previous Year
  const copyEventsFromPreviousYear = async () => {
    const prevYear = selectedYear - 1;
    const prevYearEvents = events.filter(e => e.year === prevYear && !e.isFeestdag);

    if (prevYearEvents.length === 0) {
      alert(lang === 'nl'
        ? `Geen handmatig ingevoerde activiteiten gevonden in het kalenderjaar ${prevYear} om te kopiëren.`
        : `No non-holiday events found in ${prevYear} to duplicate.`
      );
      return;
    }

    if (!confirm(lang === 'nl'
      ? `Weet je zeker dat je ${prevYearEvents.length} activiteiten van ${prevYear} wilt kopiëren naar het huidige jaar ${selectedYear}? De datums worden automatisch aangepast naar dezelfde maand/dag in ${selectedYear}.`
      : `Confirm copying ${prevYearEvents.length} events from ${prevYear} to ${selectedYear}?`
    )) {
      return;
    }

    let copiedCount = 0;
    for (const oldEv of prevYearEvents) {
      // Map old date string 'YYYY-MM-DD' to current chosen year 'selectedYear-MM-DD'
      const parts = oldEv.date.split('-');
      if (parts.length === 3) {
        const newDateStr = `${selectedYear}-${parts[1]}-${parts[2]}`;
        const id = 'copied-' + Math.random().toString(36).substr(2, 9);
        
        let newRecurEnd = null;
        if (oldEv.recurrenceEnd) {
          const endParts = oldEv.recurrenceEnd.split('-');
          if (endParts.length === 3) {
            newRecurEnd = `${selectedYear}-${endParts[1]}-${endParts[2]}`;
          }
        }

        const cloned: YearEvent = {
          ...oldEv,
          id,
          year: selectedYear,
          date: newDateStr,
          recurrenceEnd: newRecurEnd,
          createdAt: new Date().toISOString()
        };

        await dbService.saveYearEvent(cloned);
        copiedCount++;
      }
    }

    alert(lang === 'nl'
      ? `${copiedCount} activiteiten gekopieerd naar ${selectedYear}!`
      : `Successfully cloned ${copiedCount} activities to ${selectedYear}!`
    );
    loadData();
  };

  // Form Submissions
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCategoryId || !formDate) {
      alert(lang === 'nl' ? 'Vul alle verplichte velden in.' : 'Please enter all mandatory fields.');
      return;
    }

    try {
      const eventId = editingEvent ? editingEvent.id : 'ev-' + Math.random().toString(36).substr(2, 9);
      const isEdit = !!editingEvent;

      const eventData: YearEvent = {
        id: eventId,
        year: selectedYear,
        title: formTitle.trim(),
        description: formDesc.trim(),
        categoryId: formCategoryId,
        date: formDate,
        type: formType,
        recurrence: formType === 'periodic' ? formRecurrence : 'none',
        recurrenceEnd: formType === 'periodic' && formRecurrenceEnd ? formRecurrenceEnd : null,
        isFeestdag: editingEvent?.isFeestdag || false
      };

      await dbService.saveYearEvent(eventData);

      alert(lang === 'nl' 
        ? `Activiteit "${eventData.title}" succesvol ${isEdit ? 'aangepast' : 'opgeslagen'}!` 
        : `Activity "${eventData.title}" saved successfully!`
      );

      // Reset or keep open based on the user's choice
      if (saveAndClose) {
        setIsAddingEvent(false);
        setEditingEvent(null);
        resetEventForm();
      } else {
        // Keep screen open for another entry: reset only title & description
        setEditingEvent(null);
        setFormTitle('');
        setFormDesc('');
      }
      loadData();
    } catch (err) {
      console.error(err);
      alert('Save operation failed.');
    }
  };

  const resetEventForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormCategoryId(categories[0]?.id || '');
    setFormDate(`${selectedYear}-01-01`);
    setFormType('one_time');
    setFormRecurrence('none');
    setFormRecurrenceEnd('');
  };

  const handleEditClick = (ev: YearEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDesc(ev.description || '');
    setFormCategoryId(ev.categoryId);
    setFormDate(ev.date);
    setFormType(ev.type);
    setFormRecurrence(ev.recurrence || 'none');
    setFormRecurrenceEnd(ev.recurrenceEnd || '');
    setIsAddingEvent(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm(lang === 'nl' 
      ? 'Weet je zeker dat je deze activiteit wilt verwijderen?' 
      : 'Are you sure you want to delete this event?'
    )) return;

    try {
      await dbService.deleteYearEvent(id);
      setIsAddingEvent(false);
      setEditingEvent(null);
      resetEventForm();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // List View sorting utility
  const handleHeaderSort = (key: 'date' | 'title' | 'category') => {
    if (listSortKey === key) {
      setListSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setListSortKey(key);
      setListSortDirection('asc');
    }
  };

  // Copy/Duplicate selected event in list view to edit form
  const handleCopyEvent = (ev: YearEvent) => {
    setEditingEvent(null); // Clear editing context to treat as brand-new entry
    setFormTitle(`${lang === 'nl' ? 'Kopie van ' : 'Copy of '}${ev.title}`);
    setFormDesc(ev.description || '');
    setFormCategoryId(ev.categoryId);
    setFormDate(ev.date);
    setFormType(ev.type);
    setFormRecurrence(ev.recurrence || 'none');
    setFormRecurrenceEnd(ev.recurrenceEnd || '');
    setIsAddingEvent(true);
  };

  // Category Operations
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      if (editingCategoryId) {
        const category: CalendarCategory = {
          id: editingCategoryId,
          name: newCatName.trim(),
          color: newCatColor,
          description: newCatDesc.trim() || undefined
        };
        await dbService.saveCalendarCategory(category);
        setEditingCategoryId(null);
      } else {
        const id = 'cc-' + Math.random().toString(36).substr(2, 9);
        const category: CalendarCategory = {
          id,
          name: newCatName.trim(),
          color: newCatColor,
          description: newCatDesc.trim() || undefined
        };
        await dbService.saveCalendarCategory(category);
      }
      setNewCatName('');
      setNewCatDesc('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // Prevent deleting default feestdag
    if (id === 'cc-feestdag' || id === 'feestdag') {
      alert(lang === 'nl' ? 'De categorie Feestdag kan niet verwijderd worden.' : 'Feestdag category cannot be deleted.');
      return;
    }

    if (!confirm(lang === 'nl'
      ? 'Weet je zeker dat je deze categorie wilt verwijderen? Activiteiten met deze categorie verliezen hun label.'
      : 'Delete this category?'
    )) return;

    try {
      await dbService.deleteCalendarCategory(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Share URL Generator
  const getShareUrl = () => {
    const baseUrl = getPublicOrigin() + window.location.pathname;
    const userId = currentUserId || auth.currentUser?.uid || 'anonymous';
    return `${baseUrl}?calendar=${selectedYear}&owner=${userId}`;
  };

  const handleCopyShareUrl = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  // Print/PDF triggers
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    const originalViewMode = calendarViewMode;
    
    // If in list view, switch to grid view to compile the PDF visual elements
    if (calendarViewMode !== 'grid') {
      setCalendarViewMode('grid');
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    try {
      const element = document.getElementById('calendar-printable-area');
      if (!element) {
        alert(lang === 'nl' ? 'Kalender element niet gevonden.' : 'Calendar element not found.');
        return;
      }

      // Generate the canvas using html2canvas
      const canvas = await html2canvas(element, {
        scale: 2.5, // Ultra crisp high detail scaling
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const clonedArea = clonedDoc.getElementById('calendar-printable-area');
          if (clonedArea) {
            clonedArea.style.width = '1300px';
            clonedArea.style.padding = '24px';
            clonedArea.style.borderRadius = '0px';
            clonedArea.style.boxShadow = 'none';
            clonedArea.style.border = 'none';
            
            // Adjust grid layout inside clone to render exactly as 4 columns
            const monthGrid = clonedArea.querySelector('[class*="grid-cols-1"]');
            if (monthGrid) {
              monthGrid.classList.remove('md:grid-cols-3', 'xl:grid-cols-4', 'grid-cols-1');
              monthGrid.classList.add('grid-cols-4');
              (monthGrid as HTMLElement).style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
              (monthGrid as HTMLElement).style.gap = '12px';
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 297 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210 mm
      
      const margin = 8;
      const contentWidth = pdfWidth - (margin * 2); // 281 mm
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      if (contentHeight > (pdfHeight - (margin * 2))) {
        const scaledHeight = pdfHeight - (margin * 2);
        const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
        const startX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', startX, margin, scaledWidth, scaledHeight, undefined, 'FAST');
      } else {
        const startY = (pdfHeight - contentHeight) / 2;
        pdf.addImage(imgData, 'PNG', margin, startY, contentWidth, contentHeight, undefined, 'FAST');
      }

      pdf.save(`Jaarkalender_${selectedYear}.pdf`);
    } catch (err) {
      console.error('Error during PDF export:', err);
      alert(lang === 'nl' 
        ? 'Er is een fout opgetreden tijdens het aanmaken van de PDF.' 
        : 'An error occurred while generating your PDF file.'
      );
    } finally {
      if (originalViewMode !== 'grid') {
        setCalendarViewMode(originalViewMode);
      }
      setIsGeneratingPDF(false);
    }
  };

  const months = lang === 'nl' ? [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ] : [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'Augustus', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeekShort = lang === 'nl' 
    ? ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
    : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  // Grid builder list of days for each month
  const getDaysInMonth = (year: number, month: number) => {
    const days = [];
    const date = new Date(year, month, 1);
    
    // Day of the week for day 1 (0 = Sunday, we want 1 = Monday)
    let firstDayOfWeek = date.getDay();
    if (firstDayOfWeek === 0) firstDayOfWeek = 7; // Monday = 1... Sunday = 7

    // Append empty placeholders for aligned starting grid
    for (let i = 1; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return days;
  };

  // Generate filtered and sorted list of events for the management table
  const filteredEventsForList = events
    .filter(e => {
      // Must equal selected year
      if (e.year !== selectedYear) return false;

      // Filter by Search Query
      if (listSearchQuery.trim()) {
        const query = listSearchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(query);
        const matchesDesc = (e.description || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Filter by Category
      if (listCategoryFilter !== 'all' && e.categoryId !== listCategoryFilter) {
        return false;
      }

      // Filter by Recurrence type
      if (listRecurrenceFilter !== 'all') {
        if (listRecurrenceFilter === 'one_time') {
          if (e.type !== 'one_time') return false;
        } else if (listRecurrenceFilter === 'periodic') {
          if (e.type !== 'periodic') return false;
        } else {
          // Specific interval value
          if (e.type !== 'periodic' || e.recurrence !== listRecurrenceFilter) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (listSortKey === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (listSortKey === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (listSortKey === 'category') {
        const catA = categories.find(c => c.id === a.categoryId)?.name || '';
        const catB = categories.find(c => c.id === b.categoryId)?.name || '';
        comparison = catA.localeCompare(catB);
      }

      return listSortDirection === 'asc' ? comparison : -comparison;
    });

  return (
    <div id="year-calendar-root" className="bg-slate-50 min-h-screen p-4 sm:p-6 text-slate-800 font-sans print:bg-white print:p-0">
      
      {/* Header Controls */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm bo-slate-200 border border-slate-100 p-6 mb-6 print:shadow-none print:border-none print:p-0 print:mb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <CalendarIcon className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {lang === 'nl' ? 'Jaarkalender ' : 'Yearly Calendar '} {selectedYear}
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1 print:hidden">
              {lang === 'nl' 
                ? 'Plan en beheer alle periodieke en eenmalige overleggen, expertteams of bijeenkomsten.'
                : 'Plan and manage annual meetings, expert circles, and milestones on a single screen.'}
            </p>
          </div>

          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            
            {/* Year Scroller */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
              <button 
                onClick={() => setSelectedYear(prev => prev - 1)}
                className="p-1.5 hover:bg-white rounded text-slate-600 transition"
                title={lang === 'nl' ? 'Vorig jaar' : 'Previous year'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3.5 font-bold text-sm text-slate-700 min-w-[50px] text-center">
                {selectedYear}
              </span>
              <button 
                onClick={() => setSelectedYear(prev => prev + 1)}
                className="p-1.5 hover:bg-white rounded text-slate-600 transition"
                title={lang === 'nl' ? 'Volgend jaar' : 'Next year'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Read-Only Banner */}
            {isPublicShared && (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                {lang === 'nl' ? 'Gedeelde weergave (Alleen lezen)' : 'Shared View (Read Only)'}
              </span>
            )}

            {!isPublicShared && (
              <>
                {/* Manage Holidays Button */}
                <button
                  onClick={() => setIsManagingHolidays(true)}
                  className={`flex items-center gap-2 px-3.5 py-2 border text-xs font-semibold rounded-lg transition ${
                    isManagingHolidays 
                      ? 'bg-slate-800 text-white border-slate-800' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {lang === 'nl' ? 'Feestdagen beheren' : 'Manage Holidays'}
                </button>

                {/* Clone Previou Year Events Button */}
                <button
                  onClick={copyEventsFromPreviousYear}
                  className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {lang === 'nl' ? 'Kopieer vorig jaar' : 'Cloning last year'}
                </button>

                {/* Manage Categories Trigger */}
                <button
                  onClick={() => setIsManagingCategories(prev => !prev)}
                  className={`flex items-center gap-2 px-3.5 py-2 border text-xs font-semibold rounded-lg transition ${
                    isManagingCategories 
                      ? 'bg-slate-800 text-white border-slate-800' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  {lang === 'nl' ? 'Categorieën beheren' : 'Manage Categories'}
                </button>

                {/* New Event Trigger */}
                <button
                  onClick={() => {
                    resetEventForm();
                    setIsAddingEvent(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  {lang === 'nl' ? 'Event toevoegen' : 'Add Event'}
                </button>

                {/* Share Link Button */}
                <button
                  onClick={handleCopyShareUrl}
                  className={`flex items-center gap-2 px-3.5 py-2 border text-xs font-semibold rounded-lg transition cursor-pointer ${
                    copySuccess 
                      ? 'bg-emerald-50 px-3.5 py-2 border-emerald-200 text-emerald-700' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                  title={lang === 'nl' ? 'Deelbare unieke link kopiëren' : 'Copy shareable link'}
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  {copySuccess ? (lang === 'nl' ? 'Link Gekopieerd!' : 'Link Copied!') : (lang === 'nl' ? 'Online Delen' : 'Share Online')}
                </button>
              </>
            )}

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Global Search & Filter Section */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 print:hidden flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between ">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Search className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {lang === 'nl' ? 'Centraal Zoeken & Filteren op de kalender' : 'Central Calendar Search & Filter'}
                </h2>
                <p className="text-[10px] text-slate-400">
                  {lang === 'nl' ? 'Filtert zowel het visuele jaaroverzicht als de activiteitenlijst' : 'Applies to both the Visual Year Grid and the Activity List'}
                </p>
              </div>
            </div>

            {/* Clear filters button if any active */}
            {(listSearchQuery || listCategoryFilter !== 'all' || listRecurrenceFilter !== 'all') && (
              <button
                onClick={() => {
                  setListSearchQuery('');
                  setListCategoryFilter('all');
                  setListRecurrenceFilter('all');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                ✕ {lang === 'nl' ? 'Filters wissen' : 'Clear filters'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search query box */}
            <div className="relative">
              <input
                type="text"
                value={listSearchQuery}
                onChange={e => setListSearchQuery(e.target.value)}
                placeholder={lang === 'nl' ? 'Zoek activiteit op naam...' : 'Search activity name...'}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <span className="absolute left-3 top-2.5 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
            </div>

            {/* Categories filtering select option */}
            <select
              value={listCategoryFilter}
              onChange={e => setListCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{lang === 'nl' ? 'Alle categorieën' : 'All categories'}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Typen filtering select option */}
            <select
              value={listRecurrenceFilter}
              onChange={e => setListRecurrenceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{lang === 'nl' ? 'Alle typen' : 'All event types'}</option>
              <option value="one_time">{lang === 'nl' ? 'Eenmalige activiteiten' : 'One-time events'}</option>
              <option value="periodic">{lang === 'nl' ? 'Alle herhaalde (periodiek)' : 'All recurring (periodic)'}</option>
              <option value="weekly">{lang === 'nl' ? 'Elke week' : 'Every week'}</option>
              <option value="biweekly">{lang === 'nl' ? 'Om de week (Tweewekelijks)' : 'Every other week'}</option>
              <option value="monthly">{lang === 'nl' ? 'Elke maand' : 'Every month'}</option>
            </select>
          </div>
        </div>
        
        {/* Sub-navigation tabs */}
        <div className="lg:col-span-4 bg-slate-100/65 rounded-xl p-1 flex gap-2 print:hidden border border-slate-200/50">
          <button
            onClick={() => setCalendarViewMode('grid')}
            className={`px-5 py-2 rounded-lg font-bold text-xs transition duration-150 cursor-pointer flex items-center gap-2 ${
              calendarViewMode === 'grid'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-white/40 hover:text-slate-800'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {lang === 'nl' ? 'Jaaroverzicht (Visueel)' : 'Yearly Grid View'}
          </button>
          <button
            onClick={() => setCalendarViewMode('list')}
            className={`px-5 py-2 rounded-lg font-bold text-xs transition duration-150 cursor-pointer flex items-center gap-2 ${
              calendarViewMode === 'list'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-white/40 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            {lang === 'nl' ? 'Activiteitenlijst (Bewerken & Beheer)' : 'Activity List & Manage'}
          </button>
        </div>

        {calendarViewMode === 'grid' ? (
          <div id="calendar-printable-area" className="lg:col-span-4 flex flex-col gap-6">
            {/* Main 12-Month Grid Card Container */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 print:p-0 print:border-none print:shadow-none">
            
            {/* Printing header additions */}
            <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-6">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">IT Platform Twente Jaarkalender {selectedYear}</h1>
              <p className="text-xs text-slate-500 mt-1">Gedownload op {new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')}</p>
              {(listSearchQuery || listCategoryFilter !== 'all' || listRecurrenceFilter !== 'all') && (
                <div className="bg-slate-50 border border-slate-200 rounded p-1.5 mt-2 inline-block">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 block leading-tight">Actieve Filters / Active Filters</span>
                  <span className="text-[10px] text-slate-600 font-medium">
                    {listSearchQuery && `Zoekopdracht: "${listSearchQuery}" | `}
                    {listCategoryFilter !== 'all' && `Categorie: "${categories.find(c => c.id === listCategoryFilter)?.name}" | `}
                    {listRecurrenceFilter !== 'all' && `Type: "${listRecurrenceFilter}"`}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8 print:grid-cols-3 print:gap-x-4 print:gap-y-4">
              {months.map((monthName, monthIdx) => {
                const days = getDaysInMonth(selectedYear, monthIdx);
                
                // Group days into weeks of 7 to calculate rows
                const weeksInMonth: (Date | null)[][] = [];
                let currentWeek: (Date | null)[] = [];

                days.forEach((day, index) => {
                  currentWeek.push(day);
                  if (currentWeek.length === 7 || index === days.length - 1) {
                    // pad ending week if short
                    while (currentWeek.length < 7) {
                      currentWeek.push(null);
                    }
                    weeksInMonth.push(currentWeek);
                    currentWeek = [];
                  }
                });

                return (
                  <div key={monthName} className="flex flex-col bg-slate-50/50 rounded-xl p-3 border border-slate-100/80 print:bg-white print:border-slate-300">
                    
                    {/* Month header banner */}
                    <div className="text-center font-bold text-slate-700 border-b border-slate-200 pb-1.5 mb-2 text-sm uppercase tracking-wider bg-slate-100 rounded py-1 print:bg-white print:border-slate-300 print:py-0.5">
                      {monthName}
                    </div>

                    {/* Day of week headers */}
                    <div className="grid grid-cols-8 gap-1 mb-1 text-[11px] font-bold text-center text-slate-400">
                      <div className="text-[10px] text-slate-300 font-normal">Wk</div>
                      {daysOfWeekShort.map(d => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    {/* Calendar Matrix Rows */}
                    <div className="flex flex-col gap-1 text-xs">
                      {weeksInMonth.map((week, wIndex) => {
                        // Retrieve first non-null day to find week number
                        const firstVal = week.find(d => d !== null);
                        const weekNo = firstVal ? getISOWeekNumber(firstVal) : '';

                        return (
                          <div key={wIndex} className="grid grid-cols-8 gap-1 items-center font-medium text-center">
                            
                            {/* ISO Week Number */}
                            <div className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100/50 rounded py-0.5 border border-slate-100/30 print:border-none print:bg-white">
                              {weekNo}
                            </div>

                            {week.map((day, dIndex) => {
                              if (!day) {
                                return <div key={`empty-${dIndex}`} className="py-1"></div>;
                              }

                              const yearStr = day.getFullYear();
                              const monthStr = String(day.getMonth() + 1).padStart(2, '0');
                              const dateStr = String(day.getDate()).padStart(2, '0');
                              const fullDateStr = `${yearStr}-${monthStr}-${dateStr}`;

                              const dayEvents = getEventsForDay(fullDateStr);
                              const hasEvents = dayEvents.length > 0;
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                              // Define precise colors for optimal rendering on print & screen
                              let cellBg = isWeekend ? '#f8fafc' : '#ffffff';
                              let cellBorder = 'transparent';
                              let primaryBg = isWeekend ? 'bg-slate-100/80 text-slate-400 print:bg-slate-100/30' : 'bg-white text-slate-800 hover:bg-slate-100';
                              let borderStyling = 'border-transparent';
                              let indicatorDots: React.ReactNode = null;

                              if (hasEvents) {
                                const holidayEvent = dayEvents.find(e => e.isFeestdag);
                                if (holidayEvent) {
                                  // Red/sky accent for holiday
                                  cellBg = '#f0f9ff'; // sky-50
                                  cellBorder = '#0ea5e9'; // sky-500
                                  primaryBg = 'bg-sky-50 text-sky-800 font-semibold print:bg-sky-50';
                                  borderStyling = 'border-sky-300';
                                } else {
                                  // Use first custom event's category details
                                  const mainCat = categories.find(c => c.id === dayEvents[0].categoryId);
                                  const cOpts = mainCat ? getColorClasses(mainCat.color) : getColorClasses('indigo');
                                  cellBg = cOpts.bgHex || '#f5f3ff';
                                  cellBorder = cOpts.hex || '#6366f1';
                                  primaryBg = `bg-${mainCat ? mainCat.color : 'indigo'}-50 text-${mainCat ? mainCat.color : 'indigo'}-800 font-semibold print:bg-slate-50`;
                                  borderStyling = `border-${mainCat ? mainCat.color : 'indigo'}-300`;
                                }

                                // Dots for activities
                                indicatorDots = (
                                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5 max-w-[85%] overflow-hidden print:static print:transform-none print:mt-auto print:mb-0.5 print:gap-0.5">
                                    {dayEvents.slice(0, 3).map((ev) => {
                                      const dotCat = categories.find(c => c.id === ev.categoryId);
                                      const cOpts = dotCat ? getColorClasses(dotCat.color) : getColorClasses('indigo');
                                      return (
                                        <span key={ev.id} className="text-[10px] leading-none shrink-0 inline-block font-sans select-none h-2 w-2 flex items-center justify-center" style={{ color: cOpts.hex }}>●</span>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={fullDateStr}
                                  onClick={() => {
                                    setSelectedDay({ 
                                      dateStr: fullDateStr, 
                                      label: day.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) 
                                    });
                                  }}
                                  style={{ backgroundColor: cellBg, borderColor: cellBorder }}
                                  className={`relative py-1 rounded-md text-[11px] border focus:outline-none transition-all ${primaryBg} ${borderStyling} min-h-[26px] flex flex-col items-center justify-center print:min-h-[46px] print:justify-start print:items-start print:p-0.5 print:overflow-hidden`}
                                  title={`${day.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })}: ${dayEvents.length} event(s)`}
                                >
                                  <span className="font-semibold print:text-[8px] print:leading-none print:m-0.5">{day.getDate()}</span>
                                  {indicatorDots}
                                  {hasEvents && (
                                    <div className="hidden print:flex flex-col gap-0.5 w-full text-left overflow-hidden text-[5.5px] leading-tight text-slate-800 font-bold max-h-[34px] mt-0.5">
                                      {dayEvents.slice(0, 3).map(e => {
                                        const cat = categories.find(c => c.id === e.categoryId);
                                        const cOpts = cat ? getColorClasses(cat.color) : getColorClasses('indigo');
                                        return (
                                          <div key={e.id} className="truncate select-none border-l pl-0.5 pr-0.5 whitespace-nowrap leading-none tracking-tighter flex items-center gap-0.5 text-slate-900" style={{ borderLeftColor: cOpts.hex, borderLeftWidth: '1.5px' }}>
                                            <span className="text-[6px] leading-none shrink-0 inline-block select-none" style={{ color: cOpts.hex }}>●</span>
                                            <span className="truncate">{e.title}</span>
                                          </div>
                                        );
                                      })}
                                      {dayEvents.length > 3 && (
                                        <div className="text-[4.5px] italic text-slate-500 font-medium pl-0.5">
                                          +{dayEvents.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4-Column Events Overview Table directly below the Calendar */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'nl' ? `Overzicht ingevoerde evenementen & overleggen ${selectedYear}` : `Scheduled Events & Meetings Overview ${selectedYear}`}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'nl' 
                      ? 'Ingevoerde activiteiten overzichtelijk verdeeld over 4 kwartaalkolommen (Q1 t/m Q4)' 
                      : 'Entered activities structured into 4 quarterly columns (Q1 through Q4)'}
                  </p>
                </div>
                {!isPublicShared && (
                  <button
                    onClick={() => {
                      resetEventForm();
                      setIsAddingEvent(true);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'nl' ? 'Event toevoegen' : 'Add Event'}</span>
                  </button>
                )}
              </div>

              {/* 4 Quarter Columns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { qNum: 1, title: lang === 'nl' ? 'Q1 (Jan - Mrt)' : 'Q1 (Jan - Mar)', monthIndices: [0, 1, 2], badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { qNum: 2, title: lang === 'nl' ? 'Q2 (Apr - Jun)' : 'Q2 (Apr - Jun)', monthIndices: [3, 4, 5], badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { qNum: 3, title: lang === 'nl' ? 'Q3 (Jul - Sep)' : 'Q3 (Jul - Sep)', monthIndices: [6, 7, 8], badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
                  { qNum: 4, title: lang === 'nl' ? 'Q4 (Okt - Dec)' : 'Q4 (Oct - Dec)', monthIndices: [9, 10, 11], badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
                ].map((quarter) => {
                  // Get events for these months
                  const quarterEvents = filteredEventsForList.filter(ev => {
                    const d = new Date(ev.date);
                    return d.getFullYear() === selectedYear && quarter.monthIndices.includes(d.getMonth());
                  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  return (
                    <div key={quarter.qNum} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col">
                      {/* Column Header */}
                      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${quarter.badgeColor}`}>
                          {quarter.title}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {quarterEvents.length} {quarterEvents.length === 1 ? (lang === 'nl' ? 'event' : 'event') : (lang === 'nl' ? 'events' : 'events')}
                        </span>
                      </div>

                      {/* Events in Quarter */}
                      {quarterEvents.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 italic">
                          {lang === 'nl' ? 'Geen evenementen in dit kwartaal' : 'No events in this quarter'}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                          {quarterEvents.map(ev => {
                            const cat = categories.find(c => c.id === ev.categoryId);
                            const cOpts = cat ? getColorClasses(cat.color) : getColorClasses('indigo');
                            const evDate = new Date(ev.date);
                            const dateLabel = evDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            });

                            return (
                              <div
                                key={ev.id}
                                onClick={() => {
                                  if (!isPublicShared) {
                                    setEditingEvent(ev);
                                    setFormTitle(ev.title);
                                    setFormDesc(ev.description || '');
                                    setFormCategoryId(ev.categoryId);
                                    setFormDate(ev.date);
                                    setFormType(ev.isPeriodic ? 'periodic' : 'one_time');
                                    setFormRecurrence(ev.recurrence || 'none');
                                    setFormRecurrenceEnd(ev.recurrenceEndDate || '');
                                    setIsAddingEvent(true);
                                  }
                                }}
                                className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition cursor-pointer flex flex-col gap-1 group"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                    {dateLabel}
                                  </span>
                                  {cat && (
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.2 rounded truncate max-w-[110px]"
                                      style={{ backgroundColor: cOpts.bgHex || '#f5f3ff', color: cOpts.hex || '#6366f1' }}
                                    >
                                      {cat.name}
                                    </span>
                                  )}
                                </div>

                                <div className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                  {ev.title}
                                </div>

                                {ev.description && (
                                  <div className="text-[10px] text-slate-500 line-clamp-1">
                                    {ev.description}
                                  </div>
                                )}

                                {ev.isPeriodic && (
                                  <div className="text-[9px] text-indigo-600 font-medium flex items-center gap-1 mt-0.5">
                                    <span>🔄</span>
                                    <span>
                                      {ev.recurrence === 'weekly' ? (lang === 'nl' ? 'Wekelijks' : 'Weekly')
                                        : ev.recurrence === 'biweekly' ? (lang === 'nl' ? '2-Wekelijks' : 'Bi-weekly')
                                        : (lang === 'nl' ? 'Maandelijks' : 'Monthly')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
        ) : (
          /* Main Events Table / List view card */
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 print:p-0 print:border-none print:shadow-none flex flex-col gap-6 animate-in fade-in duration-200">
            
            {/* Header / Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{lang === 'nl' ? 'Gefilterde evenementengegevens' : 'Filtered Event Records'}</h3>
                <p className="text-slate-400 text-[10px]">{lang === 'nl' ? `${filteredEventsForList.length} overleggen / activiteiten` : `${filteredEventsForList.length} total active records`}</p>
              </div>
              {!isPublicShared && (
                <button
                  onClick={() => {
                    resetEventForm();
                    setIsAddingEvent(true);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === 'nl' ? 'Activiteit toevoegen' : 'Add Activity'}
                </button>
              )}
            </div>

            {/* List Table container */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                    <th 
                      onClick={() => handleHeaderSort('title')}
                      className="p-4 cursor-pointer hover:bg-slate-100/70 hover:text-indigo-600 transition duration-150 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>{lang === 'nl' ? 'Titel & omschrijving' : 'Title & Description'}</span>
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>
                    
                    <th 
                      onClick={() => handleHeaderSort('category')}
                      className="p-4 cursor-pointer hover:bg-slate-100/70 hover:text-indigo-600 transition duration-150 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>{lang === 'nl' ? 'Categorie' : 'Category'}</span>
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>

                    <th 
                      onClick={() => handleHeaderSort('date')}
                      className="p-4 cursor-pointer hover:bg-slate-100/70 hover:text-indigo-600 transition duration-150 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>{lang === 'nl' ? 'Begindatum' : 'Start date'}</span>
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>

                    <th className="p-4">{lang === 'nl' ? 'Frequentie' : 'Frequency'}</th>
                    <th className="p-4">{lang === 'nl' ? 'Einddatum' : 'End date'}</th>
                    
                    {!isPublicShared && (
                      <th className="p-4 text-right">{lang === 'nl' ? 'Acties' : 'Actions'}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEventsForList.map(e => {
                    const cat = categories.find(c => c.id === e.categoryId);
                    const colorClasses = cat ? getColorClasses(cat.color) : getColorClasses('indigo');

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/40 transition duration-100">
                        <td className="p-4 max-w-xs sm:max-w-sm md:max-w-md">
                          <p className="font-bold text-slate-900 text-sm">{e.title}</p>
                          {e.description && (
                            <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2" title={e.description}>
                              {e.description}
                            </p>
                          )}
                        </td>

                        <td className="p-4">
                          {cat ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${colorClasses.bg} text-white shadow-xs`}>
                              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic font-mono">-</span>
                          )}
                        </td>

                        <td className="p-4 font-semibold text-slate-700">
                          {new Date(e.date).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </td>

                        <td className="p-4">
                          {e.type === 'one_time' ? (
                            <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-bold">
                              {lang === 'nl' ? 'Eenmalig' : 'One-time'}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] uppercase font-bold gap-1 items-center shadow-xs">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin duration-4000" />
                              {e.recurrence === 'weekly' 
                                ? (lang === 'nl' ? 'Wekelijks' : 'Weekly') 
                                : e.recurrence === 'biweekly' 
                                ? (lang === 'nl' ? 'Tweewekelijks' : 'Bi-weekly') 
                                : (lang === 'nl' ? 'Maandelijks' : 'Monthly')}
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-slate-500">
                          {e.type === 'periodic' && e.recurrenceEnd ? (
                            new Date(e.recurrenceEnd).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          ) : e.type === 'periodic' ? (
                            <span className="text-slate-400 italic">
                              {lang === 'nl' ? 'Geen einddatum' : 'No limit'}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {!isPublicShared && (
                          <td className="p-4 text-right">
                            <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg p-0.5">
                              
                              {/* Edit triggers modal prefilled */}
                              <button
                                onClick={() => handleEditClick(e)}
                                className="p-1 px-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition"
                                title={lang === 'nl' ? 'Aanpassen' : 'Edit'}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Copy pre-populates modal for duplicate event */}
                              <button
                                onClick={() => handleCopyEvent(e)}
                                className="p-1 px-2 text-slate-500 hover:text-amber-600 hover:bg-white rounded transition"
                                title={lang === 'nl' ? 'Kopiëren (Dupliceren)' : 'Copy (Duplicate)'}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete event */}
                              <button
                                onClick={() => handleDeleteEvent(e.id)}
                                className="p-1 px-2 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition"
                                title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filteredEventsForList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 bg-slate-50/25">
                        <Info className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                        <p className="text-sm font-bold text-slate-700">
                          {lang === 'nl' ? 'Geen activiteiten gevonden' : 'No activities matches'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          {lang === 'nl' 
                            ? 'Er zijn geen activiteiten die voldoen aan je zoekgegevens of geselecteerde filters.' 
                            : 'No saved entries corresponding to your criteria.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* Categories Legend Panel - printable */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 print:border-none print:shadow-none print:p-0 print:mt-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Legenda categorieën</h3>
          <div className="flex flex-wrap gap-4">
            {categories.map(c => {
              const colorClasses = getColorClasses(c.color);
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-3.5 h-3.5 rounded-full ${colorClasses.dot}`} />
                  <span className="font-medium text-slate-700">{c.name}</span>
                </div>
              );
            })}
            {categories.length === 0 && (
              <span className="text-xs text-slate-400 italic">Geen categorieën gedefinieerd.</span>
            )}
          </div>
        </div>

        {/* Printable list of all events matching filters */}
        <div className="hidden print:block mt-8 pt-6 border-t border-slate-300 print:break-before-page">
          <h2 className="text-base font-extrabold text-slate-900 mb-4 tracking-tight uppercase">
            {lang === 'nl' ? 'Geregistreerde Activiteiten & Overleggen' : 'Registered Activities & Events'}
          </h2>
          {filteredEventsForList.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              {lang === 'nl' ? 'Geen activiteiten gevonden voor de geselecteerde filters.' : 'No activities matching current filters.'}
            </p>
          ) : (
            <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
              <thead>
                <tr className="text-slate-700 font-bold bg-slate-50 border-b border-slate-300">
                  <th className="py-2.5 px-3 w-1/4 uppercase tracking-wider text-[10px]">{lang === 'nl' ? 'Datum' : 'Date'}</th>
                  <th className="py-2.5 px-3 w-2/5 uppercase tracking-wider text-[10px]">{lang === 'nl' ? 'Activiteit' : 'Activity'}</th>
                  <th className="py-2.5 px-3 uppercase tracking-wider text-[10px]">{lang === 'nl' ? 'Categorie' : 'Category'}</th>
                  <th className="py-2.5 px-3 uppercase tracking-wider text-[10px]">{lang === 'nl' ? 'Type' : 'Type'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEventsForList
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(e => {
                    const cat = categories.find(c => c.id === e.categoryId);
                    const formattedDate = new Date(e.date).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                    return (
                      <tr key={e.id} className="text-slate-800 hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold whitespace-nowrap text-slate-850">{formattedDate}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-950">{e.title}</div>
                          {e.description && <div className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5">{e.description}</div>}
                        </td>
                        <td className="py-2 px-3">
                          {cat ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: (getColorClasses(cat.color).bgHex || '#f5f3ff'), borderColor: getColorClasses(cat.color).hex, color: '#1e293b' }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getColorClasses(cat.color).hex }} />
                              <span>{cat.name}</span>
                            </div>
                          ) : (
                            e.isFeestdag ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: '#f0f9ff', borderColor: '#0ea5e9', color: '#0ea5e9' }}>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#0ea5e9' }} />
                                <span>{lang === 'nl' ? 'Feestdag' : 'Holiday'}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium">-</span>
                            )
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium capitalize text-slate-650">
                          {e.type === 'periodic' 
                            ? (lang === 'nl' ? `Periodiek (${e.recurrence === 'weekly' ? 'Wekelijks' : e.recurrence === 'biweekly' ? 'Tweewekelijks' : 'Maandelijks'})` : `Periodic (${e.recurrence})`)
                            : (lang === 'nl' ? 'Eenmalig' : 'One-time')
                          }
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Slideover Modal / Dialog for New or Modify Event Form */}
      {isAddingEvent && !isPublicShared && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-250">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingEvent ? (lang === 'nl' ? 'Activiteit bewerken' : 'Edit Event') : (lang === 'nl' ? 'Nieuwe activiteit plannen' : 'Add New Event')}
              </h3>
              <button 
                onClick={() => {
                  setIsAddingEvent(false);
                  setEditingEvent(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">{lang === 'nl' ? 'Naam Overleg/Event' : 'Meeting Title'} *</label>
                <input 
                  type="text" 
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder={lang === 'nl' ? 'Bijv: Expertteam overleg Twente' : 'e.g. Expert Team Twente'}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">{lang === 'nl' ? 'Omschrijving' : 'Description'}</label>
                <textarea 
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder={lang === 'nl' ? 'Geef optionele agenda-punten of details aan.' : 'Optional agenda details'}
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">{lang === 'nl' ? 'Categorie' : 'Category'} *</label>
                <select
                  value={formCategoryId}
                  onChange={e => setFormCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  required
                >
                  <option value="">-- {lang === 'nl' ? 'Kies categorie' : 'Select category'} --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Date selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">{lang === 'nl' ? 'Startdatum' : 'Date'} *</label>
                <input 
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm"
                  required
                />
              </div>

              {/* Event Repeat configuration */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase">{lang === 'nl' ? 'Herhaling / Periodiciteit' : 'Recurrence'}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('one_time')}
                      className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                        formType === 'one_time' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {lang === 'nl' ? 'Eenmalig' : 'One Time'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('periodic')}
                      className={`px-3 py-1 text-xs rounded-md font-semibold transition ${
                        formType === 'periodic' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {lang === 'nl' ? 'Periodiek' : 'Periodic'}
                    </button>
                  </div>
                </div>

                {formType === 'periodic' && (
                  <div className="flex flex-col gap-3 mt-3 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">{lang === 'nl' ? 'Herhaal-interval' : 'Recurrence Interval'}</label>
                      <select
                        value={formRecurrence}
                        onChange={e => setFormRecurrence(e.target.value as any)}
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                      >
                        <option value="weekly">{lang === 'nl' ? 'Wekelijks' : 'Weekly'}</option>
                        <option value="biweekly">{lang === 'nl' ? 'Om de week (Tweewekelijks)' : 'Bi-weekly'}</option>
                        <option value="monthly">{lang === 'nl' ? 'Maandelijks (zelfde dagnummer)' : 'Monthly'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {lang === 'nl' ? 'Einddatum herhaling (optioneel)' : 'Recurrence End Date (optional)'}
                      </label>
                      <input 
                        type="date"
                        value={formRecurrenceEnd}
                        onChange={e => setFormRecurrenceEnd(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modify buttons */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-2">
                {editingEvent ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEvent.id)}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold transition mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {lang === 'nl' ? 'Verwijderen' : 'Delete'}
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={() => {
                    setIsAddingEvent(false);
                    setEditingEvent(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>

                <div className="flex gap-2">
                  {!editingEvent && (
                    <button
                      type="submit"
                      onClick={() => setSaveAndClose(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      {lang === 'nl' ? 'Opslaan & nog een' : 'Save & Add Another'}
                    </button>
                  )}
                  <button
                    type="submit"
                    onClick={() => setSaveAndClose(true)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    {editingEvent 
                      ? (lang === 'nl' ? 'Opslaan' : 'Save Changes') 
                      : (lang === 'nl' ? 'Opslaan & sluiten' : 'Save & Close')}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Day details and list of events occurring on a day modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{lang === 'nl' ? 'Overzicht van de dag' : 'Day Summary'}</span>
                <h4 className="font-bold text-slate-800 text-sm mt-0.5">{selectedDay.label}</h4>
              </div>
              <button 
                onClick={() => setSelectedDay(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              
              {/* Event list */}
              <div className="flex flex-col gap-3.5 max-h-[300px] overflow-y-auto">
                {getEventsForDay(selectedDay.dateStr).map(ev => {
                  const cat = categories.find(c => c.id === ev.categoryId);
                  const colorClasses = cat ? getColorClasses(cat.color) : getColorClasses('indigo');

                  return (
                    <div key={ev.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${colorClasses.dot}`} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{cat ? cat.name : 'Activiteit'}</span>
                        
                        {/* Periodic info */}
                        {ev.type === 'periodic' && (
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                            {ev.recurrence === 'weekly' ? 'Wekelijks' : ev.recurrence === 'biweekly' ? 'Tweewekelijks' : 'Maandelijks'}
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-slate-900 text-sm">{ev.title}</h5>
                      {ev.description && (
                        <p className="text-slate-500 text-xs mt-1 leading-relaxed">{ev.description}</p>
                      )}

                      {/* Edit controls if authorized */}
                      {!isPublicShared && (
                        <div className="flex justify-end gap-2 mt-2.5 pt-2 border-t border-slate-200/50">
                          <button
                            onClick={() => {
                              setSelectedDay(null);
                              handleEditClick(ev);
                            }}
                            className="text-[10px] text-slate-600 hover:text-indigo-600 font-semibold flex items-center gap-1 transition"
                          >
                            <Edit className="w-3 h-3" />
                            {lang === 'nl' ? 'Bewerken' : 'Edit'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {getEventsForDay(selectedDay.dateStr).length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    {lang === 'nl' ? 'Geen geplande activiteiten op deze dag.' : 'No planned events on this day.'}
                  </div>
                )}
              </div>

              {/* Allow direct add for owner */}
              {!isPublicShared && (
                <button
                  onClick={() => {
                    resetEventForm();
                    setFormDate(selectedDay.dateStr);
                    setSelectedDay(null);
                    setIsAddingEvent(true);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 mt-2 shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  {lang === 'nl' ? 'Activiteit toevoegen' : 'Add Activity'}
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Category Management Side Drawer Panel */}
      {isManagingCategories && !isPublicShared && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-end p-0 print:hidden transition-all">
          <div className="bg-white shadow-xl w-full max-w-md h-screen flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-250">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {lang === 'nl' ? 'Activiteit categorieën beheren' : 'Manage Event Categories'}
              </h3>
              <button 
                onClick={() => setIsManagingCategories(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1">
              {/* Add / Edit category form */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  {editingCategoryId 
                    ? (lang === 'nl' ? 'Categorie bewerken' : 'Edit Category')
                    : (lang === 'nl' ? 'Nieuwe categorie aanmaken' : 'Create Category')
                  }
                </h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">{lang === 'nl' ? 'Naam' : 'Name'}</label>
                  <input 
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="w-full px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    placeholder={lang === 'nl' ? 'Bijv: Kernteamoverleg' : 'e.g. Planning'}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">{lang === 'nl' ? 'Omschrijving (optioneel)' : 'Description (optional)'}</label>
                  <textarea 
                    value={newCatDesc}
                    onChange={e => setNewCatDesc(e.target.value)}
                    className="w-full px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 h-16 resize-none"
                    placeholder={lang === 'nl' ? 'Bijv: Voor alle kernteamleden en adviseurs' : 'e.g. For all core team members'}
                  />
                </div>

                {/* Theme picker */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5">{lang === 'nl' ? 'Kleur thema' : 'Color Theme'}</label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewCatColor(opt.value)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${opt.dot} ${
                          newCatColor === opt.value ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                        }`}
                      >
                        {newCatColor === opt.value && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-1">
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(null);
                        setNewCatName('');
                        setNewCatColor('indigo');
                        setNewCatDesc('');
                      }}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 rounded-lg text-xs font-semibold"
                    >
                      {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                    </button>
                  )}
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  >
                    {editingCategoryId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingCategoryId 
                      ? (lang === 'nl' ? 'Wijziging opslaan' : 'Save Changes') 
                      : (lang === 'nl' ? 'Categorie toevoegen' : 'Add Category')
                    }
                  </button>
                </div>
              </div>

              {/* Categories list */}
              <div className="flex flex-col gap-2.5">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">{lang === 'nl' ? 'Bestaande categorieën' : 'Existing Categories'}</h4>
                <div className="flex flex-col gap-2">
                  {categories.map(c => {
                    const classes = getColorClasses(c.color);
                    return (
                      <div key={c.id} className="flex items-start justify-between p-2.5 border border-slate-200 bg-white rounded-xl hover:border-slate-350 transition-all">
                        <div className="flex items-start gap-2 max-w-[75%]">
                          <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${classes.dot}`} />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                            {c.description && (
                              <span className="text-[10px] text-slate-500 mt-0.5 leading-normal break-words">{c.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingCategoryId(c.id);
                              setNewCatName(c.name);
                              setNewCatColor(c.color);
                              setNewCatDesc(c.description || '');
                            }}
                            className="text-slate-400 hover:text-indigo-600 transition p-1"
                            title={lang === 'nl' ? 'Bewerken' : 'Edit'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {c.id !== 'cc-feestdag' && c.id !== 'feestdag' && (
                            <button
                              onClick={() => {
                                if (editingCategoryId === c.id) {
                                  setEditingCategoryId(null);
                                  setNewCatName('');
                                  setNewCatColor('indigo');
                                  setNewCatDesc('');
                                }
                                handleDeleteCategory(c.id);
                              }}
                              className="text-slate-400 hover:text-rose-600 transition p-1"
                              title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Holiday Management Side Drawer Panel */}
      {isManagingHolidays && !isPublicShared && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-end p-0 print:hidden transition-all">
          <div className="bg-white shadow-xl w-full max-w-md h-screen flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-250">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === 'nl' ? 'Feestdagen beheren' : 'Manage Holidays'}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {lang === 'nl' ? `Beheer de feestdagen voor kalenderjaar ${selectedYear}` : `Manage public holidays for calendar year ${selectedYear}`}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsManagingHolidays(false);
                  setEditingHolidayId(null);
                  setHolidayTitle('');
                  setHolidayDate('');
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1">
              {/* Quick load automatic holidays button */}
              <div className="bg-gradient-to-br from-indigo-50 to-sky-50 p-4 rounded-2xl border border-indigo-100/50 flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="p-1.5 bg-indigo-500 text-white rounded-lg mt-0.5 shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      {lang === 'nl' ? 'Officiële NL Feestdagen' : 'Official NL Holidays'}
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                      {lang === 'nl' 
                        ? `Laad automatisch alle bekende officiële Nederlandse feestdagen (zoals Goede Vrijdag, Koningsdag, Hemelvaartsdag, en Kerst) voor het jaar ${selectedYear} met de juiste data.` 
                        : `Automatically populate all standard Dutch holidays for ${selectedYear} on their mathematically correct solar/lunar dates.`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const count = await generateDutchHolidays();
                    alert(lang === 'nl' 
                      ? `${count} feestdagen succesvol toegevoegd/bijgewerkt voor ${selectedYear}!` 
                      : `${count} public holidays loaded / updated successfully for ${selectedYear}!`
                    );
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {lang === 'nl' ? 'Laad officiële feestdagen' : 'Load Official Holidays'}
                </button>
              </div>

              {/* Form to Add / Edit holiday */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!holidayTitle.trim() || !holidayDate) return;

                // Feestdag category lookup or auto-creation
                let feestdagCat = categories.find(c => c.name.toLowerCase() === 'feestdag' || c.id === 'cc-feestdag');
                if (!feestdagCat) {
                  feestdagCat = {
                    id: 'cc-feestdag',
                    name: 'Feestdag',
                    color: 'sky'
                  };
                  await dbService.saveCalendarCategory(feestdagCat);
                }

                if (editingHolidayId) {
                  const existing = events.find(ev => ev.id === editingHolidayId);
                  if (existing) {
                    const updated: YearEvent = {
                      ...existing,
                      title: holidayTitle,
                      date: holidayDate,
                      year: new Date(holidayDate).getFullYear()
                    };
                    await dbService.saveYearEvent(updated);
                  }
                  setEditingHolidayId(null);
                } else {
                  const newId = 'holiday-' + Math.random().toString(36).substr(2, 9);
                  const newEv: YearEvent = {
                    id: newId,
                    year: new Date(holidayDate).getFullYear(),
                    title: holidayTitle,
                    description: lang === 'nl' ? 'Feestdag' : 'Holiday',
                    categoryId: feestdagCat.id,
                    date: holidayDate,
                    type: 'one_time',
                    isFeestdag: true
                  };
                  await dbService.saveYearEvent(newEv);
                }

                setHolidayTitle('');
                setHolidayDate('');
                loadData();
              }} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  {editingHolidayId 
                    ? (lang === 'nl' ? 'Feestdag bewerken' : 'Edit Holiday') 
                    : (lang === 'nl' ? 'Handmatig feestdag toevoegen' : 'Add Custom Holiday')}
                </h4>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{lang === 'nl' ? 'Naam' : 'Title'}</label>
                  <input 
                    type="text"
                    value={holidayTitle}
                    required
                    onChange={e => setHolidayTitle(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    placeholder={lang === 'nl' ? 'Bijv: Carnaval of Extra Vrije Dag' : 'e.g. Easter Friday'}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{lang === 'nl' ? 'Datum' : 'Date'}</label>
                  <input 
                    type="date"
                    value={holidayDate}
                    required
                    onChange={e => setHolidayDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  />
                </div>

                <div className="flex gap-2 justify-end mt-1">
                  {editingHolidayId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHolidayId(null);
                        setHolidayTitle('');
                        setHolidayDate('');
                      }}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    {editingHolidayId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingHolidayId 
                      ? (lang === 'nl' ? 'Opslaan' : 'Save Changes') 
                      : (lang === 'nl' ? 'Opslaan' : 'Save Holiday')}
                  </button>
                </div>
              </form>

              {/* Holidays list */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    {lang === 'nl' ? `Geregistreerde feestdagen (${selectedYear})` : `Registered Holidays (${selectedYear})`}
                  </h4>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                    {events.filter(e => e.year === selectedYear && e.isFeestdag).length}
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto">
                  {events
                    .filter(e => e.year === selectedYear && e.isFeestdag)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-2.5 border border-slate-100 bg-white rounded-xl hover:border-slate-200 transition">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">{ev.title}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(ev.date).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingHolidayId(ev.id);
                              setHolidayTitle(ev.title);
                              setHolidayDate(ev.date);
                            }}
                            className="text-slate-400 hover:text-indigo-600 transition p-1.5"
                            title={lang === 'nl' ? 'Bewerken' : 'Edit'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(lang === 'nl' ? `Weet u zeker dat u "${ev.title}" wilt verwijderen?` : `Are you sure you want to delete "${ev.title}"?`)) {
                                await dbService.deleteYearEvent(ev.id);
                                if (editingHolidayId === ev.id) {
                                  setEditingHolidayId(null);
                                  setHolidayTitle('');
                                  setHolidayDate('');
                                }
                                loadData();
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 transition p-1.5"
                            title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                  {events.filter(e => e.year === selectedYear && e.isFeestdag).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic border border-dashed border-slate-250 rounded-xl">
                      {lang === 'nl' ? 'Nog geen feestdagen geladen voor dit jaar.' : 'No public holidays loaded for this year.'}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
