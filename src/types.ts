export type VoteValue = 'YES' | 'NO' | 'MAYBE' | 'HEART';

export interface PollOption {
  id: string;
  dateTime: string; // ISO String or Dutch readable date format
  durationMin: number; // e.g. 60, 90, 120
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  createdAt: string; // ISO string
  sentAt: string | null; // ISO string
  finalizedOptionId: string | null;
  invitationTemplate: string;
  confirmationTemplate: string;
  locationType?: 'physical' | 'digital' | 'hybrid' | '';
  locationAddress?: string;
  ownerId?: string;
  archived?: boolean; // True if archived
  promotedMeetingId?: string; // Meeting ID when promoted to 'Notities, Afspraken & Acties'
}

export interface Invitee {
  id: string;
  pollId: string;
  firstName: string;
  lastName: string;
  email: string;
  votes: Record<string, VoteValue>; // optionId -> VoteValue
  comment: string;
  optionComments?: Record<string, string>; // optionId -> custom comment on that option
  votedAt: string | null; // ISO string
  lastReminderAt: string | null; // ISO string
  ownerId?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organization?: string;
  ownerId?: string;
}

export interface TaskProgressUpdate {
  id: string;
  author: string;
  date: string; // ISO string or YYYY-MM-DD HH:mm
  text: string;
  statusChange?: string;
}

export interface Notification {
  id: string;
  pollId?: string;
  pollTitle?: string;
  inviteeName?: string;
  title?: string;
  message: string;
  type: 'vote_submitted' | 'comment_added' | 'poll_reminder' | 'meeting_prep' | 'task_reminder' | 'task_assigned' | 'group_task_reminder' | 'general' | 'agenda_prep' | 'meeting_actions';
  timestamp: string; // ISO string
  read: boolean;
  ownerId?: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientCount?: number;
  itemType?: 'poll' | 'meeting' | 'task' | 'group_tasks';
  itemId?: string;
  uniqueUrl?: string;
  status?: 'sent' | 'scheduled' | 'draft';
}

export interface Attachment {
  id: string;
  name: string;
  type: string; // mime-type or file extension indication
  size: number; // bytes
  dataUrl: string; // base64 representation of file
}

export interface Task {
  id: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null
  completed: boolean;
  archived: boolean;
  priority: boolean;
  statusId: string; // references TaskStatus id
  categoryId: string; // references TaskCategory id
  isCalendarItem: boolean;
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  recurrence: 'none' | 'weekly' | 'monthly';
  recurrenceDay: number | null; // e.g. 1 for Monday (0=Sunday, 1=Monday, etc.)
  recurrenceExceptions: string[]; // YYYY-MM-DD exceptions where this instance is deleted or checked off
  ownerId?: string;
  attachments?: Attachment[];
  assigneeIds?: string[]; // Contact IDs
  assignees?: { id: string; name: string; email: string }[];
  showInWeekPlanner?: boolean; // Vinkje om beschikbaar te maken in Weekplanner
  projectId?: string; // Gekoppeld aan project of verkenning
  projectType?: 'project' | 'exploration';
  projectTitle?: string;
  activityId?: string; // Optioneel gekoppelde projectactiviteit
  completedAt?: string | null;
  notes?: string;
  progressUpdates?: TaskProgressUpdate[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskStatus {
  id: string;
  name: string;
  color: string; // tailwind color class prefix or simple hex
  order: number;
  ownerId?: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  ownerId?: string;
}

export type Language = 'nl' | 'en';

export interface Translation {
  dashboard: string;
  activePolls: string;
  contacts: string;
  templates: string;
  createNewPoll: string;
  title: string;
  description: string;
  createPollBtn: string;
  duration: string;
  addOption: string;
  invitees: string;
  saveContact: string;
  actions: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  export: string;
  inviteeBulkPlaceholder: string;
  sendInvitations: string;
  inviteeEmail: string;
  inviteeName: string;
  status: string;
  votes: string;
  voted: string;
  notVoted: string;
  comment: string;
  sendReminder: string;
  votedAt: string;
  realtimeStats: string;
  totalInvitees: string;
  responded: string;
  sentDaysAgo: string;
  timeUntilNextSlot: string;
  addContact: string;
  firstName: string;
  lastName: string;
  email: string;
  search: string;
  filter: string;
  sort: string;
  voteYes: string;
  voteNo: string;
  voteMaybe: string;
  voteHeart: string;
  submitVote: string;
  voteSuccess: string;
  googleCalendar: string;
  outlookCalendar: string;
  finalizeAndSync: string;
  finalizeSuccess: string;
  editTemplate: string;
  invitationMailTemplate: string;
  confirmationMailTemplate: string;
  copyBtn: string;
  sendDirectly: string;
  copied: string;
  noPollsYet: string;
  noContactsYet: string;
  notifications: string;
  markAllRead: string;
  votedOnPoll: string;
  daysAgo: string;
  inDays: string;
  hours: string;
  now: string;
  addInvitee: string;
  bulkImport: string;
  bulkImportHelp: string;
}

export type ProjectType = 'project' | 'exploration';
export type ActivityStatus = 'todo' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

export interface Project {
  id: string;
  title: string;
  description: string;
  type: ProjectType;
  createdAt: string; // ISO String
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: ActivityStatus;
  isMilestone: boolean;
  dependencies: string[]; // activityIds that must finish before this starts
  order?: number;
  parentId?: string;
  attachments?: Attachment[];
  assignee?: string;
  taskId?: string; // Optioneel gekoppelde taak
}

export interface CalendarCategory {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex (e.g. 'indigo', 'rose', 'emerald', 'amber', 'sky', 'fuchsia')
  description?: string;
  ownerId?: string;
}

export interface YearEvent {
  id: string;
  year: number; // e.g. 2026, 2027
  title: string;
  description: string;
  categoryId: string; // references CalendarCategory id
  date: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD or null (e.g. for multi-day periods like school vacations)
  type: 'one_time' | 'periodic';
  recurrence?: 'weekly' | 'biweekly' | 'monthly' | 'none';
  recurrenceEnd?: string | null; // YYYY-MM-DD or null
  isFeestdag?: boolean;
  isSchoolVacation?: boolean;
  ownerId?: string;
  createdAt?: string;
}

// ITPT Servicedesk Interfaces
export interface TicketCategory {
  id: string;
  name: string;
  ownerId?: string;
}

export interface TicketStatus {
  id: string;
  name: string;
  color: string; // 'slate' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet' etc.
  ownerId?: string;
}

export interface TicketHandler {
  id: string;
  name: string;
  email: string;
  ownerId?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorName: string;
  authorEmail: string;
  message: string;
  timestamp: string; // ISO String
  isPrivate: boolean; // True if it should only be visible to handlers (behandelaars)
  attachments?: Attachment[];
  ownerId?: string;
}

export interface Ticket {
  id: string;
  seqId: string; // Format: YYYY-MM-0001
  title: string;
  description: string;
  categoryId: string; // references TicketCategory id
  statusId: string; // references TicketStatus id
  reporterName: string;
  reporterOrg: string;
  reporterEmail: string;
  reporterPhone?: string;
  attachments?: Attachment[];
  assignedHandlers: string[]; // references TicketHandler ids
  resolution?: string; // "uitgevoerde werkzaamheden"
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  ownerId?: string;
}

export interface EmailTemplate {
  id: string;
  type: 'confirmation' | 'status_change' | 'assignment';
  name: string;
  subject: string;
  body: string;
  ownerId?: string;
}

export interface EmailLog {
  id: string;
  ticketId: string;
  ticketSeqId: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string; // ISO String
  ownerId?: string;
}

// Gedeelde Agenda (Shared Calendars) Interfaces
export type CalendarEventStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface SharedCalendar {
  id: string;
  slug: string; // unique URL token / slug
  name: string; // e.g. "Cloud Werkplekken Migratie", "IT Support & Onsite Dienstverlening"
  productService: string; // Product / Dienst name, e.g. "Cloud Werkplek", "Hardware Support", "Netwerk Upgrade"
  description: string;
  color: string; // 'indigo' | 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'cyan' | 'slate'
  defaultHandlers: string[]; // default behandelaren (names/emails)
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  ownerId?: string;
}

export interface SharedCalendarEvent {
  id: string;
  calendarId: string; // references SharedCalendar id or slug
  title: string; // Onderwerp / Titel afspraak
  description: string; // Omschrijving
  productService?: string; // Specifiek product of dienst context
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (e.g. "09:00")
  endDate: string; // YYYY-MM-DD
  endTime?: string; // HH:MM (e.g. "10:30")
  isAllDay: boolean; // Hele dag event
  handlers: string[]; // Behandelaar(en) namen of contactpersonen
  location?: string; // Locatie / Teams link / Kamer
  status: CalendarEventStatus;
  categoryColor?: string; // Tag color
  contactPerson?: string; // Contactpersoon / Klant
  contactEmail?: string; // Email
  contactPhone?: string; // Telefoonnummer
  notes?: string; // Interne notities
  attachments?: Attachment[];
  ownerId?: string;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
}

// --- Notities, Afspraken en Acties (Meeting Notes, Agreements & Action Items) ---
export type MeetingType = 
  | 'stuurgroep'
  | 'bila'
  | 'eenmalig'
  | 'afdelingsoverleg'
  | 'projectteam'
  | 'overig';

export interface MeetingParticipant {
  name: string;
  email: string;
  organization?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  durationMinutes?: number; // default e.g. 60
  meetingType: MeetingType | string;
  projectOrSubject: string; // e.g. "RDNG 3.0", "Cloud Werkplek", "AI Verkenning"
  projectId?: string; // Optional link to Project in 'Projecten en Verkenningen'
  theme?: string; // Optional custom theme for standalone meeting
  location?: string; // e.g. "Teams", "Kamer 1.12"
  participants: MeetingParticipant[];
  agenda?: string; // formatted rich text / HTML / markdown with items, time blocks & embedded images
  agendaStatus?: 'concept' | 'definitief' | 'verzonden';
  agendaUpdatedAt?: string; // ISO string
  notes: string; // formatted text / markdown for minutes/verslag
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  ownerId?: string;
  pollId?: string; // Optional linked Datumprikker ID
  pollTitle?: string; // Optional linked Datumprikker Title
}

export interface AgendaTemplate {
  id: string;
  nameNl: string;
  nameEn: string;
  icon: string;
  category: 'stuurgroep' | 'kenniskring' | 'projectteam' | 'bila' | 'brainstorm' | 'kickoff' | 'retro' | 'algemeen' | 'custom';
  descriptionNl?: string;
  descriptionEn?: string;
  html: string;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingAgreement {
  id: string;
  meetingId: string;
  meetingTitle?: string;
  title: string; // Summary of agreement
  description: string; // Details
  projectOrSubject: string; // Project / Verkenning / Onderwerp
  date: string; // YYYY-MM-DD (Date agreement was made)
  status: 'actief' | 'afgerond' | 'vervallen';
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  ownerId?: string;
}

export type MeetingNoteCategory = 'overlegverslag' | 'notitie' | 'bespreking' | 'aantekening' | 'rondvraag' | 'besluit';

export interface MeetingNote {
  id: string;
  meetingId: string;
  meetingTitle?: string;
  title: string;
  content: string;
  author?: string;
  category?: MeetingNoteCategory;
  date: string; // YYYY-MM-DD
  projectOrSubject?: string;
  tags?: string[];
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  ownerId?: string;
}

export type ActionItemStatus = 'open' | 'in_behandeling' | 'gereed' | 'on_hold';

export interface ActionItemRemark {
  id: string;
  author: string;
  authorEmail?: string;
  text: string;
  date: string; // ISO string or YYYY-MM-DD HH:mm
}

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  meetingTitle?: string;
  createdDate: string; // YYYY-MM-DD, auto-filled with creation date
  title: string;
  description: string;
  assignees: MeetingParticipant[]; // Actiehouder(s) / Behandelaar(s)
  status: ActionItemStatus;
  dueDate: string; // YYYY-MM-DD, Afspraak datum wanneer actiepunt gereed
  remarks: ActionItemRemark[];
  projectOrSubject?: string;
  completedAt?: string | null; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  ownerId?: string;
}

export interface MeetingEmailTemplate {
  id: string;
  type: 'meeting_summary' | 'action_assigned' | 'action_update';
  name: string;
  subject: string;
  body: string;
  ownerId?: string;
}

// --- Vakantie-, Verlof- en Afwezigheidskalender (Vacation & Leave Planner) ---
export type VacationLeaveType = 'vakantie' | 'verlof' | 'compensatie' | 'bijzonder_verlof' | 'opleiding' | 'ziek' | 'overig';
export type VacationLeaveStatus = 'bevestigd' | 'aangevraagd' | 'optie';

export interface VacationCalendarMember {
  id: string; // Member unique ID
  contactId?: string; // Optional link to central address book Contact
  name: string;
  email: string;
  department?: string;
  color?: string; // Badge / avatar color
  yearlyAllowanceDays?: number; // e.g. 25
}

export interface VacationCalendar {
  id: string;
  slug: string; // Unique URL slug/token
  name: string; // e.g. "IT Platform Twente - Kernteam", "Afdeling Software"
  description?: string;
  year: number; // e.g. 2026
  department?: string;
  color?: string;
  members: VacationCalendarMember[];
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  ownerId?: string;
}

export interface VacationEntry {
  id: string;
  calendarId: string;
  memberId: string; // references VacationCalendarMember id
  memberName: string;
  memberEmail?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dates: string[]; // List of YYYY-MM-DD dates in the range
  type: VacationLeaveType; // 'vakantie' | 'verlof' | 'compensatie' | 'ziek' | 'overig'
  status: VacationLeaveStatus; // 'bevestigd' | 'aangevraagd' | 'optie'
  notes?: string;
  daysCount: number; // Number of days
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  ownerId?: string;
}
