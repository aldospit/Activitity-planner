import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, MapPin, User, Mail, Phone, 
  Tag, AlignLeft, ShieldCheck, Check, Trash2, Copy, Sparkles, Briefcase
} from 'lucide-react';
import { SharedCalendarEvent, CalendarEventStatus, SharedCalendar } from '../../types';
import { DEFAULT_PRODUCT_SERVICES, CALENDAR_COLORS, STATUS_META } from './calendarHelpers';
import { formatDateString } from '../../utils/dateUtils';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: SharedCalendarEvent) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  eventToEdit: SharedCalendarEvent | null;
  calendar: SharedCalendar;
  initialDate?: string;
  initialTime?: string;
  lang: 'nl' | 'en';
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  eventToEdit,
  calendar,
  initialDate,
  initialTime,
  lang
}) => {
  const isEditing = Boolean(eventToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [productService, setProductService] = useState('');
  const [customProductInput, setCustomProductInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [handlers, setHandlers] = useState<string[]>([]);
  const [newHandlerInput, setNewHandlerInput] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<CalendarEventStatus>('scheduled');
  const [categoryColor, setCategoryColor] = useState('indigo');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfirmDelete(false);
      if (eventToEdit) {
        setTitle(eventToEdit.title || '');
        setDescription(eventToEdit.description || '');
        
        const ps = eventToEdit.productService || calendar.productService || '';
        if (DEFAULT_PRODUCT_SERVICES.includes(ps)) {
          setProductService(ps);
          setCustomProductInput('');
        } else if (ps) {
          setProductService('custom');
          setCustomProductInput(ps);
        } else {
          setProductService(DEFAULT_PRODUCT_SERVICES[0]);
          setCustomProductInput('');
        }

        setStartDate(eventToEdit.startDate || formatDateString(new Date()));
        setStartTime(eventToEdit.startTime || '09:00');
        setEndDate(eventToEdit.endDate || eventToEdit.startDate || formatDateString(new Date()));
        setEndTime(eventToEdit.endTime || '10:00');
        setIsAllDay(Boolean(eventToEdit.isAllDay));
        setHandlers(eventToEdit.handlers && eventToEdit.handlers.length > 0 ? [...eventToEdit.handlers] : [...calendar.defaultHandlers]);
        setLocation(eventToEdit.location || '');
        setStatus(eventToEdit.status || 'scheduled');
        setCategoryColor(eventToEdit.categoryColor || calendar.color || 'indigo');
        setContactPerson(eventToEdit.contactPerson || '');
        setContactEmail(eventToEdit.contactEmail || '');
        setContactPhone(eventToEdit.contactPhone || '');
        setNotes(eventToEdit.notes || '');
      } else {
        const todayStr = initialDate || formatDateString(new Date());
        setTitle('');
        setDescription('');
        setProductService(calendar.productService || DEFAULT_PRODUCT_SERVICES[0]);
        setCustomProductInput('');
        setStartDate(todayStr);
        setStartTime(initialTime || '09:00');
        setEndDate(todayStr);
        
        // Default 1 hour later
        if (initialTime) {
          const [h, m] = initialTime.split(':').map(Number);
          const nextH = Math.min(23, h + 1);
          setEndTime(`${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
        } else {
          setEndTime('10:00');
        }

        setIsAllDay(false);
        setHandlers(calendar.defaultHandlers ? [...calendar.defaultHandlers] : []);
        setLocation('');
        setStatus('confirmed');
        setCategoryColor(calendar.color || 'indigo');
        setContactPerson('');
        setContactEmail('');
        setContactPhone('');
        setNotes('');
      }
    }
  }, [isOpen, eventToEdit, calendar, initialDate, initialTime]);

  if (!isOpen) return null;

  const handleAddHandler = () => {
    const trimmed = newHandlerInput.trim();
    if (trimmed && !handlers.includes(trimmed)) {
      setHandlers([...handlers, trimmed]);
      setNewHandlerInput('');
    }
  };

  const handleRemoveHandler = (name: string) => {
    setHandlers(handlers.filter(h => h !== name));
  };

  const handleToggleDefaultHandler = (handlerName: string) => {
    if (handlers.includes(handlerName)) {
      setHandlers(handlers.filter(h => h !== handlerName));
    } else {
      setHandlers([...handlers, handlerName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert(lang === 'nl' ? 'Vul een titel / onderwerp in voor de afspraak.' : 'Please enter a title for the appointment.');
      return;
    }

    const finalProductService = productService === 'custom' ? customProductInput.trim() : productService;

    setIsSaving(true);
    try {
      const eventData: SharedCalendarEvent = {
        id: eventToEdit ? eventToEdit.id : `sce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        calendarId: calendar.id,
        title: title.trim(),
        description: description.trim(),
        productService: finalProductService || undefined,
        startDate,
        startTime: isAllDay ? undefined : startTime,
        endDate: endDate || startDate,
        endTime: isAllDay ? undefined : endTime,
        isAllDay,
        handlers,
        location: location.trim() || undefined,
        status,
        categoryColor,
        contactPerson: contactPerson.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: eventToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(eventData);
      onClose();
    } catch (err) {
      console.error("Error saving calendar event:", err);
      alert(lang === 'nl' ? 'Fout bij opslaan van afspraak.' : 'Error saving appointment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(eventToEdit.id);
      onClose();
    } catch (err) {
      console.error("Error deleting event:", err);
      alert(lang === 'nl' ? 'Fout bij verwijderen van afspraak.' : 'Error deleting appointment.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in" id="calendar-event-modal">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {isEditing 
                  ? (lang === 'nl' ? 'Afspraak / Event Bewerken' : 'Edit Appointment / Event')
                  : (lang === 'nl' ? 'Nieuwe Afspraak Inplannen' : 'Schedule New Appointment')}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {calendar.name} ({calendar.productService || 'Gedeelde Agenda'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            id="close-event-modal-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-100">
          
          {/* Main Title & Product context */}
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {lang === 'nl' ? 'Onderwerp / Titel van de Afspraak *' : 'Subject / Appointment Title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'nl' ? 'Bijv. Intakegesprek Cloud Migratie Gemeente Twente' : 'e.g. Intake meeting Cloud Migration Twente'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-semibold text-slate-900 bg-white"
                id="event-title-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{lang === 'nl' ? 'Product en/of Dienst' : 'Product or Service'}</span>
                </label>
                <select
                  value={productService}
                  onChange={(e) => setProductService(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 text-xs font-semibold text-slate-800 bg-white"
                  id="event-product-select"
                >
                  {DEFAULT_PRODUCT_SERVICES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="custom">{lang === 'nl' ? '✏️ Ander specifiek product / dienst...' : '✏️ Other specific product / service...'}</option>
                </select>
                {productService === 'custom' && (
                  <input
                    type="text"
                    value={customProductInput}
                    onChange={(e) => setCustomProductInput(e.target.value)}
                    placeholder={lang === 'nl' ? 'Typ naam van product / dienst' : 'Type product / service name'}
                    className="w-full mt-2 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-medium text-slate-800 bg-indigo-50/40"
                    id="event-custom-product-input"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Status</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CalendarEventStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 text-xs font-semibold text-slate-800 bg-white"
                  id="event-status-select"
                >
                  <option value="scheduled">{STATUS_META.scheduled[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
                  <option value="confirmed">{STATUS_META.confirmed[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
                  <option value="in_progress">{STATUS_META.in_progress[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
                  <option value="completed">{STATUS_META.completed[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
                  <option value="cancelled">{STATUS_META.cancelled[lang === 'nl' ? 'labelNl' : 'labelEn']}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date, Time & All Day */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                <span>{lang === 'nl' ? 'Datum & Tijdstip' : 'Date & Time'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-indigo-600">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                  id="event-allday-checkbox"
                />
                <span>{lang === 'nl' ? 'Hele dag' : 'All day'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  {lang === 'nl' ? 'Aanvang' : 'Start'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!endDate || endDate < e.target.value) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white flex-1"
                    id="event-start-date"
                  />
                  {!isAllDay && (
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white w-24"
                      id="event-start-time"
                    />
                  )}
                </div>
              </div>

              {/* End */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  {lang === 'nl' ? 'Einde' : 'End'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white flex-1"
                    id="event-end-date"
                  />
                  {!isAllDay && (
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 bg-white w-24"
                      id="event-end-time"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Behandelaar(en) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-indigo-600" />
                <span>{lang === 'nl' ? 'Behandelaar(en) / Uitvoerders' : 'Handler(s) / Assignees'}</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                {lang === 'nl' ? 'Wie behandelt deze afspraak?' : 'Who handles this appointment?'}
              </span>
            </div>

            {/* Default handlers chips from calendar */}
            {calendar.defaultHandlers && calendar.defaultHandlers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium mr-1">
                  {lang === 'nl' ? 'Snel selecteren:' : 'Quick select:'}
                </span>
                {calendar.defaultHandlers.map(dh => {
                  const isSelected = handlers.includes(dh);
                  return (
                    <button
                      type="button"
                      key={dh}
                      onClick={() => handleToggleDefaultHandler(dh)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      <span>{dh}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active handlers list */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 min-h-7">
                {handlers.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    {lang === 'nl' ? 'Nog geen behandelaren toegewezen' : 'No handlers assigned yet'}
                  </span>
                ) : (
                  handlers.map(h => (
                    <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200">
                      <span>{h}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHandler(h)}
                        className="p-0.5 hover:bg-indigo-200 rounded text-indigo-600 hover:text-indigo-900 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add custom handler */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <input
                  type="text"
                  value={newHandlerInput}
                  onChange={(e) => setNewHandlerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHandler();
                    }
                  }}
                  placeholder={lang === 'nl' ? 'Nieuwe behandelaar toevoegen...' : 'Add new handler...'}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white flex-1"
                  id="add-custom-handler-input"
                />
                <button
                  type="button"
                  onClick={handleAddHandler}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  {lang === 'nl' ? '+ Toevoegen' : '+ Add'}
                </button>
              </div>
            </div>
          </div>

          {/* Location & Theme Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                <span>{lang === 'nl' ? 'Locatie / Teams Link / Zaal' : 'Location / Teams Link / Room'}</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={lang === 'nl' ? 'Bijv. Online Microsoft Teams / Vergaderzaal B' : 'e.g. Microsoft Teams / Meeting Room B'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 text-xs font-semibold text-slate-800 bg-white"
                id="event-location-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-indigo-600" />
                <span>{lang === 'nl' ? 'Kleuraccent / Categorie' : 'Color Theme / Category'}</span>
              </label>
              <div className="flex items-center gap-2 pt-1">
                {Object.keys(CALENDAR_COLORS).map(cKey => (
                  <button
                    type="button"
                    key={cKey}
                    onClick={() => setCategoryColor(cKey)}
                    className={`w-6 h-6 rounded-full ${CALENDAR_COLORS[cKey].bg} transition-all cursor-pointer flex items-center justify-center ${
                      categoryColor === cKey ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={cKey}
                  >
                    {categoryColor === cKey && <Check className="h-3 w-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Person (Customer / External) */}
          <div className="space-y-3 pt-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-blue-600" />
              <span>{lang === 'nl' ? 'Contactpersoon & Klantgegevens (Optioneel)' : 'Contact Person & Client Info (Optional)'}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder={lang === 'nl' ? 'Naam contactpersoon' : 'Contact person name'}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                id="event-contact-name"
              />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="E-mailadres"
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                id="event-contact-email"
              />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={lang === 'nl' ? 'Telefoonnummer' : 'Phone number'}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                id="event-contact-phone"
              />
            </div>
          </div>

          {/* Omschrijving & Agendapunten (Full Text description) */}
          <div className="space-y-2 pt-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5 text-slate-600" />
              <span>{lang === 'nl' ? 'Omschrijving / Agendapunten / Toelichting' : 'Description / Agenda Points / Details'}</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'nl' ? 'Geef hier een uitgebreide toelichting of agendapunten voor de afspraak...' : 'Provide detailed notes or agenda points for the appointment...'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 text-xs font-medium text-slate-800 bg-white leading-relaxed"
              id="event-description-input"
            />
          </div>

          {/* Interne Notities */}
          <div className="space-y-2 pt-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {lang === 'nl' ? 'Interne Notities / Voorbereiding' : 'Internal Notes / Preparation'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'nl' ? 'Interne instructies voor behandelaren...' : 'Internal notes for handlers...'}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50"
              id="event-notes-input"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-5 flex items-center justify-between gap-3">
            {isEditing && onDelete ? (
              showConfirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600 font-bold">
                    {lang === 'nl' ? 'Zeker weten?' : 'Are you sure?'}
                  </span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                    id="confirm-delete-event-btn"
                  >
                    {isDeleting ? '...' : (lang === 'nl' ? 'Ja, Verwijder' : 'Yes, Delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    {lang === 'nl' ? 'Annuleer' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  id="delete-event-btn"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{lang === 'nl' ? 'Verwijderen' : 'Delete'}</span>
                </button>
              )
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                id="cancel-event-btn"
              >
                {lang === 'nl' ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all cursor-pointer flex items-center gap-2"
                id="save-event-btn"
              >
                <Check className="h-4 w-4" />
                <span>{isSaving ? '...' : (lang === 'nl' ? 'Afspraak Opslaan' : 'Save Appointment')}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
