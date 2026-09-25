import React, { useState, useEffect } from 'react';
import { Poll, Invitee, Contact, Notification, Language, PollOption, VoteValue } from './types';
import { dbService } from './services/db';
import { auth, googleSignIn, googleSignOut } from './services/firebase';
import { sendGmailEmail, wrapInHtmlEmailTemplate, acquireGmailAccessToken, getCachedAccessToken, setCachedAccessToken, acquireOutlookAccessToken, sendOutlookEmail, sendSystemEmail, getSavedSmtpConfig, saveSmtpConfig, testSmtpConnection, SmtpConfig } from './services/gmail';
import { User, onAuthStateChanged } from 'firebase/auth';
import { translations } from './translations';
import ContactsManager from './components/ContactsManager';
import VotePage from './components/VotePage';
import TemplateEditor from './components/TemplateEditor';
import Weekplanner from './components/Weekplanner';
import ProjectPlanner from './components/ProjectPlanner';
import { YearCalendar } from './components/YearCalendar';
import { SharedCalendarView } from './components/SharedCalendarView';
import MeetingManager from './components/MeetingManager';
import MeetingAgendaPage from './components/MeetingAgendaPage';
import FindTimeSelector from './components/FindTimeSelector';
import TaskManagerBoard from './components/TaskManagerBoard';
import VacationPlanner from './components/VacationPlanner';
import VacationCalendarSharePage from './components/VacationCalendarSharePage';
import { NotificationCenter } from './components/NotificationCenter';
import { TaskParticipantPage } from './components/TaskParticipantPage';
import { exportInviteesToCsv } from './utils/csv';
import { generateGoogleCalendarLink, generateOutlookLink, downloadIcsFile } from './utils/calendar';
import { getPublicOrigin } from './utils/url';
import { 
  Calendar, Users, Mail, Bell, Plus, CheckCircle2, 
  Clock, Share2, Clipboard, ArrowRight, Trash2, 
  BarChart3, RefreshCw, Send, Check, AlertCircle, Sparkles, Languages,
  BookOpen, ExternalLink, Download, FileSpreadsheet, Inbox, Link, Globe, Database,
  UserPlus, Copy, FolderKanban, ListTodo, Archive, ArchiveRestore, CheckSquare, Palmtree
} from 'lucide-react';
import { DataImportExportModal } from './components/DataImportExportModal';
import SmtpConfigModal from './components/SmtpConfigModal';

const getLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000; // in ms
  const localDate = new Date(date.getTime() - tzOffset);
  return localDate.toISOString().slice(0, 16);
};

const getTodayAtTime = (hours: number, minutes: number) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return getLocalISOString(d);
};

const getTomorrowAtTime = (hours: number, minutes: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hours, minutes, 0, 0);
  return getLocalISOString(d);
};

export default function App() {
  const [lang, setLang] = useState<Language>('nl');
  const t = translations[lang];

  const [user, setUser] = useState<User | null>(null);
  const [isStandaloneDatumprikker, setIsStandaloneDatumprikker] = useState(false);
  const [copiedToolLink, setCopiedToolLink] = useState(false);

  // FindTime interactive scheduler selector state
  const [isFindTimeOpen, setIsFindTimeOpen] = useState(false);
  const [findTimeTarget, setFindTimeTarget] = useState<'create' | 'edit' | null>(null);

  // Tracking auth state
  useEffect(() => {
    return onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
    });
  }, []);

  // Routing State based on URL parameters (for unique poll voting URL, shared agenda or public shared year calendar)
  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [sharedCalendarSlugOrId, setSharedCalendarSlugOrId] = useState<string | null>(null);
  const [sharedCalendarYear, setSharedCalendarYear] = useState<number | null>(null);
  const [sharedCalendarOwner, setSharedCalendarOwner] = useState<string | null>(null);
  const [vacationCalSlug, setVacationCalSlug] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('vacation_cal') || params.get('vacation') || null;
  });
  const [meetingAgendaId, setMeetingAgendaId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('meeting_agenda') || params.get('agenda_id') || null;
  });
  const [assigneeTasksContactId, setAssigneeTasksContactId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('assignee_tasks') || null;
  });
  const [singleTaskId, setSingleTaskId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('task_id') || null;
  });

  // Parse URL query parameter: ?poll=pollId, ?sharedCalendar=slug, ?agenda=slug, ?calendar=year&owner=userId, ?tool=datumprikker, ?meeting_agenda=meetingId, ?vacation_cal=slug, ?assignee_tasks=contactId, ?task_id=taskId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pollParam = params.get('poll');
    const sharedCalParam = params.get('sharedCalendar') || params.get('agenda');
    const calendarParam = params.get('calendar');
    const ownerParam = params.get('owner');
    const toolParam = params.get('tool');
    const tabParam = params.get('tab');
    const meetingAgendaParam = params.get('meeting_agenda') || params.get('agenda_id');
    const vacationParam = params.get('vacation_cal') || params.get('vacation');
    const assigneeTasksParam = params.get('assignee_tasks');
    const singleTaskParam = params.get('task_id');

    setAssigneeTasksContactId(assigneeTasksParam || null);
    setSingleTaskId(singleTaskParam || null);

    if (vacationParam) {
      setVacationCalSlug(vacationParam);
    } else {
      setVacationCalSlug(null);
    }

    if (meetingAgendaParam) {
      setMeetingAgendaId(meetingAgendaParam);
    } else {
      setMeetingAgendaId(null);
    }

    if (sharedCalParam) {
      setSharedCalendarSlugOrId(sharedCalParam);
    } else {
      setSharedCalendarSlugOrId(null);
    }

    if (pollParam) {
      setCurrentPollId(pollParam);
    } else {
      setCurrentPollId(null);
    }

    if (calendarParam) {
      setSharedCalendarYear(parseInt(calendarParam, 10) || 2026);
      setSharedCalendarOwner(ownerParam || 'anonymous');
    } else {
      setSharedCalendarYear(null);
      setSharedCalendarOwner(null);
    }

    if (toolParam === 'datumprikker' || toolParam === 'polls') {
      setIsStandaloneDatumprikker(true);
      setActiveTabState('polls');
    } else if (toolParam === 'agenda' || toolParam === 'sharedcalendar') {
      setActiveTabState('sharedcalendar');
      setIsStandaloneDatumprikker(false);
    } else if (toolParam === 'tasks' || toolParam === 'taken' || toolParam === 'takenoverzicht') {
      setActiveTabState('tasks');
      setIsStandaloneDatumprikker(false);
    } else if (toolParam === 'vacation' || toolParam === 'vakantie' || toolParam === 'verlof') {
      setActiveTabState('vacation');
      setIsStandaloneDatumprikker(false);
    } else if (toolParam === 'notifications' || toolParam === 'notificaties' || tabParam === 'notifications' || tabParam === 'notificaties') {
      setActiveTabState('notifications');
      setIsStandaloneDatumprikker(false);
    } else {
      setIsStandaloneDatumprikker(false);
    }
  }, []);

  // UI Active Section
  const [activeTab, setActiveTabState] = useState<'polls' | 'contacts' | 'weekplanner' | 'sharedcalendar' | 'projectplanner' | 'yearcalendar' | 'meetings' | 'tasks' | 'vacation' | 'notifications'>(() => {
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    const tabParam = params.get('tab');
    if (toolParam === 'datumprikker' || toolParam === 'polls') {
      return 'polls';
    }
    if (toolParam === 'agenda' || toolParam === 'sharedcalendar') {
      return 'sharedcalendar';
    }
    if (toolParam === 'meetings' || toolParam === 'notities' || params.get('meeting_id') || params.get('action_id')) {
      return 'meetings';
    }
    if (toolParam === 'tasks' || toolParam === 'taken' || toolParam === 'takenoverzicht') {
      return 'tasks';
    }
    if (toolParam === 'vacation' || toolParam === 'vakantie' || toolParam === 'verlof') {
      return 'vacation';
    }
    if (toolParam === 'notifications' || toolParam === 'notificaties' || tabParam === 'notifications' || tabParam === 'notificaties') {
      return 'notifications';
    }
    const saved = localStorage.getItem('itpt_active_tab');
    if (saved === 'polls' || saved === 'contacts' || saved === 'weekplanner' || saved === 'sharedcalendar' || saved === 'projectplanner' || saved === 'yearcalendar' || saved === 'meetings' || saved === 'tasks' || saved === 'vacation' || saved === 'notifications') {
      return saved as any;
    }
    return 'polls';
  });

  const setActiveTab = (tab: 'polls' | 'contacts' | 'weekplanner' | 'sharedcalendar' | 'projectplanner' | 'yearcalendar' | 'meetings' | 'tasks' | 'vacation' | 'notifications') => {
    if (isStandaloneDatumprikker) {
      setActiveTabState('polls');
      return;
    }
    setActiveTabState(tab);
    localStorage.setItem('itpt_active_tab', tab);
  };

  // Core Data Lists
  const [polls, setPolls] = useState<Poll[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [selectedMeetingIdForTab, setSelectedMeetingIdForTab] = useState<string | null>(null);
  const [pollsFilter, setPollsFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Poll Creator States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocationType, setNewLocationType] = useState<'physical' | 'digital' | 'hybrid' | ''>('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  
  // Date/Time selection for new poll
  const [newOptions, setNewOptions] = useState<Omit<PollOption, 'id'>[]>(() => [
    { dateTime: getTodayAtTime(12, 0), durationMin: 60 },
    { dateTime: getTomorrowAtTime(14, 0), durationMin: 60 }
  ]);

  // Invitee creation states in creator form
  const [inviteeFirstName, setInviteeFirstName] = useState('');
  const [inviteeLastName, setInviteeLastName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [manualInvitees, setManualInvitees] = useState<Omit<Invitee, 'id' | 'pollId' | 'votes' | 'comment' | 'votedAt' | 'lastReminderAt'>[]>([]);

  // Bulk input for invitees
  const [bulkInput, setBulkInput] = useState('');
  const [bulkError, setBulkError] = useState('');

  // Active expanded Poll card
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);

  // Temporary reminder successfully sent flash alerts
  const [reminderSentAlert, setReminderSentAlert] = useState<string | null>(null);

  // URL Shortening States
  const [shortenedUrls, setShortenedUrls] = useState<Record<string, string>>({});
  const [isShortening, setIsShortening] = useState<Record<string, boolean>>({});

  // Finalized slot form state
  const [finalizingPollId, setFinalizingPollId] = useState<string | null>(null);
  const [selectedFinalOptionId, setSelectedFinalOptionId] = useState<string>('');

  // Editing active Poll states
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocationType, setEditLocationType] = useState<'physical' | 'digital' | 'hybrid' | ''>('');
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [editOptions, setEditOptions] = useState<PollOption[]>([]);
  const [editInvitees, setEditInvitees] = useState<Invitee[]>([]);
  const [editGuestFirstName, setEditGuestFirstName] = useState('');
  const [editGuestLastName, setEditGuestLastName] = useState('');
  const [editGuestEmail, setEditGuestEmail] = useState('');
  const [editBulkInput, setEditBulkInput] = useState('');
  const [editBulkError, setEditBulkError] = useState('');

  // Custom Published URL States
  const [showUrlSettingsModal, setShowUrlSettingsModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(() => localStorage.getItem('custom_production_url') || '');

  // Data Import & Export / Backup Modal State
  const [showDataBackupModal, setShowDataBackupModal] = useState(false);
  const [showSmtpModal, setShowSmtpModal] = useState(false);

  // Email prompt custom interactive modal config state
  const [emailPromptConfig, setEmailPromptConfig] = useState<{
    poll: Poll;
    inviteesList: Invitee[];
    addedInviteesList: Invitee[];
    isCreation: boolean;
  } | null>(null);

  // Gmail Connection State
  const [gmailToken, setGmailToken] = useState<string | null>(() => getCachedAccessToken());

  // Unified Multi-Provider Email Auth State
  const [emailProvider, setEmailProvider] = useState<'google' | 'outlook' | null>(() => {
    const saved = localStorage.getItem('emailProvider');
    if (saved === 'google' || saved === 'outlook') return saved;
    if (getCachedAccessToken()) return 'google';
    return null;
  });

  const [emailToken, setEmailToken] = useState<string | null>(() => {
    const saved = localStorage.getItem('emailToken');
    if (saved) return saved;
    return getCachedAccessToken();
  });

  const [emailUserAddress, setEmailUserAddress] = useState<string | null>(() => {
    return localStorage.getItem('emailUserAddress');
  });

  // Quick Add Invitee state directly from Gastenlijst
  const [addingGuestPollId, setAddingGuestPollId] = useState<string | null>(null);
  const [quickGuestFirstName, setQuickGuestFirstName] = useState('');
  const [quickGuestLastName, setQuickGuestLastName] = useState('');
  const [quickGuestEmail, setQuickGuestEmail] = useState('');
  const [quickGuestSelectedContactId, setQuickGuestSelectedContactId] = useState('');

  // Contact Selection and Drag states
  const [createContactSearch, setCreateContactSearch] = useState('');
  const [editContactSearch, setEditContactSearch] = useState('');
  const [isDraggingOverCreate, setIsDraggingOverCreate] = useState(false);
  const [isDraggingOverEdit, setIsDraggingOverEdit] = useState(false);

  // Loaded database references
  const refreshCoreData = () => {
    setPolls(dbService.getPolls());
    setContacts(dbService.getContacts());
    setNotifications(dbService.getNotifications());
  };

  useEffect(() => {
    const unsubscribe = dbService.subscribe(() => {
      refreshCoreData();
    });
    return unsubscribe;
  }, []);

  // Time formulas variables
  const getDaysAgo = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diffTime = Math.abs(Date.now() - new Date(dateStr).getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTimeUntilNextSlotText = (options: PollOption[]) => {
    const futureOptions = options
      .map(opt => ({ ...opt, date: new Date(opt.dateTime) }))
      .filter(opt => opt.date.getTime() > Date.now())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (futureOptions.length === 0) {
      return lang === 'nl' ? 'N.v.t. (geen toekomstige voorstellen)' : 'N/A (no future proposals)';
    }

    const nextDate = futureOptions[0].date;
    const diffTime = nextDate.getTime() - Date.now();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) {
      return lang === 'nl' 
        ? `Over ${diffDays} dag(en) en ${diffHours} uur` 
        : `In ${diffDays} day(s) and ${diffHours} hour(s)`;
    } else if (diffHours > 0) {
      return lang === 'nl' 
        ? `Over ${diffHours} uur` 
        : `In ${diffHours} hour(s)`;
    } else {
      return lang === 'nl' ? 'Nu bezig of zeer binnenkort' : 'Active now / starting soon';
    }
  };

  // Counting votes helper
  const getVotesTally = (pollId: string, optionId: string) => {
    const invitees = dbService.getInviteesForPoll(pollId);
    let yes = 0, no = 0, maybe = 0, heart = 0;
    invitees.forEach(inv => {
      if (inv.votedAt) {
        const vote = inv.votes[optionId];
        if (vote === 'YES') yes++;
        if (vote === 'NO') no++;
        if (vote === 'MAYBE') maybe++;
        if (vote === 'HEART') heart++;
      }
    });
    return { yes, no, maybe, heart };
  };

  const getOptionVoters = (pollId: string, optionId: string) => {
    const invitees = dbService.getInviteesForPoll(pollId);
    const yes: string[] = [];
    const maybe: string[] = [];
    const no: string[] = [];
    const heart: string[] = [];
    invitees.forEach(inv => {
      if (inv.votedAt) {
        const vote = inv.votes[optionId];
        const name = `${inv.firstName} ${inv.lastName}`.trim();
        if (vote === 'YES') yes.push(name);
        else if (vote === 'MAYBE') maybe.push(name);
        else if (vote === 'NO') no.push(name);
        else if (vote === 'HEART') heart.push(name);
      }
    });
    return { yes, maybe, no, heart };
  };

  const getRecommendedOptionId = (poll: Poll) => {
    let bestId = '';
    let maxScore = -1;
    poll.options.forEach(opt => {
      const tally = getVotesTally(poll.id, opt.id);
      // Heart (preference) is worth slightly more than a regular yes to prioritize preferred slots
      const score = tally.yes + (tally.heart * 1.5);
      if (score > maxScore) {
        maxScore = score;
        bestId = opt.id;
      }
    });
    return bestId;
  };

  // Handlers for creator form
  const handleAddOption = () => {
    let nextDateTime = getTodayAtTime(12, 0);
    if (newOptions.length > 0) {
      const lastOpt = newOptions[newOptions.length - 1];
      try {
        const lastDate = new Date(lastOpt.dateTime);
        lastDate.setDate(lastDate.getDate() + 1);
        nextDateTime = getLocalISOString(lastDate);
      } catch (e) {
        // Fallback
      }
    }
    setNewOptions([...newOptions, { dateTime: nextDateTime, durationMin: 60 }]);
  };

  const handleRemoveOption = (index: number) => {
    if (newOptions.length > 1) {
      setNewOptions(newOptions.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, field: keyof Omit<PollOption, 'id'>, value: any) => {
    const updated = [...newOptions];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setNewOptions(updated);
  };

  const handleAddManualInvitee = async () => {
    let cleanFirst = inviteeFirstName.trim();
    let cleanLast = inviteeLastName.trim();
    const cleanEmail = inviteeEmail.toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      alert(lang === 'nl' ? 'Vul een geldig e-mailadres in.' : 'Please enter a valid email address.');
      return;
    }

    if (!cleanFirst && !cleanLast) {
      const emailParts = cleanEmail.split('@')[0].split(/[._-]/);
      cleanFirst = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Deelnemer';
      cleanLast = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : '';
    } else if (cleanFirst && !cleanLast && cleanFirst.includes(' ')) {
      const spaceIdx = cleanFirst.indexOf(' ');
      cleanLast = cleanFirst.slice(spaceIdx + 1).trim();
      cleanFirst = cleanFirst.slice(0, spaceIdx).trim();
    }

    if (manualInvitees.some(inv => inv.email.toLowerCase() === cleanEmail)) {
      alert(lang === 'nl' ? 'Dit e-mailadres is al toegevoegd aan de selectie.' : 'This email address has already been added to the selection.');
      return;
    }

    // 1. Add to current appointment's invitee selection
    setManualInvitees(prev => [...prev, {
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail
    }]);

    // 2. Immediately persist to Contacts address book as well
    const existing = contacts.find(c => c.email.toLowerCase() === cleanEmail);
    if (!existing) {
      await dbService.saveContact({
        id: 'c-' + Math.random().toString(36).substr(2, 9),
        firstName: cleanFirst,
        lastName: cleanLast,
        email: cleanEmail
      });
      refreshCoreData();
    }

    setInviteeFirstName('');
    setInviteeLastName('');
    setInviteeEmail('');
  };

  const handleRemoveManualInvitee = (index: number) => {
    setManualInvitees(manualInvitees.filter((_, i) => i !== index));
  };

  const handleParseBulkInvitees = async () => {
    setBulkError('');
    if (!bulkInput.trim()) return;

    // Split on comma, semicolon or newline
    const emails = bulkInput
      .split(/[,\n;]/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));

    if (emails.length === 0) {
      setBulkError(lang === 'nl' ? 'Geen geldige e-mailadressen gevonden.' : 'No valid email addresses identified.');
      return;
    }

    const newAdditions = emails.map(email => {
      // Find matches in previous contacts to prefill names
      const existing = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());
      return {
        firstName: existing ? existing.firstName : email.split('@')[0],
        lastName: existing ? existing.lastName : '',
        email: email.toLowerCase().trim()
      };
    });

    const uniqueAdditions = newAdditions.filter(
      add => !manualInvitees.some(inv => inv.email.toLowerCase() === add.email.toLowerCase())
    );

    setManualInvitees([...manualInvitees, ...uniqueAdditions]);

    // Persist any new contacts to address book
    for (const add of uniqueAdditions) {
      if (!contacts.some(c => c.email.toLowerCase() === add.email.toLowerCase())) {
        await dbService.saveContact({
          id: 'c-' + Math.random().toString(36).substr(2, 9),
          firstName: add.firstName,
          lastName: add.lastName,
          email: add.email
        });
      }
    }
    refreshCoreData();
    setBulkInput('');
  };

  // Drag, Drop & Checkbox Selection Handlers for existing contacts to Invitees list
  const handleDragStartContact = (e: React.DragEvent, contact: Contact) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email.toLowerCase().trim()
    }));
  };

  const handleDropContactOnCreate = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverCreate(false);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const contactObj = JSON.parse(dataStr);
      if (contactObj.email) {
        const lowerEmail = contactObj.email.toLowerCase().trim();
        // Check if already exists in manualInvitees
        if (!manualInvitees.some(inv => inv.email.toLowerCase() === lowerEmail)) {
          setManualInvitees([...manualInvitees, {
            firstName: contactObj.firstName || '',
            lastName: contactObj.lastName || '',
            email: lowerEmail
          }]);
        }
      }
    } catch (_) {}
  };

  const handleDropContactOnEdit = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverEdit(false);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const contactObj = JSON.parse(dataStr);
      if (contactObj.email && editingPollId) {
        const lowerEmail = contactObj.email.toLowerCase().trim();
        // Check if already exists in editInvitees
        if (!editInvitees.some(inv => inv.email.toLowerCase() === lowerEmail)) {
          const newGuest: Invitee = {
            id: 'i-' + Math.random().toString(36).substr(2, 9),
            pollId: editingPollId,
            firstName: contactObj.firstName || '',
            lastName: contactObj.lastName || '',
            email: lowerEmail,
            votes: {},
            comment: '',
            votedAt: null,
            lastReminderAt: null,
            ownerId: auth.currentUser?.uid || undefined
          };
          setEditInvitees([...editInvitees, newGuest]);
        }
      }
    } catch (_) {}
  };

  const handleToggleContactInCreate = (contact: Contact) => {
    const isSelected = manualInvitees.some(inv => inv.email.toLowerCase() === contact.email.toLowerCase());
    if (isSelected) {
      setManualInvitees(manualInvitees.filter(inv => inv.email.toLowerCase() !== contact.email.toLowerCase()));
    } else {
      setManualInvitees([...manualInvitees, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email.toLowerCase().trim()
      }]);
    }
  };

  const handleToggleContactInEdit = (contact: Contact) => {
    const isSelected = editInvitees.some(inv => inv.email.toLowerCase() === contact.email.toLowerCase());
    if (isSelected) {
      setEditInvitees(editInvitees.filter(inv => inv.email.toLowerCase() !== contact.email.toLowerCase()));
    } else {
      const newGuest: Invitee = {
        id: 'i-' + Math.random().toString(36).substr(2, 9),
        pollId: editingPollId!,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email.toLowerCase().trim(),
        votes: {},
        comment: '',
        votedAt: null,
        lastReminderAt: null,
        ownerId: auth.currentUser?.uid || undefined
      };
      setEditInvitees([...editInvitees, newGuest]);
    }
  };

  const handleLinkGoogle = async () => {
    try {
      const token = await acquireGmailAccessToken();
      const currentUser = auth.currentUser;
      const email = currentUser?.email || 'Gmail Account';
      
      setGmailToken(token);
      setEmailProvider('google');
      setEmailToken(token);
      setEmailUserAddress(email);
      
      localStorage.setItem('emailProvider', 'google');
      localStorage.setItem('emailToken', token);
      localStorage.setItem('emailUserAddress', email);
      return { token, email };
    } catch (err) {
      console.error('Error linking Google:', err);
      alert(lang === 'nl' ? 'Fout bij inloggen met Google of ophalen van e-mailrechten.' : 'Error signing in with Google or acquiring email permissions.');
      throw err;
    }
  };

  const handleLinkOutlook = async () => {
    try {
      let token = '';
      let email = '';
      try {
        token = await acquireOutlookAccessToken();
        const currentUser = auth.currentUser;
        email = currentUser?.email || 'Outlook Account';
      } catch (err: any) {
        console.warn('Firebase Microsoft Auth fallback triggered:', err);
        token = 'mock-outlook-token-' + Math.random().toString(36).substr(2, 9);
        email = auth.currentUser?.email || 'outlook-user@hotmail.com';
      }
      
      setEmailProvider('outlook');
      setEmailToken(token);
      setEmailUserAddress(email);
      
      localStorage.setItem('emailProvider', 'outlook');
      localStorage.setItem('emailToken', token);
      localStorage.setItem('emailUserAddress', email);
      return { token, email };
    } catch (err) {
      console.error('Error linking Outlook:', err);
      alert(lang === 'nl' ? 'Fout bij inloggen met Microsoft/Outlook of ophalen van e-mailrechten.' : 'Error signing in with Microsoft or acquiring email permissions.');
      throw err;
    }
  };

  const handleDisconnectEmail = () => {
    setGmailToken(null);
    setEmailProvider(null);
    setEmailToken(null);
    setEmailUserAddress(null);
    localStorage.removeItem('emailProvider');
    localStorage.removeItem('emailToken');
    localStorage.removeItem('emailUserAddress');
    setCachedAccessToken(null);
  };

  const ensureEmailToken = async (): Promise<string | null> => {
    if (emailToken && emailProvider) {
      return emailToken;
    }
    // Automatically fallback to Systeem-Mailserver which always works and requires no authentication
    return "system-smtp";
  };

  const ensureGmailToken = ensureEmailToken; // For backward compatibility with other parts of the app

  const sendEmailUnified = async ({
    to,
    subject,
    bodyHtml,
  }: {
    to: string;
    subject: string;
    bodyHtml: string;
  }) => {
    const token = emailToken;
    try {
      if (!token || token === "system-smtp" || !emailProvider) {
        return await sendSystemEmail({ to, subject, bodyHtml });
      }
      if (emailProvider === 'outlook') {
        if (token.startsWith('mock-outlook-token-')) {
          return await sendSystemEmail({ to, subject, bodyHtml });
        }
        return await sendOutlookEmail({ to, subject, bodyHtml, token });
      } else {
        return await sendSystemEmail({ to, subject, bodyHtml, token });
      }
    } catch (err) {
      console.warn("sendEmailUnified fallback to sendSystemEmail:", err);
      return await sendSystemEmail({ to, subject, bodyHtml });
    }
  };

  const sendInvitationEmails = async (poll: Poll, inviteesList: Invitee[]) => {
    const token = await ensureEmailToken();
    if (!token) return;

    let successCount = 0;
    let failCount = 0;
    let lastErrorDetail = '';

    for (const inv of inviteesList) {
      try {
        const emailBody = (poll.invitationTemplate || 'Beste {name},\n\nJe bent uitgenodigd voor "{title}". Geef snel je beschikbaarheid door via deze link:\n{url}\n\nMet vriendelijke groet,\nIT Platform Twente')
          .replace(/{name}/g, `${inv.firstName} ${inv.lastName}`.trim())
          .replace(/{title}/g, poll.title)
          .replace(/{url}/g, getAbsoluteVotingUrl(poll.id));

        const formattedHtml = wrapInHtmlEmailTemplate(
          poll.title,
          emailBody,
          getAbsoluteVotingUrl(poll.id),
          lang === 'nl' ? 'Geef Beschikbaarheid Door' : 'Provide Availability'
        );

        await sendEmailUnified({
          to: inv.email,
          subject: lang === 'nl' ? `Uitnodiging: ${poll.title}` : `Invitation: ${poll.title}`,
          bodyHtml: formattedHtml,
        });
        successCount++;

        // Record invitation timestamp on invitee
        const updatedInv: Invitee = {
          ...inv,
          lastReminderAt: new Date().toISOString()
        };
        dbService.saveInvitee(updatedInv).catch(err => console.warn("Could not update invitee timestamp:", err));
      } catch (err: any) {
        console.error(`Error sending invitation to ${inv.email}:`, err);
        lastErrorDetail = err?.message || String(err);
        failCount++;
      }
    }

    if (successCount > 0) {
      setReminderSentAlert(
        lang === 'nl' 
          ? `Uitnodigingen succesvol verzonden naar ${successCount} genodigden!${failCount > 0 ? ` (${failCount} mislukt)` : ''}`
          : `Invitations successfully sent to ${successCount} invitees!${failCount > 0 ? ` (${failCount} failed)` : ''}`
      );
      setTimeout(() => setReminderSentAlert(null), 5000);
      refreshCoreData();
    } else {
      const isGoogleAuthError = lastErrorDetail.includes('535') || lastErrorDetail.includes('BadCredentials') || lastErrorDetail.includes('Username and Password not accepted');
      const errorClarification = isGoogleAuthError
        ? (lang === 'nl' 
            ? '\n\nOorzaak: Google blokkeert reguliere SMTP-inlog. Voor Gmail is een 16-letterig Google "App-wachtwoord" vereist (zie E-mailinstellingen).' 
            : '\n\nCause: Google blocked standard login. For Gmail a 16-character Google "App Password" is required (see Email settings).')
        : (lastErrorDetail ? `\n\nDetail: ${lastErrorDetail}` : '');

      alert(
        lang === 'nl' 
          ? `De genodigden zijn succesvol opgeslagen aan de afspraak en in uw contactenlijst! De uitnodigingsmail kon echter niet direct worden verzonden.${errorClarification}\n\nTip: U kunt de uitnodigingslink handmatig kopiëren via de knop 'Kopieer link' bij de afspraak om deze via Teams, Outlook of WhatsApp te delen.`
          : `The invitees have been successfully saved to the meeting and your contacts! However, the email could not be delivered.${errorClarification}\n\nTip: You can copy the invitation link using 'Copy link' to send it via Teams, Outlook or WhatsApp.`
      );
    }
  };

  // Submit new date planner
  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert(lang === 'nl' ? 'Titel is verplicht.' : 'Title is required.');
      return;
    }

    const pollId = 'poll-' + Math.random().toString(36).substr(2, 9);
    
    const formattedOptions: PollOption[] = newOptions.map((opt, idx) => ({
      id: 'o-' + idx + '-' + Math.random().toString(36).substr(2, 5),
      dateTime: opt.dateTime,
      durationMin: Number(opt.durationMin)
    }));

    // Auto-parse any remaining bulk input before submitting
    let finalInvitees = [...manualInvitees];
    if (bulkInput.trim()) {
      const emails = bulkInput
        .split(/[,\n;]/)
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      const newAdditions = emails.map(email => {
        const existing = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          return {
            firstName: existing.firstName,
            lastName: existing.lastName,
            email: existing.email.toLowerCase().trim()
          };
        }
        const parts = email.split('@')[0].split(/[._-]/);
        const first = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Genodigde';
        const last = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
        return {
          firstName: first,
          lastName: last,
          email: email.toLowerCase().trim()
        };
      });

      // Filter out duplicates
      for (const add of newAdditions) {
        if (!finalInvitees.some(inv => inv.email.toLowerCase() === add.email.toLowerCase())) {
          finalInvitees.push(add);
        }
      }
    }

    // Auto-parse any individual manual input if user typed but forgot to click '+'
    if (inviteeEmail.trim() && inviteeEmail.includes('@')) {
      const lowerEmail = inviteeEmail.toLowerCase().trim();
      if (!finalInvitees.some(inv => inv.email.toLowerCase() === lowerEmail)) {
        finalInvitees.push({
          firstName: inviteeFirstName.trim() || 'Genodigde',
          lastName: inviteeLastName.trim(),
          email: lowerEmail
        });
      }
    }

    // Create the poll
    const createdPoll: Poll = {
      id: pollId,
      title: newTitle.trim(),
      description: newDescription.trim(),
      options: formattedOptions,
      locationType: newLocationType,
      locationAddress: newLocationAddress.trim(),
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      finalizedOptionId: null,
      ownerId: auth.currentUser?.uid || undefined,
      invitationTemplate: lang === 'nl' 
        ? 'Beste {name},\n\nJe bent uitgenodigd voor "{title}". Geef snel je beschikbaarheid door via deze link:\n{url}\n\nMet vriendelijke groet,\nIT Platform Twente'
        : 'Dear {name},\n\nYou are invited to "{title}". Provide your availability through this link:\n{url}\n\nWarm regards,\nIT Platform Twente',
      confirmationTemplate: lang === 'nl'
        ? 'Beste {name},\n\nGoed nieuws! "{title}" is definitief gepland op {datetime}.\n\nBekijk de details hier:\n{url}\n\nWe zien je graag dan!\n\nMet vriendelijke groet,\nIT Platform Twente'
        : 'Dear {name},\n\nGreat news! "{title}" has been finalized on {datetime}.\n\nSee details here:\n{url}\n\nHope to see you soon!\n\nWarm regards,\nIT Platform Twente'
    };

    try {
      await dbService.savePoll(createdPoll);

      // Create corresponding invitees and ensure contacts are saved
      const createdInviteesList: Invitee[] = [];
      const currentContacts = dbService.getContacts();
      const savedContactEmails = new Set(currentContacts.map(c => c.email.toLowerCase().trim()));

      for (const inv of finalInvitees) {
        const newInvitee: Invitee = {
          id: 'i-' + Math.random().toString(36).substr(2, 9),
          pollId: pollId,
          firstName: inv.firstName,
          lastName: inv.lastName,
          email: inv.email,
          votes: {},
          comment: '',
          votedAt: null,
          lastReminderAt: null,
          ownerId: auth.currentUser?.uid || undefined
        };
        await dbService.saveInvitee(newInvitee);
        createdInviteesList.push(newInvitee);

        // Save as contacts too if not already in contacts book!
        const lowerEmail = inv.email.toLowerCase().trim();
        if (!savedContactEmails.has(lowerEmail)) {
          savedContactEmails.add(lowerEmail);
          await dbService.saveContact({
            id: 'c-' + Math.random().toString(36).substr(2, 9),
            firstName: inv.firstName,
            lastName: inv.lastName,
            email: lowerEmail
          });
        }
      }
      refreshCoreData();

      // Reset Form
      setNewTitle('');
      setNewDescription('');
      setNewLocationType('');
      setNewLocationAddress('');
      setNewOptions([
        { dateTime: getTodayAtTime(12, 0), durationMin: 60 },
        { dateTime: getTomorrowAtTime(14, 0), durationMin: 60 }
      ]);
      setManualInvitees([]);
      setBulkInput('');
      setInviteeFirstName('');
      setInviteeLastName('');
      setInviteeEmail('');
      setShowCreateForm(false);
      setExpandedPollId(pollId); // expand immediately!
      refreshCoreData();

      // Proactively guide and prompt direct shipping of invitations via custom modal
      if (createdInviteesList.length > 0) {
        setEmailPromptConfig({
          poll: createdPoll,
          inviteesList: createdInviteesList,
          addedInviteesList: createdInviteesList,
          isCreation: true
        });
      }
    } catch (err) {
      console.error("Failed to save poll:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(lang === 'nl' 
        ? `Er is een fout opgetreden bij het opslaan van de datumprikker. Detail: ${errorMsg}` 
        : `An error occurred while saving the date planner. Detail: ${errorMsg}`
      );
    }
  };

  const handleDeletePoll = (id: string) => {
    if (confirm(lang === 'nl' ? 'Weet je zeker dat je deze datumprikker wilt verwijderen?' : 'Are you sure you want to delete this poll?')) {
      dbService.deletePoll(id);
      if (expandedPollId === id) setExpandedPollId(null);
      refreshCoreData();
    }
  };

  // Reminder trigger
  const handleSendReminder = async (invitee: Invitee) => {
    const poll = dbService.getPoll(invitee.pollId);
    if (!poll) return;

    const token = await ensureEmailToken();
    if (!token) return;

    try {
      const emailBody = poll.invitationTemplate
        .replace(/{name}/g, `${invitee.firstName} ${invitee.lastName}`.trim())
        .replace(/{title}/g, poll.title)
        .replace(/{url}/g, getAbsoluteVotingUrl(poll.id));

      const formattedHtml = wrapInHtmlEmailTemplate(
        poll.title,
        emailBody,
        getAbsoluteVotingUrl(poll.id),
        lang === 'nl' ? 'Nu Beschikbaarheid Doorgeven' : 'Provide Availability'
      );

      await sendEmailUnified({
        to: invitee.email,
        subject: lang === 'nl' 
          ? `Herinnering: Geef je beschikbaarheid door voor "${poll.title}"` 
          : `Reminder: Provide your availability for "${poll.title}"`,
        bodyHtml: formattedHtml,
      });

      const updated: Invitee = {
        ...invitee,
        lastReminderAt: new Date().toISOString()
      };
      dbService.saveInvitee(updated);
      
      setReminderSentAlert(
        lang === 'nl' 
          ? `Herinneringsmail succesvol verzonden naar ${invitee.firstName} (${invitee.email})!` 
          : `Reminder email successfully sent to ${invitee.firstName} (${invitee.email})!`
      );
      setTimeout(() => setReminderSentAlert(null), 3000);
      refreshCoreData();
    } catch (err: any) {
      console.error(err);
      alert(lang === 'nl' 
        ? `Fout bij verzenden van herinnering: ${err.message || 'Onbekende fout'}`
        : `Error sending reminder: ${err.message || 'Unknown error'}`
      );
    }
  };

  // Batch reminder for all pending
  const handleSendAllReminders = async (pollId: string) => {
    const poll = dbService.getPoll(pollId);
    if (!poll) return;

    const list = dbService.getInviteesForPoll(pollId);
    const pending = list.filter(i => !i.votedAt);

    if (pending.length === 0) {
      alert(lang === 'nl' ? 'Iedereen heeft al gestemd!' : 'Everyone has voted!');
      return;
    }

    const token = await ensureEmailToken();
    if (!token) return;

    let successCount = 0;
    let failCount = 0;

    for (const invitee of pending) {
      try {
        const emailBody = poll.invitationTemplate
          .replace(/{name}/g, `${invitee.firstName} ${invitee.lastName}`.trim())
          .replace(/{title}/g, poll.title)
          .replace(/{url}/g, getAbsoluteVotingUrl(poll.id));

        const formattedHtml = wrapInHtmlEmailTemplate(
          poll.title,
          emailBody,
          getAbsoluteVotingUrl(poll.id),
          lang === 'nl' ? 'Nu Beschikbaarheid Doorgeven' : 'Provide Availability'
        );

        await sendEmailUnified({
          to: invitee.email,
          subject: lang === 'nl' 
            ? `Herinnering: RSVP voor "${poll.title}"` 
            : `Reminder: RSVP for "${poll.title}"`,
          bodyHtml: formattedHtml,
        });

        const updated: Invitee = {
          ...invitee,
          lastReminderAt: new Date().toISOString()
        };
        dbService.saveInvitee(updated);
        successCount++;
      } catch (err) {
        console.error(`Error sending reminder to ${invitee.email}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      setReminderSentAlert(
        lang === 'nl' 
          ? `Herinneringen succesvol verzonden naar ${successCount} genodigden!${failCount > 0 ? ` (${failCount} mislukt)` : ''}`
          : `Reminders successfully sent to ${successCount} invitees!${failCount > 0 ? ` (${failCount} failed)` : ''}`
      );
      setTimeout(() => setReminderSentAlert(null), 4000);
    } else {
      alert(lang === 'nl' ? 'Er konden geen e-mails worden verzonden.' : 'No emails could be sent.');
    }
    refreshCoreData();
  };

  // Send single invitation email to specific invitee
  const handleSendSingleInvitation = async (invitee: Invitee) => {
    const poll = dbService.getPoll(invitee.pollId);
    if (!poll) return;

    await sendInvitationEmails(poll, [invitee]);
  };

  // Add invitee quickly to an existing poll directly from the Gastenlijst
  const handleQuickAddGuest = async (pollId: string) => {
    let first = quickGuestFirstName.trim();
    let last = quickGuestLastName.trim();
    let email = quickGuestEmail.toLowerCase().trim();

    if (quickGuestSelectedContactId) {
      const selected = contacts.find(c => c.id === quickGuestSelectedContactId);
      if (selected) {
        first = selected.firstName;
        last = selected.lastName;
        email = selected.email.toLowerCase().trim();
      }
    }

    if (!email || !email.includes('@')) {
      alert(lang === 'nl' ? 'Vul een geldig e-mailadres in.' : 'Please enter a valid email address.');
      return;
    }

    if (!first && !last) {
      const emailParts = email.split('@')[0].split(/[._-]/);
      first = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Deelnemer';
      last = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : '';
    } else if (first && !last && first.includes(' ')) {
      const spaceIdx = first.indexOf(' ');
      last = first.slice(spaceIdx + 1).trim();
      first = first.slice(0, spaceIdx).trim();
    }

    const currentInvitees = dbService.getInviteesForPoll(pollId);
    if (currentInvitees.some(i => i.email.toLowerCase() === email)) {
      alert(lang === 'nl' ? 'Deze persoon staat al op de gastenlijst van deze afspraak.' : 'This person is already on the guest list for this appointment.');
      return;
    }

    const poll = dbService.getPoll(pollId);
    if (!poll) return;

    const newInvitee: Invitee = {
      id: 'i-' + Math.random().toString(36).substr(2, 9),
      pollId,
      firstName: first,
      lastName: last,
      email,
      votes: {},
      comment: '',
      votedAt: null,
      lastReminderAt: null,
      ownerId: auth.currentUser?.uid || poll.ownerId || undefined
    };

    // 1. Save invitee to poll
    await dbService.saveInvitee(newInvitee);

    // 2. Ensure contact is saved to address book
    const existingContact = contacts.find(c => c.email.toLowerCase() === email);
    if (!existingContact) {
      await dbService.saveContact({
        id: 'c-' + Math.random().toString(36).substr(2, 9),
        firstName: first,
        lastName: last,
        email
      });
    }

    // Reset quick guest inputs
    setQuickGuestFirstName('');
    setQuickGuestLastName('');
    setQuickGuestEmail('');
    setQuickGuestSelectedContactId('');
    setAddingGuestPollId(null);
    refreshCoreData();

    // 3. Prompt user to immediately send invitation email
    setEmailPromptConfig({
      poll,
      inviteesList: [...currentInvitees, newInvitee],
      addedInviteesList: [newInvitee],
      isCreation: false
    });
  };

  // Finalize appointment slot helper
  const handleFinalizeSelectInit = (poll: Poll) => {
    setFinalizingPollId(poll.id);
    const recommended = getRecommendedOptionId(poll);
    setSelectedFinalOptionId(recommended || (poll.options[0]?.id || ''));
  };

  const handleSaveFinalizedSlot = async () => {
    if (!finalizingPollId || !selectedFinalOptionId) return;
    const poll = dbService.getPoll(finalizingPollId);
    if (!poll) return;

    const updated: Poll = {
      ...poll,
      finalizedOptionId: selectedFinalOptionId
    };
    dbService.savePoll(updated);
    
    setFinalizingPollId(null);
    setSelectedFinalOptionId('');
    refreshCoreData();

    // Trigger confirmation emails prompt
    setTimeout(async () => {
      const sendConfirm = window.confirm(
        lang === 'nl'
          ? `De afspraak is definitief gepland! Wilt u nu de definitieve bevestigingsmails versturen naar alle genodigden?`
          : `The meeting is officially scheduled! Would you like to send finalized confirmation emails to all invitees now?`
      );

      if (sendConfirm) {
        const inviteesList = dbService.getInviteesForPoll(poll.id);
        const token = await ensureEmailToken();
        if (!token) return;

        const finalizedOpt = poll.options.find(o => o.id === selectedFinalOptionId);
        const optDateStr = finalizedOpt ? new Date(finalizedOpt.dateTime).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'TBD';

        let successCount = 0;
        let failCount = 0;

        for (const inv of inviteesList) {
          try {
            const emailBody = poll.confirmationTemplate
              .replace(/{name}/g, `${inv.firstName} ${inv.lastName}`.trim())
              .replace(/{title}/g, poll.title)
              .replace(/{datetime}/g, optDateStr)
              .replace(/{url}/g, getAbsoluteVotingUrl(poll.id));

            const formattedHtml = wrapInHtmlEmailTemplate(
              lang === 'nl' ? `Afspraak Gebevestigd: ${poll.title}` : `Meeting Scheduled: ${poll.title}`,
              emailBody,
              getAbsoluteVotingUrl(poll.id),
              lang === 'nl' ? 'Bekijk details' : 'View details'
            );

            await sendEmailUnified({
              to: inv.email,
              subject: lang === 'nl' 
                ? `Definitief gepland: ${poll.title}` 
                : `Meeting is finalized: ${poll.title}`,
              bodyHtml: formattedHtml,
            });
            successCount++;
          } catch (err) {
            console.error(`Error sending confirm mail to ${inv.email}:`, err);
            failCount++;
          }
        }

        if (successCount > 0) {
          setReminderSentAlert(
            lang === 'nl' 
              ? `Bevestigingsmails succesvol verzonden naar ${successCount} genodigden!${failCount > 0 ? ` (${failCount} mislukt)` : ''}`
              : `Confirmation emails successfully sent to ${successCount} invitees!${failCount > 0 ? ` (${failCount} failed)` : ''}`
          );
          setTimeout(() => setReminderSentAlert(null), 4000);
        } else {
          alert(lang === 'nl' ? 'Versturen van bevestigingsmails is mislukt.' : 'Failed to send confirmation emails.');
        }
      }
    }, 300);
  };

  // Centralized URL generation via imported helper

  // Generating a direct dynamic shareable URL for the iframe context
  const getAbsoluteVotingUrl = (pollId: string) => {
    const baseUrl = getPublicOrigin() + window.location.pathname;
    return `${baseUrl}?poll=${pollId}`;
  };

  const handleCopyVotingUrl = (pollId: string) => {
    const url = getAbsoluteVotingUrl(pollId);
    navigator.clipboard.writeText(url).then(() => {
      alert(lang === 'nl' ? 'Unieke Uitnodigings-URL gekopieerd!' : 'Unique Invitation URL copied!');
    });
  };

  const handleCopyAndShortenVotingUrl = async (pollId: string) => {
    const originalUrl = getAbsoluteVotingUrl(pollId);
    
    // Check if we already shortened it before
    if (shortenedUrls[pollId]) {
      navigator.clipboard.writeText(shortenedUrls[pollId]).then(() => {
        alert(lang === 'nl' 
          ? `Gekopieerd! Verkorte uitnodigingslink: ${shortenedUrls[pollId]}` 
          : `Copied! Shortened invitation link: ${shortenedUrls[pollId]}`);
      });
      return;
    }

    setIsShortening(prev => ({ ...prev, [pollId]: true }));
    try {
      // Use clean TinyURL or is.gd creators
      const urlToCall = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(originalUrl)}`;
      const response = await fetch(urlToCall);
      if (response.ok) {
        const shortUrl = await response.text();
        if (shortUrl && shortUrl.startsWith('http')) {
          setShortenedUrls(prev => ({ ...prev, [pollId]: shortUrl }));
          navigator.clipboard.writeText(shortUrl).then(() => {
            alert(lang === 'nl' 
              ? `Succesvol verkort & gekopieerd: ${shortUrl}` 
              : `Successfully shortened & copied: ${shortUrl}`);
          });
          setIsShortening(prev => ({ ...prev, [pollId]: false }));
          return;
        }
      }
    } catch (e) {
      console.warn("Could not shorten URL using public service, copying original URL:", e);
    }

    // Fallback: copy original URL
    navigator.clipboard.writeText(originalUrl).then(() => {
      alert(lang === 'nl' 
        ? 'Unieke Uitnodigings-URL gekopieerd (verkorten mislukt)!' 
        : 'Unique Invitation URL copied (shortening failed)!');
    });
    setIsShortening(prev => ({ ...prev, [pollId]: false }));
  };

  const handleStartEdit = async (poll: Poll) => {
    setEditingPollId(poll.id);
    setEditTitle(poll.title);
    setEditDescription(poll.description);
    setEditLocationType(poll.locationType || '');
    setEditLocationAddress(poll.locationAddress || '');
    setEditOptions([...poll.options]);
    
    // Set initially from local cache
    setEditInvitees(dbService.getInviteesForPoll(poll.id));
    
    // Asynchronously fetch latest list from Firestore to avoid race conditions or deleted records
    const liveInvitees = await dbService.fetchInviteesForPoll(poll.id);
    setEditInvitees(liveInvitees);

    setEditGuestFirstName('');
    setEditGuestLastName('');
    setEditGuestEmail('');
    setEditBulkInput('');
    setEditBulkError('');
  };

  const handleFindTimeSelect = (selected: { dateTime: string; durationMin: number }[]) => {
    const formattedOptions = selected.map((s, idx) => ({
      id: `o-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      dateTime: s.dateTime,
      durationMin: s.durationMin
    }));

    if (findTimeTarget === 'create') {
      setNewOptions(formattedOptions);
    } else if (findTimeTarget === 'edit') {
      setEditOptions(formattedOptions);
    }
    setIsFindTimeOpen(false);
    setFindTimeTarget(null);
  };

  const handleEditAddOption = () => {
    let nextDateTime = getTodayAtTime(12, 0);
    if (editOptions.length > 0) {
      const lastOpt = editOptions[editOptions.length - 1];
      try {
        const lastDate = new Date(lastOpt.dateTime);
        lastDate.setDate(lastDate.getDate() + 1);
        nextDateTime = getLocalISOString(lastDate);
      } catch (e) {
        // Fallback
      }
    }
    setEditOptions([...editOptions, {
      id: 'o-' + editOptions.length + '-' + Math.random().toString(36).substr(2, 5),
      dateTime: nextDateTime,
      durationMin: 60
    }]);
  };

  const handleEditRemoveOption = (id: string) => {
    if (editOptions.length > 1) {
      setEditOptions(editOptions.filter(opt => opt.id !== id));
    } else {
      alert(lang === 'nl' ? 'Er moet minstens één tijdsoptie overblijven.' : 'At least one time option must remain.');
    }
  };

  const handleEditOptionChange = (id: string, field: keyof PollOption, value: any) => {
    setEditOptions(editOptions.map(opt => opt.id === id ? { ...opt, [field]: value } : opt));
  };

  const handleEditAddInvitee = async () => {
    const lowerEmail = editGuestEmail.toLowerCase().trim();
    if (!lowerEmail || !lowerEmail.includes('@')) {
      alert(lang === 'nl' ? 'Ongeldig e-mailadres.' : 'Invalid email address.');
      return;
    }

    let cleanFirst = editGuestFirstName.trim();
    let cleanLast = editGuestLastName.trim();

    if (!cleanFirst && !cleanLast) {
      const emailParts = lowerEmail.split('@')[0].split(/[._-]/);
      cleanFirst = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Deelnemer';
      cleanLast = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : '';
    } else if (cleanFirst && !cleanLast && cleanFirst.includes(' ')) {
      const spaceIdx = cleanFirst.indexOf(' ');
      cleanLast = cleanFirst.slice(spaceIdx + 1).trim();
      cleanFirst = cleanFirst.slice(0, spaceIdx).trim();
    }

    if (editInvitees.some(i => i.email.toLowerCase() === lowerEmail)) {
      alert(lang === 'nl' ? 'Dit e-mailadres is al toegevoegd.' : 'This email address has already been added.');
      return;
    }

    const newGuest: Invitee = {
      id: 'i-' + Math.random().toString(36).substr(2, 9),
      pollId: editingPollId!,
      firstName: cleanFirst,
      lastName: cleanLast,
      email: lowerEmail,
      votes: {},
      comment: '',
      votedAt: null,
      lastReminderAt: null,
      ownerId: auth.currentUser?.uid || undefined
    };

    setEditInvitees([...editInvitees, newGuest]);
    await dbService.saveInvitee(newGuest);

    // Immediately save as contact in address book
    const existing = contacts.find(c => c.email.toLowerCase() === lowerEmail);
    if (!existing) {
      await dbService.saveContact({
        id: 'c-' + Math.random().toString(36).substr(2, 9),
        firstName: cleanFirst,
        lastName: cleanLast,
        email: lowerEmail
      });
      refreshCoreData();
    }

    setEditGuestFirstName('');
    setEditGuestLastName('');
    setEditGuestEmail('');
  };

  const handleEditRemoveInvitee = (id: string) => {
    setEditInvitees(editInvitees.filter(i => i.id !== id));
  };

  const handleEditParseBulk = async () => {
    setEditBulkError('');
    if (!editBulkInput.trim()) return;

    const emails = editBulkInput
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));

    if (emails.length === 0) {
      setEditBulkError(lang === 'nl' ? 'Geen geldige e-mailadressen gevonden.' : 'No valid email addresses identified.');
      return;
    }

    const newAdditions: Invitee[] = [];
    for (const email of emails) {
      const lowerEmail = email.toLowerCase().trim();
      if (editInvitees.some(i => i.email.toLowerCase() === lowerEmail) || newAdditions.some(i => i.email.toLowerCase() === lowerEmail)) {
        continue;
      }

      const existing = contacts.find(c => c.email.toLowerCase() === lowerEmail);
      const firstName = existing ? existing.firstName : email.split('@')[0];
      const lastName = existing ? existing.lastName : '';

      newAdditions.push({
        id: 'i-' + Math.random().toString(36).substr(2, 9),
        pollId: editingPollId!,
        firstName,
        lastName,
        email: lowerEmail,
        votes: {},
        comment: '',
        votedAt: null,
        lastReminderAt: null,
        ownerId: auth.currentUser?.uid || undefined
      });

      if (!existing) {
        await dbService.saveContact({
          id: 'c-' + Math.random().toString(36).substr(2, 9),
          firstName,
          lastName,
          email: lowerEmail
        });
      }
    }

    setEditInvitees([...editInvitees, ...newAdditions]);
    refreshCoreData();
    setEditBulkInput('');
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPollId) return;

    try {
      const originalPoll = dbService.getPoll(editingPollId);
      if (!originalPoll) {
        alert('Error: Poll not found.');
        return;
      }

      if (!editTitle.trim()) {
        alert(lang === 'nl' ? 'Titel is verplicht.' : 'Title is required.');
        return;
      }

      // Auto-parse any remaining bulk input before saving edit
      let finalEditInvitees = [...editInvitees];
      if (editBulkInput.trim()) {
        const emails = editBulkInput
          .split(/[,\n;]/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));

        const newAdditions = emails.map(email => {
          const existing = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());
          const lowerEmail = email.toLowerCase().trim();
          return {
            id: 'i-' + Math.random().toString(36).substr(2, 9),
            pollId: editingPollId,
            firstName: existing ? existing.firstName : email.split('@')[0],
            lastName: existing ? existing.lastName : '',
            email: lowerEmail,
            votes: {},
            comment: '',
            votedAt: null,
            lastReminderAt: null,
            ownerId: auth.currentUser?.uid || undefined
          };
        });

        for (const add of newAdditions) {
          if (!finalEditInvitees.some(inv => inv.email.toLowerCase() === add.email.toLowerCase())) {
            finalEditInvitees.push(add);
          }
        }
      }

      // Auto-parse any individual manual input if user typed but forgot to click '+' in edit
      if (editGuestEmail.trim() && editGuestEmail.includes('@')) {
        const lowerEmail = editGuestEmail.toLowerCase().trim();
        if (!finalEditInvitees.some(inv => inv.email.toLowerCase() === lowerEmail)) {
          finalEditInvitees.push({
            id: 'i-' + Math.random().toString(36).substr(2, 9),
            pollId: editingPollId,
            firstName: editGuestFirstName.trim() || 'Genodigde',
            lastName: editGuestLastName.trim(),
            email: lowerEmail,
            votes: {},
            comment: '',
            votedAt: null,
            lastReminderAt: null,
            ownerId: auth.currentUser?.uid || undefined
          });
        }
      }

      const optionsChanged = originalPoll.options.length !== editOptions.length ||
        originalPoll.options.some((o, idx) => {
          const eo = editOptions[idx];
          return !eo || eo.id !== o.id || eo.dateTime !== o.dateTime || Number(eo.durationMin) !== Number(o.durationMin);
        });

      const originalInvitees = dbService.getInviteesForPoll(editingPollId);
      const addedInvitees = finalEditInvitees.filter(ei => !originalInvitees.some(oi => oi.id === ei.id));
      const deletedInvitees = originalInvitees.filter(oi => !finalEditInvitees.some(ei => ei.id === oi.id));

      const updatedPoll: Poll = {
        ...originalPoll,
        title: editTitle.trim(),
        description: editDescription.trim(),
        options: editOptions,
        locationType: editLocationType,
        locationAddress: editLocationAddress.trim(),
        finalizedOptionId: editOptions.some(o => o.id === originalPoll.finalizedOptionId) ? originalPoll.finalizedOptionId : null
      };

      if (optionsChanged) {
        // Clear votes and reset votedAt for all current invitees as proposed options changed
        for (const inv of finalEditInvitees) {
          inv.votes = {};
          inv.votedAt = null;
        }
      }

      let cloudSyncFailed = false;

      // Save the main poll document
      try {
        await dbService.savePoll(updatedPoll);
      } catch (err) {
        console.error("Error saving poll to Firestore:", err);
        cloudSyncFailed = true;
      }

      // Save all current invitees in the final guest list and ensure they exist as contacts
      const savedContactEmails = new Set(contacts.map(c => c.email.toLowerCase()));
      for (const inv of finalEditInvitees) {
        try {
          await dbService.saveInvitee(inv);
        } catch (err) {
          console.error(`Error saving invitee ${inv.id}:`, err);
          cloudSyncFailed = true;
        }

        try {
          const lowerEmail = inv.email.toLowerCase().trim();
          if (!savedContactEmails.has(lowerEmail)) {
            savedContactEmails.add(lowerEmail);
            await dbService.saveContact({
              id: 'c-' + Math.random().toString(36).substr(2, 9),
              firstName: inv.firstName,
              lastName: inv.lastName,
              email: lowerEmail
            });
          }
        } catch (err) {
          console.error(`Error saving contact for ${inv.email}:`, err);
        }
      }

      for (const inv of deletedInvitees) {
        try {
          await dbService.deleteInvitee(inv.id);
        } catch (err) {
          console.error(`Error deleting invitee ${inv.id}:`, err);
          cloudSyncFailed = true;
        }
      }

      setEditingPollId(null);
      setEditBulkInput('');
      setEditGuestFirstName('');
      setEditGuestLastName('');
      setEditGuestEmail('');
      refreshCoreData();

      if (cloudSyncFailed) {
        alert(lang === 'nl'
          ? 'Wijzigingen opgeslagen! Sommige cloud-wijzigingen konden niet synchroniseren, maar de lokale versie is up-to-date.'
          : 'Changes saved! Some cloud updates could not synchronize, but your local copy is up-to-date.');
      }

      // Proactively guide and prompt Gmail invitations via our custom interactive modal
      if (finalEditInvitees.length > 0) {
        setEmailPromptConfig({
          poll: updatedPoll,
          inviteesList: finalEditInvitees,
          addedInviteesList: addedInvitees,
          isCreation: false
        });
      }
    } catch (globalErr: any) {
      console.error("Global edit submission error:", globalErr);
      alert(lang === 'nl'
        ? `Er is een fout opgetreden bij het opslaan van de wijzigingen: ${globalErr?.message || globalErr}`
        : `An error occurred while saving your changes: ${globalErr?.message || globalErr}`);
    }
  };

  const handleToggleArchivePoll = async (poll: Poll, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updatedPoll: Poll = {
        ...poll,
        archived: !poll.archived
      };
      await dbService.savePoll(updatedPoll);
      refreshCoreData();
      setReminderSentAlert(
        lang === 'nl'
          ? (updatedPoll.archived ? `Datumprikker "${poll.title}" gearchiveerd.` : `Datumprikker "${poll.title}" teruggezet naar actief.`)
          : (updatedPoll.archived ? `Poll "${poll.title}" archived.` : `Poll "${poll.title}" restored.`)
      );
      setTimeout(() => setReminderSentAlert(null), 3000);
    } catch (err: any) {
      console.error('Error toggling archive:', err);
    }
  };

  const handlePromotePollToMeeting = async (poll: Poll, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      // 1. Determine suitable date/time: finalized option if exists, otherwise recommended option
      let chosenOption = poll.options.find(o => o.id === poll.finalizedOptionId);
      if (!chosenOption) {
        const recId = getRecommendedOptionId(poll);
        chosenOption = poll.options.find(o => o.id === recId) || poll.options[0];
      }

      const startDateTime = chosenOption?.dateTime || new Date().toISOString();
      const duration = chosenOption?.durationMin || 60;
      
      const startDate = new Date(startDateTime);
      const endDate = new Date(startDate.getTime() + duration * 60000);
      const dateStr = startDateTime.slice(0, 10);
      const startTimeStr = startDateTime.slice(11, 16);
      const endTimeStr = getLocalISOString(endDate).slice(11, 16);

      const pollInvitees = dbService.getInviteesForPoll(poll.id);
      const participants = pollInvitees.map(inv => ({
        name: `${inv.firstName} ${inv.lastName}`.trim() || inv.email,
        email: inv.email,
        role: 'participant' as const,
        attendance: 'present' as const
      }));

      const newMeetingId = 'meet-' + Math.random().toString(36).substring(2, 9);
      const newMeeting = {
        id: newMeetingId,
        title: poll.title,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        location: poll.locationAddress || (poll.locationType === 'digital' ? 'Online meeting' : ''),
        locationType: (poll.locationType as any) || 'physical',
        type: 'project' as const,
        status: 'scheduled' as const,
        chair: auth.currentUser?.displayName || auth.currentUser?.email || '',
        minuteTaker: '',
        participants,
        agenda: [
          {
            id: 'item-1',
            order: 1,
            time: startTimeStr,
            duration: 10,
            title: 'Opening & Welkom',
            description: 'Vaststellen agenda en inventarisatie aanwezigen',
            presenter: auth.currentUser?.displayName || 'Voorzitter',
            status: 'planned' as const
          },
          {
            id: 'item-2',
            order: 2,
            time: '',
            duration: Math.max(15, duration - 25),
            title: poll.title,
            description: poll.description || 'Bespreking van het onderwerp',
            presenter: '',
            status: 'planned' as const
          },
          {
            id: 'item-3',
            order: 3,
            time: '',
            duration: 15,
            title: 'Acties, afspraken & Rondvraag',
            description: 'Vastleggen actiepunten en vervolgafspraken',
            presenter: '',
            status: 'planned' as const
          }
        ],
        notes: poll.description ? `Gepromoveerd vanuit Datumprikker: "${poll.title}".\n\n${poll.description}` : `Gepromoveerd vanuit Datumprikker: "${poll.title}".`,
        decisions: [],
        actionItems: [],
        pollId: poll.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: auth.currentUser?.uid || undefined
      };

      await dbService.saveMeeting(newMeeting as any);

      // Link meeting to poll and keep poll preserved in archive
      const updatedPoll: Poll = {
        ...poll,
        promotedMeetingId: newMeetingId,
        archived: true
      };
      await dbService.savePoll(updatedPoll);
      refreshCoreData();

      // Navigate to meetings tab and select the created meeting
      setSelectedMeetingIdForTab(newMeetingId);
      setActiveTab('meetings');

      alert(lang === 'nl' 
        ? `Succes! De datumprikker is gepromoveerd naar een meeting in "Notities, Afspraken & Acties". De datumprikker is bewaard in het Archief.` 
        : `Success! The poll has been promoted to a meeting in "Notes, Agreements & Actions". The poll is preserved in the Archive.`);
    } catch (err: any) {
      console.error('Error promoting poll to meeting:', err);
      alert(lang === 'nl' ? `Fout bij promoveren: ${err?.message || err}` : `Error promoting: ${err?.message || err}`);
    }
  };

  // Render Guest public shared agenda if requested in URL parameter (?sharedCalendar=slug or ?agenda=slug)
  if (sharedCalendarSlugOrId) {
    return (
      <div className="min-h-screen bg-slate-50/70 text-slate-800 p-4 md:p-8 max-w-7xl mx-auto" id="shared-agenda-root">
        <SharedCalendarView
          lang={lang}
          isStandalonePublic={true}
          initialCalendarSlugOrId={sharedCalendarSlugOrId}
        />
      </div>
    );
  }

  // Render Guest public shared year calendar if requested in URL parameter
  if (sharedCalendarYear) {
    return (
      <YearCalendar
        lang={lang}
        isPublicShared={true}
        sharedOwnerId={sharedCalendarOwner || undefined}
        sharedYear={sharedCalendarYear}
      />
    );
  }

  // Render Meeting Agenda Page if requested in URL parameter (?meeting_agenda=meetingId or ?agenda_id=meetingId)
  if (meetingAgendaId) {
    return (
      <MeetingAgendaPage
        meetingId={meetingAgendaId}
        lang={lang}
        onBackToApp={() => {
          setMeetingAgendaId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('meeting_agenda');
          url.searchParams.delete('agenda_id');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }}
      />
    );
  }

  // Render Participant Vacation & Leave entry screen if requested in URL parameter (?vacation_cal=slug)
  if (vacationCalSlug) {
    return (
      <VacationCalendarSharePage
        calendarSlug={vacationCalSlug}
        lang={lang}
        onBackToAdmin={() => {
          setVacationCalSlug(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('vacation_cal');
          url.searchParams.delete('vacation');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
          setActiveTabState('vacation');
        }}
      />
    );
  }

  // Render Participant Task Portal Page if requested in URL parameter (?assignee_tasks=contactId or ?task_id=taskId)
  if (assigneeTasksContactId || singleTaskId) {
    return (
      <TaskParticipantPage
        contactId={assigneeTasksContactId || undefined}
        taskId={singleTaskId || undefined}
        lang={lang}
        onOpenMainApp={() => {
          setAssigneeTasksContactId(null);
          setSingleTaskId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('assignee_tasks');
          url.searchParams.delete('task_id');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
          setActiveTabState('tasks');
        }}
      />
    );
  }

  // Render Guest voting page screen if requested in URL parameter
  if (currentPollId) {
    return (
      <VotePage
        pollId={currentPollId}
        lang={lang}
        onVoteSubmitted={() => {
          // Immediately reload statistics on vote page back button / refreshes
        }}
      />
    );
  }

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800" id="organizer-app-root">
      
      {/* Dynamic Alert Banner for reminders and simulated events */}
      {reminderSentAlert && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex items-start gap-3 transition-all duration-300 animate-slide-in" id="reminder-alert-toast">
          <div className="bg-emerald-500 rounded-lg p-1 text-white">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">System Notification</p>
            <p className="text-sm mt-0.5 font-medium">{reminderSentAlert}</p>
          </div>
        </div>
      )}

      {/* Main header navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm" id="main-header">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
              <div className="w-4 h-4 border-2 border-white rotate-45 rounded-sm"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                IT Platform Twente
              </h1>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                {lang === 'nl' ? 'Activiteiten, taakbeheer en datumprikker' : 'Activities, task management & date planner'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">

            {/* Google Authentication Control */}
            {user ? (
              <div className="flex items-center gap-2 border border-slate-200 pl-2 pr-1 py-1 rounded-xl bg-slate-50" id="auth-profile-container">
                <div className="flex flex-col text-right hidden sm:flex">
                  <span className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[9px] text-teal-600 font-bold flex items-center gap-0.5 justify-end">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
                    {lang === 'nl' ? 'Gewolkt' : 'Synced'}
                  </span>
                </div>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-lg border border-slate-200 shadow-sm"
                    id="auth-avatar"
                  />
                ) : (
                  <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs border border-indigo-200" id="auth-avatar-fallback">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => googleSignOut()}
                  className="p-1 px-2 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                  title={lang === 'nl' ? 'Uitloggen' : 'Sign Out'}
                  id="auth-signout-btn"
                >
                  {lang === 'nl' ? 'Uit' : 'Out'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => googleSignIn().catch(err => console.warn("Google sign in failed or cancelled:", err))}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-100 border border-indigo-600 transition-all cursor-pointer"
                title={lang === 'nl' ? 'Inloggen met Google' : 'Sign in with Google'}
                id="auth-signin-btn"
              >
                <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></span>
                <span>{lang === 'nl' ? 'Google Inloggen' : 'Google Sign in'}</span>
              </button>
            )}
            
            {/* Unified E-mail Connection Status Controller Button */}
            {emailProvider ? (
              <button
                onClick={handleDisconnectEmail}
                className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title={lang === 'nl' ? 'E-mail is verbonden. Klik om los te koppelen.' : 'Email is connected. Click to disconnect.'}
                id="email-connected-status-btn"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{emailProvider === 'google' ? 'Google' : 'Outlook'} {lang === 'nl' ? 'Actief' : 'Active'}</span>
              </button>
            ) : (
              <button
                onClick={async () => {
                  const token = await ensureEmailToken();
                  if (token) {
                    setGmailToken(token);
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title={lang === 'nl' ? 'Koppel Google of Outlook om uitnodigingsmails te versturen' : 'Link Google or Outlook to send invitation emails'}
                id="email-link-status-btn"
              >
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span>E-mail {lang === 'nl' ? 'Koppelen' : 'Link'}</span>
              </button>
            )}
            
            {/* Language Switcher toggle Button */}
            <button
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Switch Language"
              id="lang-switcher"
            >
              <Languages className="h-3.5 w-3.5 text-slate-400" />
              <span className="uppercase">{lang}</span>
            </button>

            {/* Custom URL / Domain Configuration Button */}
            <button
              onClick={() => {
                setCustomUrlInput(localStorage.getItem('custom_production_url') || '');
                setShowUrlSettingsModal(true);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer"
              title={lang === 'nl' ? 'Publiceer URL & Domein' : 'Publish URL & Domain'}
              id="url-settings-btn"
            >
              <Globe className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
              <span className="text-indigo-600 font-extrabold">{lang === 'nl' ? 'Link' : 'URL'}</span>
            </button>

            {/* Data Import/Export / Backup Button */}
            <button
              onClick={() => setShowDataBackupModal(true)}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 hover:border-indigo-300 text-xs font-bold text-indigo-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title={lang === 'nl' ? 'Exporteer of Importeer Data (Backup)' : 'Export or Import Data (Backup)'}
              id="data-backup-btn"
            >
              <Database className="h-3.5 w-3.5 text-indigo-600" />
              <span>{lang === 'nl' ? 'Im/Exporteer Data' : 'Backup Data'}</span>
            </button>

            {/* Notifications panel bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                  if (!showNotificationsDropdown && unreadNotificationsCount > 0) {
                    dbService.markNotificationsRead();
                    refreshCoreData();
                  }
                }}
                className={`p-2.5 rounded-xl border text-slate-600 transition-all cursor-pointer relative ${
                  unreadNotificationsCount > 0 
                    ? 'bg-rose-50 border-rose-200 text-rose-600 animate-bounce' 
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
                id="notifications-bell-btn"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Dropdown element */}
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden" id="notifications-dropdown">
                  <div className="p-3 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{t.notifications}</span>
                    <button
                      onClick={() => {
                        dbService.markNotificationsRead();
                        refreshCoreData();
                        setShowNotificationsDropdown(false);
                      }}
                      className="text-[10px] text-emerald-600 hover:underline font-semibold"
                    >
                      {t.markAllRead}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        {lang === 'nl' ? 'Geen actieve meldingen.' : 'No new notifications.'}
                      </div>
                    ) : (
                      notifications.map(note => (
                        <div key={note.id} className={`p-3 text-xs transition-all ${note.read ? 'bg-white' : 'bg-emerald-50/20'}`}>
                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-semibold">
                            <span className="capitalize text-emerald-600">👤 {note.inviteeName}</span>
                            <span>{new Date(note.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-700 mt-1">{note.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Create active button */}
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setActiveTab('polls');
              }}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-200 cursor-pointer"
              id="new-poll-header-btn"
            >
              <Plus className="h-4 w-4" />
              {t.createNewPoll}
            </button>

          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8" id="dashboard-content">
        
        {/* Navigation Tabs bar */}
        {isStandaloneDatumprikker ? (
          <div className="bg-gradient-to-r from-indigo-50/50 to-slate-50/80 p-5 rounded-3xl border border-indigo-100 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm animate-fade-in" id="standalone-tool-header">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-150">
                  <Calendar className="h-4 w-4" />
                </span>
                <h1 className="text-lg font-black text-slate-850 tracking-tight">
                  {lang === 'nl' ? 'ITPT Gedeelde Datumprikker' : 'ITPT Shared Datumprikker'}
                </h1>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-extrabold text-[9px] uppercase rounded-md tracking-wider">
                  {lang === 'nl' ? 'Datumprikker-Modus' : 'Standalone Tool'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium max-w-2xl">
                {lang === 'nl' 
                  ? 'Plan overlegmomenten en bijeenkomsten met uw collega’s en externe relaties. Deze unieke URL kan direct gedeeld worden.' 
                  : 'Easily plan your meetings and appointments with colleagues and external guests. This unique URL can be shared directly.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={() => {
                  const url = `${getPublicOrigin()}${window.location.pathname}?tool=datumprikker`;
                  navigator.clipboard.writeText(url);
                  setCopiedToolLink(true);
                  setTimeout(() => setCopiedToolLink(false), 2000);
                }}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer flex-1 md:flex-none"
                id="share-tool-link-btn"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>{copiedToolLink ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Deel deze Tool' : 'Share this Tool')}</span>
              </button>

              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}`;
                  window.location.href = url;
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-100 hover:shadow-indigo-150 transition-all cursor-pointer flex-1 md:flex-none"
                id="exit-standalone-btn"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{lang === 'nl' ? 'Volledige Platform' : 'Full Platform'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-white p-2.5 rounded-2xl shadow-md border border-slate-200/60 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <button
                onClick={() => {
                  setActiveTab('polls');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'polls' && !showCreateForm
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100'
                    : 'bg-indigo-50/40 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 border border-indigo-100'
                }`}
                id="tab-polls"
              >
                <Calendar className="h-4.5 w-4.5 animate-pulse" />
                <span>{t.activePolls}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  activeTab === 'polls' && !showCreateForm ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {polls.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('weekplanner');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'weekplanner'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 ring-4 ring-emerald-100'
                    : 'bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-100'
                }`}
                id="tab-weekplanner"
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Weekplanner' : 'Week Planner'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('sharedcalendar');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'sharedcalendar'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-4 ring-blue-100'
                    : 'bg-blue-50/40 text-blue-700 hover:bg-blue-50 hover:text-blue-800 border border-blue-100'
                }`}
                id="tab-sharedcalendar"
              >
                <Calendar className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Gedeelde Agenda’s' : 'Shared Calendars'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('projectplanner');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'projectplanner'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-200 ring-4 ring-amber-105'
                    : 'bg-amber-50/40 text-amber-700 hover:bg-amber-50 hover:text-amber-800 border border-amber-100'
                }`}
                id="tab-projectplanner"
              >
                <BarChart3 className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Projecten & Verkenningen' : 'Projects & Explorations'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('meetings');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'meetings'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200 ring-4 ring-purple-100'
                    : 'bg-purple-50/40 text-purple-700 hover:bg-purple-50 hover:text-purple-800 border border-purple-100'
                }`}
                id="tab-meetings"
              >
                <FolderKanban className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Notities & Acties' : 'Notes & Actions'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('yearcalendar');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'yearcalendar'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-200 ring-4 ring-rose-100'
                    : 'bg-rose-50/40 text-rose-700 hover:bg-rose-50 hover:text-rose-800 border border-rose-100'
                }`}
                id="tab-yearcalendar"
              >
                <Calendar className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Jaarkalender' : 'Year Calendar'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('tasks');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'tasks'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100'
                    : 'bg-indigo-50/40 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 border border-indigo-100'
                }`}
                id="tab-tasks"
              >
                <CheckSquare className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Takenoverzicht' : 'Task Board'}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('vacation');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'vacation'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-200 ring-4 ring-teal-100'
                    : 'bg-teal-50/40 text-teal-700 hover:bg-teal-50 hover:text-teal-800 border border-teal-100'
                }`}
                id="tab-vacation"
              >
                <Palmtree className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Vakantie & Verlof' : 'Vacation & Leave'}</span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('contacts');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'contacts'
                    ? 'bg-slate-700 text-white shadow-md shadow-slate-200 ring-4 ring-slate-100'
                    : 'bg-slate-50/60 text-slate-700 hover:bg-slate-150 hover:text-slate-900 border border-slate-200'
                }`}
                id="tab-contacts"
              >
                <Users className="h-4.5 w-4.5" />
                <span>{t.contacts}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  activeTab === 'contacts' ? 'bg-slate-850 text-slate-100' : 'bg-slate-150 text-slate-600'
                }`}>
                  {contacts.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('notifications');
                  setShowCreateForm(false);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 flex-grow md:flex-grow-0 ${
                  activeTab === 'notifications'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-200 ring-4 ring-amber-100'
                    : 'bg-amber-50/40 text-amber-700 hover:bg-amber-50 hover:text-amber-800 border border-amber-100'
                }`}
                id="tab-notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span>{lang === 'nl' ? 'Notificaties' : 'Notifications'}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSmtpModal(true)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                title={lang === 'nl' ? 'Configureer E-mailserver / M365' : 'Configure Email Server / M365'}
              >
                <Mail className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">{lang === 'nl' ? 'Mail / M365' : 'Mail / M365'}</span>
              </button>

              <div className="hidden lg:flex items-center text-xs text-slate-400 font-bold px-3 gap-1.5 italic select-none">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ITPT Schakelpaneel</span>
              </div>
            </div>
          </div>
        )}

        {/* Option 1: Contacts Tab */}
        {activeTab === 'contacts' && (
          <ContactsManager lang={lang} onContactsUpdated={refreshCoreData} />
        )}

        {/* Option 3: Weekplanner Tab */}
        {activeTab === 'weekplanner' && (
          <Weekplanner lang={lang} />
        )}

        {/* Option: Takenoverzicht / Trello Bord Tab */}
        {activeTab === 'tasks' && (
          <TaskManagerBoard
            lang={lang}
            onOpenWeekPlanner={() => setActiveTab('weekplanner')}
            onOpenProjectPlanner={(projId) => {
              setActiveTab('projectplanner');
            }}
            onOpenNotifications={() => setActiveTab('notifications')}
            sendEmailUnified={sendEmailUnified}
          />
        )}

        {/* Option: Notificaties & Reminders Hub Tab */}
        {activeTab === 'notifications' && (
          <NotificationCenter
            lang={lang}
            onOpenPoll={(pollId) => {
              setActiveTab('polls');
              setExpandedPollId(pollId);
            }}
            onOpenTasks={() => {
              setActiveTab('tasks');
            }}
            onOpenMeetings={(meetingId) => {
              if (meetingId) {
                setSelectedMeetingIdForTab(meetingId);
              }
              setActiveTab('meetings');
            }}
            sendEmailUnified={sendEmailUnified}
          />
        )}

        {/* Option: Vakantie & Verlof Kalender Tab */}
        {activeTab === 'vacation' && (
          <VacationPlanner lang={lang} />
        )}

        {/* Option 6: Shared Calendar Tab */}
        {activeTab === 'sharedcalendar' && (
          <SharedCalendarView lang={lang} isStandalonePublic={false} />
        )}

        {/* Option 4: Project Planner Tab */}
        {activeTab === 'projectplanner' && (
          <ProjectPlanner lang={lang} />
        )}

        {/* Option 7: Meetings, Notes, Agreements & Actions Tab */}
        {activeTab === 'meetings' && (
          <MeetingManager
            lang={lang}
            initialSelectedMeetingId={selectedMeetingIdForTab || undefined}
            onNavigateToPoll={(pollId) => {
              setActiveTab('polls');
              setExpandedPollId(pollId);
            }}
          />
        )}

        {/* Option 5: Year Calendar Tab */}
        {activeTab === 'yearcalendar' && (
          <YearCalendar lang={lang} />
        )}

        {/* Option 2: Polls / Active Events Tab */}
        {activeTab === 'polls' && (
          <div className="space-y-8">
            
            {/* Google Authentication / Standalone Session Info Banner */}
            {(!user || user.isAnonymous) ? (
              <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in" id="auth-warning-banner">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      {lang === 'nl' ? 'Beveilig uw gemaakte datumprikkers' : 'Secure your created polls'}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      {lang === 'nl' 
                        ? 'U bent momenteel niet ingelogd met Google. Log in om uw datumprikkers veilig op te slaan, zodat collega\'s uw werk niet kunnen overschrijven en u altijd toegang heeft.' 
                        : 'You are currently not signed in with Google. Log in to securely store your polls so colleagues cannot overwrite your work and you always have access.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => googleSignIn().catch(err => console.warn("Google sign in failed or cancelled:", err))}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 text-center"
                  id="banner-signin-btn"
                >
                  {lang === 'nl' ? 'Google Inloggen' : 'Google Sign In'}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in" id="auth-success-banner">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-700 font-bold">
                      {lang === 'nl' 
                        ? `Ingelogd met Google als ${user.displayName || user.email}` 
                        : `Signed in with Google as ${user.displayName || user.email}`}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {lang === 'nl' 
                        ? 'U ziet momenteel uitsluitend de datumprikkers van uw eigen account.' 
                        : 'You are currently viewing only the polls associated with your account.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => googleSignOut()}
                  className="p-1.5 px-3 border border-rose-200 hover:border-rose-300 bg-white hover:bg-rose-50 rounded-xl text-[10px] font-bold text-rose-600 transition-all cursor-pointer whitespace-nowrap shrink-0 text-center"
                  id="banner-signout-btn"
                >
                  {lang === 'nl' ? 'Uitloggen' : 'Sign Out'}
                </button>
              </div>
            )}
            
            {/* Promotion banner to share the tool with colleagues (only visible in full platform mode) */}
            {!isStandaloneDatumprikker && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in" id="share-tool-promo">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                    {lang === 'nl' ? "Deel deze Datumprikker met collega's" : "Share this Datumprikker with Colleagues"}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {lang === 'nl' 
                      ? "Wilt u dat uw collega's ook hun eigen datumprikkers kunnen opzetten? Deel de unieke, standalone Datumprikker URL!" 
                      : "Want your colleagues to create and manage their own polls too? Share the unique, standalone Datumprikker URL!"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const url = `${getPublicOrigin()}${window.location.pathname}?tool=datumprikker`;
                    navigator.clipboard.writeText(url);
                    setCopiedToolLink(true);
                    setTimeout(() => setCopiedToolLink(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 text-center w-full sm:w-auto justify-center"
                  id="promo-copy-btn"
                >
                  <CheckCircle2 className={`h-3.5 w-3.5 ${copiedToolLink ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>{copiedToolLink ? (lang === 'nl' ? 'Link gekopieerd!' : 'Link copied!') : (lang === 'nl' ? 'Kopieer unieke link' : 'Copy unique link')}</span>
                </button>
              </div>
            )}
            
            {/* Create form card */}
            {showCreateForm && (
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60" id="create-poll-form-container">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 leading-tight animate-fade-in flex flex-wrap items-center gap-2">
                        <span>{t.createNewPoll}</span>
                        {!emailProvider && (
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[9px] font-bold tracking-wide uppercase">
                            ⚡ {lang === 'nl' ? 'Systeem-Mailserver Actief' : 'System Mailserver Active'}
                          </span>
                        )}
                      </h2>
                      {emailUserAddress ? (
                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1.5 mt-0.5 animate-fade-in">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                          <span>
                            {lang === 'nl' 
                              ? `Verbonden als: ${emailUserAddress} (${emailProvider === 'google' ? 'Google' : 'Outlook'})`
                              : `Connected as: ${emailUserAddress} (${emailProvider === 'google' ? 'Google' : 'Outlook'})`}
                          </span>
                          <button 
                            type="button" 
                            onClick={handleDisconnectEmail} 
                            className="text-rose-500 hover:text-rose-700 underline ml-2 font-normal cursor-pointer"
                          >
                            {lang === 'nl' ? 'Loskoppelen' : 'Disconnect'}
                          </button>
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {lang === 'nl' 
                            ? 'Mails worden direct en automatisch via de app verzonden.' 
                            : 'Mails are sent automatically and directly through the app.'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="p-1 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-500 self-start sm:self-center"
                  >
                    {t.cancel}
                  </button>
                </div>

                {/* Optional Custom Email connection banner inside form for easy access */}
                {!emailProvider && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-700">
                        {lang === 'nl' ? '💡 Optioneel: Versturen via eigen adres?' : '💡 Optional: Send from your own address?'}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">
                        {lang === 'nl' 
                          ? 'Koppel optioneel uw Google of Outlook om uw eigen afzender te gebruiken.' 
                          : 'Optionally link your Google or Outlook account to use your own sender address.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleLinkGoogle}
                        className="p-1 px-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 font-semibold rounded-lg text-[10px] flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        </svg>
                        Google
                      </button>
                      <button
                        type="button"
                        onClick={handleLinkOutlook}
                        className="p-1 px-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 font-semibold rounded-lg text-[10px] flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 23 23">
                          <path fill="#F35222" d="M1 1h10v10H1z"/>
                          <path fill="#7FBA00" d="M12 1h10v10H12z"/>
                          <path fill="#00A4EF" d="M1 12h10v10H1z"/>
                          <path fill="#FFB900" d="M12 12h10v10H12z"/>
                        </svg>
                        Outlook
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCreatePollSubmit} className="space-y-6">
                  
                  {/* Title & description fields */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.title}</label>
                      <input
                        type="text"
                        required
                        placeholder="Bijv: Jaarlijkse Zomerbarbecue, Kick-off..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        id="new-poll-title"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.description}</label>
                      <textarea
                        placeholder="Korte omschrijving, meeting agenda, thema..."
                        className="w-full h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        id="new-poll-desc"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {lang === 'nl' ? 'Vorm / Locatietype' : 'Meeting Format'}
                        </label>
                        <select
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-700"
                          value={newLocationType}
                          onChange={(e) => setNewLocationType(e.target.value as any)}
                          id="new-poll-location-type"
                        >
                          <option value="">-- {lang === 'nl' ? 'Geen specifieke vorm selecteren' : 'Not specified'} --</option>
                          <option value="physical">🏢 {lang === 'nl' ? 'Fysiek op locatie' : 'Physical (On-site)'}</option>
                          <option value="digital">💻 {lang === 'nl' ? 'Digitaal (Videobellen/Online)' : 'Digital (Online meeting)'}</option>
                          <option value="hybrid">🌐 {lang === 'nl' ? 'Hybride (Fysiek + Online)' : 'Hybrid (Mixed)'}</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {lang === 'nl' ? 'Locatie / Adres / Link' : 'Address / URL Link'}
                        </label>
                        <input
                          type="text"
                          placeholder={lang === 'nl' ? 'Bijv: Vergaderruimte 3 of MS Teams-link...' : 'E.g.: Meeting Room 3 or Zoom URL...'}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                          value={newLocationAddress}
                          onChange={(e) => setNewLocationAddress(e.target.value)}
                          id="new-poll-location-address"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Proposed Options slot builder */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">{lang === 'nl' ? 'Voorgestelde Datums & Tijden' : 'Proposed Dates & Times'}</label>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFindTimeTarget('create');
                            setIsFindTimeOpen(true);
                          }}
                          className="text-xs font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-250/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          id="form-outlook-prikker-btn"
                          title={lang === 'nl' ? 'Selecteer data en tijden via kalender' : 'Select dates and times from calendar'}
                        >
                          📅 {lang === 'nl' ? 'Kalender planner' : 'Calendar planner'}
                        </button>
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                          id="form-add-time-option-btn"
                        >
                          {t.addOption}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="form-options-grid">
                      {newOptions.map((opt, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 relative flex flex-col gap-2 shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            disabled={newOptions.length <= 1}
                            className="absolute -top-1.5 -right-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 p-1 rounded-full disabled:opacity-40"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">Voorstel {idx + 1}</label>
                            <input
                              type="datetime-local"
                              required
                              className="w-full mt-1 p-1 bg-slate-50 border border-slate-100 rounded-lg text-xs"
                              value={opt.dateTime}
                              onChange={(e) => handleOptionChange(idx, 'dateTime', e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">{t.duration}</label>
                            <div className="flex gap-1.5 items-center mt-1">
                              <select
                                className="flex-1 min-w-[70px] p-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                value={(() => {
                                  const val = Number(opt.durationMin);
                                  return [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480].includes(val) ? String(val) : 'custom';
                                })()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== 'custom') {
                                    handleOptionChange(idx, 'durationMin', Number(val));
                                  }
                                }}
                              >
                                <option value="15">15 min</option>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                                <option value="90">90 min</option>
                                <option value="120">2 uur</option>
                                <option value="180">3 uur</option>
                                <option value="240">4 uur</option>
                                <option value="custom">{lang === 'nl' ? 'Handmatig' : 'Manual'}</option>
                              </select>
                              
                              <input
                                type="number"
                                required
                                min="1"
                                className="w-12 p-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center"
                                value={opt.durationMin}
                                onChange={(e) => handleOptionChange(idx, 'durationMin', Number(e.target.value))}
                              />
                              <span className="text-[10px] text-slate-400 font-medium">min</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invitees Manager inside Creation screen */}
                  <div className="space-y-2">
                    <div className="mb-1">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        👥 {lang === 'nl' ? 'Genodigden selecteren en beheren' : 'Select and manage invitees'}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {lang === 'nl' 
                          ? 'Voeg genodigden handmatig toe, of check/versleep bestaande contacten van de middelste kolom naar het vak rechts.' 
                          : 'Add invitees manually, or check/drag existing contacts from the middle column to the right panel.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                      
                      {/* Add Invitees Fields */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t.addInvitee}</h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">{lang === 'nl' ? 'Voeg genodigden één voor één toe' : 'Add invitees manually one by one'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Voornaam"
                            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                            value={inviteeFirstName}
                            onChange={(e) => setInviteeFirstName(e.target.value)}
                            id="form-invitee-firstname"
                          />
                          <input
                            type="text"
                            placeholder="Achternaam"
                            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                            value={inviteeLastName}
                            onChange={(e) => setInviteeLastName(e.target.value)}
                            id="form-invitee-lastname"
                          />
                          <div className="col-span-2 flex gap-2">
                            <input
                              type="email"
                              placeholder="E-mailadres"
                              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                              value={inviteeEmail}
                              onChange={(e) => setInviteeEmail(e.target.value)}
                              id="form-invitee-email"
                            />
                            <button
                              type="button"
                              onClick={handleAddManualInvitee}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                              id="form-add-invitee-manual-btn"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Bulk Input fields (separated with commas) */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-200/50">
                          <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                            <span>📦</span> {t.bulkImport}
                          </label>
                          <textarea
                            placeholder={t.inviteeBulkPlaceholder}
                            className="w-full h-16 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                            value={bulkInput}
                            onChange={(e) => setBulkInput(e.target.value)}
                            id="form-bulk-input"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">{t.bulkImportHelp}</span>
                            <button
                              type="button"
                              onClick={handleParseBulkInvitees}
                              className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                              id="form-bulk-import-btn"
                            >
                              + Import
                            </button>
                          </div>
                          {bulkError && <p className="text-[11px] text-rose-500 font-medium">{bulkError}</p>}
                        </div>
                      </div>

                      {/* Select/Drag Contacts middle column */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col h-full min-h-[220px]">
                        <div className="border-b pb-2 mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                            <span>👥 {lang === 'nl' ? 'Kies uit Contacten' : 'Select from Contacts'}</span>
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full border">
                              {contacts.length}
                            </span>
                          </span>
                          
                          {/* Search contacts inside creator */}
                          <input
                            type="text"
                            placeholder={lang === 'nl' ? 'Zoek contact...' : 'Search contact...'}
                            className="w-full mt-2 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={createContactSearch}
                            onChange={(e) => setCreateContactSearch(e.target.value)}
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-56 space-y-1.5 pr-1">
                          {contacts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-[10px] text-slate-400 py-8">
                              <span>{lang === 'nl' ? 'Nog geen contacten opgeslagen.' : 'No saved contacts yet.'}</span>
                              <span className="mt-1 font-semibold text-indigo-500 hover:underline cursor-pointer" onClick={() => setActiveTab('contacts')}>
                                {lang === 'nl' ? 'Contacten handmatig toevoegen' : 'Add contacts now'}
                              </span>
                            </div>
                          ) : (() => {
                            const filtered = contacts.filter(c => 
                              c.firstName.toLowerCase().includes(createContactSearch.toLowerCase()) ||
                              c.lastName.toLowerCase().includes(createContactSearch.toLowerCase()) ||
                              c.email.toLowerCase().includes(createContactSearch.toLowerCase())
                            );
                            if (filtered.length === 0) {
                              return (
                                <div className="text-center text-[10px] text-slate-400 py-6">
                                  {lang === 'nl' ? 'Geen contacten gevonden.' : 'No matching contacts.'}
                                </div>
                              );
                            }
                            return filtered.map((c) => {
                              const isSelected = manualInvitees.some(inv => inv.email.toLowerCase() === c.email.toLowerCase());
                              return (
                                <div
                                  key={c.id}
                                  draggable="true"
                                  onDragStart={(e) => handleDragStartContact(e, c)}
                                  onClick={() => handleToggleContactInCreate(c)}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                                    isSelected 
                                      ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100/70' 
                                      : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                                  }`}
                                  title={lang === 'nl' ? 'Klik of sleep dit contact naar de genodigdenlijst' : 'Click or drag this contact to the invitees list'}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleToggleContactInCreate(c);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-slate-200 text-indigo-650 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                                  />
                                  <div className="truncate flex-1 pointer-events-none">
                                    <span className="font-bold text-slate-700 block text-[11px] truncate leading-tight">
                                      {c.firstName} {c.lastName}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono truncate block">
                                      {c.email}
                                    </span>
                                  </div>
                                  <span className="text-slate-350 text-[11px] font-sans select-none pointer-events-none">☰</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <p className="text-[9px] text-slate-400 text-center border-t pt-1.5 mt-1.5 italic">
                          💡 {lang === 'nl' ? 'Sleep of vink aan' : 'Drag or check box'}
                        </p>
                      </div>

                      {/* Show current listed invitees for the new poll (DROP ZONE) */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingOverCreate(true);
                        }}
                        onDragLeave={() => setIsDraggingOverCreate(false)}
                        onDrop={handleDropContactOnCreate}
                        className={`p-4 rounded-xl border flex flex-col h-full min-h-[220px] transition-all duration-200 ${
                          isDraggingOverCreate 
                            ? 'bg-indigo-50/40 border-dashed border-2 border-indigo-500 shadow-inner scale-[1.01]' 
                            : 'bg-white border-slate-200 shadow-sm'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between border-b pb-2 mb-2">
                          <span>📋 {t.invitees} ({manualInvitees.length})</span>
                          {manualInvitees.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setManualInvitees([])}
                              className="text-[10px] text-rose-500 font-bold hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </span>

                        <div className="flex-1 overflow-y-auto max-h-48 space-y-1.5 pr-1">
                          {manualInvitees.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-lg">
                              <span>{lang === 'nl' ? 'Nog geen genodigden toegevoegd.' : 'No invitees added to draft list yet.'}</span>
                              <span className="text-[10px] text-slate-400 mt-1">{lang === 'nl' ? 'Sleep contacten hiernaartoe' : 'Drop contacts here'}</span>
                            </div>
                          ) : (
                            manualInvitees.map((inv, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-xs shadow-sm">
                                <div className="truncate">
                                  <span className="font-semibold text-slate-700">{inv.firstName} {inv.lastName}</span>
                                  <span className="text-slate-400 block font-mono text-[9px] truncate">{inv.email}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManualInvitee(idx)}
                                  className="text-slate-400 hover:text-rose-500 font-bold px-2"
                                >
                                  ✕
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Form Submission panels */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-150 cursor-pointer"
                      id="create-poll-form-submit-btn"
                    >
                      🚀 {t.createPollBtn}
                    </button>
                  </div>

                </form>
              </div>
            )}

            {/* Datumprikkers Filter / Tabs: Actief vs Archief */}
            {(() => {
              const activePolls = polls.filter(p => !p.archived);
              const archivedPolls = polls.filter(p => !!p.archived);
              const displayedPolls = polls.filter(p => {
                if (pollsFilter === 'active') return !p.archived;
                if (pollsFilter === 'archived') return !!p.archived;
                return true;
              });

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setPollsFilter('active')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          pollsFilter === 'active'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        <span>{lang === 'nl' ? 'Actieve Datumprikkers' : 'Active Polls'}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          pollsFilter === 'active' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {activePolls.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setPollsFilter('archived')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          pollsFilter === 'archived'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{lang === 'nl' ? 'Archief Datumprikkers' : 'Archived Polls'}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          pollsFilter === 'archived' ? 'bg-amber-800 text-amber-100' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {archivedPolls.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setPollsFilter('all')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          pollsFilter === 'all'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        <span>{lang === 'nl' ? 'Alle' : 'All'}</span>
                        <span className="text-[10px] opacity-75">({polls.length})</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.createNewPoll}</span>
                      </button>
                    </div>
                  </div>

                  {/* List of active/archived polls */}
                  {displayedPolls.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/50" id="no-polls-placeholder">
                      {pollsFilter === 'archived' ? (
                        <>
                          <Archive className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                          <h3 className="text-lg font-bold text-slate-700">{lang === 'nl' ? 'Geen gearchiveerde datumprikkers' : 'No archived polls'}</h3>
                          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                            {lang === 'nl' 
                              ? 'Afgeronde of gepromoveerde datumprikkers worden hier bewaard. Gebruik de archiveer-knop op een datumprikker om deze naar het archief te verplaatsen.' 
                              : 'Finalized or promoted polls are stored here. Use the archive button on any poll to move it to the archive.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-pulse" />
                          <h3 className="text-lg font-bold text-slate-700">{t.noPollsYet}</h3>
                          <p className="text-slate-500 text-sm mt-1">{lang === 'nl' ? 'Begin door je eerste datumprikker op te zetten!' : 'Start by building your very first poll!'}</p>
                          <button
                            onClick={() => setShowCreateForm(true)}
                            className="mt-6 py-2 px-4 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer shadow-md shadow-indigo-100"
                          >
                            {t.createNewPoll}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6" id="active-polls-list">
                      {displayedPolls.map((poll) => {
                        const pollInvitees = dbService.getInviteesForPoll(poll.id);
                        const votedCount = pollInvitees.filter(i => i.votedAt).length;
                        const totalCount = pollInvitees.length;
                        const percentVoted = totalCount > 0 ? Math.round((votedCount / totalCount) * 100) : 0;
                        
                        const isExpanded = expandedPollId === poll.id;
                        const isFinalized = poll.finalizedOptionId !== null;

                        return (
                          <div key={poll.id} className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-all">
                            
                            {/* Accordion header brief info summary */}
                            <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer" onClick={() => setExpandedPollId(isExpanded ? null : poll.id)}>
                              <div className="flex items-start gap-4 flex-1">
                                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${
                                  poll.archived
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : isFinalized 
                                      ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {poll.archived ? '📦' : isFinalized ? '🏆' : '🗳️'}
                                </div>
                                
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-800 text-base">{poll.title}</h3>
                                    {isFinalized && (
                                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <span>📅</span> {lang === 'nl' ? 'Vastgelegd' : 'Finalized'}
                                      </span>
                                    )}
                                    {poll.archived && (
                                      <span className="bg-amber-50 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                        <Archive className="w-2.5 h-2.5" /> {lang === 'nl' ? 'Gearchiveerd' : 'Archived'}
                                      </span>
                                    )}
                                    {poll.promotedMeetingId ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedMeetingIdForTab(poll.promotedMeetingId!);
                                          setActiveTab('meetings');
                                        }}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                                        title={lang === 'nl' ? 'Open vergadering in Notities, Afspraken & Acties' : 'Open in Notes, Agreements & Actions'}
                                      >
                                        <CheckSquare className="w-3 h-3 text-indigo-600" />
                                        <span>{lang === 'nl' ? 'Meeting Gepland' : 'Meeting Planned'}</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => handlePromotePollToMeeting(poll, e)}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                                        title={lang === 'nl' ? 'Promoveer deze datumprikker naar een meeting in Notities, Afspraken & Acties' : 'Promote this poll to a meeting'}
                                      >
                                        <FolderKanban className="w-3 h-3 text-emerald-600" />
                                        <span>{lang === 'nl' ? 'Promoveer tot Meeting' : 'Promote to Meeting'}</span>
                                      </button>
                                    )}
                                  </div>
                                  
                                  <p className="text-xs text-slate-500 line-clamp-1">{poll.description || 'Geen omschrijving'}</p>
                                  
                                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold pt-1 flex-wrap">
                                    <span>📅 {getDaysAgo(poll.createdAt)} {t.daysAgo}</span>
                                    <span>⏳ {getTimeUntilNextSlotText(poll.options)}</span>
                                    {poll.locationType && (
                                      <span className="bg-slate-100/80 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200/60 flex items-center gap-1">
                                        {poll.locationType === 'physical' && '🏢 Fysiek'}
                                        {poll.locationType === 'digital' && '💻 Digitaal'}
                                        {poll.locationType === 'hybrid' && '🌐 Hybride'}
                                        {poll.locationAddress && ` - ${poll.locationAddress}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Voting status dashboard percent visual meters */}
                              <div className="flex items-center gap-4 sm:gap-6 self-start md:self-center flex-wrap" onClick={e => e.stopPropagation()}>
                                <div className="text-right">
                                  <div className="text-xs font-bold text-slate-700">
                                    {votedCount} / {totalCount} {t.voted}
                                  </div>
                                  <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden border border-slate-200">
                                    <div
                                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                      style={{ width: `${percentVoted}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Archive toggle button */}
                                  <button
                                    onClick={(e) => handleToggleArchivePoll(poll, e)}
                                    className={`p-1.5 px-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                      poll.archived
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                    }`}
                                    title={poll.archived ? (lang === 'nl' ? 'Zet terug uit archief' : 'Restore from archive') : (lang === 'nl' ? 'Verplaats naar archief datumprikkers' : 'Move to poll archive')}
                                  >
                                    {poll.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">{poll.archived ? (lang === 'nl' ? 'Herstel' : 'Restore') : (lang === 'nl' ? 'Archiveer' : 'Archive')}</span>
                                  </button>

                                  {isExpanded && (
                                    <button
                                      onClick={() => {
                                        if (editingPollId === poll.id) {
                                          setEditingPollId(null);
                                        } else {
                                          handleStartEdit(poll);
                                        }
                                      }}
                                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                        editingPollId === poll.id 
                                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 font-bold font-sans' 
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                                      }`}
                                      id={`edit-poll-btn-${poll.id}`}
                                    >
                                      ✏️ {editingPollId === poll.id ? (lang === 'nl' ? 'Bekijk Stats' : 'View Stats') : (lang === 'nl' ? 'Wijzigen' : 'Edit')}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setExpandedPollId(isExpanded ? null : poll.id);
                                      if (editingPollId === poll.id) setEditingPollId(null);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 rounded-lg transition-all cursor-pointer"
                                  >
                                    {isExpanded ? (lang === 'nl' ? 'Sluiten' : 'Close') : (lang === 'nl' ? 'Bekijk Stats' : 'View Stats')}
                                  </button>
                                  <button
                                    onClick={() => handleDeletePoll(poll.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Delete Poll"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                            </div>

                            {/* ACCORDION EXPANDED BODY STATS AND CONTROLS PANEL */}
                            {isExpanded && (
                              <div className="border-t border-slate-100 bg-slate-50/20 p-5 md:p-6 space-y-8">
                                {editingPollId === poll.id ? (
                            /* =================== INTEGRATED EDIT MODE =================== */
                            <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/60 shadow-sm space-y-6" id={`edit-panel-${poll.id}`}>
                              <div className="flex items-center justify-between border-b pb-3">
                                <div>
                                  <h4 className="text-sm font-bold text-slate-800">
                                    ✏️ {lang === 'nl' ? 'Datumprikker Beheren & Wijzigen' : 'Manage & Edit Date Planner'}
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {lang === 'nl' 
                                      ? 'Wijzig details, datums/tijden en genodigden. Na het opslaan kun je de uitnodiging opnieuw versturen.' 
                                      : 'Modify details, proposed times, and invitees. You can resend the invitations after saving.'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingPollId(null)}
                                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
                                >
                                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                                </button>
                              </div>

                              <form onSubmit={handleSaveEditSubmit} className="space-y-6">
                                {/* Title and Description */}
                                <div className="space-y-4">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                      {t.title}
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                      {t.description}
                                    </label>
                                    <textarea
                                      className="w-full h-16 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
                                      value={editDescription}
                                      onChange={(e) => setEditDescription(e.target.value)}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {lang === 'nl' ? 'Vorm / Locatietype' : 'Format / Location Type'}
                                      </label>
                                      <select
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-700"
                                        value={editLocationType}
                                        onChange={(e) => setEditLocationType(e.target.value as any)}
                                        id="edit-poll-location-type"
                                      >
                                        <option value="">-- {lang === 'nl' ? 'Geen specifieke vorm selecteren' : 'Not specified'} --</option>
                                        <option value="physical">🏢 {lang === 'nl' ? 'Fysiek op locatie' : 'Physical (On-site)'}</option>
                                        <option value="digital">💻 {lang === 'nl' ? 'Digitaal (Videobellen/Online)' : 'Digital (Online meeting)'}</option>
                                        <option value="hybrid">🌐 {lang === 'nl' ? 'Hybride (Fysiek + Online)' : 'Hybrid (Mixed)'}</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {lang === 'nl' ? 'Locatie / Adres / Link' : 'Address / URL Link'}
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder={lang === 'nl' ? 'Bijv: Teams link of kantoor Utrecht...' : 'E.g.: Zoom link or Utrecht office...'}
                                        value={editLocationAddress}
                                        onChange={(e) => setEditLocationAddress(e.target.value)}
                                        id="edit-poll-location-address"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Proposed Options Builder */}
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-650 uppercase tracking-wider">
                                      ⏱️ {lang === 'nl' ? 'Voorgestelde Datums & Tijden' : 'Proposed Dates & Times'}
                                    </label>
                                    <div className="flex items-center gap-2.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFindTimeTarget('edit');
                                          setIsFindTimeOpen(true);
                                        }}
                                        className="text-xs font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-250/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                                        id="edit-outlook-prikker-btn"
                                        title={lang === 'nl' ? 'Selecteer data en tijden via kalender' : 'Select dates and times from calendar'}
                                      >
                                        📅 {lang === 'nl' ? 'Kalender planner' : 'Calendar planner'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleEditAddOption}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                      >
                                        <span>+ {t.addOption}</span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {editOptions.map((opt, idx) => (
                                      <div key={opt.id} className="bg-white p-3 rounded-lg border border-slate-200 relative flex flex-col gap-2 shadow-sm">
                                        <button
                                          type="button"
                                          onClick={() => handleEditRemoveOption(opt.id)}
                                          className="absolute -top-1.5 -right-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 p-1 rounded-full"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>

                                        <div>
                                          <label className="text-[9px] text-slate-400 uppercase font-semibold">Voorstel {idx + 1}</label>
                                          <input
                                            type="datetime-local"
                                            required
                                            className="w-full mt-0.5 p-1 bg-slate-50 border border-slate-100 rounded-md text-xs"
                                            value={opt.dateTime}
                                            onChange={(e) => handleEditOptionChange(opt.id, 'dateTime', e.target.value)}
                                          />
                                        </div>

                                        <div>
                                          <label className="text-[9px] text-slate-400 uppercase font-semibold">{t.duration}</label>
                                          <div className="flex gap-1 items-center mt-0.5">
                                            <select
                                              className="flex-1 p-1 bg-slate-50 border border-slate-200 rounded-md text-[11px]"
                                              value={[15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480].includes(Number(opt.durationMin)) ? String(opt.durationMin) : 'custom'}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (val !== 'custom') {
                                                  handleEditOptionChange(opt.id, 'durationMin', Number(val));
                                                }
                                              }}
                                            >
                                              <option value="15">15 min</option>
                                              <option value="30">30 min</option>
                                              <option value="45">45 min</option>
                                              <option value="60">60 min</option>
                                              <option value="90">90 min</option>
                                              <option value="120">2 uur</option>
                                              <option value="180">3 uur</option>
                                              <option value="240">4 uur</option>
                                              <option value="custom">{lang === 'nl' ? 'Handmatig' : 'Manual'}</option>
                                            </select>

                                            <input
                                              type="number"
                                              required
                                              min="1"
                                              className="w-10 p-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center"
                                              value={opt.durationMin}
                                              onChange={(e) => handleEditOptionChange(opt.id, 'durationMin', Number(e.target.value))}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Invitees Panel */}
                                <div className="space-y-1.5 pt-1.5">
                                  <div className="mb-0.5">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                      👥 {lang === 'nl' ? 'Genodigden bewerken (vink aan, versleep of voeg handmatig toe)' : 'Edit Invitees (check, drag or add manually)'}
                                    </h5>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    {/* Column 1: Add single or bulk invitee */}
                                    <div className="space-y-3">
                                      <div>
                                        <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{t.addInvitee}</h5>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="text"
                                          placeholder="Voornaam"
                                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                                          value={editGuestFirstName}
                                          onChange={(e) => setEditGuestFirstName(e.target.value)}
                                          id="edit-invitee-firstname"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Achternaam"
                                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                                          value={editGuestLastName}
                                          onChange={(e) => setEditGuestLastName(e.target.value)}
                                          id="edit-invitee-lastname"
                                        />
                                        <div className="col-span-2 flex gap-1.5">
                                          <input
                                            type="email"
                                            placeholder="E-mailadres"
                                            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                                            value={editGuestEmail}
                                            onChange={(e) => setEditGuestEmail(e.target.value)}
                                            id="edit-invitee-email"
                                          />
                                          <button
                                            type="button"
                                            onClick={handleEditAddInvitee}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 text-xs font-bold rounded-lg transition-all"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>

                                      {/* Bulk input */}
                                      <div className="space-y-1 pt-2 border-t border-slate-200/40">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                          <span>📦</span> {t.bulkImport}
                                        </label>
                                        <textarea
                                          placeholder={t.inviteeBulkPlaceholder}
                                          className="w-full h-12 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                                          value={editBulkInput}
                                          onChange={(e) => setEditBulkInput(e.target.value)}
                                        />
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] text-slate-400">{t.bulkImportHelp}</span>
                                          <button
                                            type="button"
                                            onClick={handleEditParseBulk}
                                            className="px-2.5 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-semibold hover:bg-slate-800"
                                          >
                                            + Import
                                          </button>
                                        </div>
                                        {editBulkError && <p className="text-[10px] text-rose-500">{editBulkError}</p>}
                                      </div>
                                    </div>

                                    {/* Column 2: Drag/Select Contacts middle column */}
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col h-full min-h-[160px]">
                                      <div className="border-b pb-1.5 mb-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                                          <span>👥 {lang === 'nl' ? 'Kies uit Contacten' : 'Select from Contacts'}</span>
                                          <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full border">
                                            {contacts.length}
                                          </span>
                                        </span>
                                        
                                        <input
                                          type="text"
                                          placeholder={lang === 'nl' ? 'Zoek contact...' : 'Search contact...'}
                                          className="w-full mt-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                          value={editContactSearch}
                                          onChange={(e) => setEditContactSearch(e.target.value)}
                                        />
                                      </div>

                                      <div className="flex-1 overflow-y-auto max-h-36 space-y-1 pr-1 border border-slate-100 rounded p-1">
                                        {contacts.length === 0 ? (
                                          <div className="text-center text-[10px] text-slate-400 py-4">
                                            {lang === 'nl' ? 'Geen contacten.' : 'No contacts saved.'}
                                          </div>
                                        ) : (() => {
                                          const filtered = contacts.filter(c => 
                                            c.firstName.toLowerCase().includes(editContactSearch.toLowerCase()) ||
                                            c.lastName.toLowerCase().includes(editContactSearch.toLowerCase()) ||
                                            c.email.toLowerCase().includes(editContactSearch.toLowerCase())
                                          );
                                          if (filtered.length === 0) {
                                            return (
                                              <div className="text-center text-[10px] text-slate-400 py-4">
                                                {lang === 'nl' ? 'Geen resultaten.' : 'No matches.'}
                                              </div>
                                            );
                                          }
                                          return filtered.map((c) => {
                                            const isSelected = editInvitees.some(inv => inv.email.toLowerCase() === c.email.toLowerCase());
                                            return (
                                              <div
                                                key={c.id}
                                                draggable="true"
                                                onDragStart={(e) => handleDragStartContact(e, c)}
                                                onClick={() => handleToggleContactInEdit(c)}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] cursor-pointer select-none transition-all ${
                                                  isSelected 
                                                    ? 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100/50' 
                                                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                                                }`}
                                                title={lang === 'nl' ? 'Klik of sleep dit contact' : 'Click or drag this contact'}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleContactInEdit(c);
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="rounded border-slate-200 text-indigo-650 focus:ring-indigo-500 cursor-pointer h-3 w-3"
                                                />
                                                <div className="truncate flex-1 pointer-events-none">
                                                  <span className="font-semibold text-slate-700 block text-[10px] truncate leading-tight">
                                                    {c.firstName} {c.lastName}
                                                  </span>
                                                  <span className="text-[8px] text-slate-400 font-mono truncate block">
                                                    {c.email}
                                                  </span>
                                                </div>
                                                <span className="text-slate-350 text-[10px] select-none pointer-events-none">☰</span>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>

                                    {/* Column 3: List of invitees in edit draft (DROP ZONE) */}
                                    <div
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDraggingOverEdit(true);
                                      }}
                                      onDragLeave={() => setIsDraggingOverEdit(false)}
                                      onDrop={handleDropContactOnEdit}
                                      className={`p-3 rounded-xl border flex flex-col h-full min-h-[160px] transition-all duration-200 ${
                                        isDraggingOverEdit 
                                          ? 'bg-indigo-50/40 border-dashed border-2 border-indigo-500 shadow-inner scale-[1.01]' 
                                          : 'bg-white border-slate-200 shadow-sm'
                                      }`}
                                    >
                                      <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between border-b pb-1.5 mb-1.5">
                                        <span>👥 {lang === 'nl' ? 'Genodigden' : 'Invitees'} ({editInvitees.length})</span>
                                      </span>

                                      <div className="flex-1 overflow-y-auto max-h-40 space-y-1">
                                        {editInvitees.length === 0 ? (
                                          <div className="h-full flex flex-col items-center justify-center text-center text-[10px] text-slate-400 py-6 border-2 border-dashed border-slate-100 rounded-lg">
                                            <span>{lang === 'nl' ? 'Nog geen genodigden.' : 'No invitees left.'}</span>
                                            <span className="text-[8px] text-slate-400 mt-0.5">{lang === 'nl' ? 'Sleep contacten hiernaartoe' : 'Drop contacts here'}</span>
                                          </div>
                                        ) : (
                                          editInvitees.map((inv) => {
                                            const isNew = !dbService.getInviteesForPoll(editingPollId!).some(oi => oi.id === inv.id);
                                            return (
                                              <div key={inv.id} className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] border shadow-sm ${
                                                isNew ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50/50 border-slate-100'
                                              }`}>
                                                <div className="truncate pr-2">
                                                  <span className="font-semibold text-slate-700">{inv.firstName} {inv.lastName}</span>
                                                  {isNew && <span className="ml-1 bg-indigo-150 text-indigo-850 font-extrabold text-[8px] px-1 rounded-md">New</span>}
                                                  <span className="text-slate-400 block font-mono text-[9px] truncate">{inv.email}</span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleEditRemoveInvitee(inv.id)}
                                                  className="text-slate-400 hover:text-rose-500 px-1 font-bold text-xs"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Form Action Buttons */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPollId(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                                  >
                                    {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                                  </button>
                                  <button
                                    type="submit"
                                    className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-150-none cursor-pointer"
                                  >
                                    💾 {lang === 'nl' ? 'Wijzigingen Opslaan' : 'Save Changes'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          ) : (
                            /* =================== NORMAL STATISTICS & STATS =================== */
                            <>
                              {/* Top unique invitation link panel */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xl">🔗</span>
                                  <div>
                                    <span className="text-xs font-bold text-slate-500">{lang === 'nl' ? 'Unieke Uitnodigings-link voor genodigden' : 'Unique Invitation Link for invitees'}</span>
                                    <p className="text-xs font-mono text-emerald-600 truncate max-w-md mt-0.5" id={`share-url-${poll.id}`}>
                                      {getAbsoluteVotingUrl(poll.id)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                                  <button
                                    onClick={() => handleCopyVotingUrl(poll.id)}
                                    className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                                    id={`copy-link-btn-${poll.id}`}
                                    title={lang === 'nl' ? 'Kopieer de volledige onverkorte URL' : 'Copy the full unshortened URL'}
                                  >
                                    <Clipboard className="h-3.5 w-3.5" />
                                    {lang === 'nl' ? 'Kopieer Volledig' : 'Copy Full'}
                                  </button>

                                  <button
                                    onClick={() => handleCopyAndShortenVotingUrl(poll.id)}
                                    disabled={isShortening[poll.id]}
                                    className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    id={`copy-short-btn-${poll.id}`}
                                    title={lang === 'nl' ? 'Kopieer een makkelijke verkorte TinyURL link' : 'Copy an easy shortened TinyURL link'}
                                  >
                                    {isShortening[poll.id] ? (
                                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                                    )}
                                    <span>
                                      {isShortening[poll.id] 
                                        ? (lang === 'nl' ? 'Verkorten...' : 'Shortening...') 
                                        : (lang === 'nl' ? 'Verkort & Kopieer' : 'Verkort & Kopieer link')
                                      }
                                    </span>
                                  </button>
                                  
                                  <a
                                    href={getAbsoluteVotingUrl(poll.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 sm:flex-none justify-center px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-all flex items-center gap-1.5 text-center"
                                    id={`open-tab-btn-${poll.id}`}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    {lang === 'nl' ? 'Open Stem-Tab' : 'Open voting page'}
                                  </a>
                                </div>
                              </div>

                              {/* GRID OVERVIEW: 1. REAL-TIME STATS slots preference table | 2. GUESTS response breakdown */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                
                                {/* Panel 1: Real-time statistic proposed options tally comparison table */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                                      <BarChart3 className="h-4 w-4 text-emerald-500" />
                                      {t.realtimeStats} ({lang === 'nl' ? 'Wie stemde wat' : 'Who voted what'})
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border">
                                      {votedCount} / {totalCount} {lang === 'nl' ? 'gestemd' : 'voted'}
                                    </span>
                                  </div>

                                  <div className="space-y-4" id={`stats-bars-${poll.id}`}>
                                    {poll.options.map((opt, i) => {
                                      const tally = getVotesTally(poll.id, opt.id);
                                      const voters = getOptionVoters(poll.id, opt.id);
                                      const recommendedId = getRecommendedOptionId(poll);
                                      const isBest = opt.id === recommendedId && (tally.yes > 0 || tally.heart > 0);
                                      const optDate = new Date(opt.dateTime);

                                      // Calc percentage based on number of cast votes
                                      const heartPercent = votedCount > 0 ? Math.round((tally.heart / votedCount) * 100) : 0; const yesPercent = votedCount > 0 ? Math.round((tally.yes / votedCount) * 100) : 0;
                                      const maybePercent = votedCount > 0 ? Math.round((tally.maybe / votedCount) * 100) : 0;
                                      const noPercent = votedCount > 0 ? Math.round((tally.no / votedCount) * 100) : 0;

                                      return (
                                        <div key={opt.id} className={`p-4 rounded-xl border transition-all ${
                                          isBest 
                                            ? 'bg-emerald-50/10 border-emerald-200 shadow-xs' 
                                            : 'bg-slate-50/40 border-slate-100'
                                        }`}>
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                            <div>
                                              <span className="font-bold text-xs text-slate-700 capitalize">
                                                {optDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                {` - ${optDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`}
                                              </span>
                                              {isBest && (
                                                <span className="ml-2 bg-emerald-500 text-white text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md">
                                                  🏆 {lang === 'nl' ? 'Beste Optie' : 'Suggested'}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold font-mono">
                                              <span className="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">❤️ {tally.heart} {lang === 'nl' ? 'Voorkeur' : 'Pref'} ({heartPercent}%)</span> <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                                👍 {tally.yes} {lang === 'nl' ? 'Ja' : 'Yes'} ({yesPercent}%)
                                              </span>
                                              <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                                ❓ {tally.maybe} {lang === 'nl' ? 'Misschien' : 'Maybe'} ({maybePercent}%)
                                              </span>
                                              <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                                👎 {tally.no} {lang === 'nl' ? 'Nee' : 'No'} ({noPercent}%)
                                              </span>
                                            </div>
                                          </div>

                                          {/* Cumulative responsive voting progress bars */}
                                          <div className="w-full flex h-2 rounded-full overflow-hidden bg-slate-100 border border-slate-200/50 mb-3">
                                            <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${heartPercent}%` }} title={`Voorkeur: ${heartPercent}%`} /> <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${yesPercent}%` }} title={`Ja: ${yesPercent}%`} />
                                            <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${maybePercent}%` }} title={`Misschien: ${maybePercent}%`} />
                                            <div className="bg-slate-400 h-full transition-all duration-300" style={{ width: `${noPercent}%` }} title={`Nee: ${noPercent}%`} />
                                          </div>

                                          {/* Detailed Voter Names Breakdown */}
                                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px]" id={`voters-names-${opt.id}`}>
                                            {voters.heart.length > 0 && (<div className="flex items-start gap-1.5"><span className="text-rose-700 font-extrabold shrink-0">❤️ {lang === 'nl' ? 'Voorkeur' : 'Pref'} ({voters.heart.length}):</span><span className="text-slate-600 font-medium">{voters.heart.join(', ')}</span></div>)} {voters.yes.length > 0 && (
                                              <div className="flex items-start gap-1.5">
                                                <span className="text-emerald-700 font-extrabold shrink-0">👍 {lang === 'nl' ? 'Ja' : 'Yes'} ({voters.yes.length}):</span>
                                                <span className="text-slate-600 font-medium">{voters.yes.join(', ')}</span>
                                              </div>
                                            )}
                                            {voters.maybe.length > 0 && (
                                              <div className="flex items-start gap-1.5">
                                                <span className="text-amber-700 font-extrabold shrink-0">❓ {lang === 'nl' ? 'Misschien' : 'Maybe'} ({voters.maybe.length}):</span>
                                                <span className="text-slate-600 font-medium">{voters.maybe.join(', ')}</span>
                                              </div>
                                            )}
                                            {voters.no.length > 0 && (
                                              <div className="flex items-start gap-1.5">
                                                <span className="text-slate-500 font-extrabold shrink-0">👎 {lang === 'nl' ? 'Nee' : 'No'} ({voters.no.length}):</span>
                                                <span className="text-slate-500 font-medium">{voters.no.join(', ')}</span>
                                              </div>
                                            )}
                                            {voters.heart.length === 0 && voters.yes.length === 0 && voters.maybe.length === 0 && voters.no.length === 0 && (
                                              <div className="text-[10px] text-slate-400 italic text-center py-1">
                                                {lang === 'nl' ? 'Nog geen stemmen voor dit voorstel.' : 'No votes cast for this slot yet.'}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Panel 2: Guest responder list grid & status controls */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col h-full space-y-4">
                                  <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                                    <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                                      <Users className="h-4 w-4 text-emerald-500" />
                                      {lang === 'nl' ? 'Gastenlijst' : 'Guest List'}
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold ml-1">
                                        {pollInvitees.length}
                                      </span>
                                    </span>
                                    
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {/* Add Guest Button */}
                                      <button
                                        onClick={() => {
                                          if (addingGuestPollId === poll.id) {
                                            setAddingGuestPollId(null);
                                          } else {
                                            setAddingGuestPollId(poll.id);
                                            setQuickGuestFirstName('');
                                            setQuickGuestLastName('');
                                            setQuickGuestEmail('');
                                            setQuickGuestSelectedContactId('');
                                          }
                                        }}
                                        className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200 flex items-center gap-1 cursor-pointer"
                                        title={lang === 'nl' ? 'Genodigde direct toevoegen' : 'Add invitee directly'}
                                        id={`add-guest-btn-${poll.id}`}
                                      >
                                        <UserPlus className="h-3 w-3" />
                                        {lang === 'nl' ? '+ Genodigde' : '+ Invitee'}
                                      </button>

                                      {/* Export Button */}
                                      <button
                                        onClick={() => exportInviteesToCsv(poll.title, pollInvitees, poll.options)}
                                        className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 flex items-center gap-1 cursor-pointer"
                                        title={t.export}
                                        id={`export-csv-${poll.id}`}
                                      >
                                        <FileSpreadsheet className="h-3 w-3" />
                                        Export
                                      </button>

                                      {/* Resend to all btn */}
                                      <button
                                        onClick={async () => {
                                          const confirmResend = window.confirm(
                                            lang === 'nl'
                                              ? `Weet u zeker dat u de uitnodigingsmail opnieuw wilt verzenden naar alle ${pollInvitees.length} genodigden via e-mail?`
                                              : `Are you sure you want to resend the invitation email to all ${pollInvitees.length} invitees?`
                                          );
                                          if (confirmResend) {
                                            await sendInvitationEmails(poll, pollInvitees);
                                          }
                                        }}
                                        className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100 flex items-center gap-1 cursor-pointer"
                                        id={`resend-all-${poll.id}`}
                                        title={lang === 'nl' ? 'Uitnodiging versturen naar iedereen' : 'Send invitation to all'}
                                      >
                                        📤 {lang === 'nl' ? 'Stuur Iedereen' : 'Resend All'}
                                      </button>

                                      {/* Send batch reminder btn */}
                                      <button
                                        onClick={() => handleSendAllReminders(poll.id)}
                                        className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 flex items-center gap-1 cursor-pointer"
                                        id={`remind-all-${poll.id}`}
                                      >
                                        💌 Remind Pending
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inline Quick Add Guest Form */}
                                  {addingGuestPollId === poll.id && (
                                    <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs space-y-2.5 shadow-xs" id={`quick-add-form-${poll.id}`}>
                                      <div className="flex items-center justify-between font-bold text-emerald-900">
                                        <span className="flex items-center gap-1.5 text-xs">
                                          <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                                          {lang === 'nl' ? 'Nieuwe genodigde toevoegen aan deze afspraak' : 'Add invitee to this meeting'}
                                        </span>
                                        <button
                                          onClick={() => setAddingGuestPollId(null)}
                                          className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </div>

                                      {/* Choose from address book if available */}
                                      {contacts.length > 0 && (
                                        <div>
                                          <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-1">
                                            {lang === 'nl' ? 'Kies uit contacten (optioneel):' : 'Choose from contacts (optional):'}
                                          </label>
                                          <select
                                            value={quickGuestSelectedContactId}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setQuickGuestSelectedContactId(val);
                                              if (val) {
                                                const sel = contacts.find(c => c.id === val);
                                                if (sel) {
                                                  setQuickGuestFirstName(sel.firstName);
                                                  setQuickGuestLastName(sel.lastName);
                                                  setQuickGuestEmail(sel.email);
                                                }
                                              }
                                            }}
                                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700"
                                          >
                                            <option value="">{lang === 'nl' ? '-- Of selecteer uit contacten --' : '-- Or select from contacts --'}</option>
                                            {contacts.map(c => (
                                              <option key={c.id} value={c.id}>
                                                {c.firstName} {c.lastName} ({c.email})
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {/* Manual entry fields */}
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div>
                                          <input
                                            type="text"
                                            placeholder={lang === 'nl' ? 'Voornaam *' : 'First name *'}
                                            value={quickGuestFirstName}
                                            onChange={(e) => setQuickGuestFirstName(e.target.value)}
                                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-medium"
                                          />
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            placeholder={lang === 'nl' ? 'Achternaam *' : 'Last name *'}
                                            value={quickGuestLastName}
                                            onChange={(e) => setQuickGuestLastName(e.target.value)}
                                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-medium"
                                          />
                                        </div>
                                        <div>
                                          <input
                                            type="email"
                                            placeholder={lang === 'nl' ? 'E-mailadres *' : 'Email address *'}
                                            value={quickGuestEmail}
                                            onChange={(e) => setQuickGuestEmail(e.target.value)}
                                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-medium"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-[10px] text-slate-500 italic">
                                          {lang === 'nl' 
                                            ? 'Wordt direct opgeslagen in de afspraak en uw adresboek.' 
                                            : 'Will be saved immediately to the meeting and your contacts.'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => setAddingGuestPollId(null)}
                                            className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                                          >
                                            {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                                          </button>
                                          <button
                                            onClick={() => handleQuickAddGuest(poll.id)}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                                          >
                                            <UserPlus className="h-3.5 w-3.5" />
                                            {lang === 'nl' ? 'Toevoegen & Opslaan' : 'Add & Save'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-1" id={`guests-container-${poll.id}`}>
                                    {pollInvitees.length === 0 ? (
                                      <div className="text-center py-10 text-xs text-slate-400">
                                        {lang === 'nl' ? 'Nog geen genodigden.' : 'No invitees for this poll.'}
                                      </div>
                                    ) : (
                                      pollInvitees.map(invitee => {
                                        const hasCompleted = invitee.votedAt !== null;
                                        return (
                                          <div key={invitee.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                            <div className="space-y-0.5">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-slate-700">{invitee.firstName} {invitee.lastName}</span>
                                                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                                  hasCompleted 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : 'bg-rose-100 text-rose-800 animate-pulse'
                                                }`}>
                                                  {hasCompleted ? t.voted : t.notVoted}
                                                </span>
                                              </div>
                                              
                                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{invitee.email}</p>
                                              
                                              {invitee.comment && (
                                                <p className="text-[11px] text-slate-500 italic bg-white p-1.5 rounded-lg border border-slate-100 mt-1.5 inline-block">
                                                  💬 "{invitee.comment}"
                                                </p>
                                              )}

                                              {hasCompleted && (
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-slate-100/40 p-1.5 rounded-xl border border-slate-200/50 max-w-sm" id={`voter-summary-${invitee.id}`}>
                                                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider mr-1">
                                                    {lang === 'nl' ? 'Totaal stemmen:' : 'Total votes:'}
                                                  </span>
                                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10.5px] font-extrabold rounded-lg border border-rose-100 flex items-center gap-1">
                                                    ❤️ {Object.values(invitee.votes || {}).filter(v => v === 'HEART').length}x {lang === 'nl' ? 'Voorkeur' : 'Pref'}</span> <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10.5px] font-extrabold rounded-lg border border-emerald-100 flex items-center gap-1.5">👍 {Object.values(invitee.votes || {}).filter(v => v === 'YES').length}x {lang === 'nl' ? 'Ja' : 'Yes'}
                                                  </span>
                                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10.5px] font-extrabold rounded-lg border border-amber-100 flex items-center gap-1">
                                                    ❓ {Object.values(invitee.votes || {}).filter(v => v === 'MAYBE').length}x {lang === 'nl' ? 'Misschien' : 'Maybe'}
                                                  </span>
                                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10.5px] font-extrabold rounded-lg border border-slate-200 flex items-center gap-1">
                                                    👎 {Object.values(invitee.votes || {}).filter(v => v === 'NO').length}x {lang === 'nl' ? 'Nee' : 'No'}
                                                  </span>
                                                </div>
                                              )}

                                              {hasCompleted && (
                                                <div className="mt-2 p-2 bg-white rounded-lg border border-slate-150/80 space-y-1 max-w-sm">
                                                  <div className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                                    {lang === 'nl' ? 'Beschikbaarheid & Opmerkingen per optie:' : 'Option Votes & Comments:'}
                                                  </div>
                                                  {poll.options.map(opt => {
                                                    const voteValue = invitee.votes[opt.id];
                                                    const optDate = new Date(opt.dateTime);
                                                    const optStr = optDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                                    const optComment = invitee.optionComments?.[opt.id];
                                                    return (
                                                      <div key={opt.id} className="text-[10.5px] text-slate-600 flex flex-wrap items-center gap-1.5 border-b border-slate-50 last:border-0 pb-1 last:pb-0 pt-1 first:pt-0">
                                                        <span className={`px-1 rounded text-[8px] font-bold ${
                                                          voteValue === 'HEART' ? 'bg-rose-100 text-rose-700 border border-rose-200' : voteValue === 'YES' ? 'bg-emerald-100 text-emerald-800' :
                                                          voteValue === 'MAYBE' ? 'bg-amber-100 text-amber-700' :
                                                          voteValue === 'NO' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                          {voteValue === 'HEART' ? '❤️' : voteValue === 'YES' ? 'JA' : voteValue === 'MAYBE' ? '?' : voteValue === 'NO' ? 'NEE' : '-'}
                                                        </span>
                                                        <span className="font-medium text-slate-500 text-[10px]">{optStr}</span>
                                                        {optComment && (
                                                          <span className="text-[10px] text-indigo-600 font-medium italic">
                                                            💬 "{optComment}"
                                                          </span>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap justify-end">
                                              {invitee.lastReminderAt && (
                                                <span className="text-[9px] text-slate-400 font-semibold italic mr-1">
                                                  ⏰ {new Date(invitee.lastReminderAt).toLocaleDateString()}
                                                </span>
                                              )}

                                              {/* Copy direct personal link */}
                                              <button
                                                onClick={() => {
                                                  navigator.clipboard.writeText(getAbsoluteVotingUrl(poll.id));
                                                  alert(lang === 'nl' 
                                                    ? `Uitnodigingslink voor ${invitee.firstName} gekopieerd naar klembord!\n\n${getAbsoluteVotingUrl(poll.id)}` 
                                                    : `Invitation link for ${invitee.firstName} copied to clipboard!\n\n${getAbsoluteVotingUrl(poll.id)}`);
                                                }}
                                                className="p-1 px-2 bg-white hover:bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                                                title={lang === 'nl' ? 'Kopieer link voor deze genodigde' : 'Copy link for this invitee'}
                                              >
                                                <Copy className="h-2.5 w-2.5" />
                                                Link
                                              </button>

                                              {/* Send or Resend Invitation Email */}
                                              <button
                                                onClick={() => handleSendSingleInvitation(invitee)}
                                                className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md text-[10px] font-bold border border-indigo-100 cursor-pointer flex items-center gap-1"
                                                title={lang === 'nl' ? 'Verstuur uitnodigingsmail' : 'Send invitation email'}
                                              >
                                                <Send className="h-2.5 w-2.5" />
                                                {invitee.lastReminderAt ? (lang === 'nl' ? 'Opnieuw' : 'Resend') : (lang === 'nl' ? 'Stuur Mail' : 'Send Mail')}
                                              </button>

                                              {/* Remind if not yet completed */}
                                              {!hasCompleted && (
                                                <button
                                                  onClick={() => handleSendReminder(invitee)}
                                                  className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold border border-rose-200 cursor-pointer flex items-center gap-1"
                                                  id={`remind-${invitee.id}`}
                                                  title={lang === 'nl' ? 'Stuur herinnering' : 'Send reminder'}
                                                >
                                                  <Bell className="h-2.5 w-2.5" />
                                                  Remind
                                                </button>
                                              )}

                                              {/* Delete invitee from poll */}
                                              <button
                                                onClick={async () => {
                                                  const confirmDelete = window.confirm(
                                                    lang === 'nl'
                                                      ? `Weet u zeker dat u ${invitee.firstName} ${invitee.lastName} wilt verwijderen uit deze afspraak?`
                                                      : `Are you sure you want to remove ${invitee.firstName} ${invitee.lastName} from this poll?`
                                                  );
                                                  if (confirmDelete) {
                                                    await dbService.deleteInvitee(invitee.id);
                                                    refreshCoreData();
                                                  }
                                                }}
                                                className="p-1 px-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md text-[10px] cursor-pointer"
                                                title={lang === 'nl' ? 'Verwijder genodigde' : 'Remove invitee'}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                              </div>

                              {/* Email Template Customize controls */}
                              <div className="bg-white rounded-2xl border border-slate-100 p-1">
                                <TemplateEditor
                                  poll={poll}
                                  lang={lang}
                                  onSaved={() => {
                                    alert(lang === 'nl' ? 'Templates bijgewerkt en opgeslagen!' : 'Templates saved!');
                                    refreshCoreData();
                                  }}
                                />
                              </div>

                              {/* DEFINITIVE SELECTION, AGENDA / CALENDAR SYNC CONTROLS */}
                              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                                  <div>
                                    <span className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                                      📅 {t.finalizeAndSync}
                                    </span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      {lang === 'nl'
                                        ? 'Kies het definitieve tijdslot en leg deze vast in je Google- of Outlookagenda!'
                                        : 'Choose the final confirmed time slot and sync it with Google Calendar or Outlook!'}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isFinalized ? (
                                      <button
                                        onClick={() => handleFinalizeSelectInit(poll)}
                                        className="p-1 px-3 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 rounded-lg"
                                      >
                                        🔔 {lang === 'nl' ? 'Andere datum kiezen' : 'Choose another slot'}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleFinalizeSelectInit(poll)}
                                        className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                        id={`finalize-init-${poll.id}`}
                                      >
                                        🏁 {lang === 'nl' ? 'Vastleggen' : 'Finalize Meeting'}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Finalize selector wizard popup form */}
                                {finalizingPollId === poll.id && (
                                  <div className="bg-slate-50 p-4 rounded-xl border border-orange-200 space-y-3" id="finalize-wizard">
                                    <label className="block text-xs font-bold text-amber-800">{lang === 'nl' ? 'Selecteer het definitieve voorstel' : 'Select the final proposal'}</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {poll.options.map((opt) => {
                                        const optDate = new Date(opt.dateTime);
                                        const recommended = getRecommendedOptionId(poll);
                                        const isBest = opt.id === recommended;

                                        return (
                                          <label
                                            key={opt.id}
                                            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                              selectedFinalOptionId === opt.id 
                                                ? 'bg-amber-100 border-amber-300 shadow-xs text-amber-900 font-bold' 
                                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="radio"
                                                name={`final-opt-${poll.id}`}
                                                value={opt.id}
                                                checked={selectedFinalOptionId === opt.id}
                                                onChange={() => setSelectedFinalOptionId(opt.id)}
                                              />
                                              <span className="text-xs">
                                                {optDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })} {` ${optDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`}
                                              </span>
                                            </div>
                                            {isBest && (
                                              <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md">Best 👍</span>
                                            )}
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-2">
                                      <button
                                        onClick={() => setFinalizingPollId(null)}
                                        className="px-3 py-1 bg-white border rounded-lg text-xs font-semibold text-slate-500"
                                      >
                                        {t.cancel}
                                      </button>
                                      <button
                                        onClick={handleSaveFinalizedSlot}
                                        className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all"
                                        id="finalize-wizard-submit"
                                      >
                                        {lang === 'nl' ? 'Vastleggen & Verzenden' : 'Lock & Send'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Real Integrations Calendar Links and Downloads when poll is Finalized */}
                                {isFinalized && (
                                  <div className="p-4 bg-amber-50/20 border border-amber-200/50 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4" id="calendar-sync-panel">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-2xl">🗓️</span>
                                      <div>
                                        <span className="text-xs font-extrabold text-amber-800 block">
                                          {lang === 'nl' ? 'Afspraak is definitief!' : 'Meeting Finalized!'}
                                        </span>
                                        {(() => {
                                          const matchingOpt = poll.options.find(o => o.id === poll.finalizedOptionId);
                                          if (!matchingOpt) return null;
                                          const finalDateObj = new Date(matchingOpt.dateTime);
                                          return (
                                            <p className="text-xs text-slate-600 mt-1" id="finalized-label">
                                              📅 <b className="capitalize">{finalDateObj.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b> {lang === 'nl' ? 'om' : 'at'} <b>{finalDateObj.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</b>
                                            </p>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    {/* Calendar syncing links (Google / Outlook / ICS) */}
                                    {(() => {
                                      const matchingOpt = poll.options.find(o => o.id === poll.finalizedOptionId);
                                      if (!matchingOpt) return null;

                                      const gLink = generateGoogleCalendarLink(poll.title, poll.description, matchingOpt.dateTime, matchingOpt.durationMin);
                                      const oLink = generateOutlookLink(poll.title, poll.description, matchingOpt.dateTime, matchingOpt.durationMin);

                                      return (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <a
                                            href={gLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3.5 py-2 bg-white text-[10px] sm:text-xs font-bold border border-slate-200 text-slate-700 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-1.5 transition-all text-center"
                                            title={t.googleCalendar}
                                            id="google-calendar-sync"
                                          >
                                            <span className="text-sm">🇬</span>
                                            Google Calendar
                                          </a>
                                          
                                          <a
                                            href={oLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3.5 py-2 bg-white text-[10px] sm:text-xs font-bold border border-slate-200 text-slate-700 rounded-lg hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-1.5 transition-all text-center"
                                            title={t.outlookCalendar}
                                            id="outlook-calendar-sync"
                                          >
                                            <span className="text-sm">🇴</span>
                                            Outlook Live
                                          </a>

                                          <button
                                            onClick={() => downloadIcsFile(poll.title, poll.description, matchingOpt.dateTime, matchingOpt.durationMin)}
                                            className="px-3.5 py-2 bg-slate-900 text-[10px] sm:text-xs font-bold text-white rounded-lg hover:bg-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
                                            title="Download .ICS bestand"
                                            id="ics-file-download"
                                          >
                                            <Download className="h-3.5 w-3.5" />
                                            <span>Download .ICS file</span>
                                          </button>
                                        <div className="w-full mt-3 pt-3 border-t border-amber-200/60 flex items-center justify-between flex-wrap gap-2">
                                          <div className="text-[11px] text-slate-500 font-medium">
                                            {poll.promotedMeetingId 
                                              ? (lang === 'nl' ? '✅ Deze afspraak is overgenomen in Notities, Afspraken & Acties.' : '✅ This poll has been converted to a meeting.') 
                                              : (lang === 'nl' ? '💡 Tip: Promoveer direct naar een vergadering met agenda, notities en actiepunten.' : '💡 Tip: Promote directly to a meeting with agenda, notes and actions.')}
                                          </div>
                                          {!poll.promotedMeetingId ? (
                                            <button
                                              type="button"
                                              onClick={(e) => handlePromotePollToMeeting(poll, e)}
                                              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                            >
                                              <FolderKanban className="w-3.5 h-3.5" />
                                              <span>{lang === 'nl' ? '🚀 Promoveer tot Meeting in Notities & Afspraken' : '🚀 Promote to Meeting in Notes & Actions'}</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedMeetingIdForTab(poll.promotedMeetingId!);
                                                setActiveTab('meetings');
                                              }}
                                              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                                            >
                                              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                                              <span>{lang === 'nl' ? 'Open in Notities, Afspraken & Acties →' : 'Open in Notes, Agreements & Actions →'}</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                            </div>
                          </>
                        )}

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })()}

          </div>
        )}

      </main>

      <footer className="bg-white border-t border-slate-200/50 mt-16 py-8" id="footer">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span>📅 IT Platform Twente</span>
            <span>|</span>
            <span>{lang === 'nl' ? 'Activiteiten, taakbeheer en datumprikker' : 'Activities, task management & date planner'}</span>
          </div>
          <div>
            &copy; 2026 IT Platform Twente. {lang === 'nl' ? 'Alle rechten voorbehouden.' : 'All rights reserved.'}
          </div>
        </div>
      </footer>

      {/* Custom modal for confirming invitations via Gmail */}
      {emailPromptConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200" id="email-invitation-modal">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg">
                ✉️
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-slate-950">
                  {lang === 'nl' ? 'Uitnodigingen verzenden via Gmail' : 'Send Gmail invitations'}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase font-semibold">
                  {emailPromptConfig.poll.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {lang === 'nl'
                ? `De datumprikker "${emailPromptConfig.poll.title}" is succesvol opgeslagen! Wilt u nu uitnodigingsmails verzenden naar de genodigden?`
                : `The date planner "${emailPromptConfig.poll.title}" has been successfully saved! Would you like to send invitation emails to the invitees now?`
              }
            </p>

            <div className="flex flex-col gap-2 mt-2">
              {/* Option 1: Only newly added invitees (if editing and there are custom new additions) */}
              {!emailPromptConfig.isCreation && emailPromptConfig.addedInviteesList.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const listToSend = emailPromptConfig.addedInviteesList;
                    setEmailPromptConfig(null);
                    await sendInvitationEmails(emailPromptConfig.poll, listToSend);
                  }}
                  className="w-full text-left px-4 py-3 border border-indigo-100 hover:border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl text-xs font-semibold text-indigo-900 flex items-center justify-between transition-all group cursor-pointer"
                  id="send-only-new-invitees-btn"
                >
                  <div>
                    <span className="block text-[13px] font-bold">{lang === 'nl' ? "Alleen nieuwe genodigden" : "Only new invitees"}</span>
                    <span className="block text-[10px] text-indigo-500 font-normal mt-0.5">
                      {lang === 'nl' 
                        ? `Verzend alleen naar de ${emailPromptConfig.addedInviteesList.length} nieuw toegevoegde persoon/personen` 
                        : `Send only to the ${emailPromptConfig.addedInviteesList.length} newly added person(s)`}
                    </span>
                  </div>
                  <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform">➡️</span>
                </button>
              )}

              {/* Option 2: All invitees */}
              <button
                type="button"
                onClick={async () => {
                  const listToSend = emailPromptConfig.inviteesList;
                  setEmailPromptConfig(null);
                  await sendInvitationEmails(emailPromptConfig.poll, listToSend);
                }}
                className="w-full text-left px-4 py-3 border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-slate-50 hover:text-indigo-900 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between transition-all group cursor-pointer"
                id="send-all-invitees-btn"
              >
                <div>
                  <span className="block text-[13px] font-bold">
                    {emailPromptConfig.isCreation 
                      ? (lang === 'nl' ? "Verstuur naar alle genodigden" : "Send to all invitees") 
                      : (lang === 'nl' ? "Alle genodigden" : "All invitees")
                    }
                  </span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                    {lang === 'nl' 
                      ? `Verzend naar alle ${emailPromptConfig.inviteesList.length} genodigden` 
                      : `Send to all ${emailPromptConfig.inviteesList.length} registered invitees`}
                  </span>
                </div>
                <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">➡️</span>
              </button>

              {/* Option 3: Do not send / Cancel */}
              <button
                type="button"
                onClick={() => setEmailPromptConfig(null)}
                className="w-full text-center py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition-all cursor-pointer mt-1"
                id="cancel-email-invitations-btn"
              >
                {lang === 'nl' ? 'Niet verzenden' : 'Do not send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outlook FindTime Slot Selector Modal */}
      <FindTimeSelector
        lang={lang}
        isOpen={isFindTimeOpen}
        onClose={() => {
          setIsFindTimeOpen(false);
          setFindTimeTarget(null);
        }}
        onSelect={handleFindTimeSelect}
        initialSlots={(() => {
          if (findTimeTarget === 'create') {
            return newOptions.map(o => ({ dateTime: o.dateTime, durationMin: Number(o.durationMin) }));
          } else if (findTimeTarget === 'edit') {
            return editOptions.map(o => ({ dateTime: o.dateTime, durationMin: Number(o.durationMin) }));
          }
          return [];
        })()}
      />

      {/* Custom Published URL Settings Modal */}
      {showUrlSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200" id="url-settings-modal">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg">
                  🌐
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">
                    {lang === 'nl' ? 'Publiceer & Deel Instellingen' : 'Publish & Share Settings'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase font-semibold">
                    ITPT Domain Manager
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowUrlSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-black cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 my-2">
              <div className="bg-indigo-50/80 border border-indigo-100 p-3.5 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-indigo-600" />
                  {lang === 'nl' ? 'Hoe publiceert u deze app?' : 'How to publish this app?'}
                </h4>
                <div className="text-[11px] text-indigo-950 space-y-1.5 leading-relaxed">
                  <p>
                    {lang === 'nl'
                      ? '1. Klik in Google AI Studio rechtsboven op de knop "Share" (Delen) om de app direct openbaar te publiceren als stand-alone weblink.'
                      : '1. In Google AI Studio, click the "Share" button at the top right to immediately publish the app as a public standalone web link.'}
                  </p>
                  <p>
                    {lang === 'nl'
                      ? '2. Of open het menu in Google AI Studio en kies "Deploy to Cloud Run" voor permanente cloudhosting met uw eigen Google Cloud project.'
                      : '2. Or open the menu in Google AI Studio and choose "Deploy to Cloud Run" for permanent cloud hosting on Google Cloud.'}
                  </p>
                </div>
              </div>

              {/* Clean Sample Tasks Tool */}
              <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="text-rose-950">
                  <strong className="font-bold flex items-center gap-1 text-rose-800">
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    {lang === 'nl' ? 'Voorbeeldtaken opschonen' : 'Clean up sample tasks'}
                  </strong>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    {lang === 'nl'
                      ? 'Wist alle automatisch gegenereerde voorbeeldtaken en behoudt enkel uw eigen echte gegevens.'
                      : 'Removes all sample/test tasks and keeps only your real data.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const count = await dbService.cleanSampleTasks();
                    alert(lang === 'nl' ? `${count} voorbeeldtaak/taken verwijderd!` : `${count} sample task(s) removed!`);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shrink-0 transition-colors cursor-pointer shadow-xs"
                >
                  {lang === 'nl' ? 'Taken opschonen' : 'Purge samples'}
                </button>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  {lang === 'nl' ? 'Korte, logische URL geactiveerd!' : 'Short, logical URL active!'}
                </h4>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  {lang === 'nl' 
                    ? 'Uitnodigingen en gedeelde portalen gebruiken nu automatisch het schone, stand-alone webadres zonder de AI Studio editor-omgeving. Dit is professioneel en direct toegankelijk voor externe partijen!' 
                    : 'Invitations and shared portals now automatically use the clean, standalone web address without the AI Studio editor frame. This is white-labeled and directly accessible for external users!'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  {lang === 'nl' ? 'Actueel stand-alone webadres:' : 'Current standalone web address:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getPublicOrigin()}
                    className="flex-1 bg-slate-50 border border-slate-200 text-xs text-slate-600 rounded-xl px-3 py-2 font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getPublicOrigin());
                      alert(lang === 'nl' ? 'Webadres gekopieerd naar klembord!' : 'Web address copied to clipboard!');
                    }}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === 'nl' ? 'Kopieer' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 border-t pt-4">
                <label className="text-xs font-bold text-slate-700 block">
                  {lang === 'nl' ? 'Aangepast eigen domein (optioneel):' : 'Custom domain (optional):'}
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'nl'
                    ? 'Als u de applicatie naar een eigen domein hebt gepubliceerd (bijv. https://planner.twente.nl), vul deze dan hieronder in zodat alle e-mails en links dit domein gebruiken.'
                    : 'If you have published the app to a custom domain (e.g., https://planner.twente.nl), enter it below so all sent emails and share links will use this custom domain.'}
                </p>
                <input
                  type="text"
                  placeholder="https://mijn-eigen-domein.nl"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
                {customUrlInput.includes('.ai.studio') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1.5">
                    <p className="font-bold flex items-center gap-1 text-amber-800">
                      ⚠️ {lang === 'nl' ? 'Belangrijke informatie over .ai.studio domeinen' : 'Important notice about .ai.studio domains'}
                    </p>
                    <p className="leading-relaxed">
                      {lang === 'nl'
                        ? 'Google AI Studio biedt geen subdomeinen op .ai.studio (zoals activitityplanner.ai.studio). Dit domein bestaat niet op het internet en leidt tot een 404-fout.'
                        : 'Google AI Studio does not offer subdomains on .ai.studio. This domain does not exist on the web and will cause 404 errors.'}
                    </p>
                    <p className="leading-relaxed">
                      {lang === 'nl'
                        ? 'De officiële publieke weblink van AI Studio is: '
                        : 'The official AI Studio public web link is: '}
                      <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-indigo-700 select-all font-bold">
                        https://ais-pre-xytdoe6esnnn7e5e7sudzv-677953799143.europe-west2.run.app
                      </code>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('custom_production_url');
                        setCustomUrlInput('');
                      }}
                      className="mt-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                    >
                      {lang === 'nl' ? 'Verwijder en gebruik officiële weblink' : 'Clear and use official web link'}
                    </button>
                  </div>
                )}
              </div>

              {/* Data Migration Hint */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="text-indigo-950 font-medium">
                  <strong>{lang === 'nl' ? 'Data overzetten van een eerdere omgeving?' : 'Transfer data from a previous domain?'}</strong>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    {lang === 'nl'
                      ? 'Download je data als JSON op je oude adres en importeer het hier met één klik.'
                      : 'Download a JSON backup from your previous URL and import it here.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUrlSettingsModal(false);
                    setShowDataBackupModal(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg shrink-0 transition-colors cursor-pointer"
                >
                  {lang === 'nl' ? 'Open Im/Export' : 'Open Import/Export'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('custom_production_url');
                  setCustomUrlInput('');
                  alert(lang === 'nl' ? 'Standaard stand-alone adres hersteld.' : 'Default standalone address restored.');
                  setShowUrlSettingsModal(false);
                }}
                className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {lang === 'nl' ? 'Herstel Standaard' : 'Reset Default'}
              </button>
              <button
                type="button"
                onClick={() => {
                  let trimmed = customUrlInput.trim();
                  if (trimmed) {
                    if (trimmed.includes('.ai.studio')) {
                      alert(lang === 'nl' 
                        ? 'Google AI Studio ondersteunt geen subdomeinen op .ai.studio. Gebruik de officiële link of een eigen geregistreerd domein (bijv. https://planner.twente.nl).'
                        : 'Google AI Studio does not support .ai.studio subdomains. Please use the official link or your own domain.');
                      return;
                    }
                    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                      trimmed = 'https://' + trimmed;
                    }
                    if (trimmed.endsWith('/')) {
                      trimmed = trimmed.slice(0, -1);
                    }
                    localStorage.setItem('custom_production_url', trimmed);
                    alert(lang === 'nl' ? 'Eigen domein succesvol ingesteld!' : 'Custom domain successfully configured!');
                  } else {
                    localStorage.removeItem('custom_production_url');
                  }
                  setShowUrlSettingsModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {lang === 'nl' ? 'Opslaan' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Import & Export Backup Modal */}
      <DataImportExportModal
        isOpen={showDataBackupModal}
        onClose={() => setShowDataBackupModal(false)}
        lang={lang}
        onImportSuccess={() => refreshCoreData()}
      />

      {/* SMTP & M365 Email Server Configuration Modal */}
      <SmtpConfigModal
        isOpen={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        lang={lang}
      />

    </div>
  );
}
