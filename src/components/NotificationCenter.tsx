import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Mail,
  Send,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Filter,
  Search,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Trash2,
  Share2,
  ListTodo,
  FolderKanban,
  Eye,
  X,
  Vote,
  CalendarDays,
  Edit3,
  Plus
} from 'lucide-react';
import {
  Poll,
  Invitee,
  Contact,
  Task,
  TaskStatus,
  Meeting,
  Notification,
  Language,
  MeetingParticipant
} from '../types';
import { dbService } from '../services/db';
import { getPublicOrigin } from '../utils/url';
import { wrapInHtmlEmailTemplate, wrapInMeetingEmailTemplate } from '../services/gmail';
import { SearchableContactSelect } from './SearchableContactSelect';

interface NotificationCenterProps {
  lang?: Language;
  onOpenPoll?: (pollId: string) => void;
  onOpenTasks?: () => void;
  onOpenMeetings?: (meetingId?: string) => void;
  sendEmailUnified?: (params: { to: string; subject: string; bodyHtml: string }) => Promise<any>;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  lang = 'nl',
  onOpenPoll,
  onOpenTasks,
  onOpenMeetings,
  sendEmailUnified
}) => {
  const isNl = lang === 'nl';

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'polls' | 'meetings' | 'logs'>('tasks');

  // Core Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Success / Feedback Alerts
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Email Preview & Composer Modal State
  const [showComposer, setShowComposer] = useState(false);
  const [composerType, setComposerType] = useState<'task_assignee' | 'group_tasks' | 'poll_reminder' | 'meeting_prep'>('task_assignee');
  const [composerRecipients, setComposerRecipients] = useState<{ name: string; email: string; contactId?: string }[]>([]);
  const [composerSubject, setComposerSubject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerUniqueUrl, setComposerUniqueUrl] = useState('');
  const [composerButtonText, setComposerButtonText] = useState('');
  const [composerContextItem, setComposerContextItem] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number } | null>(null);

  // Filters & Search
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [pollSearchQuery, setPollSearchQuery] = useState('');
  const [meetingSearchQuery, setMeetingSearchQuery] = useState('');
  const [logFilterType, setLogFilterType] = useState<string>('all');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Edit Meeting Modal State (direct editing of meetings inside Notification Hub)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editMeetingTitle, setEditMeetingTitle] = useState('');
  const [editMeetingDate, setEditMeetingDate] = useState('');
  const [editMeetingTime, setEditMeetingTime] = useState('');
  const [editMeetingDuration, setEditMeetingDuration] = useState<number>(60);
  const [editMeetingLocation, setEditMeetingLocation] = useState('');
  const [editMeetingParticipants, setEditMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  // Load core data
  const loadData = () => {
    setTasks(dbService.getTasks());
    setStatuses(dbService.getTaskStatuses());
    setContacts(dbService.getContacts());
    setPolls(dbService.getPolls());
    setInvitees(dbService.getInvitees());
    setMeetings(dbService.getMeetings());
    setNotifications(dbService.getNotifications());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return () => unsub();
  }, []);

  const showAlert = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  // Build public URLs
  const origin = getPublicOrigin();
  const getPersonalTaskPortalUrl = (contactId: string) => `${origin}/?assignee_tasks=${contactId}`;
  const getSingleTaskUrl = (taskId: string) => `${origin}/?task_id=${taskId}`;
  const getPollUrl = (pollId: string) => `${origin}/?poll_id=${pollId}`;
  const getMeetingAgendaUrl = (meetingId: string) => `${origin}/?meeting_agenda=${meetingId}`;

  // Assignee task summaries
  const assigneesSummary = useMemo(() => {
    const map = new Map<string, { contact: Contact; openTasks: Task[]; completedTasks: Task[] }>();

    // Initialise for all known contacts
    contacts.forEach(c => {
      map.set(c.id, { contact: c, openTasks: [], completedTasks: [] });
    });

    tasks.forEach(t => {
      if (t.archived) return;
      const ids = t.assigneeIds || [];
      ids.forEach(cid => {
        let entry = map.get(cid);
        if (!entry) {
          const found = contacts.find(c => c.id === cid);
          if (found) {
            entry = { contact: found, openTasks: [], completedTasks: [] };
            map.set(cid, entry);
          }
        }
        if (entry) {
          if (t.completed) {
            entry.completedTasks.push(t);
          } else {
            entry.openTasks.push(t);
          }
        }
      });
    });

    return Array.from(map.values())
      .filter(item => item.openTasks.length > 0 || item.completedTasks.length > 0)
      .sort((a, b) => b.openTasks.length - a.openTasks.length);
  }, [contacts, tasks]);

  // Total contacts with open tasks
  const contactsWithOpenTasks = useMemo(() => {
    return assigneesSummary.filter(a => a.openTasks.length > 0);
  }, [assigneesSummary]);

  // Open polls with pending responses
  const activePollsWithPending = useMemo(() => {
    return polls.map(p => {
      const pollInvitees = invitees.filter(i => i.pollId === p.id);
      const pending = pollInvitees.filter(i => !i.votedAt);
      const voted = pollInvitees.filter(i => !!i.votedAt);
      return {
        poll: p,
        total: pollInvitees.length,
        votedCount: voted.length,
        pendingInvitees: pending
      };
    }).filter(item => item.pendingInvitees.length > 0);
  }, [polls, invitees]);

  // Upcoming meetings
  const upcomingMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [meetings]);

  // Compose Task Reminder for single assignee
  const handleOpenAssigneeComposer = (contact: Contact, openTasks: Task[]) => {
    const personalUrl = getPersonalTaskPortalUrl(contact.id);
    const subject = isNl 
      ? `Overzicht van jouw openstaande taken (${openTasks.length}) - IT Platform Twente` 
      : `Overview of your assigned tasks (${openTasks.length}) - IT Platform Twente`;

    const taskBulletList = openTasks.map((t, idx) => {
      const deadline = t.endDate ? ` (uiterlijk: ${t.endDate})` : (t.startDate ? ` (start: ${t.startDate})` : '');
      const proj = t.projectTitle ? ` [${t.projectTitle}]` : '';
      return `${idx + 1}. ${t.title}${proj}${deadline}`;
    }).join('\n');

    const body = isNl
      ? `Beste ${contact.firstName},\n\nHierbij een overzicht van de taken die momenteel aan jou zijn toegewezen binnen IT Platform Twente:\n\n${taskBulletList}\n\nVia onderstaande unieke link kun je jouw taken direct openen, de status bijwerken (bijv. 'In behandeling' of 'Gereed'), voortgangsberichten plaatsen of notities toevoegen.\n\nMet vriendelijke groet,\nIT Platform Twente`
      : `Dear ${contact.firstName},\n\nHere is an overview of the tasks currently assigned to you:\n\n${taskBulletList}\n\nUsing the unique link below, you can view your tasks, update their status, or mark them as completed.\n\nBest regards,\nIT Platform Twente`;

    setComposerType('task_assignee');
    setComposerRecipients([{ name: `${contact.firstName} ${contact.lastName}`.trim(), email: contact.email, contactId: contact.id }]);
    setComposerSubject(subject);
    setComposerBody(body);
    setComposerUniqueUrl(personalUrl);
    setComposerButtonText(isNl ? 'Mijn Taken Bekijken & Bijwerken' : 'View & Update My Tasks');
    setComposerContextItem({ contact, openTasks });
    setShowComposer(true);
  };

  // Compose Batch Reminder for ALL assignees with open tasks
  const handleOpenBatchAssigneeComposer = () => {
    if (contactsWithOpenTasks.length === 0) {
      showAlert(isNl ? 'Er zijn momenteel geen actiehouders met openstaande taken!' : 'No assignees with open tasks found!', 'info');
      return;
    }

    const recipients = contactsWithOpenTasks.map(item => ({
      name: `${item.contact.firstName} ${item.contact.lastName}`.trim(),
      email: item.contact.email,
      contactId: item.contact.id
    }));

    const subject = isNl
      ? `Herinnering: Jouw openstaande taken bijwerken - IT Platform Twente`
      : `Reminder: Update your open tasks - IT Platform Twente`;

    const body = isNl
      ? `Beste {name},\n\nEr staan momenteel taken aan jou toegewezen die nog openstaan of in behandeling zijn.\n\nVia jouw persoonlijke link kun je direct de voortgang bijwerken, toelichtingen toevoegen of taken gereedmelden:\n{unique_url}\n\nMet vriendelijke groet,\nIT Platform Twente`
      : `Dear {name},\n\nYou have pending tasks assigned to you.\n\nPlease open your personal portal to update the status or mark them as done:\n{unique_url}\n\nBest regards,\nIT Platform Twente`;

    setComposerType('group_tasks');
    setComposerRecipients(recipients);
    setComposerSubject(subject);
    setComposerBody(body);
    setComposerUniqueUrl('{unique_url}');
    setComposerButtonText(isNl ? 'Mijn Taken Overzicht' : 'My Tasks Overview');
    setComposerContextItem({ contactsWithOpenTasks });
    setShowComposer(true);
  };

  // Compose Datumprikker Reminder
  const handleOpenPollReminderComposer = (poll: Poll, pendingInvitees: Invitee[]) => {
    const pollUrl = getPollUrl(poll.id);
    const recipients = pendingInvitees.map(inv => ({
      name: `${inv.firstName} ${inv.lastName}`.trim(),
      email: inv.email
    }));

    const subject = isNl
      ? `Herinnering: Graag je beschikbaarheid doorgeven voor "${poll.title}"`
      : `Reminder: Please vote for "${poll.title}"`;

    const body = isNl
      ? `Beste {name},\n\nJe hebt nog niet gestemd voor "${poll.title}". Om een geschikte datum te kiezen, willen we je vriendelijk vragen snel je beschikbaarheid door te geven via onderstaande link:\n\n{unique_url}\n\nAlvast bedankt!\n\nMet vriendelijke groet,\nIT Platform Twente`
      : `Dear {name},\n\nYou haven't responded yet for "${poll.title}". Please provide your availability using the link below:\n\n{unique_url}\n\nThank you!\n\nBest regards,\nIT Platform Twente`;

    setComposerType('poll_reminder');
    setComposerRecipients(recipients);
    setComposerSubject(subject);
    setComposerBody(body);
    setComposerUniqueUrl(pollUrl);
    setComposerButtonText(isNl ? 'Nu Beschikbaarheid Doorgeven' : 'Vote Now');
    setComposerContextItem({ poll, pendingInvitees });
    setShowComposer(true);
  };

  // Open Meeting Quick Edit Modal in Notification Center
  const handleOpenEditMeetingModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setEditMeetingTitle(meeting.title || '');
    setEditMeetingDate(meeting.date || '');
    setEditMeetingTime(meeting.time || '10:00');
    setEditMeetingDuration(meeting.durationMinutes || 60);
    setEditMeetingLocation(meeting.location || 'Microsoft Teams');
    setEditMeetingParticipants(meeting.participants ? [...meeting.participants] : []);
  };

  const handleSaveEditedMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    if (!editMeetingTitle.trim()) {
      showAlert(isNl ? 'Vul een geldige titel in' : 'Please enter a title', 'error');
      return;
    }

    setIsSavingMeeting(true);
    try {
      const updated: Meeting = {
        ...editingMeeting,
        title: editMeetingTitle.trim(),
        date: editMeetingDate,
        time: editMeetingTime,
        durationMinutes: editMeetingDuration,
        location: editMeetingLocation.trim(),
        participants: editMeetingParticipants,
        updatedAt: new Date().toISOString()
      };
      await dbService.saveMeeting(updated);
      setEditingMeeting(null);
      loadData();
      showAlert(isNl ? 'Overleg succesvol bijgewerkt!' : 'Meeting updated successfully!', 'success');
    } catch (err) {
      console.error("Error saving meeting:", err);
      showAlert(isNl ? 'Fout bij opslaan van overleg.' : 'Failed to save meeting.', 'error');
    } finally {
      setIsSavingMeeting(false);
    }
  };

  // Compose Meeting Agenda Preparation
  const handleOpenMeetingPrepComposer = (meeting: Meeting) => {
    const meetingUrl = getMeetingAgendaUrl(meeting.id);
    const recipients = (meeting.participants && meeting.participants.length > 0)
      ? meeting.participants.map(p => ({
          name: p.name,
          email: p.email,
          contactId: contacts.find(c => c.email.toLowerCase() === p.email.toLowerCase())?.id
        }))
      : [{ name: isNl ? 'Deelnemers' : 'Participants', email: '' }];

    const subject = isNl
      ? `Agenda & Voorbereiding voor: ${meeting.title} (${meeting.date})`
      : `Agenda & Preparation for: ${meeting.title} (${meeting.date})`;

    const locationText = meeting.location ? `\nLocatie: ${meeting.location}` : '';
    const timeText = meeting.time ? `\nTijd: ${meeting.time}${meeting.durationMinutes ? ` (${meeting.durationMinutes} min)` : ''}` : '';

    const body = isNl
      ? `Beste deelnemer,\n\nTer voorbereiding op onze bijeenkomst "${meeting.title}" sturen wij u hierbij de agenda en benodigde stukken.${timeText}${locationText}\n\nU kunt de actuele agenda, notities en actiepunten online inzien via onderstaande unieke link:\n\n{unique_url}\n\nGraag tot dan!\n\nMet vriendelijke groet,\nIT Platform Twente`
      : `Dear participant,\n\nAhead of our meeting "${meeting.title}", here is the agenda and preparation information.${timeText}${locationText}\n\nYou can view the agenda, notes, and action items online:\n\n{unique_url}\n\nLooking forward to meeting you!\n\nBest regards,\nIT Platform Twente`;

    setComposerType('meeting_prep');
    setComposerRecipients(recipients.filter(r => !!r.email));
    setComposerSubject(subject);
    setComposerBody(body);
    setComposerUniqueUrl(meetingUrl);
    setComposerButtonText(isNl ? 'Bekijk Agenda & Stukken' : 'View Agenda & Notes');
    setComposerContextItem({ meeting });
    setShowComposer(true);
  };

  // Dispatch Email Execution
  const handleDispatchNotification = async () => {
    if (composerRecipients.length === 0) {
      showAlert(isNl ? 'Geen geldige ontvangers met een e-mailadres!' : 'No valid recipients with email!', 'error');
      return;
    }

    setIsSending(true);
    setSendProgress({ sent: 0, total: composerRecipients.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < composerRecipients.length; i++) {
      const recipient = composerRecipients[i];
      if (!recipient.email) continue;

      try {
        // Compute unique recipient-specific URL if needed
        let personalUrl = composerUniqueUrl;
        if (composerType === 'group_tasks' || composerType === 'task_assignee') {
          if (recipient.contactId) {
            personalUrl = getPersonalTaskPortalUrl(recipient.contactId);
          }
        }

        // Replace placeholders in message
        const personalizedBody = composerBody
          .replace(/{name}/g, recipient.name || (isNl ? 'Deelnemer' : 'Participant'))
          .replace(/{unique_url}/g, personalUrl);

        // Wrap in styled HTML email
        const formattedHtml = composerType === 'meeting_prep'
          ? wrapInMeetingEmailTemplate(
              composerSubject,
              personalizedBody.replace(/\n/g, '<br/>'),
              {
                badge: 'Agenda-voorbereiding',
                headerTitle: composerSubject,
                actionUrl: personalUrl,
                actionText: composerButtonText || (isNl ? 'Bekijk Agenda' : 'View Agenda')
              }
            )
          : wrapInHtmlEmailTemplate(
              composerSubject,
              personalizedBody.replace(/\n/g, '<br/>'),
              personalUrl,
              composerButtonText || (isNl ? 'Open Link' : 'Open Link')
            );

        if (sendEmailUnified) {
          await sendEmailUnified({
            to: recipient.email,
            subject: composerSubject,
            bodyHtml: formattedHtml
          });
        }

        // Log this notification to database
        await dbService.logNotification({
          type: composerType === 'meeting_prep' ? 'meeting_prep' : (composerType === 'poll_reminder' ? 'poll_reminder' : 'task_reminder'),
          title: composerSubject,
          message: personalizedBody,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          uniqueUrl: personalUrl,
          itemType: composerType === 'meeting_prep' ? 'meeting' : (composerType === 'poll_reminder' ? 'poll' : 'task'),
          itemId: composerContextItem?.poll?.id || composerContextItem?.meeting?.id || undefined,
          status: 'sent'
        });

        // If it's a poll reminder, update invitee lastReminderAt
        if (composerType === 'poll_reminder' && composerContextItem?.poll?.id) {
          const inv = invitees.find(item => item.pollId === composerContextItem.poll.id && item.email.toLowerCase() === recipient.email.toLowerCase());
          if (inv) {
            await dbService.saveInvitee({ ...inv, lastReminderAt: new Date().toISOString() });
          }
        }

        successCount++;
      } catch (err) {
        console.error(`Error notifying ${recipient.email}:`, err);
        failCount++;
      }

      setSendProgress({ sent: i + 1, total: composerRecipients.length });
    }

    setIsSending(false);
    setShowComposer(false);
    setSendProgress(null);
    loadData();

    if (successCount > 0) {
      showAlert(
        isNl
          ? `Succesvol ${successCount} herinnering(en) verstuurd!${failCount > 0 ? ` (${failCount} mislukt)` : ''}`
          : `Successfully sent ${successCount} reminder(s)!${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        'success'
      );
    } else {
      showAlert(
        isNl 
          ? 'Verzending via server mislukt. Tip: gebruik de knop "Kopieer e-mailtekst" of "Mailto" om handmatig te versturen.' 
          : 'Dispatch failed. Use "Copy email text" to send manually.',
        'error'
      );
    }
  };

  // Clear all log notifications
  const handleClearLogs = async () => {
    if (window.confirm(isNl ? 'Weet u zeker dat u het hele notificatielogboek wilt wissen?' : 'Clear all notification logs?')) {
      await dbService.clearAllNotifications();
      loadData();
      showAlert(isNl ? 'Notificatielogboek gewist.' : 'Logs cleared.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Notification Hub Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-linear-to-br from-indigo-100 to-violet-100 rounded-full blur-2xl opacity-60 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/80 shadow-2xs">
                <Bell className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  {isNl ? 'Notificaties & Reminders Hub' : 'Notification & Reminder Hub'}
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  {isNl
                    ? 'Verstuur herinneringen voor openstaande taken, datumprikkers en agenda-voorbereidingen met unieke gepersonaliseerde links.'
                    : 'Dispatch task reminders, poll RSVP requests and meeting preparation notes with unique personal links.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleOpenBatchAssigneeComposer}
              className="px-4 py-2.5 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Users className="h-4 w-4" />
              <span>{isNl ? 'Herinner Alle Actiehouders' : 'Remind All Assignees'}</span>
              <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">
                {contactsWithOpenTasks.length}
              </span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">{isNl ? 'Actiehouders met taken' : 'Assignees with tasks'}</span>
              <ListTodo className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-xl font-black text-slate-800 mt-1">{contactsWithOpenTasks.length}</p>
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">{isNl ? 'Open Datumprikkers' : 'Active Polls'}</span>
              <Vote className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl font-black text-slate-800 mt-1">{activePollsWithPending.length}</p>
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">{isNl ? 'Vergaderingen' : 'Meetings'}</span>
              <CalendarDays className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-black text-slate-800 mt-1">{upcomingMeetings.length}</p>
          </div>

          <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">{isNl ? 'Logboek Berichten' : 'Logged Notifications'}</span>
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xl font-black text-slate-800 mt-1">{notifications.length}</p>
          </div>
        </div>
      </div>

      {/* Floating feedback alert */}
      {alertMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-md transition-all ${
          alertMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : alertMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
        }`}>
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4" />}
            <span>{alertMessage.text}</span>
          </div>
          <button onClick={() => setAlertMessage(null)} className="p-1 hover:bg-black/5 rounded-lg cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === 'tasks'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ListTodo className="h-3.5 w-3.5" />
          <span>{isNl ? 'Taken & Actiehouders' : 'Tasks & Assignees'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeSubTab === 'tasks' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {contactsWithOpenTasks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('polls')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === 'polls'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Vote className="h-3.5 w-3.5" />
          <span>{isNl ? 'Datumprikker Reminders' : 'Poll Reminders'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeSubTab === 'polls' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {activePollsWithPending.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('meetings')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === 'meetings'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{isNl ? 'Agenda-voorbereidingen' : 'Meeting Prep'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeSubTab === 'meetings' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {upcomingMeetings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>{isNl ? 'Logboek & Historie' : 'Notification Log'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeSubTab === 'logs' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {notifications.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: TAKEN & ACTIEHOUDERS REMINDERS                                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          {/* Search bar & batch action */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={isNl ? 'Zoek actiehouder of taak...' : 'Search assignee or task...'}
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {onOpenTasks && (
              <button
                onClick={onOpenTasks}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                <span>{isNl ? 'Naar Takenoverzicht / Trello' : 'Go to Task Board'}</span>
              </button>
            )}
          </div>

          {/* Assignees List */}
          {assigneesSummary.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {isNl ? 'Geen actiehouders met openstaande taken' : 'No assignees with tasks'}
              </h3>
              <p className="text-xs text-slate-500">
                {isNl ? 'Wijs eerst contactpersonen toe aan taken in het takenoverzicht.' : 'Assign contacts to tasks first.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assigneesSummary
                .filter(item => {
                  if (!taskSearchQuery.trim()) return true;
                  const q = taskSearchQuery.toLowerCase();
                  const matchName = `${item.contact.firstName} ${item.contact.lastName}`.toLowerCase().includes(q);
                  const matchEmail = item.contact.email.toLowerCase().includes(q);
                  const matchTask = item.openTasks.some(t => t.title.toLowerCase().includes(q));
                  return matchName || matchEmail || matchTask;
                })
                .map(item => {
                  const { contact, openTasks, completedTasks } = item;
                  const isExpanded = expandedContactId === contact.id;
                  const personalPortalUrl = getPersonalTaskPortalUrl(contact.id);

                  return (
                    <div
                      key={contact.id}
                      className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs transition hover:border-slate-300 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
                            {contact.firstName.charAt(0)}{contact.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-slate-800">
                                {contact.firstName} {contact.lastName}
                              </h3>
                              {openTasks.length > 0 ? (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-extrabold">
                                  {openTasks.length} {isNl ? 'open' : 'open'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-extrabold">
                                  ✓ {isNl ? 'alles gereed' : 'all done'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 font-medium">{contact.email}</p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Copy personal URL */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(personalPortalUrl, `task-url-${contact.id}`)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                            title={isNl ? 'Kopieer unieke link voor deze persoon' : 'Copy unique link'}
                          >
                            {copiedLink === `task-url-${contact.id}` ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-600 font-bold">{isNl ? 'Gekopieerd!' : 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="h-3.5 w-3.5" />
                                <span>{isNl ? 'Kopieer Link' : 'Copy Link'}</span>
                              </>
                            )}
                          </button>

                          {/* Stuur Herinnering Knop */}
                          <button
                            type="button"
                            onClick={() => handleOpenAssigneeComposer(contact, openTasks)}
                            disabled={openTasks.length === 0}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>{isNl ? 'Stuur Herinnering' : 'Send Reminder'}</span>
                          </button>

                          {/* Toggle Expand */}
                          <button
                            type="button"
                            onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded View: list of tasks */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <h4 className="text-xs font-bold text-slate-700">
                            {isNl ? 'Toegewezen Taken:' : 'Assigned Tasks:'}
                          </h4>
                          <div className="space-y-1.5">
                            {openTasks.map(task => (
                              <div
                                key={task.id}
                                className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span className="font-bold text-slate-800 truncate">{task.title}</span>
                                  {task.projectTitle && (
                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold shrink-0">
                                      {task.projectTitle}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <a
                                    href={getSingleTaskUrl(task.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                  >
                                    <span>{isNl ? 'Unieke taak-URL' : 'Task URL'}</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            ))}

                            {completedTasks.length > 0 && (
                              <p className="text-[11px] text-slate-400 font-medium pt-1">
                                + {completedTasks.length} {isNl ? 'reeds voltooide taken' : 'already completed tasks'}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: DATUMPRIKKER REMINDERS                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'polls' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={isNl ? 'Zoek datumprikker...' : 'Search date poll...'}
                value={pollSearchQuery}
                onChange={(e) => setPollSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {activePollsWithPending.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {isNl ? 'Iedereen heeft gestemd op alle datumprikkers!' : 'All votes received!'}
              </h3>
              <p className="text-xs text-slate-500">
                {isNl ? 'Er zijn momenteel geen genodigden die nog moeten reageren.' : 'No pending invitees found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activePollsWithPending
                .filter(item => !pollSearchQuery.trim() || item.poll.title.toLowerCase().includes(pollSearchQuery.toLowerCase()))
                .map(item => {
                  const { poll, total, votedCount, pendingInvitees } = item;
                  const pollUrl = getPollUrl(poll.id);

                  return (
                    <div
                      key={poll.id}
                      className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                              <Vote className="h-4 w-4" />
                            </span>
                            <h3 className="text-sm font-black text-slate-800">{poll.title}</h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {votedCount} van de {total} genodigden hebben gereageerd ({pendingInvitees.length} openstaand)
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pollUrl, `poll-${poll.id}`)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                          >
                            {copiedLink === `poll-${poll.id}` ? (
                              <span className="text-emerald-600 font-bold">{isNl ? 'Gekopieerd!' : 'Copied!'}</span>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>{isNl ? 'Kopieer Poll Link' : 'Copy Poll Link'}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPollReminderComposer(poll, pendingInvitees)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>{isNl ? `Herinner Alle Niet-Stemmers (${pendingInvitees.length})` : 'Remind All Pending'}</span>
                          </button>
                        </div>
                      </div>

                      {/* List of pending non-voters */}
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          {isNl ? 'Nog niet gestemd door:' : 'Pending response from:'}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {pendingInvitees.map(inv => (
                            <div key={inv.id} className="p-2 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                              <div className="truncate">
                                <span className="font-bold text-slate-800 block truncate">{inv.firstName} {inv.lastName}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{inv.email}</span>
                              </div>
                              {inv.lastReminderAt && (
                                <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                  {new Date(inv.lastReminderAt).toLocaleDateString(isNl ? 'nl-NL' : 'en-US')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: AGENDA-VOORBEREIDINGEN                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'meetings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={isNl ? 'Zoek overleg / bijeenkomst...' : 'Search meeting...'}
                value={meetingSearchQuery}
                onChange={(e) => setMeetingSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {onOpenMeetings && (
              <button
                onClick={() => onOpenMeetings()}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{isNl ? 'Naar Notities & Overleggen' : 'Go to Meetings'}</span>
              </button>
            )}
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
              <Calendar className="h-10 w-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {isNl ? 'Geen meetings of overleggen aangemaakt' : 'No meetings found'}
              </h3>
              <p className="text-xs text-slate-500">
                {isNl ? 'Maak eerst een meeting aan in het onderdeel Notities & Meetings.' : 'Create a meeting first.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings
                .filter(m => !meetingSearchQuery.trim() || m.title.toLowerCase().includes(meetingSearchQuery.toLowerCase()))
                .map(meeting => {
                  const meetingUrl = getMeetingAgendaUrl(meeting.id);
                  const validParticipants = (meeting.participants || []).filter(p => !!p.name || !!p.email);
                  const pCount = validParticipants.length;

                  return (
                    <div
                      key={meeting.id}
                      className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-slate-800">{meeting.title}</h3>
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-extrabold">
                              {meeting.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                            {meeting.time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{meeting.time}{meeting.durationMinutes ? ` (${meeting.durationMinutes} min)` : ''}</span>
                              </span>
                            )}
                            {meeting.location && <span>• {meeting.location}</span>}
                            <span>• {pCount} {isNl ? 'deelnemers' : 'participants'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditMeetingModal(meeting)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                            title={isNl ? 'Bewerk meeting details & deelnemers' : 'Edit meeting details & attendees'}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{isNl ? 'Aanpassen' : 'Edit'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(meetingUrl, `meeting-${meeting.id}`)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                          >
                            {copiedLink === `meeting-${meeting.id}` ? (
                              <span className="text-emerald-600 font-bold">{isNl ? 'Gekopieerd!' : 'Copied!'}</span>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>{isNl ? 'Kopieer Agenda Link' : 'Copy Link'}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenMeetingPrepComposer(meeting)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>{isNl ? 'Verstuur Agenda-voorbereiding' : 'Send Prep & Agenda'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Participants chips preview */}
                      {validParticipants.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-slate-400 font-bold mr-1">{isNl ? 'Deelnemers:' : 'Attendees:'}</span>
                          {validParticipants.map((p, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-700 font-medium">
                              {p.name} {p.email && <span className="text-slate-400 text-[10px]">({p.email})</span>}
                            </span>
                          ))}
                        </div>
                      )}

                      {meeting.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {meeting.description}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: LOGBOEK & HISTORIE                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">{isNl ? 'Filter op type:' : 'Filter by type:'}</span>
              <select
                value={logFilterType}
                onChange={(e) => setLogFilterType(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">{isNl ? 'Alle typen' : 'All types'}</option>
                <option value="task_reminder">{isNl ? 'Taak reminders' : 'Task reminders'}</option>
                <option value="poll_reminder">{isNl ? 'Datumprikker reminders' : 'Poll reminders'}</option>
                <option value="meeting_prep">{isNl ? 'Agenda voorbereidingen' : 'Meeting prep'}</option>
              </select>
            </div>

            {notifications.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isNl ? 'Wis Geschiedenis' : 'Clear History'}</span>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-2">
              <Clock className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">{isNl ? 'Nog geen notificaties verstuurd' : 'No notifications yet'}</h3>
              <p className="text-xs text-slate-400">{isNl ? 'Verzonden reminders verschijnen hier in het logboek.' : 'Sent reminders will appear here.'}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications
                .filter(n => logFilterType === 'all' || n.type === logFilterType)
                .map(note => (
                  <div
                    key={note.id}
                    className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          note.type === 'task_reminder' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : note.type === 'poll_reminder'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {note.type.replace('_', ' ')}
                        </span>
                        <h4 className="font-bold text-slate-800">{note.title || (isNl ? 'Herinnering' : 'Notification')}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isNl ? 'Aan:' : 'To:'} <span className="font-semibold text-slate-700">{note.recipientName || note.recipientEmail || 'Onbekend'}</span>
                        {note.recipientEmail && <span className="text-slate-400"> ({note.recipientEmail})</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
                      <span>{new Date(note.timestamp).toLocaleString(isNl ? 'nl-NL' : 'en-US')}</span>
                      {note.uniqueUrl && (
                        <a
                          href={note.uniqueUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title={isNl ? 'Open unieke URL' : 'Open link'}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPOSER & PREVIEW MODAL                                                  */}
      {/* ========================================================================= */}
      {showComposer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-800">
                  {isNl ? 'Notificatie & E-mail Versturen' : 'Compose Notification'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Recipient summary */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                {isNl ? 'Ontvanger(s):' : 'Recipients:'} ({composerRecipients.length})
              </span>
              <p className="font-bold text-slate-800 truncate">
                {composerRecipients.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ') || (isNl ? 'Geen ontvangers' : 'No recipients')}
              </p>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {isNl ? 'Onderwerp:' : 'Subject:'}
              </label>
              <input
                type="text"
                value={composerSubject}
                onChange={(e) => setComposerSubject(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {isNl ? 'Berichttekst:' : 'Message:'}
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isNl ? 'Ondersteunt tags: {name}, {unique_url}' : 'Supports tags: {name}, {unique_url}'}
                </span>
              </div>
              <textarea
                rows={7}
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-mono"
              />
            </div>

            {/* Unique URL Info Box */}
            <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                  {isNl ? 'Unieke Deelbare Link in e-mail:' : 'Unique Link included:'}
                </span>
                <span className="text-xs font-mono text-indigo-900 truncate block">
                  {composerUniqueUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(composerUniqueUrl, 'composer-link')}
                className="px-2.5 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-50 cursor-pointer shrink-0"
              >
                {copiedLink === 'composer-link' ? (isNl ? 'Gekopieerd!' : 'Copied!') : (isNl ? 'Kopieer' : 'Copy')}
              </button>
            </div>

            {/* Progress indicator when sending */}
            {isSending && sendProgress && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{isNl ? 'Verzenden...' : 'Sending...'}</span>
                  <span>{sendProgress.sent} / {sendProgress.total}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 transition-all duration-300"
                    style={{ width: `${(sendProgress.sent / sendProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2">
              {/* Copy plain text option */}
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(`${composerSubject}\n\n${composerBody}\n\nLink: ${composerUniqueUrl}`, 'composer-all');
                  showAlert(isNl ? 'E-mailtekst gekopieerd naar klembord!' : 'Copied to clipboard!');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{isNl ? 'Kopieer E-mailtekst' : 'Copy Text'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  disabled={isSending}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
                >
                  {isNl ? 'Annuleren' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleDispatchNotification}
                  disabled={isSending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer"
                >
                  {isSending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>
                    {isSending
                      ? (isNl ? 'Verzenden...' : 'Sending...')
                      : (isNl ? `Direct Verzenden (${composerRecipients.length})` : `Send (${composerRecipients.length})`)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT MEETING & PARTICIPANTS MODAL                                         */}
      {/* ========================================================================= */}
      {editingMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-800">
                  {isNl ? 'Overleg & Deelnemers Bewerken' : 'Edit Meeting & Attendees'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMeeting(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedMeeting} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isNl ? 'Titel van het overleg *' : 'Meeting Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={editMeetingTitle}
                  onChange={(e) => setEditMeetingTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isNl ? 'Datum *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editMeetingDate}
                    onChange={(e) => setEditMeetingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isNl ? 'Tijdstip' : 'Time'}
                  </label>
                  <input
                    type="time"
                    value={editMeetingTime}
                    onChange={(e) => setEditMeetingTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isNl ? 'Duur (minuten)' : 'Duration (min)'}
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={editMeetingDuration}
                    onChange={(e) => setEditMeetingDuration(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isNl ? 'Locatie / Verbinding' : 'Location / Link'}
                </label>
                <input
                  type="text"
                  value={editMeetingLocation}
                  onChange={(e) => setEditMeetingLocation(e.target.value)}
                  placeholder="bijv. Microsoft Teams of Kamer 1.12"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                />
              </div>

              {/* Deelnemers toevoegen via doorzoekbare alfabetische selectie */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-indigo-600" />
                    <span>{isNl ? 'Deelnemers toevoegen uit contactpersonen (Alfabetisch & Doorzoekbaar)' : 'Add Attendees from Contacts'}</span>
                  </label>
                  <span className="text-[11px] font-bold text-slate-400">
                    {editMeetingParticipants.length} {isNl ? 'gekoppeld' : 'added'}
                  </span>
                </div>

                <SearchableContactSelect
                  contacts={contacts}
                  placeholder={isNl ? 'Zoek en selecteer een contactpersoon...' : 'Search and select contact...'}
                  onSelect={(c) => {
                    if (!c) return;
                    const email = c.email.toLowerCase().trim();
                    if (editMeetingParticipants.some(p => p.email.toLowerCase() === email)) {
                      showAlert(isNl ? 'Deze deelnemer is al toegevoegd' : 'Attendee already added', 'info');
                      return;
                    }
                    setEditMeetingParticipants([
                      ...editMeetingParticipants,
                      {
                        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                        email: email,
                        organization: c.organization
                      }
                    ]);
                  }}
                />

                {/* Chips of added attendees */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {editMeetingParticipants.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium shadow-2xs"
                    >
                      <strong>{p.name}</strong>
                      {p.email && <span className="text-slate-400 text-[10px]">({p.email})</span>}
                      <button
                        type="button"
                        onClick={() => setEditMeetingParticipants(editMeetingParticipants.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {editMeetingParticipants.length === 0 && (
                    <p className="text-xs text-slate-400 italic">
                      {isNl ? 'Nog geen deelnemers geselecteerd. Kies hierboven uit de lijst.' : 'No attendees selected yet.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMeeting(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
                >
                  {isNl ? 'Annuleren' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSavingMeeting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer"
                >
                  {isSavingMeeting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{isNl ? 'Opslaan & Toepassen' : 'Save & Apply'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
