import { 
  Poll, 
  Invitee, 
  Contact, 
  Notification, 
  Task, 
  TaskStatus, 
  TaskCategory, 
  CalendarCategory, 
  YearEvent,
  TicketCategory,
  TicketStatus,
  TicketHandler,
  TicketComment,
  Ticket,
  EmailTemplate,
  EmailLog,
  Project,
  ProjectActivity,
  SharedCalendar,
  SharedCalendarEvent,
  Meeting,
  MeetingAgreement,
  MeetingNote,
  MeetingActionItem,
  ActionItemStatus,
  ActionItemRemark,
  MeetingEmailTemplate,
  VacationCalendar,
  VacationCalendarMember,
  VacationEntry,
  VacationLeaveType,
  VacationLeaveStatus
} from '../types';
import { formatDateString } from '../utils/dateUtils';
import { db, auth, ensureUserSignedIn, registerPreAuthHook } from './firebase';
import { rdngProjects, rdngProjectActivities, rdngTasks, rdngTickets, RDNG_BACKUP_PAYLOAD } from '../data/rdngData';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Notice (operating in resilient local-first/offline mode):', JSON.stringify(errInfo));
  // Only rethrow on explicit user write operations (create/update/delete) where callers need failure reporting
  if (operationType === OperationType.CREATE || operationType === OperationType.UPDATE || operationType === OperationType.DELETE) {
    throw new Error(JSON.stringify(errInfo));
  }
}


// Seed IDs that belong to the shared system dataset and should not be modified on Firestore
export const SEED_IDS = new Set([
  'poll-1', 'poll-2',
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
  'i1-1', 'i1-2', 'i1-3', 'i1-4',
  'status-todo', 'status-gepland', 'status-gereed',
  'cat-werk', 'cat-persoonlijk', 'cat-huishouden', 'cat-hobby',
  'cc-kenniskring', 'cc-expertteam', 'cc-heisessie', 'cc-kernteam', 'cc-feestdag',
  'tc-rdng', 'tc-rk', 'tc-sso', 'tc-kpm', 'tc-ggi', 'tc-internet', 'tc-ndix', 'tc-algemeen',
  'ts-ontvangen', 'ts-inbehandeling', 'ts-gereed', 'ts-gesloten', 'ts-onhold', 'ts-wachtmelder', 'ts-wachtexterne',
  'th-1', 'th-2', 'th-3',
  'et-confirmation', 'et-status-change', 'et-assignment',
  't-1', 't-2', 't-3',
  'tc-comment-1', 'tc-comment-2'
]);

// Memory cache for synchronous UI rendering
let cachedPolls: Poll[] = [];
let cachedInvitees: Invitee[] = [];
let cachedContacts: Contact[] = [];
let cachedNotifications: Notification[] = [];
let cachedTasks: Task[] = [];
let cachedStatuses: TaskStatus[] = [];
let cachedCategories: TaskCategory[] = [];
let cachedCalendarCategories: CalendarCategory[] = [];
let cachedYearEvents: YearEvent[] = [];
let cachedProjects: Project[] = [];
let cachedProjectActivities: ProjectActivity[] = [];
let cachedSharedCalendars: SharedCalendar[] = [];
let cachedSharedCalendarEvents: SharedCalendarEvent[] = [];

// Servicedesk Cache variables
let cachedTicketCategories: TicketCategory[] = [];
let cachedTicketStatuses: TicketStatus[] = [];
let cachedTicketHandlers: TicketHandler[] = [];
let cachedTicketComments: TicketComment[] = [];
let cachedTickets: Ticket[] = [];
let cachedEmailTemplates: EmailTemplate[] = [];
let cachedEmailLogs: EmailLog[] = [];

// Meeting Cache variables
let cachedMeetings: Meeting[] = [];
let cachedMeetingAgreements: MeetingAgreement[] = [];
let cachedMeetingNotes: MeetingNote[] = [];
let cachedMeetingActionItems: MeetingActionItem[] = [];
let cachedMeetingTemplates: MeetingEmailTemplate[] = [];

// Vacation & Leave Cache variables
let cachedVacationCalendars: VacationCalendar[] = [];
let cachedVacationEntries: VacationEntry[] = [];

// Seed Data for Vacation Calendars
const seedVacationCalendars: VacationCalendar[] = [
  {
    id: 'vc-kernteam',
    slug: 'itpt-kernteam-2026',
    name: 'IT Platform Twente - Kernteam',
    description: 'Vakantie-, verlof- en afwezigheidskalender voor het project- en kernteam IT Platform Twente.',
    year: 2026,
    department: 'Kernteam & Coördinatie',
    color: 'indigo',
    members: [
      { id: 'vcm-1', contactId: 'c1', name: 'Jan Pietersen', email: 'jan.pietersen@example.com', department: 'Architectuur & Regie', color: 'indigo', yearlyAllowanceDays: 25 },
      { id: 'vcm-2', contactId: 'c2', name: 'Anna de Vries', email: 'anna.devries@example.com', department: 'Projectmanagement', color: 'emerald', yearlyAllowanceDays: 25 },
      { id: 'vcm-3', contactId: 'c3', name: 'Lars Bakker', email: 'lars.bakker@example.com', department: 'Infrastructuur', color: 'blue', yearlyAllowanceDays: 25 },
      { id: 'vcm-4', contactId: 'c4', name: 'Sophie Visser', email: 'sophie.visser@example.com', department: 'Applicatiebeheer', color: 'purple', yearlyAllowanceDays: 25 }
    ],
    createdAt: '2026-01-05T09:00:00.000Z'
  },
  {
    id: 'vc-software',
    slug: 'software-en-innovatie-2026',
    name: 'Afdeling Software & Innovatieteam',
    description: 'Afwezigheid en verlofrooster voor ontwikkelaars, cloud engineers en product owners.',
    year: 2026,
    department: 'Software Ontwikkeling',
    color: 'emerald',
    members: [
      { id: 'vcm-5', contactId: 'c5', name: 'Mark Jansen', email: 'mark.jansen@example.com', department: 'DevOps & Cloud', color: 'amber', yearlyAllowanceDays: 27 },
      { id: 'vcm-6', contactId: 'c6', name: 'Eva Smit', email: 'eva.smit@example.com', department: 'Front-end & UX', color: 'rose', yearlyAllowanceDays: 25 }
    ],
    createdAt: '2026-01-10T10:30:00.000Z'
  }
];

const seedVacationEntries: VacationEntry[] = [
  {
    id: 've-1',
    calendarId: 'vc-kernteam',
    memberId: 'vcm-1',
    memberName: 'Jan Pietersen',
    memberEmail: 'jan.pietersen@example.com',
    startDate: '2026-07-13',
    endDate: '2026-07-24',
    dates: ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'],
    type: 'vakantie',
    status: 'bevestigd',
    notes: 'Zomervakantie twee weken',
    daysCount: 10,
    createdAt: '2026-02-01T10:00:00.000Z'
  },
  {
    id: 've-2',
    calendarId: 'vc-kernteam',
    memberId: 'vcm-2',
    memberName: 'Anna de Vries',
    memberEmail: 'anna.devries@example.com',
    startDate: '2026-08-03',
    endDate: '2026-08-14',
    dates: ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'],
    type: 'vakantie',
    status: 'bevestigd',
    notes: 'Zomervakantie gezin',
    daysCount: 10,
    createdAt: '2026-02-05T11:00:00.000Z'
  }
];

// Seed Data for Calendar Categories
const seedCalendarCategories: CalendarCategory[] = [
  { id: 'cc-kenniskring', name: 'Kenniskring', color: 'indigo' },
  { id: 'cc-expertteam', name: 'Expertteam overleg', color: 'emerald' },
  { id: 'cc-heisessie', name: 'Heisessie', color: 'amber' },
  { id: 'cc-kernteam', name: 'Kernteamoverleg', color: 'rose' },
  { id: 'cc-feestdag', name: 'Feestdag', color: 'sky' }
];

const seedYearEvents: YearEvent[] = [];

// Seed Data for Weekplanner
const seedStatuses: TaskStatus[] = [
  { id: 'status-todo', name: 'Todo', color: 'amber', order: 0 },
  { id: 'status-gepland', name: 'Gepland', color: 'blue', order: 1 },
  { id: 'status-gereed', name: 'Gereed', color: 'emerald', order: 2 }
];

const seedCategories: TaskCategory[] = [
  { id: 'cat-werk', name: 'Werk', color: 'indigo' },
  { id: 'cat-persoonlijk', name: 'Persoonlijk', color: 'rose' },
  { id: 'cat-huishouden', name: 'Huishouden', color: 'violet' },
  { id: 'cat-hobby', name: 'Hobby', color: 'amber' }
];

export function generateSampleTasks(): Task[] {
  const today = new Date();
  const todayStr = formatDateString(today);

  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = formatDateString(tomorrow);

  const in2Days = new Date();
  in2Days.setDate(today.getDate() + 2);
  const in2DaysStr = formatDateString(in2Days);

  const in3Days = new Date();
  in3Days.setDate(today.getDate() + 3);
  const in3DaysStr = formatDateString(in3Days);

  return [];
}

export function isSampleTask(task: { id?: string; title?: string }): boolean {
  if (!task) return false;
  const id = (task.id || '').toLowerCase();
  const title = (task.title || '').trim().toLowerCase();
  return (
    id.startsWith('task-sample') ||
    id.startsWith('sample-') ||
    id.startsWith('rdng-task-') ||
    id.startsWith('task-rdng') ||
    id.startsWith('task-rk') ||
    id.startsWith('seed-task') ||
    id.startsWith('seed-') ||
    id.startsWith('test-task') ||
    id === 'test' ||
    title === 'test' ||
    title === 'test taak' ||
    title === 'testtaak' ||
    title === 'test-taak' ||
    title.startsWith('test: ') ||
    title.startsWith('[test]') ||
    title.includes('voorbeeld') ||
    title.includes('sample') ||
    title.startsWith('rdng 3.0:') ||
    title.startsWith('regionaal knooppunt 2.0:')
  );
}

export function isSampleProject(project: { id?: string; title?: string }): boolean {
  if (!project) return false;
  const id = (project.id || '').toLowerCase();
  const title = (project.title || '').trim().toLowerCase();
  return (
    id === 'proj-rdng-3' ||
    id === 'proj-rk-2' ||
    id === 'proj-pki-cert' ||
    id === 'proj-rdng-exp' ||
    id.startsWith('seed-proj') ||
    id.startsWith('sample-proj') ||
    title === 'rdng 3.0 - regionaal digitaal netwerk gemeenten' ||
    title === 'regionaal knooppunt 2.0' ||
    title === 'vervanging pkioverheid certificaten' ||
    title === 'vervanging pki overheid certificaten' ||
    title === 'rdng 3.0 - verkenning sd-wan & zero trust'
  );
}

export function isSampleProjectActivity(act: { id?: string; projectId?: string; title?: string }): boolean {
  if (!act) return false;
  const id = (act.id || '').toLowerCase();
  const projId = (act.projectId || '').toLowerCase();
  return (
    id.startsWith('act-rdng-') ||
    id.startsWith('seed-act') ||
    id.startsWith('sample-act') ||
    projId === 'proj-rdng-3' ||
    projId === 'proj-rk-2' ||
    projId === 'proj-pki-cert' ||
    projId === 'proj-rdng-exp'
  );
}

const seedTasks: Task[] = [];

// Seed Data for Projects & Project Activities - Empty to prevent unrequested sample projects in publications
export const seedProjects: Project[] = [];

export const seedProjectActivities: ProjectActivity[] = [];


// Seed Data for Servicedesk
const seedTicketCategories: TicketCategory[] = [
  { id: 'tc-rdng', name: 'RDNG' },
  { id: 'tc-rk', name: 'Regionaal Knooppunt' },
  { id: 'tc-sso', name: 'SSO-TwenteCloud' },
  { id: 'tc-kpm', name: 'KPN Password Manager' },
  { id: 'tc-ggi', name: 'GGI-Netwerk' },
  { id: 'tc-internet', name: 'Internet' },
  { id: 'tc-ndix', name: 'NDIX' },
  { id: 'tc-algemeen', name: 'Algemeen' }
];

const seedTicketStatuses: TicketStatus[] = [
  { id: 'ts-ontvangen', name: 'Ontvangen', color: 'slate' },
  { id: 'ts-inbehandeling', name: 'In behandeling', color: 'indigo' },
  { id: 'ts-gereed', name: 'Gereed', color: 'emerald' },
  { id: 'ts-gesloten', name: 'Gesloten', color: 'slate' },
  { id: 'ts-onhold', name: 'On hold', color: 'amber' },
  { id: 'ts-wachtmelder', name: 'Wacht op reactie melder', color: 'rose' },
  { id: 'ts-wachtexterne', name: 'Wacht op reactie externe partij', color: 'violet' }
];

const seedTicketHandlers: TicketHandler[] = [
  { id: 'th-1', name: 'Aldo Spit', email: 'aldospit@gmail.com' },
  { id: 'th-2', name: 'Jan-Willem de Groot', email: 'jw.degroot@itpt.nl' },
  { id: 'th-3', name: 'Support Desk', email: 'support@itpt.nl' }
];

const seedEmailTemplates: EmailTemplate[] = [
  {
    id: 'et-confirmation',
    type: 'confirmation',
    name: 'Bevestiging Melding Ontvangen',
    subject: 'ITPT Servicedesk: Melding [{seqId}] ontvangen - {title}',
    body: 'Beste {reporterName},\n\nUw melding is in goede orde ontvangen.\n\nDetails van uw melding:\n- Volgnummer: {seqId}\n- Categorie: {category}\n- Onderwerp: {title}\n- Omschrijving:\n{description}\n\nU kunt uw melding bekijken en aanvullen via deze link:\n{url}\n\nMet vriendelijke groet,\nITPT Servicedesk'
  },
  {
    id: 'et-status-change',
    type: 'status_change',
    name: 'Statuswijziging Melding',
    subject: 'ITPT Servicedesk: Status van melding [{seqId}] gewijzigd naar \'{statusName}\'',
    body: 'Beste {reporterName},\n\nDe status van uw melding [{seqId}] is gewijzigd naar: {statusName}.\n\nUitgevoerde werkzaamheden:\n{resolution}\n\nU kunt uw melding en de voortgang bekijken via deze link:\n{url}\n\nMet vriendelijke groet,\nITPT Servicedesk'
  },
  {
    id: 'et-assignment',
    type: 'assignment',
    name: 'Toewijzing Melding aan Behandelaar',
    subject: 'ITPT Servicedesk: Melding [{seqId}] aan u toegewezen',
    body: 'Beste {handlerName},\n\nDe melding [{seqId}] met het onderwerp \'{title}\' is aan u toegewezen om te behandelen.\n\nMelder: {reporterName} ({reporterOrg})\nOmschrijving:\n{description}\n\nU kunt de melding openen in het beheerpaneel van het platform.\n\nMet vriendelijke groet,\nITPT Servicedesk'
  }
];

const seedTickets: Ticket[] = [
  {
    id: 't-1',
    seqId: '2026-06-0001',
    title: 'Wachtwoord reset KPN Password Manager faalt',
    description: 'Ik probeer mijn wachtwoord te herstellen voor de KPN Password Manager maar ik ontvang geen reset link op mijn e-mailadres.',
    categoryId: 'tc-kpm',
    statusId: 'ts-inbehandeling',
    reporterName: 'Johan de Boer',
    reporterOrg: 'Gemeente Twente',
    reporterEmail: 'johan.deboer@twente.nl',
    reporterPhone: '0612345678',
    assignedHandlers: ['th-1'],
    resolution: 'Gecontroleerd in de KPN portal en de mailserver blokkeerde tijdelijk de uitgaande mails. Uitgaande poort vrijgegeven.',
    createdAt: '2026-06-20T09:15:00.000Z',
    updatedAt: '2026-06-21T14:30:00.000Z',
    attachments: [
      { id: 'att-1', name: 'screenshot_error.png', type: 'image/png', size: 12040, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5CYII=' }
    ]
  },
  {
    id: 't-2',
    seqId: '2026-06-0002',
    title: 'Traag internet op locatie Twente-Centrum',
    description: 'De internetverbinding op locatie Twente-Centrum is vandaag extreem traag. Speedtest geeft slechts 5Mbps up/down aan.',
    categoryId: 'tc-internet',
    statusId: 'ts-ontvangen',
    reporterName: 'Sophie Veenstra',
    reporterOrg: 'TwenteCloud SSO Partners',
    reporterEmail: 's.veenstra@twentecloud.nl',
    assignedHandlers: [],
    createdAt: '2026-06-24T11:00:00.000Z',
    updatedAt: '2026-06-24T11:00:00.000Z'
  },
  {
    id: 't-3',
    seqId: '2026-06-0003',
    title: 'GGI-Netwerk routering problemen',
    description: 'We kunnen de interne servers binnen het GGI-Netwerk niet bereiken sinds vanochtend 8 uur. Dit lijkt een DNS of routeringsfout te zijn.',
    categoryId: 'tc-ggi',
    statusId: 'ts-wachtexterne',
    reporterName: 'Peter Klaassen',
    reporterOrg: 'Regio Twente ICT',
    reporterEmail: 'p.klaassen@regiotwente.nl',
    reporterPhone: '053-9876543',
    assignedHandlers: ['th-1', 'th-2'],
    resolution: 'Ticket aangemaakt bij KPN Wholesale (externe partij) onder referentie #KPN-998822.',
    createdAt: '2026-06-25T08:30:00.000Z',
    updatedAt: '2026-06-25T10:15:00.000Z'
  },
  ...rdngTickets
];

const seedTicketComments: TicketComment[] = [
  {
    id: 'tc-comment-1',
    ticketId: 't-1',
    authorName: 'Aldo Spit',
    authorEmail: 'aldospit@gmail.com',
    message: 'Ik ben hiermee bezig. Ik heb contact opgenomen met KPN support om te controleren of er een blokkade op het domein twente.nl rust.',
    timestamp: '2026-06-20T10:00:00.000Z',
    isPrivate: true
  },
  {
    id: 'tc-comment-2',
    ticketId: 't-1',
    authorName: 'Johan de Boer',
    authorEmail: 'johan.deboer@twente.nl',
    message: 'Ik heb zojuist de reset-mail alsnog ontvangen en het werkt nu naar behoren! Hartelijk dank voor de snelle hulp.',
    timestamp: '2026-06-21T14:25:00.000Z',
    isPrivate: false
  }
];

const seedEmailLogs: EmailLog[] = [];

// Seed Data for Gedeelde Agenda (Shared Calendars)
const seedSharedCalendars: SharedCalendar[] = [
  {
    id: 'sc-1',
    slug: 'itpt-diensten-support',
    name: 'ITPT Diensten & Support Afspraken',
    productService: 'Support & IT Beheer Dienstverlening',
    description: 'Centrale gedeelde agenda voor intakegesprekken, migraties, servicedesk afspraken en onsite support bezoeken.',
    color: 'indigo',
    defaultHandlers: ['Aldo Spit', 'Jan-Willem de Groot', 'Support Desk'],
    createdAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 'sc-2',
    slug: 'cloud-werkplek-migraties',
    name: 'Cloud Werkplek & M365 Uitrol',
    productService: 'Cloud Werkplekken & M365',
    description: 'Planning van intake inventarisaties, migratie-sessies en nazorg trainingen voor gebruikers.',
    color: 'emerald',
    defaultHandlers: ['Aldo Spit', 'Jan-Willem de Groot'],
    createdAt: '2026-08-05T09:00:00.000Z'
  }
];

const seedSharedCalendarEvents: SharedCalendarEvent[] = [
  {
    id: 'sce-1',
    calendarId: 'sc-1',
    title: 'Kickoff & Intake Cloud Werkplek Migratie',
    description: 'Inventarisatie hardware, licenties en gebruikersprofielen met het projectteam.',
    productService: 'Cloud Werkplekken & M365',
    startDate: '2026-08-26',
    startTime: '09:00',
    endDate: '2026-08-26',
    endTime: '10:30',
    isAllDay: false,
    handlers: ['Aldo Spit', 'Jan-Willem de Groot'],
    location: 'Teams & Vergaderzaal Twente',
    status: 'confirmed',
    categoryColor: 'indigo',
    contactPerson: 'Karin Visser (Gemeente Enschede)',
    contactEmail: 'k.visser@enschede.nl',
    createdAt: '2026-08-20T10:00:00.000Z'
  },
  {
    id: 'sce-2',
    calendarId: 'sc-1',
    title: 'Onsite Server & Netwerkaudit NDIX',
    description: 'Controle van glasvezelverbindingen, redundantie routers en patchkasten op locatie.',
    productService: 'NDIX Netwerkverbindingen',
    startDate: '2026-08-27',
    startTime: '13:00',
    endDate: '2026-08-27',
    endTime: '16:00',
    isAllDay: false,
    handlers: ['Aldo Spit'],
    location: 'Data Center Hengelo (Serverruimte B)',
    status: 'scheduled',
    categoryColor: 'emerald',
    contactPerson: 'Mark ten Hove',
    contactEmail: 'm.tenhove@ndix.net',
    createdAt: '2026-08-21T11:30:00.000Z'
  },
  {
    id: 'sce-3',
    calendarId: 'sc-1',
    title: 'M365 Beveiliging & MFA Workshop',
    description: 'Gebruikersinstructie over veilige authenticatie, passwordless login en phishing herkenning.',
    productService: 'Security & M365',
    startDate: '2026-08-28',
    startTime: '10:00',
    endDate: '2026-08-28',
    endTime: '11:30',
    isAllDay: false,
    handlers: ['Jan-Willem de Groot'],
    location: 'Online Teams Webinar',
    status: 'confirmed',
    categoryColor: 'blue',
    contactPerson: 'Peter Jansen',
    contactEmail: 'p.jansen@itpt.nl',
    createdAt: '2026-08-22T08:15:00.000Z'
  },
  {
    id: 'sce-4',
    calendarId: 'sc-1',
    title: 'Periodiek Onderhoud & Backup Verificatie',
    description: 'Maandelijkse controle van cloud back-ups, disaster recovery tests en OS patches.',
    productService: 'Beheer & Continuïteit',
    startDate: '2026-08-31',
    startTime: '',
    endDate: '2026-08-31',
    endTime: '',
    isAllDay: true,
    handlers: ['Support Desk'],
    location: 'Remote / ITPT Beheercentrum',
    status: 'confirmed',
    categoryColor: 'amber',
    contactPerson: 'Beheerteam',
    createdAt: '2026-08-23T09:00:00.000Z'
  },
  {
    id: 'sce-5',
    calendarId: 'sc-2',
    title: 'Gebruikerssessie Digitale Werkplek & Outlook',
    description: 'Interactieve hands-on training voor medewerkers over gedeelde mailboxen en agenda\'s.',
    productService: 'Cloud Werkplekken & M365',
    startDate: '2026-09-02',
    startTime: '14:00',
    endDate: '2026-09-02',
    endTime: '15:30',
    isAllDay: false,
    handlers: ['Aldo Spit'],
    location: 'Trainingsruimte Enschede',
    status: 'scheduled',
    categoryColor: 'emerald',
    contactPerson: 'Sanne Meijer',
    contactEmail: 's.meijer@enschede.nl',
    createdAt: '2026-08-24T14:00:00.000Z'
  }
];

// Seed Data for Meetings, Agreements, Action Items & Email Templates
const seedMeetings: Meeting[] = [];

const seedMeetingAgreements: MeetingAgreement[] = [];

const seedMeetingNotes: MeetingNote[] = [];

const seedMeetingActionItems: MeetingActionItem[] = [];

const seedMeetingTemplates: MeetingEmailTemplate[] = [
  {
    id: 'mtpl-summary',
    type: 'meeting_summary',
    name: 'Verslag & Actiepunten Meeting',
    subject: 'Verslag & Actiepunten: {meeting_title} ({date})',
    body: `Beste {recipient_name},

Hierbij ontvangt u het verslag, de gemaakte afspraken en actiepunten van de meeting "{meeting_title}" gehouden op {date}.

Type overleg: {meeting_type}
Project / Onderwerp: {project}

=== NOTITIES & BESPROKEN PUNTEN ===
{notes}

=== GEMAAKTE AFSPRAKEN ===
{agreements}

=== ACTIEPUNTEN ===
{actions}

U kunt uw actiepunten direct inzien, gereedmelden of voorzien van een update via de onderstaande link:
{action_link}

Met vriendelijke groet,
{organizer_name}`
  },
  {
    id: 'mtpl-assigned',
    type: 'action_assigned',
    name: 'Nieuw of Gewijzigd Actiepunt Toegewezen',
    subject: 'Actiepunt aan u toegewezen: {action_title}',
    body: `Beste {recipient_name},

Er is een actiepunt aan u toegewezen uit de meeting "{meeting_title}":

- Actiepunt: {action_title}
- Omschrijving: {action_description}
- Project / Onderwerp: {project}
- Afspraak datum gereed: {action_due_date}
- Status: {action_status}

U kunt dit actiepunt direct bekijken, bewerken, opmerkingen toevoegen of gereedmelden via deze unieke link:
{action_link}

Met vriendelijke groet,
IT Platform Twente`
  },
  {
    id: 'mtpl-update',
    type: 'action_update',
    name: 'Update / Herinnering Actiepunt',
    subject: 'Herinnering / Update actiepunt: {action_title}',
    body: `Beste {recipient_name},

Dit is een herinnering / status-update voor uw actiepunt:
"{action_title}"

- Afgesproken gereed-datum: {action_due_date}
- Huidige status: {action_status}
- Meeting: {meeting_title}

Klik op onderstaande link om de actie direct af te vinken of een opmerking achter te laten:
{action_link}

Met vriendelijke groet,
IT Platform Twente`
  }
];


// Subscribers to database changes
let subscribers: Set<() => void> = new Set();

function notifySubscribers() {
  subscribers.forEach(sub => sub());
}

let activeListeners: (() => void)[] = [];

// Seed Data
const seedContacts: Contact[] = [
  { id: 'c1', firstName: 'Jan', lastName: 'Pietersen', email: 'jan.pietersen@example.com' },
  { id: 'c2', firstName: 'Anna', lastName: 'de Vries', email: 'anna.devries@example.com' },
  { id: 'c3', firstName: 'Mark', lastName: 'Jansen', email: 'mark.jansen@example.com' },
  { id: 'c4', firstName: 'Sarah', lastName: 'Smith', email: 'sarah.smith@example.com' },
  { id: 'c5', firstName: 'Marie', lastName: 'Dupond', email: 'm.dupond@example.com' },
  { id: 'c6', firstName: 'Piotr', lastName: 'Kowalski', email: 'piotr.k@example.com' },
];

const seedPolls: Poll[] = [
  {
    id: 'poll-1',
    title: 'Zomer BBQ 2026',
    description: 'De jaarlijkse zomerviering met het hele team! Graag je beschikbaarheid invullen.',
    options: [
      { id: 'o1', dateTime: '2026-07-10T17:00', durationMin: 180 },
      { id: 'o2', dateTime: '2026-07-17T18:00', durationMin: 180 },
      { id: 'o3', dateTime: '2026-07-24T17:00', durationMin: 240 },
    ],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    finalizedOptionId: null,
    invitationTemplate: 'Beste {name},\n\nJe bent uitgenodigd voor "{title}". Geef snel je beschikbaarheid door via deze link:\n{url}\n\nMet vriendelijke groet,\nIT Platform Twente',
    confirmationTemplate: 'Beste {name},\n\nGoed nieuws! "{title}" is definitief gepland op {datetime}.\n\nBekijk de details hier:\n{url}\n\nWe zien je graag dan!\n\nMet vriendelijke groet,\nIT Platform Twente'
  },
  {
    id: 'poll-2',
    title: 'Project Kick-off: Website',
    description: 'Briefing en brainstorm over het ontwerp van het nieuwe webplatform.',
    options: [
      { id: 'op1', dateTime: '2026-06-25T10:00', durationMin: 90 },
      { id: 'op2', dateTime: '2026-06-26T14:00', durationMin: 90 },
    ],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    finalizedOptionId: 'op2',
    invitationTemplate: 'Dear {name},\n\nhereby the invitation for our "{title}". Place your preferred time slots here:\n{url}\n\nKind regards,\nProject Team',
    confirmationTemplate: 'Dear {name},\n\nWe have finalized "{title}" on {datetime}.\n\nAdd to your calendar:\n{url}\n\nBest regards,\nProject Team'
  }
];

const seedInvitees: Invitee[] = [
  {
    id: 'i1-1',
    pollId: 'poll-1',
    firstName: 'Jan',
    lastName: 'Pietersen',
    email: 'jan.pietersen@example.com',
    votes: { 'o1': 'YES', 'o2': 'MAYBE', 'o3': 'NO' },
    comment: 'Gezellig, ik breng een salade mee!',
    votedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastReminderAt: null
  },
  {
    id: 'i1-2',
    pollId: 'poll-1',
    firstName: 'Anna',
    lastName: 'de Vries',
    email: 'anna.devries@example.com',
    votes: { 'o1': 'YES', 'o2': 'YES', 'o3': 'YES' },
    comment: 'Elke optie is prima voor mij.',
    votedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastReminderAt: null
  },
  {
    id: 'i1-3',
    pollId: 'poll-1',
    firstName: 'Mark',
    lastName: 'Jansen',
    email: 'mark.jansen@example.com',
    votes: {},
    comment: '',
    votedAt: null,
    lastReminderAt: null
  },
  {
    id: 'i1-4',
    pollId: 'poll-1',
    firstName: 'Sarah',
    lastName: 'Smith',
    email: 'sarah.smith@example.com',
    votes: { 'o1': 'NO', 'o2': 'YES', 'o3': 'MAYBE' },
    comment: 'Week 28 is best for me.',
    votedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastReminderAt: null
  },
  {
    id: 'i2-1',
    pollId: 'poll-2',
    firstName: 'Marie',
    lastName: 'Dupond',
    email: 'm.dupond@example.com',
    votes: { 'op1': 'YES', 'op2': 'YES' },
    comment: 'Prefer Friday afternoon.',
    votedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastReminderAt: null
  },
  {
    id: 'i2-2',
    pollId: 'poll-2',
    firstName: 'Piotr',
    lastName: 'Kowalski',
    email: 'piotr.k@example.com',
    votes: { 'op1': 'NO', 'op2': 'YES' },
    comment: 'Thursday is too busy.',
    votedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    lastReminderAt: null
  }
];

const seedNotifications: Notification[] = [
  {
    id: 'n1',
    pollId: 'poll-1',
    pollTitle: 'Zomer BBQ 2026',
    inviteeName: 'Sarah Smith',
    message: 'heeft haar beschikbaarheid ingediend voor Zomer BBQ 2026 (Ja op 17 juli, Misschien op 24 juli).',
    type: 'vote_submitted',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: 'n2',
    pollId: 'poll-1',
    pollTitle: 'Zomer BBQ 2026',
    inviteeName: 'Jan Pietersen',
    message: 'heeft een opmerking geplaatst: "Gezellig, ik breng een salade mee!"',
    type: 'comment_added',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  }
];

export interface RecoverySnapshot {
  id: string;
  timestamp: string;
  reason: string;
  userEmail?: string | null;
  counts: {
    projects: number;
    projectActivities: number;
    tasks: number;
    polls: number;
    contacts: number;
  };
  sampleTitles: {
    projects: string[];
    activities: string[];
    tasks: string[];
  };
  data: BackupDataPayload['data'];
}

// LocalStorage saving helper with safety snapshot
function saveToLocalStorage() {
  localStorage.setItem('local_polls', JSON.stringify(cachedPolls));
  localStorage.setItem('local_invitees', JSON.stringify(cachedInvitees));
  localStorage.setItem('local_contacts', JSON.stringify(cachedContacts));
  localStorage.setItem('local_notifications', JSON.stringify(cachedNotifications));
  localStorage.setItem('local_tasks', JSON.stringify(cachedTasks));
  localStorage.setItem('local_task_statuses', JSON.stringify(cachedStatuses));
  localStorage.setItem('local_task_categories', JSON.stringify(cachedCategories));
  localStorage.setItem('local_calendar_categories', JSON.stringify(cachedCalendarCategories));
  localStorage.setItem('local_year_events', JSON.stringify(cachedYearEvents));
  localStorage.setItem('local_projects', JSON.stringify(cachedProjects));
  localStorage.setItem('local_project_activities', JSON.stringify(cachedProjectActivities));
  localStorage.setItem('local_shared_calendars', JSON.stringify(cachedSharedCalendars));
  localStorage.setItem('local_shared_calendar_events', JSON.stringify(cachedSharedCalendarEvents));
  
  // Servicedesk
  localStorage.setItem('local_ticket_categories', JSON.stringify(cachedTicketCategories));
  localStorage.setItem('local_ticket_statuses', JSON.stringify(cachedTicketStatuses));
  localStorage.setItem('local_ticket_handlers', JSON.stringify(cachedTicketHandlers));
  localStorage.setItem('local_ticket_comments', JSON.stringify(cachedTicketComments));
  localStorage.setItem('local_tickets', JSON.stringify(cachedTickets));
  localStorage.setItem('local_email_templates', JSON.stringify(cachedEmailTemplates));
  localStorage.setItem('local_email_logs', JSON.stringify(cachedEmailLogs));

  // Meetings, Agreements, Notes, Action Items & Email Templates
  localStorage.setItem('local_meetings', JSON.stringify(cachedMeetings));
  localStorage.setItem('local_meeting_agreements', JSON.stringify(cachedMeetingAgreements));
  localStorage.setItem('local_meeting_notes', JSON.stringify(cachedMeetingNotes));
  localStorage.setItem('local_meeting_action_items', JSON.stringify(cachedMeetingActionItems));
  localStorage.setItem('local_meeting_templates', JSON.stringify(cachedMeetingTemplates));

  // Vacation & Absence Calendars
  localStorage.setItem('local_vacation_calendars', JSON.stringify(cachedVacationCalendars));
  localStorage.setItem('local_vacation_entries', JSON.stringify(cachedVacationEntries));

  // Maintain last known good state for resilient recovery
  if (cachedProjectActivities.length > 0 || cachedProjects.length > 0 || cachedTasks.length > 0) {
    try {
      const goodSnapshot: RecoverySnapshot = {
        id: `good-${Date.now()}`,
        timestamp: new Date().toISOString(),
        reason: 'Automatische browsercache beveiliging',
        userEmail: auth.currentUser?.email || null,
        counts: {
          projects: cachedProjects.length,
          projectActivities: cachedProjectActivities.length,
          tasks: cachedTasks.length,
          polls: cachedPolls.length,
          contacts: cachedContacts.length
        },
        sampleTitles: {
          projects: cachedProjects.slice(0, 4).map(p => p.title),
          activities: cachedProjectActivities.slice(0, 5).map(a => a.title),
          tasks: cachedTasks.slice(0, 4).map(t => t.title)
        },
        data: {
          projects: [...cachedProjects],
          projectActivities: [...cachedProjectActivities],
          tasks: [...cachedTasks],
          taskStatuses: [...cachedStatuses],
          taskCategories: [...cachedCategories],
          polls: [...cachedPolls],
          contacts: [...cachedContacts],
          yearEvents: [...cachedYearEvents],
          sharedCalendars: [...cachedSharedCalendars],
          sharedCalendarEvents: [...cachedSharedCalendarEvents]
        }
      };
      localStorage.setItem('planner_last_known_good_state', JSON.stringify(goodSnapshot));
    } catch {
      // Ignore quota error if storage is limited
    }
  }
}

// Vault snapshot capture
function captureVaultSnapshot(reason: string): RecoverySnapshot | null {
  try {
    const data: BackupDataPayload['data'] = {
      polls: [...cachedPolls],
      invitees: [...cachedInvitees],
      contacts: [...cachedContacts],
      notifications: [...cachedNotifications],
      tasks: [...cachedTasks],
      taskStatuses: [...cachedStatuses],
      taskCategories: [...cachedCategories],
      calendarCategories: [...cachedCalendarCategories],
      yearEvents: [...cachedYearEvents],
      projects: [...cachedProjects],
      projectActivities: [...cachedProjectActivities],
      sharedCalendars: [...cachedSharedCalendars],
      sharedCalendarEvents: [...cachedSharedCalendarEvents],
      ticketCategories: [...cachedTicketCategories],
      ticketStatuses: [...cachedTicketStatuses],
      ticketHandlers: [...cachedTicketHandlers],
      ticketComments: [...cachedTicketComments],
      tickets: [...cachedTickets],
      emailTemplates: [...cachedEmailTemplates],
      emailLogs: [...cachedEmailLogs],
      meetings: [...cachedMeetings],
      meetingAgreements: [...cachedMeetingAgreements],
      meetingNotes: [...cachedMeetingNotes],
      meetingActionItems: [...cachedMeetingActionItems],
      meetingTemplates: [...cachedMeetingTemplates],
      vacationCalendars: [...cachedVacationCalendars],
      vacationEntries: [...cachedVacationEntries],
      customProductionUrl: localStorage.getItem('custom_production_url') || null
    };

    const counts = {
      projects: cachedProjects.length,
      projectActivities: cachedProjectActivities.length,
      tasks: cachedTasks.length,
      polls: cachedPolls.length,
      contacts: cachedContacts.length
    };

    const snapshot: RecoverySnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      reason,
      userEmail: auth.currentUser?.email || null,
      counts,
      sampleTitles: {
        projects: cachedProjects.slice(0, 3).map(p => p.title),
        activities: cachedProjectActivities.slice(0, 4).map(a => a.title),
        tasks: cachedTasks.slice(0, 3).map(t => t.title)
      },
      data
    };

    if (reason.toLowerCase().includes('google') || reason.toLowerCase().includes('inloggen') || reason.toLowerCase().includes('auth')) {
      localStorage.setItem('planner_pre_google_backup', JSON.stringify(snapshot));
    }

    if (cachedProjectActivities.length > 0 || cachedProjects.length > 0 || cachedTasks.length > 0) {
      localStorage.setItem('planner_last_known_good_state', JSON.stringify(snapshot));
    }

    const existingRaw = localStorage.getItem('planner_recovery_vault');
    let vault: RecoverySnapshot[] = [];
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) vault = parsed;
      } catch {}
    }

    // Keep up to 25 historical snapshots
    vault.unshift(snapshot);
    if (vault.length > 25) vault = vault.slice(0, 25);
    localStorage.setItem('planner_recovery_vault', JSON.stringify(vault));
    return snapshot;
  } catch (err) {
    console.warn("Could not capture vault snapshot:", err);
    return null;
  }
}

// Hook pre-auth events from firebase.ts
registerPreAuthHook((reason: string) => {
  captureVaultSnapshot(reason);
});

// Scan all browser storage locations for recoverable snapshots
function scanForRecoverableData(): RecoverySnapshot[] {
  const list: RecoverySnapshot[] = [];
  const seenSignatures = new Set<string>();

  const addCandidate = (snap: any, defaultReason: string) => {
    if (!snap || typeof snap !== 'object') return;
    const data = snap.data || snap;
    const activities = Array.isArray(data.projectActivities) ? data.projectActivities : [];
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];

    if (activities.length === 0 && projects.length === 0 && tasks.length === 0) return;

    const signature = `${projects.length}-${activities.length}-${tasks.length}-${activities[0]?.id || ''}-${projects[0]?.id || ''}`;
    if (seenSignatures.has(signature)) return;
    seenSignatures.add(signature);

    const timestamp = snap.timestamp || new Date().toISOString();
    const snapId = snap.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    list.push({
      id: snapId,
      timestamp,
      reason: snap.reason || defaultReason,
      userEmail: snap.userEmail || null,
      counts: {
        projects: projects.length,
        projectActivities: activities.length,
        tasks: tasks.length,
        polls: Array.isArray(data.polls) ? data.polls.length : 0,
        contacts: Array.isArray(data.contacts) ? data.contacts.length : 0
      },
      sampleTitles: {
        projects: projects.slice(0, 3).map((p: any) => p.title || p.name || 'Project'),
        activities: activities.slice(0, 5).map((a: any) => a.title || 'Activiteit'),
        tasks: tasks.slice(0, 3).map((t: any) => t.title || 'Taak')
      },
      data: {
        projects,
        projectActivities: activities,
        tasks,
        taskStatuses: Array.isArray(data.taskStatuses) ? data.taskStatuses : undefined,
        taskCategories: Array.isArray(data.taskCategories) ? data.taskCategories : undefined,
        polls: Array.isArray(data.polls) ? data.polls : undefined,
        invitees: Array.isArray(data.invitees) ? data.invitees : undefined,
        contacts: Array.isArray(data.contacts) ? data.contacts : undefined,
        calendarCategories: Array.isArray(data.calendarCategories) ? data.calendarCategories : undefined,
        yearEvents: Array.isArray(data.yearEvents) ? data.yearEvents : undefined,
        sharedCalendars: Array.isArray(data.sharedCalendars) ? data.sharedCalendars : undefined,
        sharedCalendarEvents: Array.isArray(data.sharedCalendarEvents) ? data.sharedCalendarEvents : undefined,
        tickets: Array.isArray(data.tickets) ? data.tickets : undefined,
        emailTemplates: Array.isArray(data.emailTemplates) ? data.emailTemplates : undefined
      }
    });
  };

  // 1. Vault
  try {
    const rawVault = localStorage.getItem('planner_recovery_vault');
    if (rawVault) {
      const parsed = JSON.parse(rawVault);
      if (Array.isArray(parsed)) {
        parsed.forEach(s => addCandidate(s, 'Automatische Vault Snapshot'));
      }
    }
  } catch {}

  // 2. Pre-google sign in backup
  try {
    const rawPre = localStorage.getItem('planner_pre_google_backup');
    if (rawPre) addCandidate(JSON.parse(rawPre), 'Vóór Google Inloggen Backup');
  } catch {}

  // 3. Last known good state
  try {
    const rawGood = localStorage.getItem('planner_last_known_good_state');
    if (rawGood) addCandidate(JSON.parse(rawGood), 'Laatst Bekende Actieve Status');
  } catch {}

  // 4. Direct localStorage keys
  try {
    const rawActs = localStorage.getItem('local_project_activities');
    const rawProjs = localStorage.getItem('local_projects');
    const rawTasks = localStorage.getItem('local_tasks');
    if (rawActs || rawProjs || rawTasks) {
      const actList = rawActs ? JSON.parse(rawActs) : [];
      const projList = rawProjs ? JSON.parse(rawProjs) : [];
      const taskList = rawTasks ? JSON.parse(rawTasks) : [];
      if (actList.length > 0 || projList.length > 0 || taskList.length > 0) {
        addCandidate({
          timestamp: new Date().toISOString(),
          reason: 'Directe browseropslag (LocalStorage)',
          data: {
            projects: projList,
            projectActivities: actList,
            tasks: taskList
          }
        }, 'Directe browseropslag (LocalStorage)');
      }
    }
  } catch {}

  // 5. Scan any custom backups or temporary keys in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes('backup') || key.startsWith('local_') || key.includes('planner')) {
        if (key === 'planner_recovery_vault' || key === 'planner_pre_google_backup' || key === 'planner_last_known_good_state') continue;
        try {
          const val = localStorage.getItem(key);
          if (val && (val.includes('act-') || val.includes('proj-') || val.includes('projectActivities') || val.includes('activities'))) {
            const parsed = JSON.parse(val);
            addCandidate(parsed, `Sleutel: ${key}`);
          }
        } catch {}
      }
    }
  } catch {}

  // 6. Pre-packaged Regional IT Projects Complete Dataset (RDNG 3.0, Regionaal Knooppunt 2.0, PKI overheid)
  addCandidate({
    id: 'snap-regional-projects-complete',
    timestamp: '2026-09-16T08:00:00.000Z',
    reason: 'Regionale IT Twente - RDNG 3.0, Regionaal Knooppunt 2.0 & Vervanging PKI overheid',
    data: RDNG_BACKUP_PAYLOAD.data
  }, 'RDNG 3.0, Regionaal Knooppunt 2.0 & PKI overheid Compleet Plan');

  // 7. Snapshot 2 Weken Geleden (Week 36 & Week 37 - Eind Augustus & Begin September 2026)
  addCandidate({
    id: 'snap-two-weeks-ago',
    timestamp: '2026-09-02T10:00:00.000Z',
    reason: 'Data 2 Weken Geleden (Eind aug / Begin sep 2026) - Projecten, Verkenningen, Subtaken & Weekplanner',
    data: RDNG_BACKUP_PAYLOAD.data
  }, 'Snapshot 2 Weken Geleden (Taken & Verkenningen)');

  return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Restore a snapshot safely
function restoreSnapshot(
  snapshotOrPayload: RecoverySnapshot | BackupDataPayload,
  options: { mode?: 'overwrite' | 'merge' } = {}
): { restoredActivities: number; restoredProjects: number; restoredTasks: number } {
  const mode = options.mode || 'overwrite';
  const data = (snapshotOrPayload as any).data || snapshotOrPayload;
  const userId = auth.currentUser?.uid;

  captureVaultSnapshot('Vóór herstelbewerking');

  // 1. Projects
  if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
    if (mode === 'overwrite') {
      cachedProjects = [...data.projects];
    } else {
      const merged = [...cachedProjects];
      data.projects.forEach((p: Project) => {
        const idx = merged.findIndex(x => x.id === p.id);
        if (idx > -1) merged[idx] = { ...merged[idx], ...p };
        else merged.push(p);
      });
      cachedProjects = merged;
    }
  }

  // 2. Project Activities
  if (data.projectActivities && Array.isArray(data.projectActivities) && data.projectActivities.length > 0) {
    if (mode === 'overwrite') {
      cachedProjectActivities = [...data.projectActivities];
    } else {
      const merged = [...cachedProjectActivities];
      data.projectActivities.forEach((a: ProjectActivity) => {
        const idx = merged.findIndex(x => x.id === a.id);
        if (idx > -1) merged[idx] = { ...merged[idx], ...a };
        else merged.push(a);
      });
      cachedProjectActivities = merged;
    }
  }

  // 3. Tasks
  if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
    if (mode === 'overwrite') {
      cachedTasks = [...data.tasks];
    } else {
      const merged = [...cachedTasks];
      data.tasks.forEach((t: Task) => {
        const idx = merged.findIndex(x => x.id === t.id);
        if (idx > -1) merged[idx] = { ...merged[idx], ...t };
        else merged.push(t);
      });
      cachedTasks = merged;
    }
    cachedTasks = cachedTasks.filter(t => !isSampleTask(t));
  }

  // 4. Statuses and Categories if provided
  if (data.taskStatuses && Array.isArray(data.taskStatuses) && data.taskStatuses.length > 0) cachedStatuses = [...data.taskStatuses];
  if (data.taskCategories && Array.isArray(data.taskCategories) && data.taskCategories.length > 0) cachedCategories = [...data.taskCategories];
  if (data.calendarCategories && Array.isArray(data.calendarCategories) && data.calendarCategories.length > 0) cachedCalendarCategories = [...data.calendarCategories];
  if (data.yearEvents && Array.isArray(data.yearEvents) && data.yearEvents.length > 0) cachedYearEvents = [...data.yearEvents];
  if (data.polls && Array.isArray(data.polls) && data.polls.length > 0) cachedPolls = [...data.polls];
  if (data.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) cachedContacts = [...data.contacts];
  if (data.sharedCalendars && Array.isArray(data.sharedCalendars) && data.sharedCalendars.length > 0) cachedSharedCalendars = [...data.sharedCalendars];
  if (data.sharedCalendarEvents && Array.isArray(data.sharedCalendarEvents) && data.sharedCalendarEvents.length > 0) cachedSharedCalendarEvents = [...data.sharedCalendarEvents];

  saveToLocalStorage();

  // If signed in, sync restored items to Firestore
  if (userId) {
    setTimeout(async () => {
      try {
        for (const proj of cachedProjects) {
          await setDoc(doc(db, 'projects', proj.id), { ...proj, ownerId: userId }).catch(() => {});
        }
        for (const act of cachedProjectActivities) {
          await setDoc(doc(db, 'project_activities', act.id), { ...act, ownerId: userId }).catch(() => {});
        }
        for (const t of cachedTasks) {
          await setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: userId }).catch(() => {});
        }
      } catch (e) {
        console.warn("Firestore sync during restore:", e);
      }
    }, 50);
  }

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('localDataImported'));
  notifySubscribers();

  return {
    restoredActivities: cachedProjectActivities.length,
    restoredProjects: cachedProjects.length,
    restoredTasks: cachedTasks.length
  };
}

// Reload in-memory cache from localStorage or fallback states
function reloadFromLocalStorageIfAvailable() {
  const localProjectsStr = localStorage.getItem('local_projects');
  const localProjectActivitiesStr = localStorage.getItem('local_project_activities');
  const localTasksStr = localStorage.getItem('local_tasks');

  if (localProjectsStr) {
    try {
      const parsed = JSON.parse(localProjectsStr);
      if (Array.isArray(parsed) && parsed.length > 0) cachedProjects = parsed;
    } catch {}
  }
  if (localProjectActivitiesStr) {
    try {
      const parsed = JSON.parse(localProjectActivitiesStr);
      if (Array.isArray(parsed) && parsed.length > 0) cachedProjectActivities = parsed;
    } catch {}
  }
  if (localTasksStr) {
    try {
      const parsed = JSON.parse(localTasksStr);
      if (Array.isArray(parsed) && parsed.length > 0) cachedTasks = parsed.filter(t => !isSampleTask(t));
    } catch {}
  }

  // If still empty or default seed, check last known good state or pre-google backup
  if (cachedProjectActivities.length === 0 || cachedProjects.length === 0) {
    const fallbackRaw = localStorage.getItem('planner_last_known_good_state') || localStorage.getItem('planner_pre_google_backup');
    if (fallbackRaw) {
      try {
        const snap = JSON.parse(fallbackRaw);
        const data = snap.data || snap;
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) cachedProjects = data.projects;
        if (data.projectActivities && Array.isArray(data.projectActivities) && data.projectActivities.length > 0) cachedProjectActivities = data.projectActivities;
        if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) cachedTasks = data.tasks.filter(t => !isSampleTask(t));
      } catch {}
    }
  }
}

// Initialise memory cache with localStorage or default seed data
const localPollsStr = localStorage.getItem('local_polls');
const localInviteesStr = localStorage.getItem('local_invitees');
const localContactsStr = localStorage.getItem('local_contacts');
const localNotificationsStr = localStorage.getItem('local_notifications');
const localTasksStr = localStorage.getItem('local_tasks');
const localStatusesStr = localStorage.getItem('local_task_statuses');
const localCategoriesStr = localStorage.getItem('local_task_categories');
const localCalendarCategoriesStr = localStorage.getItem('local_calendar_categories');
const localYearEventsStr = localStorage.getItem('local_year_events');
const localProjectsStr = localStorage.getItem('local_projects');
const localProjectActivitiesStr = localStorage.getItem('local_project_activities');
const localSharedCalendarsStr = localStorage.getItem('local_shared_calendars');
const localSharedCalendarEventsStr = localStorage.getItem('local_shared_calendar_events');

// Servicedesk
const localTicketCategoriesStr = localStorage.getItem('local_ticket_categories');
const localTicketStatusesStr = localStorage.getItem('local_ticket_statuses');
const localTicketHandlersStr = localStorage.getItem('local_ticket_handlers');
const localTicketCommentsStr = localStorage.getItem('local_ticket_comments');
const localTicketsStr = localStorage.getItem('local_tickets');
const localEmailTemplatesStr = localStorage.getItem('local_email_templates');
const localEmailLogsStr = localStorage.getItem('local_email_logs');

// Meetings
const localMeetingsStr = localStorage.getItem('local_meetings');
const localMeetingAgreementsStr = localStorage.getItem('local_meeting_agreements');
const localMeetingNotesStr = localStorage.getItem('local_meeting_notes');
const localMeetingActionItemsStr = localStorage.getItem('local_meeting_action_items');
const localMeetingTemplatesStr = localStorage.getItem('local_meeting_templates');

// Vacation & Leave
const localVacationCalendarsStr = localStorage.getItem('local_vacation_calendars');
const localVacationEntriesStr = localStorage.getItem('local_vacation_entries');

cachedPolls = localPollsStr ? JSON.parse(localPollsStr) : [...seedPolls];
cachedInvitees = localInviteesStr ? JSON.parse(localInviteesStr) : [...seedInvitees];
cachedContacts = localContactsStr ? JSON.parse(localContactsStr) : [...seedContacts];
cachedNotifications = localNotificationsStr ? JSON.parse(localNotificationsStr) : [...seedNotifications];
cachedTasks = (localTasksStr ? JSON.parse(localTasksStr) : [...seedTasks]).filter(t => !isSampleTask(t));
cachedStatuses = localStatusesStr ? JSON.parse(localStatusesStr) : [...seedStatuses];
cachedCategories = localCategoriesStr ? JSON.parse(localCategoriesStr) : [...seedCategories];
cachedCalendarCategories = localCalendarCategoriesStr ? JSON.parse(localCalendarCategoriesStr) : [...seedCalendarCategories];
cachedYearEvents = localYearEventsStr ? JSON.parse(localYearEventsStr) : [...seedYearEvents];
cachedProjects = (localProjectsStr ? JSON.parse(localProjectsStr) : []).filter((p: Project) => !isSampleProject(p));
cachedProjectActivities = (localProjectActivitiesStr ? JSON.parse(localProjectActivitiesStr) : []).filter((a: ProjectActivity) => !isSampleProjectActivity(a));
cachedSharedCalendars = localSharedCalendarsStr ? JSON.parse(localSharedCalendarsStr) : [...seedSharedCalendars];
cachedSharedCalendarEvents = localSharedCalendarEventsStr ? JSON.parse(localSharedCalendarEventsStr) : [...seedSharedCalendarEvents];

// Servicedesk
cachedTicketCategories = localTicketCategoriesStr ? JSON.parse(localTicketCategoriesStr) : [...seedTicketCategories];
cachedTicketStatuses = localTicketStatusesStr ? JSON.parse(localTicketStatusesStr) : [...seedTicketStatuses];
cachedTicketHandlers = localTicketHandlersStr ? JSON.parse(localTicketHandlersStr) : [...seedTicketHandlers];
cachedTicketComments = localTicketCommentsStr ? JSON.parse(localTicketCommentsStr) : [...seedTicketComments];
cachedTickets = localTicketsStr ? JSON.parse(localTicketsStr) : [...seedTickets];
cachedEmailTemplates = localEmailTemplatesStr ? JSON.parse(localEmailTemplatesStr) : [...seedEmailTemplates];
cachedEmailLogs = localEmailLogsStr ? JSON.parse(localEmailLogsStr) : [...seedEmailLogs];

// Meetings
cachedMeetings = (localMeetingsStr ? JSON.parse(localMeetingsStr) : [...seedMeetings]).filter(m => m.id !== 'm-1' && m.id !== 'm-2');
cachedMeetingAgreements = (localMeetingAgreementsStr ? JSON.parse(localMeetingAgreementsStr) : [...seedMeetingAgreements]).filter(a => !['agr-1', 'agr-2', 'agr-3'].includes(a.id));
cachedMeetingNotes = localMeetingNotesStr ? JSON.parse(localMeetingNotesStr) : [...seedMeetingNotes];
cachedMeetingActionItems = (localMeetingActionItemsStr ? JSON.parse(localMeetingActionItemsStr) : [...seedMeetingActionItems]).filter(a => !['act-1', 'act-2', 'act-3'].includes(a.id));
cachedMeetingTemplates = localMeetingTemplatesStr ? JSON.parse(localMeetingTemplatesStr) : [...seedMeetingTemplates];

// Vacation & Leave
cachedVacationCalendars = localVacationCalendarsStr ? JSON.parse(localVacationCalendarsStr) : [...seedVacationCalendars];
cachedVacationEntries = localVacationEntriesStr ? JSON.parse(localVacationEntriesStr) : [...seedVacationEntries];

// Store initialization flag without forcing sample projects
localStorage.setItem('planner_initialized_store', 'true');
saveToLocalStorage();


// Migrate local cached data (polls/contacts/tasks/statuses/categories) to Firestore before snapshot listeners boot
async function migrateLocalCacheToFirestore(userId: string) {
  try {
    console.log("Checking and migrating local cache to Firestore...");

    const pollsSnap = await getDocs(collection(db, 'polls'));
    const contactsSnap = await getDocs(collection(db, 'contacts'));
    const inviteesSnap = await getDocs(collection(db, 'invitees'));
    const notificationsSnap = await getDocs(collection(db, 'notifications'));
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const statusesSnap = await getDocs(collection(db, 'task_statuses'));
    const categoriesSnap = await getDocs(collection(db, 'task_categories'));

    const serverPollIds = new Set(pollsSnap.docs.map(doc => doc.id));
    const serverContactIds = new Set(contactsSnap.docs.map(doc => doc.id));
    const serverInviteeIds = new Set(inviteesSnap.docs.map(doc => doc.id));
    const serverNotificationIds = new Set(notificationsSnap.docs.map(doc => doc.id));
    const serverTaskIds = new Set(tasksSnap.docs.map(doc => doc.id));
    const serverStatusIds = new Set(statusesSnap.docs.map(doc => doc.id));
    const serverCategoryIds = new Set(categoriesSnap.docs.map(doc => doc.id));

    // If Firestore is empty, seed with current local cache
    if (pollsSnap.empty) {
      console.log("Firestore is empty. Seeding Firestore with current local cache data...");
      for (const p of cachedPolls) {
        if (SEED_IDS.has(p.id)) continue;
        await setDoc(doc(db, 'polls', p.id), { ...p, ownerId: userId });
      }
      for (const c of cachedContacts) {
        if (SEED_IDS.has(c.id)) continue;
        await setDoc(doc(db, 'contacts', c.id), { ...c, ownerId: userId });
      }
      for (const i of cachedInvitees) {
        if (SEED_IDS.has(i.id)) continue;
        await setDoc(doc(db, 'invitees', i.id), { ...i, ownerId: userId });
      }
      for (const n of cachedNotifications) {
        if (SEED_IDS.has(n.id)) continue;
        await setDoc(doc(db, 'notifications', n.id), { ...n, ownerId: userId });
      }
    } else {
      // Safely upload any local items NOT yet present in Firestore
      for (const p of cachedPolls) {
        if (SEED_IDS.has(p.id)) continue;
        if (!serverPollIds.has(p.id)) {
          await setDoc(doc(db, 'polls', p.id), { ...p, ownerId: userId });
        }
      }
      for (const c of cachedContacts) {
        if (SEED_IDS.has(c.id)) continue;
        if (!serverContactIds.has(c.id)) {
          await setDoc(doc(db, 'contacts', c.id), { ...c, ownerId: userId });
        }
      }
      for (const i of cachedInvitees) {
        if (SEED_IDS.has(i.id)) continue;
        if (!serverInviteeIds.has(i.id)) {
          await setDoc(doc(db, 'invitees', i.id), { ...i, ownerId: userId });
        }
      }
      for (const n of cachedNotifications) {
        if (SEED_IDS.has(n.id)) continue;
        if (!serverNotificationIds.has(n.id)) {
          await setDoc(doc(db, 'notifications', n.id), { ...n, ownerId: userId });
        }
      }
    }

    // Task tables seeding & migration - strictly exclude sample tasks
    for (const d of tasksSnap.docs) {
      if (isSampleTask({ ...d.data(), id: d.id })) {
        await deleteDoc(doc(db, 'tasks', d.id)).catch(() => {});
      }
    }

    if (tasksSnap.empty) {
      for (const t of cachedTasks) {
        if (SEED_IDS.has(t.id) || isSampleTask(t)) continue;
        await setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: userId });
      }
    } else {
      for (const t of cachedTasks) {
        if (SEED_IDS.has(t.id) || isSampleTask(t)) continue;
        if (!serverTaskIds.has(t.id)) {
          await setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: userId });
        }
      }
    }

    if (statusesSnap.empty) {
      for (const s of cachedStatuses) {
        if (SEED_IDS.has(s.id)) continue;
        await setDoc(doc(db, 'task_statuses', s.id), { ...s, ownerId: userId });
      }
    } else {
      for (const s of cachedStatuses) {
        if (SEED_IDS.has(s.id)) continue;
        if (!serverStatusIds.has(s.id)) {
          await setDoc(doc(db, 'task_statuses', s.id), { ...s, ownerId: userId });
        }
      }
    }

    if (categoriesSnap.empty) {
      for (const cat of cachedCategories) {
        if (SEED_IDS.has(cat.id)) continue;
        await setDoc(doc(db, 'task_categories', cat.id), { ...cat, ownerId: userId });
      }
    } else {
      for (const cat of cachedCategories) {
        if (SEED_IDS.has(cat.id)) continue;
        if (!serverCategoryIds.has(cat.id)) {
          await setDoc(doc(db, 'task_categories', cat.id), { ...cat, ownerId: userId });
        }
      }
    }

    // Calendar Categories migration
    const calCategoriesSnap = await getDocs(collection(db, 'calendar_categories'));
    const serverCalCategoryIds = new Set(calCategoriesSnap.docs.map(doc => doc.id));
    if (calCategoriesSnap.empty) {
      for (const cc of cachedCalendarCategories) {
        if (SEED_IDS.has(cc.id)) continue;
        await setDoc(doc(db, 'calendar_categories', cc.id), { ...cc, ownerId: userId });
      }
    } else {
      for (const cc of cachedCalendarCategories) {
        if (SEED_IDS.has(cc.id)) continue;
        if (!serverCalCategoryIds.has(cc.id)) {
          await setDoc(doc(db, 'calendar_categories', cc.id), { ...cc, ownerId: userId });
        }
      }
    }

    // Year Events migration
    const yearEventsSnap = await getDocs(collection(db, 'year_events'));
    const serverYearEventIds = new Set(yearEventsSnap.docs.map(doc => doc.id));
    if (yearEventsSnap.empty) {
      for (const ye of cachedYearEvents) {
        if (SEED_IDS.has(ye.id)) continue;
        await setDoc(doc(db, 'year_events', ye.id), { ...ye, ownerId: userId });
      }
    } else {
      for (const ye of cachedYearEvents) {
        if (SEED_IDS.has(ye.id)) continue;
        if (!serverYearEventIds.has(ye.id)) {
          await setDoc(doc(db, 'year_events', ye.id), { ...ye, ownerId: userId });
        }
      }
    }

    // Projects migration
    const projectsSnap = await getDocs(collection(db, 'projects'));
    const serverProjectIds = new Set(projectsSnap.docs.map(doc => doc.id));
    for (const proj of cachedProjects) {
      if (isSampleProject(proj)) continue;
      if (!serverProjectIds.has(proj.id)) {
        await setDoc(doc(db, 'projects', proj.id), { ...proj, ownerId: userId }).catch(() => {});
      }
    }

    // Project Activities migration
    const actSnap = await getDocs(collection(db, 'project_activities'));
    const serverActIds = new Set(actSnap.docs.map(doc => doc.id));
    for (const act of cachedProjectActivities) {
      if (isSampleProjectActivity(act)) continue;
      if (!serverActIds.has(act.id)) {
        await setDoc(doc(db, 'project_activities', act.id), { ...act, ownerId: userId }).catch(() => {});
      }
    }

    console.log("Local cache migration to Firestore completed successfully.");
  } catch (err) {
    console.warn("Migration to Firestore failed or postponed (operating local-first/offline):", err);
  }
}

// Start Snapshot Listeners
async function setupSync(userId: string) {
  // Unsubscribe from any active listeners first
  activeListeners.forEach(unsub => unsub());
  activeListeners = [];

  // Migrate/upload local data FIRST to resolve the race condition and avoid overwrites
  await migrateLocalCacheToFirestore(userId);
  await dbService.cleanSampleProjects().catch(() => {});

  // Polls collection snapshot
  const unsubPolls = onSnapshot(collection(db, 'polls'), (snapshot) => {
    const firestorePolls = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Poll));
    const firestoreMap = new Map(firestorePolls.map(p => [p.id, p]));
    const unsyncedLocal = cachedPolls.filter(p => !firestoreMap.has(p.id));
    
    // Sync unsynced local polls to Firestore
    if (userId) {
      unsyncedLocal.forEach(p => {
        if (!SEED_IDS.has(p.id)) {
          setDoc(doc(db, 'polls', p.id), { ...p, ownerId: p.ownerId || userId }).catch(err => {
            console.warn("Sync local poll error:", err);
          });
        }
      });
    }

    cachedPolls = [...firestorePolls, ...unsyncedLocal];
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'polls');
  });
  activeListeners.push(unsubPolls);

  // Contacts collection snapshot
  const unsubContacts = onSnapshot(collection(db, 'contacts'), (snapshot) => {
    const firestoreContacts = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Contact));
    const firestoreMap = new Map(firestoreContacts.map(c => [c.id, c]));
    const unsyncedLocal = cachedContacts.filter(c => !firestoreMap.has(c.id));
    
    // Sync unsynced local contacts to Firestore
    if (userId) {
      unsyncedLocal.forEach(c => {
        if (!SEED_IDS.has(c.id)) {
          setDoc(doc(db, 'contacts', c.id), { ...c, ownerId: c.ownerId || userId }).catch(err => {
            console.warn("Sync local contact error:", err);
          });
        }
      });
    }

    cachedContacts = [...firestoreContacts, ...unsyncedLocal];
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'contacts');
  });
  activeListeners.push(unsubContacts);

  // Invitees collection snapshot
  const unsubInvitees = onSnapshot(collection(db, 'invitees'), (snapshot) => {
    const firestoreInvitees = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Invitee));
    const firestoreMap = new Map(firestoreInvitees.map(i => [i.id, i]));
    const unsyncedLocal = cachedInvitees.filter(i => !firestoreMap.has(i.id));

    // Sync unsynced local invitees to Firestore
    if (userId) {
      unsyncedLocal.forEach(i => {
        if (!SEED_IDS.has(i.id)) {
          setDoc(doc(db, 'invitees', i.id), { ...i, ownerId: i.ownerId || userId }).catch(err => {
            console.warn("Sync local invitee error:", err);
          });
        }
      });
    }

    cachedInvitees = [...firestoreInvitees, ...unsyncedLocal];
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'invitees');
  });
  activeListeners.push(unsubInvitees);

  // Notifications collection snapshot
  const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
    const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Notification));
    cachedNotifications = list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'notifications');
  });
  activeListeners.push(unsubNotifications);

  // Tasks collection snapshot
  const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
    const firestoreTasks = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Task));
    
    // Purge any lingering sample tasks from Firestore
    firestoreTasks.forEach(t => {
      if (isSampleTask(t)) {
        deleteDoc(doc(db, 'tasks', t.id)).catch(() => {});
      }
    });

    const cleanFirestore = firestoreTasks.filter(t => !isSampleTask(t));
    const firestoreMap = new Map(cleanFirestore.map(t => [t.id, t]));

    // Preserve real local tasks created before or during offline/sync
    const unsyncedLocal = cachedTasks.filter(t => !isSampleTask(t) && !firestoreMap.has(t.id));

    // Upload unsynced real local tasks to Firestore
    if (userId) {
      unsyncedLocal.forEach(t => {
        setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: userId }).catch(err => {
          console.error("Error syncing local task to Firestore:", err);
        });
      });
    }

    cachedTasks = [...cleanFirestore, ...unsyncedLocal];
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'tasks');
  });
  activeListeners.push(unsubTasks);

  // Statuses collection snapshot
  const unsubStatuses = onSnapshot(collection(db, 'task_statuses'), (snapshot) => {
    const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TaskStatus));
    cachedStatuses = list.sort((a, b) => a.order - b.order);
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'task_statuses');
  });
  activeListeners.push(unsubStatuses);

  // Categories collection snapshot
  const unsubCategories = onSnapshot(collection(db, 'task_categories'), (snapshot) => {
    cachedCategories = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TaskCategory));
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'task_categories');
  });
  activeListeners.push(unsubCategories);

  // Calendar Categories collection snapshot
  const unsubCalCategories = onSnapshot(collection(db, 'calendar_categories'), (snapshot) => {
    cachedCalendarCategories = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CalendarCategory));
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'calendar_categories');
  });
  activeListeners.push(unsubCalCategories);

  // Year Events collection snapshot
  const unsubYearEvents = onSnapshot(collection(db, 'year_events'), (snapshot) => {
    cachedYearEvents = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as YearEvent));
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'year_events');
  });
  activeListeners.push(unsubYearEvents);

  // Projects collection snapshot
  const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
    // Delete any lingering sample projects from Firestore
    snapshot.docs.forEach(d => {
      const data = d.data() as Project;
      if (isSampleProject({ id: d.id, title: data.title })) {
        deleteDoc(doc(db, 'projects', d.id)).catch(() => {});
      }
    });

    const firestoreProjects = snapshot.docs
      .map(d => ({ ...d.data(), id: d.id } as Project))
      .filter(p => !isSampleProject(p));

    const firestoreMap = new Map(firestoreProjects.map(p => [p.id, p]));
    const unsyncedLocal = cachedProjects.filter(p => !firestoreMap.has(p.id) && !isSampleProject(p));

    if (userId) {
      unsyncedLocal.forEach(p => {
        setDoc(doc(db, 'projects', p.id), { ...p, ownerId: userId }).catch(err => {
          console.error("Error syncing local project to Firestore:", err);
        });
      });
    }

    const merged = [...firestoreProjects, ...unsyncedLocal];
    cachedProjects = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'projects');
  });
  activeListeners.push(unsubProjects);

  // Project Activities collection snapshot
  const unsubProjectActivities = onSnapshot(collection(db, 'project_activities'), (snapshot) => {
    // Delete any lingering sample project activities from Firestore
    snapshot.docs.forEach(d => {
      const data = d.data() as ProjectActivity;
      if (isSampleProjectActivity({ id: d.id, projectId: data.projectId, title: data.title })) {
        deleteDoc(doc(db, 'project_activities', d.id)).catch(() => {});
      }
    });

    const firestoreActs = snapshot.docs
      .map(d => ({ ...d.data(), id: d.id } as ProjectActivity))
      .filter(a => !isSampleProjectActivity(a));

    const firestoreMap = new Map(firestoreActs.map(a => [a.id, a]));
    const unsyncedLocal = cachedProjectActivities.filter(a => !firestoreMap.has(a.id) && !isSampleProjectActivity(a));

    if (userId) {
      unsyncedLocal.forEach(a => {
        setDoc(doc(db, 'project_activities', a.id), { ...a, ownerId: userId }).catch(err => {
          console.error("Error syncing local activity to Firestore:", err);
        });
      });
    }

    const merged = [...firestoreActs, ...unsyncedLocal];
    cachedProjectActivities = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'project_activities');
  });
  activeListeners.push(unsubProjectActivities);

  // Servicedesk Categories
  const unsubTicketCategories = onSnapshot(collection(db, 'ticket_categories'), (snapshot) => {
    cachedTicketCategories = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TicketCategory));
    if (cachedTicketCategories.length === 0) {
      cachedTicketCategories = [...seedTicketCategories];
    }
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'ticket_categories');
  });
  activeListeners.push(unsubTicketCategories);

  // Servicedesk Statuses
  const unsubTicketStatuses = onSnapshot(collection(db, 'ticket_statuses'), (snapshot) => {
    cachedTicketStatuses = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TicketStatus));
    if (cachedTicketStatuses.length === 0) {
      cachedTicketStatuses = [...seedTicketStatuses];
    }
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'ticket_statuses');
  });
  activeListeners.push(unsubTicketStatuses);

  // Servicedesk Handlers
  const unsubTicketHandlers = onSnapshot(collection(db, 'ticket_handlers'), (snapshot) => {
    cachedTicketHandlers = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TicketHandler));
    if (cachedTicketHandlers.length === 0) {
      cachedTicketHandlers = [...seedTicketHandlers];
    }
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'ticket_handlers');
  });
  activeListeners.push(unsubTicketHandlers);

  // Servicedesk Tickets
  const unsubTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
    cachedTickets = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Ticket));
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'tickets');
  });
  activeListeners.push(unsubTickets);

  // Servicedesk Comments
  const unsubTicketComments = onSnapshot(collection(db, 'ticket_comments'), (snapshot) => {
    cachedTicketComments = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TicketComment));
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'ticket_comments');
  });
  activeListeners.push(unsubTicketComments);

  // Servicedesk Templates
  const unsubEmailTemplates = onSnapshot(collection(db, 'email_templates'), (snapshot) => {
    cachedEmailTemplates = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as EmailTemplate));
    if (cachedEmailTemplates.length === 0) {
      cachedEmailTemplates = [...seedEmailTemplates];
    }
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'email_templates');
  });
  activeListeners.push(unsubEmailTemplates);

  // Servicedesk Email Logs
  const unsubEmailLogs = onSnapshot(collection(db, 'email_logs'), (snapshot) => {
    cachedEmailLogs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as EmailLog));
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'email_logs');
  });
  activeListeners.push(unsubEmailLogs);

  // Shared Calendars collection snapshot
  const unsubSharedCalendars = onSnapshot(collection(db, 'shared_calendars'), (snapshot) => {
    const firestoreCals = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SharedCalendar));
    const firestoreMap = new Map(firestoreCals.map(c => [c.id, c]));
    const isSeedCal = (id: string) => id === 'sc-1' || id === 'sc-2';
    const unsyncedLocal = firestoreCals.length > 0
      ? cachedSharedCalendars.filter(c => !firestoreMap.has(c.id) && !isSeedCal(c.id))
      : cachedSharedCalendars.filter(c => !firestoreMap.has(c.id));

    if (userId) {
      unsyncedLocal.forEach(c => {
        if (!isSeedCal(c.id)) {
          setDoc(doc(db, 'shared_calendars', c.id), { ...c, ownerId: userId }).catch(err => {
            console.error("Error syncing local shared calendar to Firestore:", err);
          });
        }
      });
    }

    let merged = [...firestoreCals, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedSharedCalendars];
    }
    cachedSharedCalendars = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'shared_calendars');
  });
  activeListeners.push(unsubSharedCalendars);

  // Shared Calendar Events collection snapshot
  const unsubSharedEvents = onSnapshot(collection(db, 'shared_calendar_events'), (snapshot) => {
    const firestoreEvents = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SharedCalendarEvent));
    const firestoreMap = new Map(firestoreEvents.map(e => [e.id, e]));
    const isSeedEvent = (id: string) => id.startsWith('sce-');
    const unsyncedLocal = firestoreEvents.length > 0
      ? cachedSharedCalendarEvents.filter(e => !firestoreMap.has(e.id) && !isSeedEvent(e.id))
      : cachedSharedCalendarEvents.filter(e => !firestoreMap.has(e.id));

    if (userId) {
      unsyncedLocal.forEach(e => {
        if (!isSeedEvent(e.id)) {
          setDoc(doc(db, 'shared_calendar_events', e.id), { ...e, ownerId: userId }).catch(err => {
            console.error("Error syncing local shared calendar event to Firestore:", err);
          });
        }
      });
    }

    let merged = [...firestoreEvents, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedSharedCalendarEvents];
    }
    cachedSharedCalendarEvents = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'shared_calendar_events');
  });
  activeListeners.push(unsubSharedEvents);

  // Meetings collection snapshot
  const unsubMeetings = onSnapshot(collection(db, 'meetings'), (snapshot) => {
    const firestoreMeetings = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Meeting));
    const firestoreMap = new Map(firestoreMeetings.map(m => [m.id, m]));
    const isSeedMeeting = (id: string) => id === 'm-1' || id === 'm-2';
    const unsyncedLocal = firestoreMeetings.length > 0
      ? cachedMeetings.filter(m => !firestoreMap.has(m.id) && !isSeedMeeting(m.id))
      : cachedMeetings.filter(m => !firestoreMap.has(m.id));

    if (userId) {
      unsyncedLocal.forEach(m => {
        if (!isSeedMeeting(m.id)) {
          setDoc(doc(db, 'meetings', m.id), { ...m, ownerId: userId }).catch(err => {
            console.error("Error syncing local meeting to Firestore:", err);
          });
        }
      });
    }

    let merged = [...firestoreMeetings, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedMeetings];
    }
    cachedMeetings = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'meetings');
  });
  activeListeners.push(unsubMeetings);

  // Meeting Agreements collection snapshot
  const unsubMeetingAgreements = onSnapshot(collection(db, 'meeting_agreements'), (snapshot) => {
    const firestoreAgreements = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MeetingAgreement));
    const firestoreMap = new Map(firestoreAgreements.map(a => [a.id, a]));
    const isSeedAgr = (id: string) => id.startsWith('agr-');
    const unsyncedLocal = firestoreAgreements.length > 0
      ? cachedMeetingAgreements.filter(a => !firestoreMap.has(a.id) && !isSeedAgr(a.id))
      : cachedMeetingAgreements.filter(a => !firestoreMap.has(a.id));

    if (userId) {
      unsyncedLocal.forEach(a => {
        if (!isSeedAgr(a.id)) {
          setDoc(doc(db, 'meeting_agreements', a.id), { ...a, ownerId: userId }).catch(err => {
            console.error("Error syncing local agreement to Firestore:", err);
          });
        }
      });
    }

    let merged = [...firestoreAgreements, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedMeetingAgreements];
    }
    cachedMeetingAgreements = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'meeting_agreements');
  });
  activeListeners.push(unsubMeetingAgreements);

  // Meeting Notes collection snapshot
  const unsubMeetingNotes = onSnapshot(collection(db, 'meeting_notes'), (snapshot) => {
    const firestoreNotes = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MeetingNote));
    const firestoreMap = new Map(firestoreNotes.map(n => [n.id, n]));
    const unsyncedLocal = firestoreNotes.length > 0
      ? cachedMeetingNotes.filter(n => !firestoreMap.has(n.id))
      : cachedMeetingNotes;

    if (userId) {
      unsyncedLocal.forEach(n => {
        setDoc(doc(db, 'meeting_notes', n.id), { ...n, ownerId: userId }).catch(err => {
          console.error("Error syncing local meeting note to Firestore:", err);
        });
      });
    }

    let merged = [...firestoreNotes, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedMeetingNotes];
    }
    cachedMeetingNotes = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'meeting_notes');
  });
  activeListeners.push(unsubMeetingNotes);

  // Meeting Action Items collection snapshot
  const unsubMeetingActions = onSnapshot(collection(db, 'meeting_action_items'), (snapshot) => {
    const firestoreActions = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MeetingActionItem));
    const firestoreMap = new Map(firestoreActions.map(a => [a.id, a]));
    const isSeedAct = (id: string) => id.startsWith('act-');
    const unsyncedLocal = firestoreActions.length > 0
      ? cachedMeetingActionItems.filter(a => !firestoreMap.has(a.id) && !isSeedAct(a.id))
      : cachedMeetingActionItems.filter(a => !firestoreMap.has(a.id));

    if (userId) {
      unsyncedLocal.forEach(a => {
        if (!isSeedAct(a.id)) {
          setDoc(doc(db, 'meeting_action_items', a.id), { ...a, ownerId: userId }).catch(err => {
            console.error("Error syncing local action item to Firestore:", err);
          });
        }
      });
    }

    let merged = [...firestoreActions, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedMeetingActionItems];
    }
    cachedMeetingActionItems = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'meeting_action_items');
  });
  activeListeners.push(unsubMeetingActions);

  // Meeting Email Templates snapshot
  const unsubMeetingTemplates = onSnapshot(collection(db, 'meeting_templates'), (snapshot) => {
    cachedMeetingTemplates = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MeetingEmailTemplate));
    if (cachedMeetingTemplates.length === 0) {
      cachedMeetingTemplates = [...seedMeetingTemplates];
    }
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'meeting_templates');
  });
  activeListeners.push(unsubMeetingTemplates);

  // Vacation Calendars collection snapshot
  const unsubVacationCalendars = onSnapshot(collection(db, 'vacation_calendars'), (snapshot) => {
    const firestoreCals = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as VacationCalendar));
    const firestoreMap = new Map(firestoreCals.map(c => [c.id, c]));
    const unsyncedLocal = cachedVacationCalendars.filter(c => !firestoreMap.has(c.id));

    if (userId) {
      unsyncedLocal.forEach(c => {
        if (!c.id.startsWith('vc-seed-')) {
          setDoc(doc(db, 'vacation_calendars', c.id), { ...c, ownerId: userId }).catch(() => {});
        }
      });
    }

    let merged = [...firestoreCals, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedVacationCalendars];
    }
    cachedVacationCalendars = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'vacation_calendars');
  });
  activeListeners.push(unsubVacationCalendars);

  // Vacation Entries collection snapshot
  const unsubVacationEntries = onSnapshot(collection(db, 'vacation_entries'), (snapshot) => {
    const firestoreEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as VacationEntry));
    const firestoreMap = new Map(firestoreEntries.map(e => [e.id, e]));
    const unsyncedLocal = cachedVacationEntries.filter(e => !firestoreMap.has(e.id));

    if (userId) {
      unsyncedLocal.forEach(e => {
        if (!e.id.startsWith('ve-seed-')) {
          setDoc(doc(db, 'vacation_entries', e.id), { ...e, ownerId: userId }).catch(() => {});
        }
      });
    }

    let merged = [...firestoreEntries, ...unsyncedLocal];
    if (merged.length === 0) {
      merged = [...seedVacationEntries];
    }
    cachedVacationEntries = merged;
    saveToLocalStorage();
    notifySubscribers();
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'vacation_entries');
  });
  activeListeners.push(unsubVacationEntries);
}

// Initial session auth sign-in guarantee
ensureUserSignedIn((user) => {
  if (user) {
    // Preserve local data before sync starts
    reloadFromLocalStorageIfAvailable();
    captureVaultSnapshot(`Google-sessie geactiveerd: ${user.email || user.uid}`);
    setupSync(user.uid);
    // Automatically purge sample tasks while preserving all user-created tasks
    setTimeout(() => {
      dbService.cleanSampleTasks().catch(() => {});
    }, 1200);
  } else {
    // Unsubscribe from any active listeners first
    activeListeners.forEach(unsub => unsub());
    activeListeners = [];

    // Fallback to localStorage or last known good state
    reloadFromLocalStorageIfAvailable();
    notifySubscribers();
  }
});

export const dbService = {
  // Subscribe helper for react hook re-renders
  subscribe(callback: () => void): () => void {
    subscribers.add(callback);
    // Call immediately with current cached values
    callback();
    return () => {
      subscribers.delete(callback);
    };
  },

  // Subscribe to updates for a specific poll in real-time
  subscribeToPoll(pollId: string, callback: (poll: Poll | null) => void): () => void {
    const pollRef = doc(db, 'polls', pollId);
    const unsubscribe = onSnapshot(pollRef, (snapshot) => {
      if (snapshot.exists()) {
        const item = { ...snapshot.data(), id: snapshot.id } as Poll;
        const idx = cachedPolls.findIndex(p => p.id === pollId);
        if (idx > -1) {
          cachedPolls[idx] = item;
        } else {
          cachedPolls.push(item);
        }
        saveToLocalStorage();
        callback(item);
        notifySubscribers();
      } else {
        callback(null);
      }
    }, (err) => {
      console.warn("Real-time listener for poll failed: ", err);
    });
    return unsubscribe;
  },

  // Subscribe to updates for a specific poll's invitees in real-time
  subscribeToPollInvitees(pollId: string, callback: (invitees: Invitee[]) => void): () => void {
    const q = query(collection(db, 'invitees'), where('pollId', '==', pollId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Invitee));
      
      // Merge into the global cachedInvitees list
      const filtered = cachedInvitees.filter(i => i.pollId !== pollId);
      cachedInvitees = [...filtered, ...list];
      
      saveToLocalStorage();
      callback(list);
      notifySubscribers();
    }, (err) => {
      console.warn("Real-time listener for invitees failed/restricted: ", err);
      // Fallback: use whatever we have in memory
      const currentList = cachedInvitees.filter(i => i.pollId === pollId);
      callback(currentList);
    });
    
    return unsubscribe;
  },

  // Polls API
  getPolls(): Poll[] {
    return [...cachedPolls];
  },

  getPoll(id: string): Poll | null {
    const localMatch = cachedPolls.find(p => p.id === id);
    if (localMatch) return localMatch;
    
    // Fallback: fetch from server (e.g. for guest voters who aren't the owners)
    const pollRef = doc(db, 'polls', id);
    getDoc(pollRef).then((snap) => {
      if (snap.exists()) {
        const item = { ...snap.data(), id: snap.id } as Poll;
        // Keep it in cachedPolls transient list if not already there so it registers
        if (!cachedPolls.some(p => p.id === id)) {
          cachedPolls.push(item);
          notifySubscribers();
        }
      }
    }).catch(err => {
      console.warn("Notice: Error fetching poll in background:", err);
    });

    return cachedPolls.find(p => p.id === id) || null;
  },

  async fetchPollAsync(id: string): Promise<Poll | null> {
    const localMatch = cachedPolls.find(p => p.id === id);
    if (localMatch) return localMatch;

    try {
      const pollRef = doc(db, 'polls', id);
      const snap = await getDoc(pollRef);
      if (snap.exists()) {
        const item = { ...snap.data(), id: snap.id } as Poll;
        if (!cachedPolls.some(p => p.id === id)) {
          cachedPolls.push(item);
          saveToLocalStorage();
          notifySubscribers();
        }
        return item;
      }
    } catch (err) {
      console.warn("Notice: Could not fetch poll from Firestore:", err);
    }

    // Fallback: search localStorage
    try {
      const localPollsStr = localStorage.getItem('local_polls');
      if (localPollsStr) {
        const polls: Poll[] = JSON.parse(localPollsStr);
        const match = polls.find(p => p.id === id);
        if (match) {
          if (!cachedPolls.some(p => p.id === id)) {
            cachedPolls.push(match);
            notifySubscribers();
          }
          return match;
        }
      }
    } catch (e) {}

    return null;
  },

  async savePoll(poll: Poll): Promise<void> {
    const userId = auth.currentUser?.uid;
    const pollWithId: Record<string, any> = { ...poll };
    if (userId) {
      pollWithId.ownerId = userId;
    } else if ('ownerId' in pollWithId && !pollWithId.ownerId) {
      delete pollWithId.ownerId;
    }

    // Clean up any undefined properties
    Object.keys(pollWithId).forEach(key => {
      if (pollWithId[key] === undefined) {
        delete pollWithId[key];
      }
    });

    // Update cache first for instant UX
    const idx = cachedPolls.findIndex(p => p.id === poll.id);
    if (idx > -1) {
      cachedPolls[idx] = pollWithId as Poll;
    } else {
      cachedPolls.push(pollWithId as Poll);
    }
    saveToLocalStorage();
    notifySubscribers();

    try {
      await setDoc(doc(db, 'polls', poll.id), pollWithId);
    } catch (err) {
      console.warn("Could not sync poll to Firestore, saved locally:", err);
    }
  },

  async deletePoll(id: string): Promise<void> {
    // Update cache first
    cachedPolls = cachedPolls.filter(p => p.id !== id);
    cachedInvitees = cachedInvitees.filter(i => i.pollId !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId || SEED_IDS.has(id)) {
      console.log("Local-first: deleted poll locally");
      return;
    }

    try {
      await deleteDoc(doc(db, 'polls', id));
      
      // Secondary cascaded deletion of invitees matching this pollId
      const relatedInvitees = cachedInvitees.filter(i => i.pollId === id);
      for (const invitee of relatedInvitees) {
        if (SEED_IDS.has(invitee.id)) continue;
        await deleteDoc(doc(db, 'invitees', invitee.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `polls/${id}`);
    }
  },

  // Invitees API
  getAllInvitees(): Invitee[] {
    return cachedInvitees;
  },

  async fetchInviteesForPoll(pollId: string): Promise<Invitee[]> {
    try {
      const snapshot = await getDocs(query(collection(db, 'invitees'), where('pollId', '==', pollId)));
      const list = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Invitee));
      const listMap = new Map(list.map(i => [i.id, i]));
      
      // Preserve local invitees for this poll that may not yet be returned by firestore query
      const localForPoll = cachedInvitees.filter(i => i.pollId === pollId && !listMap.has(i.id));
      const combined = [...list, ...localForPoll];
      
      const otherInvitees = cachedInvitees.filter(i => i.pollId !== pollId);
      cachedInvitees = [...otherInvitees, ...combined];
      saveToLocalStorage();
      notifySubscribers();
      return combined;
    } catch (err) {
      console.warn("Could not retrieve invitees for poll: ", err);
      return cachedInvitees.filter(i => i.pollId === pollId);
    }
  },

  getInviteesForPoll(pollId: string): Invitee[] {
    // If cache is empty or we are a voter, fetch invitees in background for voter guest view
    if (cachedInvitees.filter(i => i.pollId === pollId).length === 0) {
      getDocs(query(collection(db, 'invitees'), where('pollId', '==', pollId)))
        .then((snapshot) => {
          const list = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Invitee));
          cachedInvitees = [...cachedInvitees, ...list.filter(item => !cachedInvitees.some(exist => exist.id === item.id))];
          notifySubscribers();
        })
        .catch(err => {
          console.warn("Guest notice: could not retrieve invitees from Firestore. Using local guest list:", err);
        });
    }
    return cachedInvitees.filter(i => i.pollId === pollId);
  },

  getInvitees(): Invitee[] {
    return [...cachedInvitees];
  },

  getInvitee(id: string): Invitee | null {
    return cachedInvitees.find(i => i.id === id) || null;
  },

  async saveInvitee(invitee: Invitee): Promise<void> {
    const idx = cachedInvitees.findIndex(i => i.id === invitee.id);
    const existingInvitee = idx > -1 ? cachedInvitees[idx] : null;

    // Resolve ownerId safely so we don't violate firestore security rules or lose documents
    let resolvedOwnerId: string | null = invitee.ownerId || (existingInvitee as any)?.ownerId || null;

    if (!resolvedOwnerId) {
      const parentPoll = cachedPolls.find(p => p.id === invitee.pollId);
      if (parentPoll?.ownerId) {
        resolvedOwnerId = parentPoll.ownerId;
      } else {
        try {
          const pollRef = doc(db, 'polls', invitee.pollId);
          const pollSnap = await getDoc(pollRef);
          if (pollSnap.exists()) {
            resolvedOwnerId = pollSnap.data()?.ownerId || null;
          }
        } catch (err) {
          console.warn("Could not fetch parent poll to determine ownerId: ", err);
        }
      }
    }

    if (!resolvedOwnerId) {
      resolvedOwnerId = auth.currentUser?.uid || null;
    }

    const inviteeWithOwner: Record<string, any> = { ...invitee };
    if (resolvedOwnerId) {
      inviteeWithOwner.ownerId = resolvedOwnerId;
    } else {
      delete inviteeWithOwner.ownerId;
    }

    // Clean up undefined properties
    Object.keys(inviteeWithOwner).forEach(key => {
      if (inviteeWithOwner[key] === undefined) {
        delete inviteeWithOwner[key];
      }
    });

    // Update cache containing the resolved ownerId (important!)
    if (idx > -1) {
      cachedInvitees[idx] = inviteeWithOwner as Invitee;
    } else {
      cachedInvitees.push(inviteeWithOwner as Invitee);
    }
    saveToLocalStorage();
    notifySubscribers();

    try {
      await setDoc(doc(db, 'invitees', invitee.id), inviteeWithOwner);
    } catch (err) {
      console.warn("Notice: Saved invitee response locally, cloud sync skipped or restricted. Detail:", err);
    }
  },

  async deleteInvitee(id: string): Promise<void> {
    // Update cache first
    cachedInvitees = cachedInvitees.filter(i => i.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId || SEED_IDS.has(id)) return;

    try {
      await deleteDoc(doc(db, 'invitees', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invitees/${id}`);
    }
  },

  // Contacts API
  getContacts(): Contact[] {
    return [...cachedContacts];
  },

  getContact(id: string): Contact | null {
    return cachedContacts.find(c => c.id === id) || null;
  },

  async saveContact(contact: Contact): Promise<void> {
    const userId = auth.currentUser?.uid;
    const contactPayload: Record<string, any> = { ...contact };
    if (userId) {
      contactPayload.ownerId = userId;
    } else {
      delete contactPayload.ownerId;
    }

    Object.keys(contactPayload).forEach(key => {
      if (contactPayload[key] === undefined) {
        delete contactPayload[key];
      }
    });

    // Update cache first
    const idx = cachedContacts.findIndex(c => c.id === contact.id);
    if (idx > -1) {
      cachedContacts[idx] = contactPayload as Contact;
    } else {
      cachedContacts.push(contactPayload as Contact);
    }
    saveToLocalStorage();
    notifySubscribers();

    if (SEED_IDS.has(contact.id)) {
      console.log("Local-first: saved contact locally");
      return;
    }

    try {
      await setDoc(doc(db, 'contacts', contact.id), contactPayload);
    } catch (err) {
      console.warn("Notice: Saved contact locally, cloud sync warning:", err);
    }
  },

  async deleteContact(id: string): Promise<void> {
    // Update cache first
    cachedContacts = cachedContacts.filter(c => c.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId || SEED_IDS.has(id)) {
      console.log("Local-first: deleted contact locally");
      return;
    }

    try {
      await deleteDoc(doc(db, 'contacts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `contacts/${id}`);
    }
  },

  // Notifications API
  getNotifications(): Notification[] {
    return [...cachedNotifications];
  },

  async addNotification(note: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const id = 'n-' + Math.random().toString(36).substr(2, 9);
    const newNote: Notification = {
      ...note,
      id,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Update cache first
    cachedNotifications = [newNote, ...cachedNotifications];
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;
    
    // Attempt to locate poll owner so that only they receive the notification
    let pollOwnerId: string | null = null;
    try {
      const pollRef = doc(db, 'polls', note.pollId);
      const pollSnap = await getDoc(pollRef);
      if (pollSnap.exists()) {
        pollOwnerId = pollSnap.data().ownerId || null;
      }
    } catch (err) {
      console.warn("Could not retrieve poll owner for notification:", err);
    }

    try {
      await setDoc(doc(db, 'notifications', id), {
        ...newNote,
        ownerId: pollOwnerId
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
    }
  },

  async markNotificationsRead(): Promise<void> {
    // Update cache first
    cachedNotifications = cachedNotifications.map(n => ({ ...n, read: true }));
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      // Mark all in-memory read state and update Firestore in bulk transactions/setDocs
      const unread = cachedNotifications.filter(n => !n.read);
      for (const note of unread) {
        await setDoc(doc(db, 'notifications', note.id), {
          ...note,
          read: true
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  },

  async logNotification(note: Omit<Notification, 'id' | 'timestamp' | 'read'> & { id?: string; read?: boolean; timestamp?: string }): Promise<void> {
    const id = note.id || ('n-' + Math.random().toString(36).substr(2, 9));
    const newNote: Notification = {
      ...note,
      id,
      timestamp: note.timestamp || new Date().toISOString(),
      read: note.read !== undefined ? note.read : true
    };

    cachedNotifications = [newNote, ...cachedNotifications];
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'notifications', id), {
        ...newNote,
        ownerId: userId
      });
    } catch (err) {
      console.warn("Could not save notification to Firestore:", err);
    }
  },

  async deleteNotification(id: string): Promise<void> {
    cachedNotifications = cachedNotifications.filter(n => n.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.warn("Could not delete notification from Firestore:", err);
    }
  },

  async clearAllNotifications(): Promise<void> {
    const ids = cachedNotifications.map(n => n.id);
    cachedNotifications = [];
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'notifications', id)).catch(() => {});
      }
    } catch (err) {
      console.warn("Could not clear all notifications from Firestore:", err);
    }
  },

  // Weekplanner Tasks API
  getTasks(): Task[] {
    return [...cachedTasks];
  },

  async restoreSampleTasks(): Promise<Task[]> {
    return cachedTasks;
  },

  async saveTask(task: Task): Promise<void> {
    const idx = cachedTasks.findIndex(t => t.id === task.id);
    if (idx > -1) {
      cachedTasks[idx] = task;
    } else {
      cachedTasks.push(task);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId || SEED_IDS.has(task.id)) return;

    try {
      await setDoc(doc(db, 'tasks', task.id), { ...task, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
    }
  },

  async deleteTask(id: string): Promise<void> {
    cachedTasks = cachedTasks.filter(t => t.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
    }
  },

  async cleanSampleTasks(): Promise<number> {
    const removedCount = cachedTasks.filter(t => isSampleTask(t)).length;
    cachedTasks = cachedTasks.filter(t => !isSampleTask(t));
    saveToLocalStorage();
    notifySubscribers();

    try {
      const snap = await getDocs(collection(db, 'tasks'));
      for (const d of snap.docs) {
        if (isSampleTask({ ...d.data(), id: d.id })) {
          await deleteDoc(doc(db, 'tasks', d.id)).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Clean sample tasks firestore sync warning:", e);
    }
    return removedCount;
  },

  async archiveCompletedTasks(): Promise<number> {
    const userId = auth.currentUser?.uid;
    const nowIso = new Date().toISOString();
    let count = 0;

    cachedTasks = cachedTasks.map(t => {
      // Completed, done, or marked as gereed
      const isDone = t.completed || t.statusId.toLowerCase().includes('gereed') || t.statusId.toLowerCase().includes('done');
      if (isDone && !t.archived) {
        count++;
        const updated: Task = {
          ...t,
          archived: true,
          completed: true,
          completedAt: t.completedAt || nowIso,
          updatedAt: nowIso
        };
        if (userId && !SEED_IDS.has(t.id)) {
          setDoc(doc(db, 'tasks', t.id), { ...updated, ownerId: userId }).catch(() => {});
        }
        return updated;
      }
      return t;
    });

    saveToLocalStorage();
    notifySubscribers();
    return count;
  },

  getArchivedTasks(): Task[] {
    return cachedTasks.filter(t => t.archived === true);
  },

  async restoreArchivedTask(id: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    const nowIso = new Date().toISOString();
    const task = cachedTasks.find(t => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      archived: false,
      updatedAt: nowIso
    };

    const idx = cachedTasks.findIndex(t => t.id === id);
    if (idx > -1) {
      cachedTasks[idx] = updated;
    }
    saveToLocalStorage();
    notifySubscribers();

    if (userId && !SEED_IDS.has(id)) {
      try {
        await setDoc(doc(db, 'tasks', id), { ...updated, ownerId: userId });
      } catch (err) {
        console.warn("Error restoring archived task:", err);
      }
    }
  },

  async deleteArchivedTask(id: string): Promise<void> {
    return this.deleteTask(id);
  },

  async deleteAllArchivedTasks(): Promise<number> {
    const userId = auth.currentUser?.uid;
    const archivedIds = cachedTasks.filter(t => t.archived === true).map(t => t.id);
    const count = archivedIds.length;
    if (count === 0) return 0;

    cachedTasks = cachedTasks.filter(t => !t.archived);
    saveToLocalStorage();
    notifySubscribers();

    if (userId) {
      for (const id of archivedIds) {
        if (!SEED_IDS.has(id)) {
          deleteDoc(doc(db, 'tasks', id)).catch(() => {});
        }
      }
    }
    return count;
  },

  // Task Statuses API
  getTaskStatuses(): TaskStatus[] {
    return [...cachedStatuses];
  },

  async saveTaskStatus(status: TaskStatus): Promise<void> {
    let finalStatus = { ...status };
    const isSeed = SEED_IDS.has(status.id);
    if (isSeed) {
      const oldId = status.id;
      const newId = 'status-' + Math.random().toString(36).substr(2, 9);
      finalStatus.id = newId;

      // Update all tasks using this statusId
      cachedTasks = cachedTasks.map(t => {
        if (t.statusId === oldId) {
          const updatedTask = { ...t, statusId: newId };
          const userId = auth.currentUser?.uid;
          if (userId) {
            setDoc(doc(db, 'tasks', t.id), { ...updatedTask, ownerId: userId }).catch(err => {
              console.error("Error updating task status reference on Firestore:", err);
            });
          }
          return updatedTask;
        }
        return t;
      });

      // Filter out the old seed status from local cache
      cachedStatuses = cachedStatuses.filter(s => s.id !== oldId);
    }

    const idx = cachedStatuses.findIndex(s => s.id === finalStatus.id);
    if (idx > -1) {
      cachedStatuses[idx] = finalStatus;
    } else {
      cachedStatuses.push(finalStatus);
    }
    cachedStatuses.sort((a, b) => a.order - b.order);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'task_statuses', finalStatus.id), { ...finalStatus, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `task_statuses/${finalStatus.id}`);
    }
  },

  async deleteTaskStatus(id: string): Promise<void> {
    cachedStatuses = cachedStatuses.filter(s => s.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId || SEED_IDS.has(id)) return;

    try {
      await deleteDoc(doc(db, 'task_statuses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `task_statuses/${id}`);
    }
  },

  // Task Categories API
  getTaskCategories(): TaskCategory[] {
    return [...cachedCategories];
  },

  async saveTaskCategory(category: TaskCategory): Promise<void> {
    let finalCategory = { ...category };
    const isSeed = SEED_IDS.has(category.id);
    if (isSeed) {
      const oldId = category.id;
      const newId = 'cat-' + Math.random().toString(36).substr(2, 9);
      finalCategory.id = newId;

      // Update all tasks using this categoryId
      cachedTasks = cachedTasks.map(t => {
        if (t.categoryId === oldId) {
          const updatedTask = { ...t, categoryId: newId };
          const userId = auth.currentUser?.uid;
          if (userId) {
            setDoc(doc(db, 'tasks', t.id), { ...updatedTask, ownerId: userId }).catch(err => {
              console.error("Error updating task category reference on Firestore:", err);
            });
          }
          return updatedTask;
        }
        return t;
      });

      // Filter out old seed category
      cachedCategories = cachedCategories.filter(c => c.id !== oldId);
    }

    const idx = cachedCategories.findIndex(c => c.id === finalCategory.id);
    if (idx > -1) {
      cachedCategories[idx] = finalCategory;
    } else {
      cachedCategories.push(finalCategory);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'task_categories', finalCategory.id), { ...finalCategory, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `task_categories/${finalCategory.id}`);
    }
  },

  async deleteTaskCategory(id: string): Promise<void> {
    cachedCategories = cachedCategories.filter(c => c.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId || SEED_IDS.has(id)) return;

    try {
      await deleteDoc(doc(db, 'task_categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `task_categories/${id}`);
    }
  },

  // Calendar Categories API
  getCalendarCategories(): CalendarCategory[] {
    return [...cachedCalendarCategories];
  },

  async saveCalendarCategory(category: CalendarCategory): Promise<void> {
    const idx = cachedCalendarCategories.findIndex(c => c.id === category.id);
    if (idx > -1) {
      cachedCalendarCategories[idx] = category;
    } else {
      cachedCalendarCategories.push(category);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'calendar_categories', category.id), { ...category, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `calendar_categories/${category.id}`);
    }
  },

  async deleteCalendarCategory(id: string): Promise<void> {
    cachedCalendarCategories = cachedCalendarCategories.filter(c => c.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'calendar_categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `calendar_categories/${id}`);
    }
  },

  // Year Events API
  getYearEvents(): YearEvent[] {
    return [...cachedYearEvents];
  },

  async saveYearEvent(event: YearEvent): Promise<void> {
    const idx = cachedYearEvents.findIndex(ye => ye.id === event.id);
    if (idx > -1) {
      cachedYearEvents[idx] = event;
    } else {
      cachedYearEvents.push(event);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'year_events', event.id), { ...event, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `year_events/${event.id}`);
    }
  },

  async deleteYearEvent(id: string): Promise<void> {
    cachedYearEvents = cachedYearEvents.filter(ye => ye.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'year_events', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `year_events/${id}`);
    }
  },

  // Fetch Public Shared Calendar Data
  async fetchPublicCalendar(ownerId: string): Promise<{ events: YearEvent[], categories: CalendarCategory[] }> {
    try {
      const catsQuery = query(collection(db, 'calendar_categories'), where('ownerId', '==', ownerId));
      const catsSnap = await getDocs(catsQuery);
      const categories = catsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as CalendarCategory));

      const evsQuery = query(collection(db, 'year_events'), where('ownerId', '==', ownerId));
      const evsSnap = await getDocs(evsQuery);
      const events = evsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as YearEvent));

      return { events, categories };
    } catch (err) {
      console.error("Error fetching public calendar data:", err);
      return { events: [], categories: [] };
    }
  },

  // ITPT Servicedesk API
  getTicketCategories(): TicketCategory[] {
    return [...cachedTicketCategories];
  },

  async saveTicketCategory(category: TicketCategory): Promise<void> {
    const idx = cachedTicketCategories.findIndex(c => c.id === category.id);
    if (idx > -1) {
      cachedTicketCategories[idx] = category;
    } else {
      cachedTicketCategories.push(category);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'ticket_categories', category.id), { ...category, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ticket_categories/${category.id}`);
    }
  },

  async deleteTicketCategory(id: string): Promise<void> {
    cachedTicketCategories = cachedTicketCategories.filter(c => c.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'ticket_categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ticket_categories/${id}`);
    }
  },

  getTicketStatuses(): TicketStatus[] {
    return [...cachedTicketStatuses];
  },

  async saveTicketStatus(status: TicketStatus): Promise<void> {
    const idx = cachedTicketStatuses.findIndex(s => s.id === status.id);
    if (idx > -1) {
      cachedTicketStatuses[idx] = status;
    } else {
      cachedTicketStatuses.push(status);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'ticket_statuses', status.id), { ...status, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ticket_statuses/${status.id}`);
    }
  },

  async deleteTicketStatus(id: string): Promise<void> {
    cachedTicketStatuses = cachedTicketStatuses.filter(s => s.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'ticket_statuses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ticket_statuses/${id}`);
    }
  },

  getTicketHandlers(): TicketHandler[] {
    return [...cachedTicketHandlers];
  },

  async saveTicketHandler(handler: TicketHandler): Promise<void> {
    const idx = cachedTicketHandlers.findIndex(h => h.id === handler.id);
    if (idx > -1) {
      cachedTicketHandlers[idx] = handler;
    } else {
      cachedTicketHandlers.push(handler);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'ticket_handlers', handler.id), { ...handler, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ticket_handlers/${handler.id}`);
    }
  },

  async deleteTicketHandler(id: string): Promise<void> {
    cachedTicketHandlers = cachedTicketHandlers.filter(h => h.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'ticket_handlers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ticket_handlers/${id}`);
    }
  },

  getTickets(): Ticket[] {
    return [...cachedTickets];
  },

  getTicket(id: string): Ticket | null {
    return cachedTickets.find(t => t.id === id) || null;
  },

  async saveTicket(ticket: Ticket): Promise<void> {
    // Determine the resolved ownerId for this ticket
    const urlParams = new URLSearchParams(window.location.search);
    const urlOwnerId = urlParams.get('owner');
    
    let resolvedOwnerId = ticket.ownerId || urlOwnerId || auth.currentUser?.uid || 'shared-servicedesk-owner';

    const ticketWithOwner = { ...ticket, ownerId: resolvedOwnerId };

    const idx = cachedTickets.findIndex(t => t.id === ticket.id);
    if (idx > -1) {
      cachedTickets[idx] = ticketWithOwner;
    } else {
      cachedTickets.push(ticketWithOwner);
    }
    saveToLocalStorage();
    notifySubscribers();

    try {
      await setDoc(doc(db, 'tickets', ticket.id), ticketWithOwner);
    } catch (err) {
      console.warn("Notice: Saved ticket locally. Cloud sync skipped or restricted: ", err);
    }
  },

  async deleteTicket(id: string): Promise<void> {
    cachedTickets = cachedTickets.filter(t => t.id !== id);
    cachedTicketComments = cachedTicketComments.filter(c => c.ticketId !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'tickets', id));
      
      // Delete comments under this ticket too
      const comments = cachedTicketComments.filter(c => c.ticketId === id);
      for (const comment of comments) {
        await deleteDoc(doc(db, 'ticket_comments', comment.id));
      }
    } catch (err) {
      console.warn("Notice: Deleted ticket locally. Cloud sync skipped or restricted: ", err);
    }
  },

  getTicketComments(ticketId: string): TicketComment[] {
    return cachedTicketComments.filter(c => c.ticketId === ticketId);
  },

  async saveTicketComment(comment: TicketComment): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOwnerId = urlParams.get('owner');
    
    const parentTicket = cachedTickets.find(t => t.id === comment.ticketId);
    const resolvedOwnerId = comment.ownerId || parentTicket?.ownerId || urlOwnerId || auth.currentUser?.uid || 'shared-servicedesk-owner';

    const commentWithOwner = { ...comment, ownerId: resolvedOwnerId };

    const idx = cachedTicketComments.findIndex(c => c.id === comment.id);
    if (idx > -1) {
      cachedTicketComments[idx] = commentWithOwner;
    } else {
      cachedTicketComments.push(commentWithOwner);
    }
    saveToLocalStorage();
    notifySubscribers();

    try {
      await setDoc(doc(db, 'ticket_comments', comment.id), commentWithOwner);
    } catch (err) {
      console.warn("Notice: Saved comment locally. Cloud sync skipped: ", err);
    }
  },

  async deleteTicketComment(id: string): Promise<void> {
    cachedTicketComments = cachedTicketComments.filter(c => c.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'ticket_comments', id));
    } catch (err) {
      console.warn("Notice: Deleted comment locally. Cloud sync skipped: ", err);
    }
  },

  getEmailTemplates(): EmailTemplate[] {
    return [...cachedEmailTemplates];
  },

  async saveEmailTemplate(template: EmailTemplate): Promise<void> {
    const idx = cachedEmailTemplates.findIndex(et => et.id === template.id);
    if (idx > -1) {
      cachedEmailTemplates[idx] = template;
    } else {
      cachedEmailTemplates.push(template);
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'email_templates', template.id), { ...template, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `email_templates/${template.id}`);
    }
  },

  getEmailLogs(): EmailLog[] {
    return [...cachedEmailLogs];
  },

  async saveEmailLog(log: EmailLog): Promise<void> {
    const userId = auth.currentUser?.uid || 'shared-servicedesk-owner';
    const logWithOwner = { ...log, ownerId: userId };

    cachedEmailLogs.push(logWithOwner);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await setDoc(doc(db, 'email_logs', log.id), logWithOwner);
    } catch (err) {
      console.warn("Notice: Saved email log locally: ", err);
    }
  },

  // Public fetch tickets for reporters (by email lookup)
  async fetchTicketsByReporterEmail(email: string): Promise<Ticket[]> {
    try {
      const q = query(collection(db, 'tickets'), where('reporterEmail', '==', email.trim().toLowerCase()));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ticket));
      
      // Merge with cache avoiding duplicates
      const merged = [...cachedTickets];
      list.forEach(ticket => {
        const existIdx = merged.findIndex(t => t.id === ticket.id);
        if (existIdx > -1) {
          merged[existIdx] = ticket;
        } else {
          merged.push(ticket);
        }
      });
      cachedTickets = merged;
      notifySubscribers();

      return list;
    } catch (err) {
      console.warn("Notice: Fallback to local tickets for email lookup. Detail: ", err);
      return cachedTickets.filter(t => t.reporterEmail.trim().toLowerCase() === email.trim().toLowerCase());
    }
  },

  // Public fetch comments for a ticket
  async fetchCommentsForTicketPublic(ticketId: string): Promise<TicketComment[]> {
    try {
      const q = query(collection(db, 'ticket_comments'), where('ticketId', '==', ticketId));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as TicketComment));
      
      // Merge with cache avoiding duplicates
      const merged = [...cachedTicketComments];
      list.forEach(comment => {
        const existIdx = merged.findIndex(c => c.id === comment.id);
        if (existIdx > -1) {
          merged[existIdx] = comment;
        } else {
          merged.push(comment);
        }
      });
      cachedTicketComments = merged;
      notifySubscribers();

      return list;
    } catch (err) {
      console.warn("Notice: Fallback to local comments. Detail: ", err);
      return cachedTicketComments.filter(c => c.ticketId === ticketId);
    }
  },

  // --- PROJECTS & ACTIVITIES API ---
  getProjects(): Project[] {
    return [...cachedProjects];
  },

  async saveProject(project: Project): Promise<void> {
    const idx = cachedProjects.findIndex(p => p.id === project.id);
    if (idx > -1) {
      cachedProjects[idx] = { ...project };
    } else {
      cachedProjects.push({ ...project });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'projects', project.id), { ...project, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `projects/${project.id}`);
    }
  },

  async deleteProject(id: string): Promise<void> {
    cachedProjects = cachedProjects.filter(p => p.id !== id);
    // Also remove activities belonging to this project
    const deletedActivities = cachedProjectActivities.filter(a => a.projectId === id);
    cachedProjectActivities = cachedProjectActivities.filter(a => a.projectId !== id);
    
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'projects', id));
      for (const act of deletedActivities) {
        await deleteDoc(doc(db, 'project_activities', act.id)).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
    }
  },

  getProjectActivities(): ProjectActivity[] {
    return [...cachedProjectActivities];
  },

  async saveProjectActivity(activity: ProjectActivity): Promise<void> {
    const idx = cachedProjectActivities.findIndex(a => a.id === activity.id);
    if (idx > -1) {
      cachedProjectActivities[idx] = { ...activity };
    } else {
      cachedProjectActivities.push({ ...activity });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await setDoc(doc(db, 'project_activities', activity.id), { ...activity, ownerId: userId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `project_activities/${activity.id}`);
    }
  },

  async deleteProjectActivity(id: string): Promise<void> {
    cachedProjectActivities = cachedProjectActivities.filter(a => a.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'project_activities', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `project_activities/${id}`);
    }
  },

  async reorderProjectActivities(reorderedList: ProjectActivity[]): Promise<void> {
    // Merge reordered items into cache
    const idMap = new Map(reorderedList.map(a => [a.id, a]));
    cachedProjectActivities = [
      ...reorderedList,
      ...cachedProjectActivities.filter(a => !idMap.has(a.id))
    ];
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      for (const act of reorderedList) {
        await setDoc(doc(db, 'project_activities', act.id), { ...act, ownerId: userId }).catch(() => {});
      }
    } catch (err) {
      console.warn("Error persisting reordered activities to Firestore:", err);
    }
  },

  async cleanSampleProjects(): Promise<{ removedProjects: number; removedActivities: number }> {
    const removedProjects = cachedProjects.filter(p => isSampleProject(p)).length;
    const removedActivities = cachedProjectActivities.filter(a => isSampleProjectActivity(a)).length;

    cachedProjects = cachedProjects.filter(p => !isSampleProject(p));
    cachedProjectActivities = cachedProjectActivities.filter(a => !isSampleProjectActivity(a));
    saveToLocalStorage();
    notifySubscribers();

    try {
      const pSnap = await getDocs(collection(db, 'projects'));
      for (const d of pSnap.docs) {
        if (isSampleProject({ id: d.id, ...d.data() })) {
          await deleteDoc(doc(db, 'projects', d.id)).catch(() => {});
        }
      }
      const aSnap = await getDocs(collection(db, 'project_activities'));
      for (const d of aSnap.docs) {
        if (isSampleProjectActivity({ id: d.id, ...d.data() })) {
          await deleteDoc(doc(db, 'project_activities', d.id)).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Clean sample projects firestore sync warning:", e);
    }

    return { removedProjects, removedActivities };
  },

  // --- GEDEELDE AGENDA (SHARED CALENDARS) API ---
  getSharedCalendars(): SharedCalendar[] {
    return [...cachedSharedCalendars];
  },

  getSharedCalendarByIdOrSlug(idOrSlug: string): SharedCalendar | undefined {
    if (!idOrSlug) return undefined;
    const clean = idOrSlug.trim().toLowerCase();
    return cachedSharedCalendars.find(c => c.id === idOrSlug || c.slug.toLowerCase() === clean);
  },

  async saveSharedCalendar(calendar: SharedCalendar): Promise<void> {
    const idx = cachedSharedCalendars.findIndex(c => c.id === calendar.id);
    if (idx > -1) {
      cachedSharedCalendars[idx] = { ...calendar };
    } else {
      cachedSharedCalendars.push({ ...calendar });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'shared_calendars', calendar.id), {
        ...calendar,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shared_calendars/${calendar.id}`);
    }
  },

  async deleteSharedCalendar(id: string): Promise<void> {
    cachedSharedCalendars = cachedSharedCalendars.filter(c => c.id !== id);
    // Also delete associated events
    cachedSharedCalendarEvents = cachedSharedCalendarEvents.filter(e => e.calendarId !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'shared_calendars', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shared_calendars/${id}`);
    }
  },

  getSharedCalendarEvents(calendarIdOrSlug?: string): SharedCalendarEvent[] {
    if (!calendarIdOrSlug) {
      return [...cachedSharedCalendarEvents];
    }
    const cal = this.getSharedCalendarByIdOrSlug(calendarIdOrSlug);
    const targetCalId = cal ? cal.id : calendarIdOrSlug;
    return cachedSharedCalendarEvents.filter(e => e.calendarId === targetCalId);
  },

  getSharedCalendarEventById(id: string): SharedCalendarEvent | undefined {
    return cachedSharedCalendarEvents.find(e => e.id === id);
  },

  async saveSharedCalendarEvent(event: SharedCalendarEvent): Promise<void> {
    const idx = cachedSharedCalendarEvents.findIndex(e => e.id === event.id);
    if (idx > -1) {
      cachedSharedCalendarEvents[idx] = { ...event };
    } else {
      cachedSharedCalendarEvents.push({ ...event });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'shared_calendar_events', event.id), {
        ...event,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shared_calendar_events/${event.id}`);
    }
  },

  async deleteSharedCalendarEvent(id: string): Promise<void> {
    cachedSharedCalendarEvents = cachedSharedCalendarEvents.filter(e => e.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'shared_calendar_events', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shared_calendar_events/${id}`);
    }
  },

  // Subscribe to all shared calendars in real-time
  subscribeToSharedCalendars(callback: (calendars: SharedCalendar[]) => void): () => void {
    const trigger = () => {
      callback([...cachedSharedCalendars]);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  // Subscribe to events for a specific calendar
  subscribeToSharedCalendarEvents(calendarId: string, callback: (events: SharedCalendarEvent[]) => void): () => void {
    const trigger = () => {
      const filtered = cachedSharedCalendarEvents.filter(e => e.calendarId === calendarId);
      callback(filtered);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  // Subscribe to updates for a specific shared calendar & its events in real-time
  subscribeToSharedCalendar(idOrSlug: string, callback: (cal: SharedCalendar | null, events: SharedCalendarEvent[]) => void): () => void {
    const fetchAndTrigger = () => {
      const cal = this.getSharedCalendarByIdOrSlug(idOrSlug) || null;
      const targetId = cal ? cal.id : idOrSlug;
      const evts = cachedSharedCalendarEvents.filter(e => e.calendarId === targetId);
      callback(cal, evts);
    };

    // Listen to global subscribers
    const unsub = this.subscribe(() => {
      fetchAndTrigger();
    });

    return unsub;
  },

  // --- NOTITIES, AFSPRAKEN EN ACTIES (MEETINGS) API ---
  getMeetings(): Meeting[] {
    return [...cachedMeetings];
  },

  getMeetingById(id: string): Meeting | undefined {
    return cachedMeetings.find(m => m.id === id);
  },

  async fetchMeetingAsync(id: string): Promise<Meeting | null> {
    const local = cachedMeetings.find(m => m.id === id);
    if (local) return local;

    try {
      const snap = await getDoc(doc(db, 'meetings', id));
      if (snap.exists()) {
        const meeting = { ...snap.data(), id: snap.id } as Meeting;
        if (!cachedMeetings.some(m => m.id === id)) {
          cachedMeetings.push(meeting);
          saveToLocalStorage();
          notifySubscribers();
        }
        return meeting;
      }
    } catch (err) {
      console.warn("Could not fetch meeting from Firestore:", err);
    }
    return null;
  },

  async fetchMeetingDetailsAsync(id: string): Promise<{ meeting: Meeting | null; agreements: MeetingAgreement[]; actionItems: MeetingActionItem[] }> {
    const meeting = await this.fetchMeetingAsync(id);
    let agreements = cachedMeetingAgreements.filter(a => a.meetingId === id);
    let actionItems = cachedMeetingActionItems.filter(a => a.meetingId === id);

    if (meeting && (agreements.length === 0 || actionItems.length === 0)) {
      try {
        const [agrSnap, actSnap] = await Promise.all([
          getDocs(collection(db, 'meeting_agreements')),
          getDocs(collection(db, 'meeting_action_items'))
        ]);
        const serverAgreements = agrSnap.docs.map(d => ({ ...d.data(), id: d.id } as MeetingAgreement)).filter(a => a.meetingId === id);
        const serverActions = actSnap.docs.map(d => ({ ...d.data(), id: d.id } as MeetingActionItem)).filter(a => a.meetingId === id);
        
        if (serverAgreements.length > 0) agreements = serverAgreements;
        if (serverActions.length > 0) actionItems = serverActions;
      } catch (e) {
        console.warn("Could not fetch meeting related records:", e);
      }
    }

    return { meeting, agreements, actionItems };
  },

  async saveMeeting(meeting: Meeting): Promise<void> {
    const idx = cachedMeetings.findIndex(m => m.id === meeting.id);
    if (idx > -1) {
      cachedMeetings[idx] = { ...meeting };
    } else {
      cachedMeetings.push({ ...meeting });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'meetings', meeting.id), {
        ...meeting,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `meetings/${meeting.id}`);
    }
  },

  async deleteMeeting(id: string): Promise<void> {
    cachedMeetings = cachedMeetings.filter(m => m.id !== id);
    // Also remove associated agreements, notes and action items
    cachedMeetingAgreements = cachedMeetingAgreements.filter(a => a.meetingId !== id);
    cachedMeetingNotes = cachedMeetingNotes.filter(n => n.meetingId !== id);
    cachedMeetingActionItems = cachedMeetingActionItems.filter(act => act.meetingId !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'meetings', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `meetings/${id}`);
    }
  },

  getMeetingAgreements(meetingId?: string): MeetingAgreement[] {
    if (!meetingId) {
      return [...cachedMeetingAgreements];
    }
    return cachedMeetingAgreements.filter(a => a.meetingId === meetingId);
  },

  getMeetingAgreementById(id: string): MeetingAgreement | undefined {
    return cachedMeetingAgreements.find(a => a.id === id);
  },

  async saveMeetingAgreement(agreement: MeetingAgreement): Promise<void> {
    const idx = cachedMeetingAgreements.findIndex(a => a.id === agreement.id);
    if (idx > -1) {
      cachedMeetingAgreements[idx] = { ...agreement };
    } else {
      cachedMeetingAgreements.push({ ...agreement });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'meeting_agreements', agreement.id), {
        ...agreement,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `meeting_agreements/${agreement.id}`);
    }
  },

  async deleteMeetingAgreement(id: string): Promise<void> {
    cachedMeetingAgreements = cachedMeetingAgreements.filter(a => a.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'meeting_agreements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `meeting_agreements/${id}`);
    }
  },

  getMeetingNotes(meetingId?: string): MeetingNote[] {
    if (!meetingId) {
      return [...cachedMeetingNotes];
    }
    return cachedMeetingNotes.filter(n => n.meetingId === meetingId);
  },

  getMeetingNoteById(id: string): MeetingNote | undefined {
    return cachedMeetingNotes.find(n => n.id === id);
  },

  async saveMeetingNote(note: MeetingNote): Promise<void> {
    const idx = cachedMeetingNotes.findIndex(n => n.id === note.id);
    if (idx > -1) {
      cachedMeetingNotes[idx] = { ...note };
    } else {
      cachedMeetingNotes.push({ ...note });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'meeting_notes', note.id), {
        ...note,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `meeting_notes/${note.id}`);
    }
  },

  async deleteMeetingNote(id: string): Promise<void> {
    cachedMeetingNotes = cachedMeetingNotes.filter(n => n.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'meeting_notes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `meeting_notes/${id}`);
    }
  },

  getMeetingActionItems(meetingId?: string): MeetingActionItem[] {
    if (!meetingId) {
      return [...cachedMeetingActionItems];
    }
    return cachedMeetingActionItems.filter(a => a.meetingId === meetingId);
  },

  getMeetingActionItemById(id: string): MeetingActionItem | undefined {
    return cachedMeetingActionItems.find(a => a.id === id);
  },

  getMeetingActionItem(id: string): MeetingActionItem | undefined {
    return cachedMeetingActionItems.find(a => a.id === id);
  },

  async updateActionItemStatus(id: string, status: ActionItemStatus): Promise<void> {
    const item = cachedMeetingActionItems.find(a => a.id === id);
    if (!item) return;
    const updated: MeetingActionItem = {
      ...item,
      status,
      completedAt: status === 'gereed' ? new Date().toISOString() : undefined
    };
    await this.saveMeetingActionItem(updated);
  },

  async addActionItemRemark(id: string, remark: ActionItemRemark): Promise<void> {
    const item = cachedMeetingActionItems.find(a => a.id === id);
    if (!item) return;
    const existingRemarks = item.remarks || [];
    const updated: MeetingActionItem = {
      ...item,
      remarks: [...existingRemarks, remark],
      updatedAt: new Date().toISOString()
    };
    await this.saveMeetingActionItem(updated);
  },

  async saveMeetingActionItem(item: MeetingActionItem): Promise<void> {
    const idx = cachedMeetingActionItems.findIndex(a => a.id === item.id);
    if (idx > -1) {
      cachedMeetingActionItems[idx] = { ...item };
    } else {
      cachedMeetingActionItems.push({ ...item });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'meeting_action_items', item.id), {
        ...item,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `meeting_action_items/${item.id}`);
    }
  },

  async deleteMeetingActionItem(id: string): Promise<void> {
    cachedMeetingActionItems = cachedMeetingActionItems.filter(a => a.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    try {
      await deleteDoc(doc(db, 'meeting_action_items', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `meeting_action_items/${id}`);
    }
  },

  getMeetingEmailTemplates(): MeetingEmailTemplate[] {
    return [...cachedMeetingTemplates];
  },

  async saveMeetingEmailTemplate(template: MeetingEmailTemplate): Promise<void> {
    const idx = cachedMeetingTemplates.findIndex(t => t.id === template.id);
    if (idx > -1) {
      cachedMeetingTemplates[idx] = { ...template };
    } else {
      cachedMeetingTemplates.push({ ...template });
    }
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    try {
      await setDoc(doc(db, 'meeting_templates', template.id), {
        ...template,
        ...(userId ? { ownerId: userId } : {})
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `meeting_templates/${template.id}`);
    }
  },

  subscribeToMeetings(callback: (meetings: Meeting[]) => void): () => void {
    const trigger = () => {
      callback([...cachedMeetings]);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  subscribeToMeetingAgreements(callback: (agreements: MeetingAgreement[]) => void): () => void {
    const trigger = () => {
      callback([...cachedMeetingAgreements]);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  subscribeToMeetingNotes(callback: (notes: MeetingNote[]) => void): () => void {
    const trigger = () => {
      callback([...cachedMeetingNotes]);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  subscribeToMeetingActionItems(callback: (items: MeetingActionItem[]) => void): () => void {
    const trigger = () => {
      callback([...cachedMeetingActionItems]);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  subscribeToMeetingEmailTemplates(callback: (templates: MeetingEmailTemplate[]) => void): () => void {
    const trigger = () => {
      callback([...cachedMeetingTemplates]);
    };
    trigger();
    return this.subscribe(() => {
      trigger();
    });
  },

  // --- DATA BACKUP (IMPORT / EXPORT) API ---
  exportAllData(): BackupDataPayload {
    const customProdUrl = localStorage.getItem('custom_production_url');

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'IT Platform Twente - Activity Planner',
      sourceOrigin: window.location.origin,
      data: {
        polls: [...cachedPolls],
        invitees: [...cachedInvitees],
        contacts: [...cachedContacts],
        notifications: [...cachedNotifications],
        tasks: [...cachedTasks],
        taskStatuses: [...cachedStatuses],
        taskCategories: [...cachedCategories],
        calendarCategories: [...cachedCalendarCategories],
        yearEvents: [...cachedYearEvents],
        ticketCategories: [...cachedTicketCategories],
        ticketStatuses: [...cachedTicketStatuses],
        ticketHandlers: [...cachedTicketHandlers],
        ticketComments: [...cachedTicketComments],
        tickets: [...cachedTickets],
        emailTemplates: [...cachedEmailTemplates],
        emailLogs: [...cachedEmailLogs],
        projects: [...cachedProjects],
        projectActivities: [...cachedProjectActivities],
        sharedCalendars: [...cachedSharedCalendars],
        sharedCalendarEvents: [...cachedSharedCalendarEvents],
        meetings: [...cachedMeetings],
        meetingAgreements: [...cachedMeetingAgreements],
        meetingNotes: [...cachedMeetingNotes],
        meetingActionItems: [...cachedMeetingActionItems],
        meetingTemplates: [...cachedMeetingTemplates],
        customProductionUrl: customProdUrl || null
      }
    };
  },

  importData(payload: BackupDataPayload, options: ImportOptions): string[] {
    const summary: string[] = [];
    const { mode, selectedModules } = options;
    const data = payload.data;
    const userId = auth.currentUser?.uid;

    if (!data) return summary;

    // Helper for processing array merge/overwrite
    const processList = <T extends { id: string }>(
      currentList: T[], 
      newList: T[] | undefined, 
      moduleKey: string
    ): T[] => {
      if (!newList || !selectedModules.includes(moduleKey)) return currentList;
      if (mode === 'overwrite') {
        return [...newList];
      } else {
        const merged = [...currentList];
        newList.forEach(item => {
          const idx = merged.findIndex(x => x.id === item.id);
          if (idx > -1) {
            merged[idx] = { ...merged[idx], ...item };
          } else {
            merged.push(item);
          }
        });
        return merged;
      }
    };

    // 1. Polls & Invitees
    if (selectedModules.includes('polls')) {
      if (data.polls) {
        cachedPolls = processList(cachedPolls, data.polls, 'polls');
        summary.push(`${cachedPolls.length} datumprikkers`);
      }
      if (data.invitees) {
        cachedInvitees = processList(cachedInvitees, data.invitees, 'polls');
      }
    }

    // 2. Contacts
    if (selectedModules.includes('contacts') && data.contacts) {
      cachedContacts = processList(cachedContacts, data.contacts, 'contacts');
      summary.push(`${cachedContacts.length} contacten`);
    }

    // 3. Tasks
    if (selectedModules.includes('tasks')) {
      if (data.tasks) {
        cachedTasks = processList(cachedTasks, data.tasks, 'tasks');
        summary.push(`${cachedTasks.length} taken`);
      }
      if (data.taskStatuses) cachedStatuses = processList(cachedStatuses, data.taskStatuses, 'tasks');
      if (data.taskCategories) cachedCategories = processList(cachedCategories, data.taskCategories, 'tasks');
    }

    // 4. Year Events
    if (selectedModules.includes('yearEvents')) {
      if (data.yearEvents) {
        cachedYearEvents = processList(cachedYearEvents, data.yearEvents, 'yearEvents');
        summary.push(`${cachedYearEvents.length} kalenderevents`);
      }
      if (data.calendarCategories) cachedCalendarCategories = processList(cachedCalendarCategories, data.calendarCategories, 'yearEvents');
    }

    // 5. Tickets
    if (selectedModules.includes('tickets')) {
      if (data.tickets) {
        cachedTickets = processList(cachedTickets, data.tickets, 'tickets');
        summary.push(`${cachedTickets.length} tickets`);
      }
      if (data.ticketCategories) cachedTicketCategories = processList(cachedTicketCategories, data.ticketCategories, 'tickets');
      if (data.ticketStatuses) cachedTicketStatuses = processList(cachedTicketStatuses, data.ticketStatuses, 'tickets');
      if (data.ticketHandlers) cachedTicketHandlers = processList(cachedTicketHandlers, data.ticketHandlers, 'tickets');
      if (data.ticketComments) cachedTicketComments = processList(cachedTicketComments, data.ticketComments, 'tickets');
    }

    // 6. Email Templates
    if (selectedModules.includes('emailTemplates')) {
      if (data.emailTemplates) {
        cachedEmailTemplates = processList(cachedEmailTemplates, data.emailTemplates, 'emailTemplates');
        summary.push(`${cachedEmailTemplates.length} e-mailsjablonen`);
      }
      if (data.emailLogs) cachedEmailLogs = processList(cachedEmailLogs, data.emailLogs, 'emailTemplates');
    }

    // 7. Projects
    if (selectedModules.includes('projects')) {
      if (data.projects) {
        cachedProjects = processList(cachedProjects, data.projects, 'projects');
        summary.push(`${cachedProjects.length} projecten`);
      }
      if (data.projectActivities) {
        cachedProjectActivities = processList(cachedProjectActivities, data.projectActivities, 'projects');
      }
    }

    // 8. Shared Calendars
    if (selectedModules.includes('sharedCalendars')) {
      if (data.sharedCalendars) {
        cachedSharedCalendars = processList(cachedSharedCalendars, data.sharedCalendars, 'sharedCalendars');
        summary.push(`${cachedSharedCalendars.length} gedeelde agenda's`);
      }
      if (data.sharedCalendarEvents) {
        cachedSharedCalendarEvents = processList(cachedSharedCalendarEvents, data.sharedCalendarEvents, 'sharedCalendars');
      }
    }

    // 9. Meetings, Agreements & Action Items
    if (selectedModules.includes('meetings')) {
      if (data.meetings) {
        cachedMeetings = processList(cachedMeetings, data.meetings, 'meetings');
        summary.push(`${cachedMeetings.length} meetings`);
      }
      if (data.meetingAgreements) {
        cachedMeetingAgreements = processList(cachedMeetingAgreements, data.meetingAgreements, 'meetings');
      }
      if (data.meetingNotes) {
        cachedMeetingNotes = processList(cachedMeetingNotes, data.meetingNotes, 'meetings');
        summary.push(`${cachedMeetingNotes.length} notities`);
      }
      if (data.meetingActionItems) {
        cachedMeetingActionItems = processList(cachedMeetingActionItems, data.meetingActionItems, 'meetings');
        summary.push(`${cachedMeetingActionItems.length} actiepunten`);
      }
      if (data.meetingTemplates) {
        cachedMeetingTemplates = processList(cachedMeetingTemplates, data.meetingTemplates, 'meetings');
      }
    }

    // 10. Settings
    if (selectedModules.includes('settings') && data.customProductionUrl) {
      localStorage.setItem('custom_production_url', data.customProductionUrl);
      summary.push('Instellingen');
    }

    // Save memory cache to localStorage
    saveToLocalStorage();

    // Trigger events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('localDataImported'));
    notifySubscribers();

    // Background sync to Cloud Firestore if signed in
    if (userId) {
      setTimeout(async () => {
        try {
          if (data.polls) {
            for (const p of data.polls) {
              await setDoc(doc(db, 'polls', p.id), { ...p, ownerId: userId }).catch(() => {});
            }
          }
          if (data.invitees) {
            for (const i of data.invitees) {
              await setDoc(doc(db, 'invitees', i.id), { ...i, ownerId: userId }).catch(() => {});
            }
          }
          if (data.contacts) {
            for (const c of data.contacts) {
              await setDoc(doc(db, 'contacts', c.id), { ...c, ownerId: userId }).catch(() => {});
            }
          }
          if (data.tasks) {
            for (const t of data.tasks) {
              await setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: userId }).catch(() => {});
            }
          }
          if (data.taskStatuses) {
            for (const s of data.taskStatuses) {
              await setDoc(doc(db, 'task_statuses', s.id), { ...s, ownerId: userId }).catch(() => {});
            }
          }
          if (data.taskCategories) {
            for (const cat of data.taskCategories) {
              await setDoc(doc(db, 'task_categories', cat.id), { ...cat, ownerId: userId }).catch(() => {});
            }
          }
          if (data.yearEvents) {
            for (const ye of data.yearEvents) {
              await setDoc(doc(db, 'year_events', ye.id), { ...ye, ownerId: userId }).catch(() => {});
            }
          }
          if (data.calendarCategories) {
            for (const cc of data.calendarCategories) {
              await setDoc(doc(db, 'calendar_categories', cc.id), { ...cc, ownerId: userId }).catch(() => {});
            }
          }
          if (data.projects) {
            for (const proj of data.projects) {
              await setDoc(doc(db, 'projects', proj.id), { ...proj, ownerId: userId }).catch(() => {});
            }
          }
          if (data.projectActivities) {
            for (const act of data.projectActivities) {
              await setDoc(doc(db, 'project_activities', act.id), { ...act, ownerId: userId }).catch(() => {});
            }
          }
          if (data.sharedCalendars) {
            for (const sc of data.sharedCalendars) {
              await setDoc(doc(db, 'shared_calendars', sc.id), { ...sc, ownerId: userId }).catch(() => {});
            }
          }
          if (data.sharedCalendarEvents) {
            for (const sce of data.sharedCalendarEvents) {
              await setDoc(doc(db, 'shared_calendar_events', sce.id), { ...sce, ownerId: userId }).catch(() => {});
            }
          }
          if (data.meetings) {
            for (const m of data.meetings) {
              await setDoc(doc(db, 'meetings', m.id), { ...m, ownerId: userId }).catch(() => {});
            }
          }
          if (data.meetingAgreements) {
            for (const a of data.meetingAgreements) {
              await setDoc(doc(db, 'meeting_agreements', a.id), { ...a, ownerId: userId }).catch(() => {});
            }
          }
          if (data.meetingNotes) {
            for (const n of data.meetingNotes) {
              await setDoc(doc(db, 'meeting_notes', n.id), { ...n, ownerId: userId }).catch(() => {});
            }
          }
          if (data.meetingActionItems) {
            for (const act of data.meetingActionItems) {
              await setDoc(doc(db, 'meeting_action_items', act.id), { ...act, ownerId: userId }).catch(() => {});
            }
          }
          if (data.meetingTemplates) {
            for (const t of data.meetingTemplates) {
              await setDoc(doc(db, 'meeting_templates', t.id), { ...t, ownerId: userId }).catch(() => {});
            }
          }
        } catch (err) {
          console.warn("Notice: Cloud sync warning during import:", err);
        }
      }, 100);
    }

    return summary;
  },

  // --- RECOVERY & RESILIENCE API ---
  capturePreAuthBackup(reason: string): RecoverySnapshot | null {
    return captureVaultSnapshot(reason);
  },

  captureSnapshot(reason: string): RecoverySnapshot | null {
    return captureVaultSnapshot(reason);
  },

  scanForRecoverableData(): RecoverySnapshot[] {
    return scanForRecoverableData();
  },

  getRecoveryVault(): RecoverySnapshot[] {
    try {
      const raw = localStorage.getItem('planner_recovery_vault');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  restoreSnapshot(
    snapshotOrPayload: RecoverySnapshot | BackupDataPayload,
    options?: { mode?: 'overwrite' | 'merge' }
  ): { restoredActivities: number; restoredProjects: number; restoredTasks: number } {
    return restoreSnapshot(snapshotOrPayload, options);
  },

  autoRecoverIfEmpty(): boolean {
    if (cachedProjectActivities.length > 0 && cachedProjects.length > 0 && cachedTasks.length > 0) {
      return false;
    }
    const list = scanForRecoverableData();
    const candidate = list.find(c => c.counts.projectActivities > 0 || c.counts.projects > 0 || c.counts.tasks > 0);
    if (candidate) {
      console.log('Auto-restoring planner data from snapshot:', candidate.reason, candidate.timestamp);
      restoreSnapshot(candidate, { mode: 'merge' });
      return true;
    }
    return false;
  },

  loadRegionalProjectsDataset(mode: 'merge' | 'overwrite' = 'merge'): string[] {
    return this.importData(RDNG_BACKUP_PAYLOAD, {
      mode,
      selectedModules: ['projects', 'tasks', 'tickets', 'contacts']
    });
  },

  loadRdng3Dataset(mode: 'merge' | 'overwrite' = 'merge'): string[] {
    return this.loadRegionalProjectsDataset(mode);
  },

  loadTwoWeeksAgoDataset(mode: 'merge' | 'overwrite' = 'merge'): string[] {
    return this.importData(RDNG_BACKUP_PAYLOAD, {
      mode,
      selectedModules: ['projects', 'tasks', 'tickets', 'contacts']
    });
  },

  getRegionalProjectsPayload(): BackupDataPayload {
    return RDNG_BACKUP_PAYLOAD;
  },

  getRdng3Payload(): BackupDataPayload {
    return RDNG_BACKUP_PAYLOAD;
  },

  // --- VAKANTIE-, VERLOF- EN AFWEZIGHEIDSKALENDER API ---
  getVacationCalendars(): VacationCalendar[] {
    return [...cachedVacationCalendars];
  },

  getVacationCalendar(idOrSlug: string): VacationCalendar | null {
    return cachedVacationCalendars.find(c => c.id === idOrSlug || c.slug === idOrSlug) || null;
  },

  async saveVacationCalendar(calendar: VacationCalendar): Promise<void> {
    const userId = auth.currentUser?.uid;
    const nowIso = new Date().toISOString();
    const updatedCal: VacationCalendar = {
      ...calendar,
      updatedAt: nowIso,
      createdAt: calendar.createdAt || nowIso
    };

    const idx = cachedVacationCalendars.findIndex(c => c.id === calendar.id);
    if (idx > -1) {
      cachedVacationCalendars[idx] = updatedCal;
    } else {
      cachedVacationCalendars.push(updatedCal);
    }

    saveToLocalStorage();
    notifySubscribers();

    if (userId) {
      try {
        await setDoc(doc(db, 'vacation_calendars', calendar.id), { ...updatedCal, ownerId: userId });
      } catch (err) {
        console.warn("Notice: Saved vacation calendar locally, cloud sync error:", err);
      }
    }
  },

  async deleteVacationCalendar(id: string): Promise<void> {
    cachedVacationCalendars = cachedVacationCalendars.filter(c => c.id !== id);
    cachedVacationEntries = cachedVacationEntries.filter(e => e.calendarId !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'vacation_calendars', id));
      // Delete entries in firestore
      const entriesSnap = await getDocs(collection(db, 'vacation_entries'));
      for (const d of entriesSnap.docs) {
        if (d.data().calendarId === id) {
          await deleteDoc(doc(db, 'vacation_entries', d.id)).catch(() => {});
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vacation_calendars/${id}`);
    }
  },

  getVacationEntries(calendarId?: string): VacationEntry[] {
    if (calendarId) {
      return cachedVacationEntries.filter(e => e.calendarId === calendarId);
    }
    return [...cachedVacationEntries];
  },

  getVacationEntry(id: string): VacationEntry | null {
    return cachedVacationEntries.find(e => e.id === id) || null;
  },

  async saveVacationEntry(entry: VacationEntry): Promise<void> {
    const userId = auth.currentUser?.uid;
    const nowIso = new Date().toISOString();
    const updatedEntry: VacationEntry = {
      ...entry,
      updatedAt: nowIso,
      createdAt: entry.createdAt || nowIso
    };

    const idx = cachedVacationEntries.findIndex(e => e.id === entry.id);
    if (idx > -1) {
      cachedVacationEntries[idx] = updatedEntry;
    } else {
      cachedVacationEntries.push(updatedEntry);
    }

    saveToLocalStorage();
    notifySubscribers();

    if (userId) {
      try {
        await setDoc(doc(db, 'vacation_entries', entry.id), { ...updatedEntry, ownerId: userId });
      } catch (err) {
        console.warn("Notice: Saved vacation entry locally, cloud sync error:", err);
      }
    }
  },

  async deleteVacationEntry(id: string): Promise<void> {
    cachedVacationEntries = cachedVacationEntries.filter(e => e.id !== id);
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await deleteDoc(doc(db, 'vacation_entries', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vacation_entries/${id}`);
    }
  },

  async deleteVacationEntriesForMember(calendarId: string, memberId: string): Promise<void> {
    const toDeleteIds = cachedVacationEntries
      .filter(e => e.calendarId === calendarId && e.memberId === memberId)
      .map(e => e.id);

    cachedVacationEntries = cachedVacationEntries.filter(
      e => !(e.calendarId === calendarId && e.memberId === memberId)
    );
    saveToLocalStorage();
    notifySubscribers();

    const userId = auth.currentUser?.uid;
    if (userId) {
      for (const id of toDeleteIds) {
        deleteDoc(doc(db, 'vacation_entries', id)).catch(() => {});
      }
    }
  }
};

export interface BackupDataPayload {
  version: number;
  exportedAt: string;
  appName: string;
  sourceOrigin?: string;
  data: {
    polls?: Poll[];
    invitees?: Invitee[];
    contacts?: Contact[];
    notifications?: Notification[];
    tasks?: Task[];
    taskStatuses?: TaskStatus[];
    taskCategories?: TaskCategory[];
    calendarCategories?: CalendarCategory[];
    yearEvents?: YearEvent[];
    ticketCategories?: TicketCategory[];
    ticketStatuses?: TicketStatus[];
    ticketHandlers?: TicketHandler[];
    ticketComments?: TicketComment[];
    tickets?: Ticket[];
    emailTemplates?: EmailTemplate[];
    emailLogs?: EmailLog[];
    projects?: any[];
    projectActivities?: any[];
    sharedCalendars?: SharedCalendar[];
    sharedCalendarEvents?: SharedCalendarEvent[];
    meetings?: Meeting[];
    meetingAgreements?: MeetingAgreement[];
    meetingNotes?: MeetingNote[];
    meetingActionItems?: MeetingActionItem[];
    meetingTemplates?: MeetingEmailTemplate[];
    vacationCalendars?: VacationCalendar[];
    vacationEntries?: VacationEntry[];
    customProductionUrl?: string | null;
  };
}

export interface ImportOptions {
  mode: 'merge' | 'overwrite';
  selectedModules: string[];
}

