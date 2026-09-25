import React, { useState, useEffect, useMemo } from 'react';
import { 
  Meeting, 
  MeetingAgreement, 
  MeetingNote,
  MeetingNoteCategory,
  MeetingActionItem, 
  MeetingType, 
  ActionItemStatus, 
  MeetingParticipant, 
  Contact, 
  Language,
  ActionItemRemark,
  Project
} from '../types';
import { dbService } from '../services/db';
import { 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock3, 
  AlertCircle, 
  Send, 
  Search, 
  Filter, 
  FileText, 
  Handshake, 
  ListTodo, 
  X, 
  Check, 
  MessageSquare, 
  ExternalLink,
  ChevronRight,
  UserPlus,
  Share2,
  FolderKanban,
  MapPin,
  Sparkles,
  Bold,
  List,
  Heading2,
  Copy,
  Download,
  CalendarPlus,
  Eye,
  Layers,
  Image as ImageIcon,
  Palette,
  Unlink,
  Link as LinkIcon,
  Table,
  Rows
} from 'lucide-react';
import { wrapInHtmlEmailTemplate, wrapInMeetingEmailTemplate, sendSystemEmail } from '../services/gmail';
import AgendaRichEditor from './AgendaRichEditor';
import { FormattedAgendaModal } from './FormattedAgendaModal';
import AgendaTemplateManagerModal from './AgendaTemplateManagerModal';
import { SearchableContactSelect } from './SearchableContactSelect';
import { Poll } from '../types';
import { getPublicOrigin } from '../utils/url';
import { generateGoogleCalendarLink, generateOutlookLink, downloadIcsFile } from '../utils/calendar';

interface MeetingManagerProps {
  lang: Language;
  initialSelectedMeetingId?: string | null;
  onNavigateToPoll?: (pollId: string) => void;
}

const MEETING_TYPE_LABELS: Record<string, { nl: string; en: string; color: string }> = {
  stuurgroep: { nl: 'Stuurgroep', en: 'Steering Committee', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  bila: { nl: 'Bila (1-op-1)', en: '1-on-1 (Bi-weekly)', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  eenmalig: { nl: 'Eenmalige afspraak', en: 'One-off Meeting', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  afdelingsoverleg: { nl: 'Afdelingsoverleg', en: 'Department Meeting', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  projectteam: { nl: 'Projectteam', en: 'Project Team', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  overig: { nl: 'Overig overleg', en: 'Other Meeting', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const ACTION_STATUS_CONFIG: Record<ActionItemStatus, { labelNl: string; labelEn: string; badgeClass: string; icon: any }> = {
  open: { labelNl: 'Openstaand', labelEn: 'Open', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock3 },
  in_behandeling: { labelNl: 'In behandeling', labelEn: 'In Progress', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  gereed: { labelNl: 'Gereed', labelEn: 'Completed', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  on_hold: { labelNl: 'On Hold', labelEn: 'On Hold', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertCircle }
};

const NOTE_CATEGORY_CONFIG: Record<MeetingNoteCategory, { labelNl: string; labelEn: string; badgeClass: string; iconBg: string }> = {
  overlegverslag: { labelNl: 'Overlegverslag', labelEn: 'Meeting Record', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', iconBg: 'bg-blue-100 text-blue-700' },
  notitie: { labelNl: 'Notitie', labelEn: 'Note', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', iconBg: 'bg-amber-100 text-amber-700' },
  besluit: { labelNl: 'Besluit', labelEn: 'Decision', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-700' },
  bespreking: { labelNl: 'Bespreking', labelEn: 'Discussion', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', iconBg: 'bg-indigo-100 text-indigo-700' },
  aantekening: { labelNl: 'Aantekening', labelEn: 'Memo', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200', iconBg: 'bg-purple-100 text-purple-700' },
  rondvraag: { labelNl: 'Rondvraag', labelEn: 'A.O.B.', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', iconBg: 'bg-slate-200 text-slate-700' }
};

export const MeetingManager: React.FC<MeetingManagerProps> = ({ 
  lang, 
  initialSelectedMeetingId = null,
  onNavigateToPoll
}) => {
  // Navigation tabs within module
  const [subTab, setSubTab] = useState<'meetings' | 'notes' | 'actions' | 'agreements'>('meetings');

  // DB Data
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agreements, setAgreements] = useState<MeetingAgreement[]>([]);
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [polls, setPolls] = useState<Poll[]>(() => dbService.getPolls());

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterNoteCategory, setFilterNoteCategory] = useState<string>('all');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(initialSelectedMeetingId || null);

  // Formatted Agenda Modal & Template Manager Modal
  const [formattedAgendaMeeting, setFormattedAgendaMeeting] = useState<Meeting | null>(null);
  const [showTemplateManagerModal, setShowTemplateManagerModal] = useState(false);
  const [isLinkPollModalOpen, setIsLinkPollModalOpen] = useState(false);
  const [linkPollMeeting, setLinkPollMeeting] = useState<Meeting | null>(null);

  // Meeting Form Modal
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('10:00');
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(60);
  const [formType, setFormType] = useState<MeetingType>('projectteam');
  const [formProject, setFormProject] = useState('');
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formTheme, setFormTheme] = useState<string>('');
  const [formLinkType, setFormLinkType] = useState<'project' | 'theme'>('project');
  const [formLocation, setFormLocation] = useState('Microsoft Teams');
  const [formAgenda, setFormAgenda] = useState('');
  const [formAgendaStatus, setFormAgendaStatus] = useState<'concept' | 'definitief' | 'verzonden'>('concept');
  const [formNotes, setFormNotes] = useState('');
  const [formParticipants, setFormParticipants] = useState<MeetingParticipant[]>([]);
  const [formPollId, setFormPollId] = useState<string>('');
  const [formPollTitle, setFormPollTitle] = useState<string>('');
  const [meetingModalTab, setMeetingModalTab] = useState<'details' | 'agenda' | 'notes'>('details');

  // Dedicated Agenda Editor Modal
  const [agendaEditorMeeting, setAgendaEditorMeeting] = useState<Meeting | null>(null);
  const [agendaEditorContent, setAgendaEditorContent] = useState('');
  const [agendaEditorStatus, setAgendaEditorStatus] = useState<'concept' | 'definitief' | 'verzonden'>('concept');
  const [isSavingDedicatedAgenda, setIsSavingDedicatedAgenda] = useState(false);
  const [copiedMeetingUrlId, setCopiedMeetingUrlId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Participant inline quick add
  const [newPartName, setNewPartName] = useState('');
  const [newPartEmail, setNewPartEmail] = useState('');
  const [newPartOrg, setNewPartOrg] = useState('');

  // Action item creation / edit modal
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<MeetingActionItem | null>(null);
  const [actionMeetingId, setActionMeetingId] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionDueDate, setActionDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [actionStatus, setActionStatus] = useState<ActionItemStatus>('open');
  const [actionAssignees, setActionAssignees] = useState<MeetingParticipant[]>([]);
  const [isCreatingNewAssignee, setIsCreatingNewAssignee] = useState(false);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [newAssigneeEmail, setNewAssigneeEmail] = useState('');
  const [newAssigneeOrg, setNewAssigneeOrg] = useState('');

  // Bulk action items creation modal state
  const [isBulkActionModalOpen, setIsBulkActionModalOpen] = useState(false);
  const [bulkMeetingId, setBulkMeetingId] = useState('');
  const [bulkActionRows, setBulkActionRows] = useState<{
    id: string;
    title: string;
    description: string;
    dueDate: string;
    status: ActionItemStatus;
    assignees: MeetingParticipant[];
  }[]>([]);

  // Agreement creation / edit modal
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<MeetingAgreement | null>(null);
  const [agrMeetingId, setAgrMeetingId] = useState('');
  const [agrTitle, setAgrTitle] = useState('');
  const [agrDesc, setAgrDesc] = useState('');
  const [agrProject, setAgrProject] = useState('');
  const [agrDate, setAgrDate] = useState(new Date().toISOString().split('T')[0]);
  const [agrStatus, setAgrStatus] = useState<'actief' | 'afgerond' | 'vervallen'>('actief');

  // Note creation / edit modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [noteMeetingId, setNoteMeetingId] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('');
  const [noteCategory, setNoteCategory] = useState<MeetingNoteCategory>('overlegverslag');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [noteProject, setNoteProject] = useState('');
  const [noteTags, setNoteTags] = useState('');

  // Remarks Modal
  const [activeRemarkAction, setActiveRemarkAction] = useState<MeetingActionItem | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');

  // Email Dispatch Modal
  const [emailModalMeeting, setEmailModalMeeting] = useState<Meeting | null>(null);
  const [emailModalType, setEmailModalType] = useState<'agenda' | 'notes_and_actions' | 'actions' | 'combination' | 'minutes'>('agenda');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailCustomIntro, setEmailCustomIntro] = useState('');
  const [includePublicUrlInEmail, setIncludePublicUrlInEmail] = useState(true);
  const [includeCalendarInEmail, setIncludeCalendarInEmail] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState('');

  // Quick recipient input inside email modal
  const [newEmailRecipientInput, setNewEmailRecipientInput] = useState('');

  // Load initial data and subscribe to realtime updates
  const loadData = () => {
    setMeetings(dbService.getMeetings());
    setAgreements(dbService.getMeetingAgreements());
    setMeetingNotes(dbService.getMeetingNotes());
    setActionItems(dbService.getMeetingActionItems());
    setContacts(dbService.getContacts());
    setProjects(dbService.getProjects());
    setPolls(dbService.getPolls());
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(() => {
      loadData();
    });
    return unsub;
  }, []);

  // Update selected meeting if initialSelectedMeetingId changes from parent
  useEffect(() => {
    if (initialSelectedMeetingId) {
      setSelectedMeetingId(initialSelectedMeetingId);
      setSubTab('meetings');
    }
  }, [initialSelectedMeetingId]);

  // Check URL parameters for direct action viewing (e.g. from email link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const actionId = params.get('action_id');
    const meetingId = params.get('meeting_id');

    if (actionId) {
      const act = dbService.getMeetingActionItem(actionId);
      if (act) {
        setSubTab('actions');
        setActiveRemarkAction(act);
      }
    } else if (meetingId) {
      setSelectedMeetingId(meetingId);
      setSubTab('meetings');
    }
  }, [actionItems]);

  // Helper to ensure any participant or assignee is automatically saved into the address book
  const ensureContactInDb = async (name: string, email: string, org?: string): Promise<Contact | null> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) return null;

    let cleanName = name.trim();
    if (!cleanName) {
      const parts = cleanEmail.split('@')[0].split(/[._-]/);
      cleanName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    const existing = contacts.find(c => c.email.toLowerCase() === cleanEmail);
    if (existing) {
      return existing;
    }

    const nameParts = cleanName.split(' ');
    const first = nameParts[0] || 'Contact';
    const last = nameParts.slice(1).join(' ') || '';
    const newContact: Contact = {
      id: 'c-' + Math.random().toString(36).substr(2, 9),
      firstName: first,
      lastName: last,
      email: cleanEmail,
      organization: org?.trim() || undefined
    };

    await dbService.saveContact(newContact);
    const updated = dbService.getContacts();
    setContacts(updated);
    return newContact;
  };

  // Open Meeting Modal for Create
  const handleOpenNewMeeting = () => {
    setEditingMeeting(null);
    setFormTitle('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime('10:00');
    setFormDurationMinutes(60);
    setFormType('projectteam');
    
    // Default to first project from Projecten en Verkenningen if available
    const firstProj = projects.length > 0 ? projects[0] : null;
    if (firstProj) {
      setFormProjectId(firstProj.id);
      setFormProject(firstProj.title);
      setFormLinkType('project');
      setFormTheme('');
    } else {
      setFormProjectId('');
      setFormProject('');
      setFormLinkType('theme');
      setFormTheme('');
    }

    setFormLocation('Microsoft Teams');
    setFormAgenda('');
    setFormAgendaStatus('concept');
    setFormNotes('');
    setFormParticipants([]);
    setFormPollId('');
    setFormPollTitle('');
    setMeetingModalTab('details');
    setIsMeetingModalOpen(true);
  };

  // Open Meeting Modal for Edit
  const handleOpenEditMeeting = (m: Meeting) => {
    setEditingMeeting(m);
    setFormTitle(m.title);
    setFormDate(m.date);
    setFormTime(m.time || '10:00');
    setFormDurationMinutes(m.durationMinutes || 60);
    setFormType(m.meetingType as MeetingType);
    setFormProjectId(m.projectId || '');
    setFormTheme(m.theme || '');
    setFormLinkType(m.projectId ? 'project' : (m.theme ? 'theme' : 'project'));
    setFormProject(m.projectOrSubject);
    setFormLocation(m.location || 'Microsoft Teams');
    setFormAgenda(m.agenda || '');
    setFormAgendaStatus(m.agendaStatus || 'concept');
    setFormNotes(m.notes || '');
    setFormParticipants(m.participants || []);
    setFormPollId(m.pollId || '');
    setFormPollTitle(m.pollTitle || '');
    setMeetingModalTab('details');
    setIsMeetingModalOpen(true);
  };

  // Auto-fill meeting details from selected Datumprikker poll
  const handleAutoFillFromPoll = (poll: Poll) => {
    if (!formTitle.trim()) {
      setFormTitle(poll.title);
    }
    if (poll.locationAddress || poll.locationType) {
      setFormLocation(poll.locationAddress || (poll.locationType === 'digital' ? 'Microsoft Teams' : 'Fysiek overleg'));
    }
    const targetOpt = (poll.finalizedOptionId && poll.options.find(o => o.id === poll.finalizedOptionId)) || poll.options[0];
    if (targetOpt) {
      const d = new Date(targetOpt.dateTime);
      setFormDate(d.toISOString().split('T')[0]);
      setFormTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      if (targetOpt.durationMin) {
        setFormDurationMinutes(targetOpt.durationMin);
      }
    }
    const pollInvitees = dbService.getInviteesForPoll(poll.id);
    if (pollInvitees.length > 0) {
      const newParticipants = [...formParticipants];
      pollInvitees.forEach(inv => {
        const email = inv.email.toLowerCase().trim();
        if (!newParticipants.some(p => p.email.toLowerCase() === email)) {
          newParticipants.push({
            name: `${inv.firstName || ''} ${inv.lastName || ''}`.trim() || inv.email,
            email: email
          });
        }
      });
      setFormParticipants(newParticipants);
    }
    if (!formAgenda && poll.description) {
      setFormAgenda(`<p>${poll.description.replace(/\n/g, '<br/>')}</p>`);
    }
  };

  // Unlink Datumprikker from Meeting
  const handleUnlinkPollFromMeeting = async (meetingToUnlink: Meeting) => {
    if (!confirm(lang === 'nl' ? 'Weet je zeker dat je de koppeling met deze datumprikker wilt verbreken?' : 'Are you sure you want to unlink this date poll?')) return;
    const oldPollId = meetingToUnlink.pollId;
    const updated: Meeting = {
      ...meetingToUnlink,
      pollId: undefined,
      pollTitle: undefined,
      updatedAt: new Date().toISOString()
    };
    await dbService.saveMeeting(updated);
    if (oldPollId) {
      const p = dbService.getPoll(oldPollId);
      if (p && p.promotedMeetingId === meetingToUnlink.id) {
        dbService.savePoll({ ...p, promotedMeetingId: undefined });
      }
    }
    loadData();
  };

  // Link Datumprikker from quick modal
  const handleLinkPollToMeeting = async (targetMeeting: Meeting, pollToLink: Poll, autoImportDetails = false) => {
    let updatedMeeting: Meeting = {
      ...targetMeeting,
      pollId: pollToLink.id,
      pollTitle: pollToLink.title,
      updatedAt: new Date().toISOString()
    };

    if (autoImportDetails) {
      const targetOpt = (pollToLink.finalizedOptionId && pollToLink.options.find(o => o.id === pollToLink.finalizedOptionId)) || pollToLink.options[0];
      if (targetOpt) {
        const d = new Date(targetOpt.dateTime);
        updatedMeeting.date = d.toISOString().split('T')[0];
        updatedMeeting.time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        if (targetOpt.durationMin) updatedMeeting.durationMinutes = targetOpt.durationMin;
      }
      if (pollToLink.locationAddress || pollToLink.locationType) {
        updatedMeeting.location = pollToLink.locationAddress || (pollToLink.locationType === 'digital' ? 'Microsoft Teams' : 'Fysiek overleg');
      }
      const pollInvitees = dbService.getInviteesForPoll(pollToLink.id);
      if (pollInvitees.length > 0) {
        const newParticipants = [...(updatedMeeting.participants || [])];
        pollInvitees.forEach(inv => {
          const email = inv.email.toLowerCase().trim();
          if (!newParticipants.some(p => p.email.toLowerCase() === email)) {
            newParticipants.push({
              name: `${inv.firstName || ''} ${inv.lastName || ''}`.trim() || inv.email,
              email: email
            });
          }
        });
        updatedMeeting.participants = newParticipants;
      }
    }

    await dbService.saveMeeting(updatedMeeting);
    if (pollToLink.promotedMeetingId !== targetMeeting.id) {
      dbService.savePoll({ ...pollToLink, promotedMeetingId: targetMeeting.id });
    }
    setIsLinkPollModalOpen(false);
    setLinkPollMeeting(null);
    loadData();
  };

  // Open dedicated Agenda Editor Modal
  const handleOpenAgendaEditor = (m: Meeting) => {
    setAgendaEditorMeeting(m);
    setAgendaEditorContent(m.agenda || '');
    setAgendaEditorStatus(m.agendaStatus || 'concept');
  };

  // Save from dedicated Agenda Editor Modal
  const handleSaveDedicatedAgenda = async () => {
    if (!agendaEditorMeeting) return;
    setIsSavingDedicatedAgenda(true);
    try {
      const updated: Meeting = {
        ...agendaEditorMeeting,
        agenda: agendaEditorContent,
        agendaStatus: agendaEditorStatus,
        agendaUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await dbService.saveMeeting(updated);
      setAgendaEditorMeeting(null);
      loadData();
    } catch (e) {
      console.error("Error saving agenda:", e);
      alert(lang === 'nl' ? 'Fout bij opslaan van de agenda.' : 'Error saving agenda.');
    } finally {
      setIsSavingDedicatedAgenda(false);
    }
  };

  // Copy public Agenda URL
  const handleCopyAgendaUrl = (mId: string) => {
    const fullUrl = `${getPublicOrigin()}?meeting_agenda=${mId}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedMeetingUrlId(mId);
      setTimeout(() => setCopiedMeetingUrlId(null), 2500);
    });
  };

  // Add participant to meeting and auto-persist to address book
  const handleAddParticipant = async () => {
    const cleanEmail = newPartEmail.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      alert(lang === 'nl' ? 'Vul een geldig e-mailadres in.' : 'Please enter a valid email address.');
      return;
    }

    let cleanName = newPartName.trim();
    if (!cleanName) {
      const parts = cleanEmail.split('@')[0].split(/[._-]/);
      cleanName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    if (formParticipants.some(p => p.email.toLowerCase() === cleanEmail)) {
      alert(lang === 'nl' ? 'Deze deelnemer is al toegevoegd.' : 'This participant is already added.');
      return;
    }

    const newPart: MeetingParticipant = {
      name: cleanName,
      email: cleanEmail,
      organization: newPartOrg.trim() || undefined
    };

    setFormParticipants([...formParticipants, newPart]);

    // Ensure contact exists in central address book!
    await ensureContactInDb(cleanName, cleanEmail, newPartOrg);

    setNewPartName('');
    setNewPartEmail('');
    setNewPartOrg('');
  };

  // Select contact from dropdown to add to participants
  const handleSelectContactForMeeting = (contactId: string) => {
    if (!contactId) return;
    const c = contacts.find(item => item.id === contactId);
    if (!c) return;

    if (formParticipants.some(p => p.email.toLowerCase() === c.email.toLowerCase())) {
      return;
    }

    setFormParticipants([
      ...formParticipants,
      {
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email.toLowerCase().trim(),
        organization: c.organization || undefined
      }
    ]);
  };

  // Save Meeting
  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert(lang === 'nl' ? 'Vul een titel in voor het overleg.' : 'Please enter a title for the meeting.');
      return;
    }

    let projectOrSubjectToSave = formProject.trim() || 'Algemeen';
    let projectIdToSave: string | undefined = undefined;
    let themeToSave: string | undefined = undefined;

    if (formLinkType === 'project' && formProjectId) {
      projectIdToSave = formProjectId;
      const matched = projects.find(p => p.id === formProjectId);
      projectOrSubjectToSave = matched ? matched.title : formProject.trim() || 'Project';
    } else if (formLinkType === 'theme') {
      themeToSave = formTheme.trim() || 'Algemeen';
      projectOrSubjectToSave = themeToSave;
    }

    const meetingId = editingMeeting ? editingMeeting.id : 'm-' + Math.random().toString(36).substr(2, 9);
    const updatedMeeting: Meeting = {
      id: meetingId,
      title: formTitle.trim(),
      date: formDate,
      time: formTime,
      durationMinutes: formDurationMinutes || 60,
      meetingType: formType,
      projectOrSubject: projectOrSubjectToSave,
      projectId: projectIdToSave,
      theme: themeToSave,
      location: formLocation.trim() || undefined,
      participants: formParticipants,
      agenda: formAgenda,
      agendaStatus: formAgendaStatus,
      agendaUpdatedAt: new Date().toISOString(),
      notes: formNotes,
      pollId: formPollId || undefined,
      pollTitle: formPollTitle || undefined,
      createdAt: editingMeeting ? editingMeeting.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveMeeting(updatedMeeting);

    // Synchronize poll link if present
    if (formPollId) {
      const pollToUpdate = dbService.getPoll(formPollId);
      if (pollToUpdate && pollToUpdate.promotedMeetingId !== meetingId) {
        dbService.savePoll({ ...pollToUpdate, promotedMeetingId: meetingId });
      }
    }

    setIsMeetingModalOpen(false);
    setSelectedMeetingId(meetingId);
    loadData();
  };

  // Helper for adding a new assignee directly from action modal and saving to address book
  const handleCreateAndAddActionAssignee = async () => {
    if (!newAssigneeEmail.trim() || !newAssigneeEmail.includes('@')) {
      alert(lang === 'nl' ? 'Voer een geldig e-mailadres in.' : 'Please enter a valid email address.');
      return;
    }
    const cleanName = newAssigneeName.trim() || newAssigneeEmail.split('@')[0];
    await ensureContactInDb(cleanName, newAssigneeEmail, newAssigneeOrg);
    if (!actionAssignees.some(a => a.email.toLowerCase() === newAssigneeEmail.toLowerCase().trim())) {
      setActionAssignees([
        ...actionAssignees,
        {
          name: cleanName,
          email: newAssigneeEmail.toLowerCase().trim(),
          organization: newAssigneeOrg.trim() || undefined
        }
      ]);
    }
    setNewAssigneeName('');
    setNewAssigneeEmail('');
    setNewAssigneeOrg('');
    setIsCreatingNewAssignee(false);
  };

  // Delete Meeting
  const handleDeleteMeeting = async (id: string) => {
    const confirmMsg = lang === 'nl' 
      ? 'Weet u zeker dat u deze meeting wilt verwijderen? Gekoppelde acties en afspraken blijven bewaard.' 
      : 'Are you sure you want to delete this meeting? Linked action items and agreements will be preserved.';
    if (window.confirm(confirmMsg)) {
      await dbService.deleteMeeting(id);
      if (selectedMeetingId === id) setSelectedMeetingId(null);
      loadData();
    }
  };

  // Open Bulk Action Items Modal
  const handleOpenBulkActionModal = (mId?: string) => {
    const targetMeetingId = mId || selectedMeetingId || (meetings[0]?.id || '');
    setBulkMeetingId(targetMeetingId);

    const defaultDueDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    };

    // Pre-populate with 3 empty rows
    setBulkActionRows([
      { id: 'bulk-1', title: '', description: '', dueDate: defaultDueDate(), status: 'open', assignees: [] },
      { id: 'bulk-2', title: '', description: '', dueDate: defaultDueDate(), status: 'open', assignees: [] },
      { id: 'bulk-3', title: '', description: '', dueDate: defaultDueDate(), status: 'open', assignees: [] }
    ]);
    setIsBulkActionModalOpen(true);
  };

  const handleAddBulkRow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const newRowId = 'bulk-' + Math.random().toString(36).substr(2, 7);
    setBulkActionRows(prev => [
      ...prev,
      { id: newRowId, title: '', description: '', dueDate: d.toISOString().split('T')[0], status: 'open', assignees: [] }
    ]);
  };

  const handleRemoveBulkRow = (rowId: string) => {
    if (bulkActionRows.length <= 1) {
      alert(lang === 'nl' ? 'Er moet minstens één rij blijven staan.' : 'At least one row must remain.');
      return;
    }
    setBulkActionRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleBulkRowChange = (rowId: string, field: string, value: any) => {
    setBulkActionRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const handleSaveBulkActions = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = bulkActionRows.filter(r => r.title.trim().length > 0);
    if (validRows.length === 0) {
      alert(lang === 'nl' ? 'Vul minstens één actiepunt met een titel in.' : 'Please enter at least one action item title.');
      return;
    }

    const meeting = meetings.find(m => m.id === bulkMeetingId);
    const todayStr = new Date().toISOString().split('T')[0];

    for (const row of validRows) {
      const actionId = 'act-' + Math.random().toString(36).substr(2, 9);
      const newAction: MeetingActionItem = {
        id: actionId,
        meetingId: bulkMeetingId,
        meetingTitle: meeting ? meeting.title : undefined,
        createdDate: todayStr,
        title: row.title.trim(),
        description: row.description.trim(),
        assignees: row.assignees || [],
        status: row.status || 'open',
        dueDate: row.dueDate || todayStr,
        remarks: [],
        projectOrSubject: meeting ? meeting.projectOrSubject : undefined,
        completedAt: row.status === 'gereed' ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await dbService.saveMeetingActionItem(newAction);
    }

    setIsBulkActionModalOpen(false);
    loadData();
  };

  // Open Action Item Modal
  const handleOpenNewAction = (mId?: string) => {
    setEditingAction(null);
    setActionMeetingId(mId || selectedMeetingId || (meetings[0]?.id || ''));
    setActionTitle('');
    setActionDesc('');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setActionDueDate(d.toISOString().split('T')[0]);
    setActionStatus('open');
    setActionAssignees([]);
    setIsCreatingNewAssignee(false);
    setNewAssigneeName('');
    setNewAssigneeEmail('');
    setNewAssigneeOrg('');
    setIsActionModalOpen(true);
  };

  const handleOpenEditAction = (action: MeetingActionItem) => {
    setEditingAction(action);
    setActionMeetingId(action.meetingId);
    setActionTitle(action.title);
    setActionDesc(action.description);
    setActionDueDate(action.dueDate);
    setActionStatus(action.status);
    setActionAssignees(action.assignees || []);
    setIsCreatingNewAssignee(false);
    setNewAssigneeName('');
    setNewAssigneeEmail('');
    setNewAssigneeOrg('');
    setIsActionModalOpen(true);
  };

  // Save Action Item
  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim()) {
      alert(lang === 'nl' ? 'Vul een titel in voor het actiepunt.' : 'Please enter a title for the action item.');
      return;
    }

    const meeting = meetings.find(m => m.id === actionMeetingId);
    const actionId = editingAction ? editingAction.id : 'act-' + Math.random().toString(36).substr(2, 9);
    const todayStr = new Date().toISOString().split('T')[0];

    const updatedAction: MeetingActionItem = {
      id: actionId,
      meetingId: actionMeetingId,
      meetingTitle: meeting ? meeting.title : undefined,
      createdDate: editingAction ? editingAction.createdDate : todayStr,
      title: actionTitle.trim(),
      description: actionDesc.trim(),
      assignees: actionAssignees,
      status: actionStatus,
      dueDate: actionDueDate,
      remarks: editingAction ? editingAction.remarks : [],
      projectOrSubject: meeting ? meeting.projectOrSubject : undefined,
      completedAt: actionStatus === 'gereed' ? (editingAction?.completedAt || new Date().toISOString()) : null,
      createdAt: editingAction ? editingAction.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveMeetingActionItem(updatedAction);
    setIsActionModalOpen(false);
    loadData();
  };

  // Toggle Action Complete Quick Checkbox
  const handleToggleActionComplete = async (action: MeetingActionItem) => {
    const isCurrentlyDone = action.status === 'gereed';
    const newStatus: ActionItemStatus = isCurrentlyDone ? 'open' : 'gereed';
    await dbService.updateActionItemStatus(action.id, newStatus);
    loadData();
  };

  // Delete Action Item
  const handleDeleteAction = async (id: string) => {
    if (window.confirm(lang === 'nl' ? 'Actiepunt definitief verwijderen?' : 'Delete action item permanently?')) {
      await dbService.deleteMeetingActionItem(id);
      loadData();
    }
  };

  // Open Agreement Modal
  const handleOpenNewAgreement = (mId?: string) => {
    setEditingAgreement(null);
    const targetMeeting = meetings.find(m => m.id === (mId || selectedMeetingId)) || meetings[0];
    setAgrMeetingId(targetMeeting ? targetMeeting.id : '');
    setAgrTitle('');
    setAgrDesc('');
    setAgrProject(targetMeeting ? targetMeeting.projectOrSubject : '');
    setAgrDate(new Date().toISOString().split('T')[0]);
    setAgrStatus('actief');
    setIsAgreementModalOpen(true);
  };

  const handleOpenEditAgreement = (agr: MeetingAgreement) => {
    setEditingAgreement(agr);
    setAgrMeetingId(agr.meetingId);
    setAgrTitle(agr.title);
    setAgrDesc(agr.description);
    setAgrProject(agr.projectOrSubject);
    setAgrDate(agr.date);
    setAgrStatus(agr.status);
    setIsAgreementModalOpen(true);
  };

  // Save Agreement
  const handleSaveAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agrTitle.trim()) {
      alert(lang === 'nl' ? 'Vul een samenvatting in van de gemaakte afspraak.' : 'Please enter an agreement title.');
      return;
    }

    const meeting = meetings.find(m => m.id === agrMeetingId);
    const agrId = editingAgreement ? editingAgreement.id : 'agr-' + Math.random().toString(36).substr(2, 9);

    const updatedAgr: MeetingAgreement = {
      id: agrId,
      meetingId: agrMeetingId,
      meetingTitle: meeting ? meeting.title : undefined,
      title: agrTitle.trim(),
      description: agrDesc.trim(),
      projectOrSubject: agrProject.trim() || (meeting ? meeting.projectOrSubject : 'Algemeen'),
      date: agrDate,
      status: agrStatus,
      createdAt: editingAgreement ? editingAgreement.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveMeetingAgreement(updatedAgr);
    setIsAgreementModalOpen(false);
    loadData();
  };

  // Delete Agreement
  const handleDeleteAgreement = async (id: string) => {
    if (window.confirm(lang === 'nl' ? 'Gemaakte afspraak verwijderen?' : 'Delete agreement?')) {
      await dbService.deleteMeetingAgreement(id);
      loadData();
    }
  };

  // Open New Note Modal
  const handleOpenNewNote = (defaultMeetingId?: string) => {
    const targetMeetingId = defaultMeetingId || selectedMeetingId || (meetings.length > 0 ? meetings[0].id : '');
    const meeting = meetings.find(m => m.id === targetMeetingId);
    
    setEditingNote(null);
    setNoteMeetingId(targetMeetingId);
    setNoteTitle('');
    setNoteContent('');
    setNoteAuthor('');
    setNoteCategory('overlegverslag');
    setNoteDate(meeting ? meeting.date : new Date().toISOString().split('T')[0]);
    setNoteProject(meeting ? meeting.projectOrSubject : '');
    setNoteTags('');
    setIsNoteModalOpen(true);
  };

  // Open Edit Note Modal
  const handleOpenEditNote = (note: MeetingNote) => {
    setEditingNote(note);
    setNoteMeetingId(note.meetingId);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteAuthor(note.author || '');
    setNoteCategory(note.category || 'overlegverslag');
    setNoteDate(note.date);
    setNoteProject(note.projectOrSubject || '');
    setNoteTags(note.tags ? note.tags.join(', ') : '');
    setIsNoteModalOpen(true);
  };

  // Save Note (Create or Update)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || !noteMeetingId) return;

    const meeting = meetings.find(m => m.id === noteMeetingId);
    const noteId = editingNote ? editingNote.id : 'note-' + Math.random().toString(36).substr(2, 9);
    
    const parsedTags = noteTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const updatedNote: MeetingNote = {
      id: noteId,
      meetingId: noteMeetingId,
      meetingTitle: meeting ? meeting.title : undefined,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      author: noteAuthor.trim() || undefined,
      category: noteCategory,
      date: noteDate,
      projectOrSubject: noteProject.trim() || (meeting ? meeting.projectOrSubject : undefined),
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      createdAt: editingNote ? editingNote.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveMeetingNote(updatedNote);
    setIsNoteModalOpen(false);
    loadData();
  };

  // Delete Note
  const handleDeleteNote = async (id: string) => {
    if (window.confirm(lang === 'nl' ? 'Notitie / overlegverslag definitief verwijderen?' : 'Delete this note / meeting record?')) {
      await dbService.deleteMeetingNote(id);
      loadData();
    }
  };

  // Add Remark to Action Item
  const handleAddRemark = async () => {
    if (!activeRemarkAction || !newRemarkText.trim()) return;

    const remark: ActionItemRemark = {
      id: 'rem-' + Math.random().toString(36).substr(2, 9),
      author: 'Deelnemer / Actiehouder',
      text: newRemarkText.trim(),
      date: new Date().toISOString()
    };

    await dbService.addActionItemRemark(activeRemarkAction.id, remark);
    const updated = dbService.getMeetingActionItem(activeRemarkAction.id);
    setActiveRemarkAction(updated);
    setNewRemarkText('');
    loadData();
  };

  // Switch Email Modal Type and update default subject
  const handleSelectEmailModalType = (type: 'agenda' | 'notes_and_actions' | 'actions' | 'combination') => {
    setEmailModalType(type);
    if (!emailModalMeeting) return;
    if (type === 'agenda') {
      setEmailSubject(`Agenda: ${emailModalMeeting.title} (${emailModalMeeting.date}${emailModalMeeting.time ? ` om ${emailModalMeeting.time}` : ''})`);
    } else if (type === 'actions') {
      setEmailSubject(`Actielijst: ${emailModalMeeting.title} (${emailModalMeeting.date})`);
    } else if (type === 'notes_and_actions') {
      setEmailSubject(`Notities & Acties: ${emailModalMeeting.title} (${emailModalMeeting.date})`);
    } else if (type === 'combination') {
      setEmailSubject(`Agenda, Notities & Actielijst: ${emailModalMeeting.title} (${emailModalMeeting.date})`);
    }
  };

  // Open Email Modal
  const handleOpenEmailModal = (m: Meeting, initialType: 'agenda' | 'notes_and_actions' | 'actions' | 'combination' | 'minutes' = 'agenda') => {
    const effectiveType: 'agenda' | 'notes_and_actions' | 'actions' | 'combination' = 
      initialType === 'minutes' ? 'notes_and_actions' : initialType;

    setEmailModalMeeting(m);
    setEmailModalType(effectiveType);
    const emails = Array.from(new Set(m.participants.map(p => p.email.toLowerCase().trim()))).filter(Boolean);
    setEmailRecipients(emails);
    setEmailStatusMsg('');
    setIsSendingEmail(false);
    setEmailCustomIntro('');
    setIncludePublicUrlInEmail(true);
    setIncludeCalendarInEmail(true);
    setNewEmailRecipientInput('');

    if (effectiveType === 'agenda') {
      setEmailSubject(`Agenda: ${m.title} (${m.date}${m.time ? ` om ${m.time}` : ''})`);
    } else if (effectiveType === 'actions') {
      setEmailSubject(`Actielijst: ${m.title} (${m.date})`);
    } else if (effectiveType === 'notes_and_actions') {
      setEmailSubject(`Notities & Acties: ${m.title} (${m.date})`);
    } else if (effectiveType === 'combination') {
      setEmailSubject(`Agenda, Notities & Actielijst: ${m.title} (${m.date})`);
    }
  };

  // Add recipient to email list and auto-save to address book
  const handleAddEmailRecipient = async () => {
    const raw = newEmailRecipientInput.trim();
    if (!raw) return;

    let email = raw;
    let name = '';
    const match = raw.match(/^(.*?)\s*<(.+@.+)>$/);
    if (match) {
      name = match[1].trim();
      email = match[2].trim();
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@')) {
      alert(lang === 'nl' ? 'Voer een geldig e-mailadres in.' : 'Please enter a valid email address.');
      return;
    }
    if (!name) {
      name = cleanEmail.split('@')[0];
    }

    if (!emailRecipients.includes(cleanEmail)) {
      setEmailRecipients([...emailRecipients, cleanEmail]);
    }

    // Auto-save to address book so it can be managed
    await ensureContactInDb(name, cleanEmail);
    setNewEmailRecipientInput('');
  };

  // Send Meeting Agenda OR Summary & Action Items via Email
  const handleSendMeetingEmail = async () => {
    if (!emailModalMeeting || emailRecipients.length === 0) return;

    setIsSendingEmail(true);
    setEmailStatusMsg(lang === 'nl' ? 'E-mails worden verzonden...' : 'Sending emails...');

    const meetingAgreements = agreements.filter(a => a.meetingId === emailModalMeeting.id);
    const meetingActions = actionItems.filter(a => a.meetingId === emailModalMeeting.id);
    const meetingNotesForEmail = meetingNotes.filter(n => n.meetingId === emailModalMeeting.id);

    // Build Public unique URLs
    const publicAgendaUrl = `${getPublicOrigin()}?meeting_agenda=${emailModalMeeting.id}`;
    const appBaseUrl = `${getPublicOrigin()}?meeting_id=${emailModalMeeting.id}`;

    const meetingDateTimeStr = `${emailModalMeeting.date}T${emailModalMeeting.time || '10:00'}:00`;
    const durationMin = emailModalMeeting.durationMinutes || 60;
    const calDesc = `Overleg: ${emailModalMeeting.title}\nProject/Thema: ${emailModalMeeting.projectOrSubject}\nLocatie: ${emailModalMeeting.location || 'Online'}\nBekijk agenda online: ${publicAgendaUrl}`;
    const googleCalUrl = generateGoogleCalendarLink(emailModalMeeting.title, calDesc, meetingDateTimeStr, durationMin);
    const outlookCalUrl = generateOutlookLink(emailModalMeeting.title, calDesc, meetingDateTimeStr, durationMin);

    let badge = 'Agenda';
    let headerTitle = `📅 Agenda: ${emailModalMeeting.title}`;
    let emailBodyHtml = '';
    let actionUrl: string | undefined = undefined;
    let actionText: string | undefined = undefined;
    let footerNote = 'IT Platform Twente • Overleg & Agendabeheer';
    let calendarLinks: { googleUrl?: string; outlookUrl?: string } | undefined = undefined;

    const emailSubjectToSend = emailSubject.trim() || `Overleg: ${emailModalMeeting.title}`;

    // Common meeting info box
    const meetingMetaHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
          <tr>
            <td style="padding: 4px 0; width: 130px; font-weight: bold; color: #64748b;">📅 Datum & tijd:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${emailModalMeeting.date} ${emailModalMeeting.time ? `om ${emailModalMeeting.time} uur` : ''} (${durationMin} min)</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">📁 Project / Thema:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #4338ca;">${emailModalMeeting.projectOrSubject}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">📍 Locatie / Tool:</td>
            <td style="padding: 4px 0;">${emailModalMeeting.location || 'Microsoft Teams / Online'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold; color: #64748b;">👥 Deelnemers:</td>
            <td style="padding: 4px 0;">${emailModalMeeting.participants.map(p => `${p.name} (${p.email})`).join(', ') || 'Geen geregistreerd'}</td>
          </tr>
        </table>
      </div>
    `;

    // Common custom intro note
    const customIntroHtml = emailCustomIntro.trim() ? `
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #1e3a8a; line-height: 1.5;">
        ${emailCustomIntro.replace(/\n/g, '<br/>')}
      </div>
    ` : '';

    // Action items table generator
    const renderActionsTable = (actions: MeetingActionItem[]) => {
      if (actions.length === 0) {
        return '<p style="color: #64748b; font-size: 13px; font-style: italic; margin: 8px 0;">Geen actiepunten geregistreerd voor deze meeting.</p>';
      }
      return `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left;">
              <th style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Actiepunt</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Actiehouder(s)</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Uiterste datum</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${actions.map(act => {
              const isDone = act.status === 'gereed';
              const isInProg = act.status === 'in_behandeling';
              const statusColor = isDone ? '#059669' : isInProg ? '#2563eb' : '#d97706';
              const statusBg = isDone ? '#ecfdf5' : isInProg ? '#eff6ff' : '#fffbeb';
              const statusLabel = ACTION_STATUS_CONFIG[act.status]?.labelNl || act.status;
              const assigneesStr = act.assignees.map(a => a.name).join(', ') || 'Niet toegewezen';

              return `
                <tr>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; vertical-align: top;">
                    <strong style="color: #0f172a;">${act.title}</strong>
                    ${act.description ? `<div style="color: #64748b; font-size: 12px; margin-top: 4px;">${act.description}</div>` : ''}
                  </td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; color: #334155;">
                    ${assigneesStr}
                  </td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; color: #475569; white-space: nowrap;">
                    ${act.dueDate || '-'}
                  </td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; vertical-align: top;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; color: ${statusColor}; background-color: ${statusBg}; border: 1px solid ${statusColor}40;">
                      ${statusLabel}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };

    if (emailModalType === 'agenda') {
      badge = 'Agenda';
      headerTitle = `📅 Agenda: ${emailModalMeeting.title}`;
      footerNote = 'IT Platform Twente • Overleg & Agendabeheer';
      if (includePublicUrlInEmail) {
        actionUrl = publicAgendaUrl;
        actionText = 'Bekijk Interactieve Agenda Online';
      }
      if (includeCalendarInEmail) {
        calendarLinks = { googleUrl: googleCalUrl, outlookUrl: outlookCalUrl };
      }

      emailBodyHtml = `
        ${meetingMetaHtml}
        ${customIntroHtml}

        <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          📋 Voorbereide Agendapunten
        </h3>
        ${emailModalMeeting.agenda && emailModalMeeting.agenda.trim().length > 0 ? `
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; line-height: 1.6;">
            ${emailModalMeeting.agenda}
          </div>
        ` : `
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; color: #64748b; font-size: 13px;">
            De gedetailleerde inhoudelijke agendapunten worden nog aangevuld.
          </div>
        `}
      `;
    } else if (emailModalType === 'actions') {
      badge = 'Actielijst';
      headerTitle = `🎯 Actielijst: ${emailModalMeeting.title}`;
      footerNote = 'IT Platform Twente • Actiepuntenbeheer & Takenopvolging';
      actionUrl = appBaseUrl;
      actionText = 'Bekijk Actielijst & Werk Bij Online';

      emailBodyHtml = `
        ${meetingMetaHtml}
        ${customIntroHtml}

        <h3 style="color: #0f172a; font-size: 15px; margin: 20px 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          🎯 Overzicht Actiepunten (${meetingActions.length})
        </h3>
        <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0;">
          Hieronder vindt u de actielijst zoals vastgesteld tijdens dit overleg.
        </p>
        ${renderActionsTable(meetingActions)}
      `;
    } else if (emailModalType === 'notes_and_actions' || emailModalType === 'minutes') {
      badge = 'Notities & Acties';
      headerTitle = `📝 Notities & Actiepunten: ${emailModalMeeting.title}`;
      footerNote = 'IT Platform Twente • Overleg, Notities & Actiepunten';
      actionUrl = appBaseUrl;
      actionText = 'Bekijk Notities & Acties Online';

      emailBodyHtml = `
        ${meetingMetaHtml}
        ${customIntroHtml}

        <h3 style="color: #0f172a; font-size: 15px; margin: 20px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          📝 Overleg Notities & Verslag
        </h3>
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap;">
          ${emailModalMeeting.notes || 'Geen algemene notulen ingevoerd.'}
        </div>

        ${meetingNotesForEmail.length > 0 ? `
          <h4 style="color: #0f172a; font-size: 14px; margin: 18px 0 8px 0; font-weight: bold;">
            Gedetailleerde notities & verslagpunten (${meetingNotesForEmail.length})
          </h4>
          <div style="margin: 8px 0 16px 0;">
            ${meetingNotesForEmail.map(n => `
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <strong style="color: #0f172a; font-size: 13px;">${n.title}</strong>
                  <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: #eff6ff; color: #1d4ed8; text-transform: uppercase;">
                    ${n.category || 'Notitie'}
                  </span>
                </div>
                <div style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${n.content}</div>
                ${n.author ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Auteur: ${n.author} (${n.date})</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${meetingAgreements.length > 0 ? `
          <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            🤝 Gemaakte Afspraken (${meetingAgreements.length})
          </h3>
          <ul style="padding-left: 20px; font-size: 14px; color: #334155; margin: 8px 0;">
            ${meetingAgreements.map(a => `
              <li style="margin-bottom: 6px;">
                <strong>${a.title}</strong>: ${a.description}
              </li>
            `).join('')}
          </ul>
        ` : ''}

        <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          🎯 Gekoppelde Actiepunten (${meetingActions.length})
        </h3>
        ${renderActionsTable(meetingActions)}
      `;
    } else if (emailModalType === 'combination') {
      badge = 'Agenda, Notities & Actielijst';
      headerTitle = `📋 Overlegdossier: ${emailModalMeeting.title}`;
      footerNote = 'IT Platform Twente • Compleet Overleg-, Notities- en Actiebeheer';
      actionUrl = appBaseUrl;
      actionText = 'Bekijk Volledig Overleg Online';

      emailBodyHtml = `
        ${meetingMetaHtml}
        ${customIntroHtml}

        ${emailModalMeeting.agenda && emailModalMeeting.agenda.trim().length > 0 ? `
          <h3 style="color: #0f172a; font-size: 15px; margin: 20px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            📋 Agenda
          </h3>
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 14px; color: #334155; line-height: 1.6;">
            ${emailModalMeeting.agenda}
          </div>
        ` : ''}

        <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          📝 Overleg Notities & Verslag
        </h3>
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap;">
          ${emailModalMeeting.notes || 'Geen algemene notulen ingevoerd.'}
        </div>

        ${meetingNotesForEmail.length > 0 ? `
          <h4 style="color: #0f172a; font-size: 14px; margin: 18px 0 8px 0; font-weight: bold;">
            Gedetailleerde notities & verslagpunten (${meetingNotesForEmail.length})
          </h4>
          <div style="margin: 8px 0 16px 0;">
            ${meetingNotesForEmail.map(n => `
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <strong style="color: #0f172a; font-size: 13px;">${n.title}</strong>
                  <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: #eff6ff; color: #1d4ed8; text-transform: uppercase;">
                    ${n.category || 'Notitie'}
                  </span>
                </div>
                <div style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${n.content}</div>
                ${n.author ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Auteur: ${n.author} (${n.date})</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${meetingAgreements.length > 0 ? `
          <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            🤝 Gemaakte Afspraken (${meetingAgreements.length})
          </h3>
          <ul style="padding-left: 20px; font-size: 14px; color: #334155; margin: 8px 0;">
            ${meetingAgreements.map(a => `
              <li style="margin-bottom: 6px;">
                <strong>${a.title}</strong>: ${a.description}
              </li>
            `).join('')}
          </ul>
        ` : ''}

        <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
          🎯 Actielijst (${meetingActions.length})
        </h3>
        ${renderActionsTable(meetingActions)}
      `;
    }

    const fullHtml = wrapInMeetingEmailTemplate(
      headerTitle,
      emailBodyHtml,
      {
        badge,
        headerTitle,
        actionUrl,
        actionText,
        footerNote
      }
    );

    let sent = 0;
    let failed = 0;
    let lastErr = '';

    for (const recipient of emailRecipients) {
      try {
        await sendSystemEmail({
          to: recipient,
          subject: emailSubjectToSend,
          bodyHtml: fullHtml
        });
        sent++;

        // Log notification to central notification center
        await dbService.logNotification({
          type: emailModalType === 'agenda' ? 'agenda_prep' : 'meeting_actions',
          title: emailSubjectToSend,
          message: emailCustomIntro.trim() || `Verzonden voor meeting: ${emailModalMeeting.title}`,
          recipientEmail: recipient,
          recipientName: recipient.split('@')[0],
          uniqueUrl: actionUrl,
          itemType: 'meeting',
          itemId: emailModalMeeting.id,
          status: 'sent'
        });
      } catch (err: any) {
        console.error(`Fout bij verzenden naar ${recipient}:`, err);
        lastErr = err?.message || String(err);
        failed++;
      }
    }

    setIsSendingEmail(false);
    if (sent > 0) {
      if (emailModalType === 'agenda') {
        const updatedMeeting: Meeting = {
          ...emailModalMeeting,
          agendaStatus: 'verzonden',
          agendaUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await dbService.saveMeeting(updatedMeeting);
        loadData();
      }

      setEmailStatusMsg(
        lang === 'nl' 
          ? `Succesvol verzonden naar ${sent} geadresseerde(n)!${failed > 0 ? ` (${failed} mislukt)` : ''}` 
          : `Sent successfully to ${sent} recipient(s)!${failed > 0 ? ` (${failed} failed)` : ''}`
      );
      setTimeout(() => {
        setEmailModalMeeting(null);
      }, 2000);
    } else {
      const isBadCreds = lastErr.includes('535') || lastErr.includes('BadCredentials') || lastErr.includes('Username and Password not accepted');
      const hint = isBadCreds 
        ? '\n\nLet op: Google vereist een 16-letterig "App Wachtwoord" voor Gmail SMTP. Stel dit in via de E-mailinstellingen.' 
        : `\n\nFoutmelding: ${lastErr}`;
      alert((lang === 'nl' ? 'Kon e-mails niet verzenden.' : 'Failed to send emails.') + hint);
      setEmailStatusMsg(lang === 'nl' ? 'Verzenden mislukt.' : 'Sending failed.');
    }
  };

  // Helper formatting for notes text area
  const insertFormatting = (prefix: string, suffix: string = '') => {
    setFormNotes(prev => prev + `\n${prefix}Tekst${suffix}`);
  };

  // Filtered Meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const matchesSearch = 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.projectOrSubject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.participants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'all' || m.meetingType === filterType;
      return matchesSearch && matchesType;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetings, searchQuery, filterType]);

  // Filtered Actions
  const filteredActions = useMemo(() => {
    return actionItems.filter(a => {
      const matchesSearch = 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.assignees.some(assignee => assignee.name.toLowerCase().includes(searchQuery.toLowerCase()) || assignee.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
      const matchesMeeting = !selectedMeetingId || a.meetingId === selectedMeetingId;
      return matchesSearch && matchesStatus && matchesMeeting;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [actionItems, searchQuery, filterStatus, selectedMeetingId]);

  // Filtered Agreements
  const filteredAgreements = useMemo(() => {
    return agreements.filter(agr => {
      const matchesSearch = 
        agr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agr.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agr.projectOrSubject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMeeting = !selectedMeetingId || agr.meetingId === selectedMeetingId;
      return matchesSearch && matchesMeeting;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [agreements, searchQuery, selectedMeetingId]);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return meetingNotes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.author && note.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (note.meetingTitle && note.meetingTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (note.projectOrSubject && note.projectOrSubject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (note.tags && note.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesCategory = filterNoteCategory === 'all' || note.category === filterNoteCategory;
      const matchesMeeting = !selectedMeetingId || note.meetingId === selectedMeetingId;
      return matchesSearch && matchesCategory && matchesMeeting;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetingNotes, searchQuery, filterNoteCategory, selectedMeetingId]);

  const activeMeeting = useMemo(() => {
    return meetings.find(m => m.id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FolderKanban className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              {lang === 'nl' ? 'Notities, Afspraken & Acties' : 'Notes, Agreements & Action Items'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {lang === 'nl' 
              ? 'Beheer stuurgroepoverleggen, bila\'s, projectmeetings en afdelingsoverleggen. Leg notities en gemaakte afspraken vast, wijs actiehouders toe en verstuur verslagen met één klik.' 
              : 'Manage steering committee meetings, 1-on-1s, project meetings and department check-ins. Keep notes, agreements, action items and notify participants.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTemplateManagerModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
            id="btn-manage-templates-header"
            title={lang === 'nl' ? 'Beheer agenda sjablonen (Stuurgroep, Kenniskringen, Projectteams, etc.)' : 'Manage agenda templates'}
          >
            <Layers className="h-4 w-4 text-indigo-600" />
            {lang === 'nl' ? 'Sjablonen' : 'Templates'}
          </button>
          <button
            onClick={handleOpenNewMeeting}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            id="btn-new-meeting"
          >
            <Plus className="h-4 w-4" />
            {lang === 'nl' ? 'Nieuwe Meeting' : 'New Meeting'}
          </button>
          <button
            onClick={() => handleOpenNewNote()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            id="btn-new-note-header"
          >
            <FileText className="h-4 w-4" />
            {lang === 'nl' ? '+ Notitie / Verslag' : '+ Note / Record'}
          </button>
          <button
            onClick={() => handleOpenNewAction()}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            id="btn-new-action-direct"
          >
            <CheckCircle2 className="h-4 w-4" />
            {lang === 'nl' ? '+ Actiepunt' : '+ Action Item'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setSubTab('meetings'); setSelectedMeetingId(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'meetings' && !selectedMeetingId
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {lang === 'nl' ? 'Overleggen' : 'Meetings'} ({meetings.length})
          </button>

          <button
            onClick={() => { setSubTab('notes'); setSelectedMeetingId(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'notes' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {lang === 'nl' ? 'Notities & Verslagen' : 'Notes & Records'} ({meetingNotes.length})
          </button>

          <button
            onClick={() => setSubTab('actions')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'actions' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            {lang === 'nl' ? 'Actiepunten' : 'Action Items'} ({actionItems.filter(a => a.status !== 'gereed').length} open)
          </button>

          <button
            onClick={() => setSubTab('agreements')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'agreements' 
                ? 'bg-purple-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Handshake className="h-3.5 w-3.5" />
            {lang === 'nl' ? 'Gemaakte Afspraken' : 'Agreements'} ({agreements.length})
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-52">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={lang === 'nl' ? 'Zoek op titel, inhoud, auteur...' : 'Search title, content, author...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-400"
            />
          </div>

          {subTab === 'meetings' && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl text-xs px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="all">{lang === 'nl' ? 'Alle types' : 'All types'}</option>
              {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{lang === 'nl' ? v.nl : v.en}</option>
              ))}
            </select>
          )}

          {subTab === 'notes' && (
            <select
              value={filterNoteCategory}
              onChange={(e) => setFilterNoteCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl text-xs px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="all">{lang === 'nl' ? 'Alle categorieën' : 'All categories'}</option>
              <option value="overlegverslag">{lang === 'nl' ? 'Overlegverslag' : 'Meeting Record'}</option>
              <option value="notitie">{lang === 'nl' ? 'Notitie' : 'Note'}</option>
              <option value="besluit">{lang === 'nl' ? 'Besluit' : 'Decision'}</option>
              <option value="bespreking">{lang === 'nl' ? 'Bespreking' : 'Discussion'}</option>
              <option value="aantekening">{lang === 'nl' ? 'Aantekening' : 'Memo'}</option>
              <option value="rondvraag">{lang === 'nl' ? 'Rondvraag' : 'A.O.B.'}</option>
            </select>
          )}

          {subTab === 'actions' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl text-xs px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="all">{lang === 'nl' ? 'Alle statussen' : 'All statuses'}</option>
              <option value="open">{lang === 'nl' ? 'Openstaand' : 'Open'}</option>
              <option value="in_behandeling">{lang === 'nl' ? 'In behandeling' : 'In Progress'}</option>
              <option value="gereed">{lang === 'nl' ? 'Gereed' : 'Completed'}</option>
              <option value="on_hold">{lang === 'nl' ? 'On Hold' : 'On Hold'}</option>
            </select>
          )}
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      {selectedMeetingId && activeMeeting ? (
        /* DETAIL VIEW OF SINGLE MEETING */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <button
                  onClick={() => setSelectedMeetingId(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 mb-2 cursor-pointer"
                >
                  ← {lang === 'nl' ? 'Terug naar alle overleggen' : 'Back to all meetings'}
                </button>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{activeMeeting.title}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${MEETING_TYPE_LABELS[activeMeeting.meetingType]?.color || 'bg-slate-100'}`}>
                    {MEETING_TYPE_LABELS[activeMeeting.meetingType]?.nl || activeMeeting.meetingType}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    {activeMeeting.date} {activeMeeting.time ? `(${activeMeeting.time})` : ''}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <FolderKanban className="h-3.5 w-3.5 text-purple-500" />
                    {activeMeeting.projectOrSubject}
                  </span>
                  {activeMeeting.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {activeMeeting.location}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFormattedAgendaMeeting(activeMeeting)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title={lang === 'nl' ? 'Bekijk of exporteer als officiële IT Platform Twente opgemaakte agenda (met transparante achtergrond & logo)' : 'View formatted agenda'}
                  id="btn-view-formatted-agenda"
                >
                  <Palette className="h-3.5 w-3.5" />
                  {lang === 'nl' ? 'Opgemaakte Agenda' : 'Formatted Agenda'}
                </button>
                <button
                  onClick={() => handleOpenAgendaEditor(activeMeeting)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-all cursor-pointer"
                  title="Bewerk de agenda met opmaak & afbeeldingen"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {lang === 'nl' ? 'Agenda Voorbereiden' : 'Prepare Agenda'}
                </button>
                <button
                  onClick={() => handleCopyAgendaUrl(activeMeeting.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Kopieer de unieke publieke link naar deze agenda"
                >
                  <Share2 className="h-3.5 w-3.5 text-slate-500" />
                  {copiedMeetingUrlId === activeMeeting.id ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Kopieer Link' : 'Copy Link')}
                </button>
                <a
                  href={`${getPublicOrigin()}?meeting_agenda=${activeMeeting.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Bekijk hoe de agenda eruitziet voor genodigden"
                >
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  {lang === 'nl' ? 'Open Pagina' : 'View Page'}
                </a>
                <button
                  onClick={() => handleOpenEmailModal(activeMeeting, 'agenda')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold border border-purple-200 transition-all cursor-pointer"
                  title="Verzend agenda vooraf naar genodigden"
                >
                  <Send className="h-3.5 w-3.5" />
                  {lang === 'nl' ? 'Agenda Mailen' : 'Email Agenda'}
                </button>
                <button
                  onClick={() => handleOpenEmailModal(activeMeeting, 'minutes')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
                  title="Verzend verslag & actiepunten naar deelnemers"
                >
                  <Send className="h-3.5 w-3.5" />
                  {lang === 'nl' ? 'Verslag Mailen' : 'Email Minutes'}
                </button>
                <button
                  onClick={() => handleOpenEditMeeting(activeMeeting)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  title="Meeting bewerken"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteMeeting(activeMeeting.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                  title="Meeting verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Linked Datumprikker Info Banner */}
            {activeMeeting.pollId ? (
              <div className="py-3 px-4 bg-purple-50/70 border border-purple-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🗳️</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">
                        {lang === 'nl' ? 'Gekoppelde Datumprikker:' : 'Linked Date Poll:'}
                      </span>
                      <span className="text-xs bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-md">
                        {activeMeeting.pollTitle || 'Datumprikker'}
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      {lang === 'nl' 
                        ? 'Dit overleg is gekoppeld aan de datumprikker. Genodigden en planning zijn gesynchroniseerd.' 
                        : 'This meeting is linked to a date poll. Invitees and scheduling are connected.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onNavigateToPoll && (
                    <button
                      onClick={() => onNavigateToPoll(activeMeeting.pollId!)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>{lang === 'nl' ? 'Bekijk Datumprikker' : 'View Date Poll'}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setLinkPollMeeting(activeMeeting);
                      setIsLinkPollModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                    title={lang === 'nl' ? 'Koppeling wijzigen' : 'Change link'}
                  >
                    {lang === 'nl' ? 'Wijzigen' : 'Change'}
                  </button>
                  <button
                    onClick={() => handleUnlinkPollFromMeeting(activeMeeting)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                    title={lang === 'nl' ? 'Koppeling met datumprikker verbreken' : 'Unlink date poll'}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-2.5 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">🗳️</span>
                  <span>{lang === 'nl' ? 'Geen datumprikker gekoppeld aan dit overleg.' : 'No date poll linked to this meeting.'}</span>
                </div>
                <button
                  onClick={() => {
                    setLinkPollMeeting(activeMeeting);
                    setIsLinkPollModalOpen(true);
                  }}
                  className="px-3 py-1 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>{lang === 'nl' ? 'Koppel met Datumprikker' : 'Link Date Poll'}</span>
                </button>
              </div>
            )}

            {/* Participants Bar */}
            <div className="py-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600 uppercase block mb-1.5">
                {lang === 'nl' ? 'Deelnemers & Aanwezigen:' : 'Participants:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {activeMeeting.participants.map((p, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    {p.name} <span className="text-slate-400 text-[10px]">({p.email})</span>
                  </span>
                ))}
                {activeMeeting.participants.length === 0 && (
                  <span className="text-xs text-slate-400 italic">
                    {lang === 'nl' ? 'Geen deelnemers toegevoegd.' : 'No participants added.'}
                  </span>
                )}
              </div>
            </div>

            {/* Agenda Section */}
            <div className="pt-4 border-b border-slate-100 pb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  {lang === 'nl' ? 'Voorbereide Agenda' : 'Prepared Agenda'}
                  <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    activeMeeting.agendaStatus === 'verzonden'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : activeMeeting.agendaStatus === 'definitief'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {activeMeeting.agendaStatus === 'verzonden' 
                      ? (lang === 'nl' ? 'Verzonden' : 'Sent')
                      : activeMeeting.agendaStatus === 'definitief'
                      ? (lang === 'nl' ? 'Definitief' : 'Final')
                      : (lang === 'nl' ? 'Concept' : 'Draft')}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenAgendaEditor(activeMeeting)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    {lang === 'nl' ? 'Agenda bewerken' : 'Edit agenda'}
                  </button>
                </div>
              </div>

              {activeMeeting.agenda && activeMeeting.agenda.trim().length > 0 ? (
                <div 
                  className="p-5 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 leading-relaxed font-sans shadow-xs space-y-2 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-800 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_img]:max-w-md [&_img]:rounded-lg [&_img]:my-2 [&_img]:border [&_img]:border-slate-200 [&_img]:shadow-xs"
                  dangerouslySetInnerHTML={{ __html: activeMeeting.agenda }}
                />
              ) : (
                <div className="p-6 bg-slate-50/70 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    {lang === 'nl' ? 'Nog geen agenda voorbereid voor dit overleg.' : 'No agenda prepared for this meeting yet.'}
                  </p>
                  <button
                    onClick={() => handleOpenAgendaEditor(activeMeeting)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {lang === 'nl' ? 'Nu Agenda Opstellen (met foto\'s & opmaak)' : 'Compose Agenda Now'}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Notes & Meeting Record for this Meeting */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'nl' ? 'Notities & Overlegverslag' : 'Notes & Meeting Record'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {meetingNotes.filter(n => n.meetingId === activeMeeting.id).length}
                </span>
              </div>
              <button
                onClick={() => handleOpenNewNote(activeMeeting.id)}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 cursor-pointer"
                id="btn-add-note-meeting-detail"
              >
                <Plus className="h-3 w-3" />
                {lang === 'nl' ? '+ Notitie / Verslag' : '+ Note / Record'}
              </button>
            </div>

            {/* General meeting summary / notes if entered */}
            {activeMeeting.notes && activeMeeting.notes.trim().length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>{lang === 'nl' ? 'Algemene notulen / samenvatting:' : 'General meeting notes:'}</span>
                  <button 
                    onClick={() => handleOpenEditMeeting(activeMeeting)} 
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" />
                    {lang === 'nl' ? 'Bewerken' : 'Edit'}
                  </button>
                </div>
                <div className="whitespace-pre-wrap">{activeMeeting.notes}</div>
              </div>
            )}

            {/* Structured Notes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meetingNotes.filter(n => n.meetingId === activeMeeting.id).map(note => {
                const catConf = NOTE_CATEGORY_CONFIG[note.category] || NOTE_CATEGORY_CONFIG.overlegverslag;
                return (
                  <div key={note.id} className="p-4 bg-slate-50/60 hover:bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 relative group transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catConf.badgeClass}`}>
                          {lang === 'nl' ? catConf.labelNl : catConf.labelEn}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">{note.date}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEditNote(note)} 
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer"
                          title="Bewerken"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteNote(note.id)} 
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900">{note.title}</h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-400 font-medium">
                      <span>{note.author ? `Door: ${note.author}` : (note.projectOrSubject || '')}</span>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {note.tags.map((t, idx) => (
                            <span key={idx} className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-normal">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {meetingNotes.filter(n => n.meetingId === activeMeeting.id).length === 0 && (!activeMeeting.notes || activeMeeting.notes.trim().length === 0) && (
                <div className="col-span-2 py-6 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-400 italic">
                    {lang === 'nl' ? 'Nog geen notities of overlegverslag vastgelegd voor dit overleg.' : 'No notes or meeting record recorded for this meeting yet.'}
                  </p>
                  <button
                    onClick={() => handleOpenNewNote(activeMeeting.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    {lang === 'nl' ? 'Eerste Notitie / Verslag Toevoegen' : 'Add First Note / Record'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Agreements for this Meeting */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'nl' ? 'Gemaakte Afspraken' : 'Agreements Made'}
                </h3>
              </div>
              <button
                onClick={() => handleOpenNewAgreement(activeMeeting.id)}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                {lang === 'nl' ? '+ Afspraak' : '+ Agreement'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agreements.filter(a => a.meetingId === activeMeeting.id).map(agr => (
                <div key={agr.id} className="p-3 bg-purple-50/40 border border-purple-100 rounded-xl space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950">{agr.title}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenEditAgreement(agr)} className="text-slate-400 hover:text-indigo-600">
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleDeleteAgreement(agr.id)} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{agr.description}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-medium">
                    <span>{agr.projectOrSubject}</span>
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-bold uppercase">{agr.status}</span>
                  </div>
                </div>
              ))}
              {agreements.filter(a => a.meetingId === activeMeeting.id).length === 0 && (
                <p className="text-xs text-slate-400 italic col-span-2">
                  {lang === 'nl' ? 'Nog geen afspraken vastgelegd voor dit overleg.' : 'No agreements recorded for this meeting yet.'}
                </p>
              )}
            </div>
          </div>

          {/* Action Items for this Meeting */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'nl' ? 'Actiepunten voor deze Meeting' : 'Action Items for this Meeting'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenBulkActionModal(activeMeeting.id)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 cursor-pointer transition-all"
                  title={lang === 'nl' ? 'Meerdere actiepunten in bulk toevoegen' : 'Add multiple action items'}
                >
                  <Rows className="h-3 w-3" />
                  {lang === 'nl' ? 'Bulk Actiepunten' : 'Bulk Actions'}
                </button>
                <button
                  onClick={() => handleOpenNewAction(activeMeeting.id)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  {lang === 'nl' ? '+ Actiepunt' : '+ Action Item'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {actionItems.filter(a => a.meetingId === activeMeeting.id).map(act => (
                <div key={act.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group">
                  <div className="flex items-start gap-2.5 flex-1">
                    <button
                      onClick={() => handleToggleActionComplete(act)}
                      className={`mt-0.5 p-1 rounded-md transition-colors cursor-pointer ${
                        act.status === 'gereed' 
                          ? 'bg-emerald-600 text-white' 
                          : 'border border-slate-300 hover:border-emerald-500 text-transparent'
                      }`}
                      title="Afvinken voor gereed"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <div>
                      <span className={`text-xs font-bold ${act.status === 'gereed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {act.title}
                      </span>
                      {act.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{act.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-600">
                          {lang === 'nl' ? 'Actiehouder(s):' : 'Assignee(s):'} {act.assignees.map(a => a.name).join(', ') || 'Niemand'}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-amber-600">
                          {lang === 'nl' ? 'Gereed voor:' : 'Due:'} {act.dueDate}
                        </span>
                        {act.remarks && act.remarks.length > 0 && (
                          <button
                            onClick={() => setActiveRemarkAction(act)}
                            className="flex items-center gap-0.5 text-indigo-600 font-bold hover:underline ml-1"
                          >
                            <MessageSquare className="h-2.5 w-2.5" />
                            {act.remarks.length} {lang === 'nl' ? 'opmerkingen' : 'remarks'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ACTION_STATUS_CONFIG[act.status]?.badgeClass || 'bg-slate-100'}`}>
                      {ACTION_STATUS_CONFIG[act.status]?.labelNl || act.status}
                    </span>
                    <button
                      onClick={() => setActiveRemarkAction(act)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
                      title="Opmerkingen toevoegen"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditAction(act)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg"
                      title="Actiepunt bewerken"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAction(act.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Actiepunt verwijderen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {actionItems.filter(a => a.meetingId === activeMeeting.id).length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">
                  {lang === 'nl' ? 'Nog geen actiepunten aangemaakt voor deze meeting.' : 'No action items created for this meeting yet.'}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : subTab === 'meetings' ? (
        /* LIST OF MEETINGS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map(m => {
            const meetingActions = actionItems.filter(a => a.meetingId === m.id);
            const openActions = meetingActions.filter(a => a.status !== 'gereed');
            const meetingAgrs = agreements.filter(a => a.meetingId === m.id);

            return (
              <div 
                key={m.id} 
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                onClick={() => setSelectedMeetingId(m.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${MEETING_TYPE_LABELS[m.meetingType]?.color || 'bg-slate-100'}`}>
                      {MEETING_TYPE_LABELS[m.meetingType]?.nl || m.meetingType}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {m.date} {m.time ? `• ${m.time}` : ''}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {m.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 mb-2 font-medium flex-wrap">
                    <span className="flex items-center gap-1">
                      <FolderKanban className="h-3 w-3 text-purple-500" />
                      <span>{m.projectOrSubject}</span>
                    </span>
                    {m.pollId && (
                      <span 
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200"
                        title={lang === 'nl' ? `Gekoppeld met datumprikker: ${m.pollTitle || ''}` : `Linked date poll: ${m.pollTitle || ''}`}
                      >
                        <span>🗳️</span>
                        <span className="truncate max-w-[110px]">{m.pollTitle || 'Datumprikker'}</span>
                      </span>
                    )}
                    {m.agenda && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                        m.agendaStatus === 'verzonden' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : m.agendaStatus === 'definitief' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        Agenda: {m.agendaStatus || 'concept'}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 mb-3">
                    {m.notes ? m.notes.replace(/[#*`_]/g, '') : (m.agenda ? (lang === 'nl' ? 'Agenda opgesteld' : 'Agenda prepared') : (lang === 'nl' ? 'Geen notities' : 'No notes'))}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-slate-400" />
                      {m.participants.length} {lang === 'nl' ? 'deelnemers' : 'participants'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Handshake className="h-3 w-3 text-purple-500" />
                      {meetingAgrs.length} {lang === 'nl' ? 'afspraken' : 'agreements'}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTodo className="h-3 w-3 text-emerald-500" />
                      {openActions.length} {lang === 'nl' ? 'open acties' : 'open actions'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    {lang === 'nl' ? 'Bekijk & Beheer' : 'View & Manage'} <ChevronRight className="h-3 w-3" />
                  </span>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setFormattedAgendaMeeting(m)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title={lang === 'nl' ? 'Opgemaakte Agenda (IT Platform Twente format)' : 'Formatted Agenda (ITPT style)'}
                    >
                      <Palette className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenAgendaEditor(m)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title={lang === 'nl' ? 'Agenda voorbereiden / bewerken' : 'Prepare agenda'}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopyAgendaUrl(m.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title={lang === 'nl' ? 'Kopieer unieke agenda link' : 'Copy unique agenda link'}
                    >
                      {copiedMeetingUrlId === m.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Share2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenEmailModal(m, 'agenda')}
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                      title={lang === 'nl' ? 'Verzend agenda per mail' : 'Email agenda'}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditMeeting(m)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Bewerken"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMeeting(m.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Verwijderen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredMeetings.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                {lang === 'nl' ? 'Geen meetings gevonden.' : 'No meetings found.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'nl' ? 'Klik op "+ Nieuwe Meeting" om uw eerste overleg vast te leggen.' : 'Click "+ New Meeting" to schedule your first meeting.'}
              </p>
            </div>
          )}
        </div>
      ) : subTab === 'notes' ? (
        /* NOTITIES & OVERLEGVERSLAGEN VIEW */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                {lang === 'nl' ? 'Notities & Overlegverslagen' : 'Notes & Meeting Records'}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {filteredNotes.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'nl' 
                  ? 'Vastgelegde inhoudelijke notulen, besproken thema\'s, genomen besluiten en rondvragen per overleg.' 
                  : 'Recorded meeting minutes, discussed topics, decisions and AOB per meeting.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenNewNote()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              id="btn-new-note-tab"
            >
              <Plus className="h-4 w-4" />
              {lang === 'nl' ? '+ Nieuwe Notitie / Verslag' : '+ New Note / Record'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map(note => {
              const catConf = NOTE_CATEGORY_CONFIG[note.category] || NOTE_CATEGORY_CONFIG.overlegverslag;
              return (
                <div key={note.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catConf.badgeClass}`}>
                        {lang === 'nl' ? catConf.labelNl : catConf.labelEn}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">{note.date}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1">{note.title}</h4>

                    {note.meetingTitle && (
                      <button
                        onClick={() => {
                          setSelectedMeetingId(note.meetingId);
                          setSubTab('meetings');
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold mb-2 flex items-center gap-1 cursor-pointer truncate max-w-full text-left"
                        title={lang === 'nl' ? 'Ga naar dit overleg' : 'Go to meeting'}
                      >
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="truncate">{note.meetingTitle}</span>
                      </button>
                    )}

                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 max-h-56 overflow-y-auto font-sans">
                      {note.content}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                    <div className="truncate">
                      <span className="text-[11px] text-slate-500 font-medium truncate block">
                        {note.author ? (lang === 'nl' ? `Auteur: ${note.author}` : `By: ${note.author}`) : (note.projectOrSubject || '')}
                      </span>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {note.tags.map((t, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-normal">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenEditNote(note)} 
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Bewerken"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteNote(note.id)} 
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">
                  {lang === 'nl' ? 'Geen notities of overlegverslagen gevonden.' : 'No notes or meeting records found.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'nl' ? 'Leg notities, besluiten of acties vast bij uw overleggen.' : 'Record notes, decisions or points for your meetings.'}
                </p>
                <button
                  onClick={() => handleOpenNewNote()}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  {lang === 'nl' ? 'Nieuwe Notitie Aanmaken' : 'Create New Note'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'actions' ? (
        /* MASTER ACTION ITEMS VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-emerald-600" />
              {lang === 'nl' ? 'Totaaloverzicht Actiepunten' : 'All Action Items'} ({filteredActions.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenBulkActionModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title={lang === 'nl' ? 'Meerdere actiepunten tegelijk invoeren na overleg' : 'Add multiple action items at once'}
              >
                <Rows className="h-3.5 w-3.5" />
                <span>{lang === 'nl' ? 'Bulk Actiepunten Invoeren' : 'Bulk Action Items'}</span>
              </button>
              <button
                onClick={() => handleOpenNewAction()}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {lang === 'nl' ? 'Nieuw Actiepunt' : 'New Action'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">{lang === 'nl' ? 'Actiepunt & Omschrijving' : 'Action Item'}</th>
                  <th className="py-3 px-4">{lang === 'nl' ? 'Gekoppelde Meeting' : 'Meeting'}</th>
                  <th className="py-3 px-4">{lang === 'nl' ? 'Actiehouder(s)' : 'Assignee(s)'}</th>
                  <th className="py-3 px-4">{lang === 'nl' ? 'Gereed Datum' : 'Due Date'}</th>
                  <th className="py-3 px-4">{lang === 'nl' ? 'Status' : 'Status'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'nl' ? 'Acties' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActions.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActionComplete(act)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          act.status === 'gereed' 
                            ? 'bg-emerald-600 text-white' 
                            : 'border border-slate-300 hover:border-emerald-500 text-transparent'
                        }`}
                        title="Afvinken voor gereed"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold block ${act.status === 'gereed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {act.title}
                      </span>
                      {act.description && (
                        <p className="text-[11px] text-slate-500 max-w-md line-clamp-1">{act.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {act.meetingTitle || (lang === 'nl' ? 'Los overleg' : 'Standalone')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {act.assignees.map((assignee, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700">
                            {assignee.name}
                          </span>
                        ))}
                        {act.assignees.length === 0 && (
                          <span className="text-slate-400 italic">{lang === 'nl' ? 'Niet toegewezen' : 'Unassigned'}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                      {act.dueDate}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ACTION_STATUS_CONFIG[act.status]?.badgeClass || 'bg-slate-100'}`}>
                        {ACTION_STATUS_CONFIG[act.status]?.labelNl || act.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActiveRemarkAction(act)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                          title="Opmerkingen inzien / toevoegen"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditAction(act)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                          title="Bewerken"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAction(act.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredActions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      {lang === 'nl' ? 'Geen actiepunten gevonden.' : 'No action items found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Gemaakte Afspraken View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgreements.map(agr => (
            <div key={agr.id} className="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">
                    {agr.status}
                  </span>
                  <span className="text-[11px] text-slate-400">{agr.date}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{agr.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{agr.description}</p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-medium">{agr.projectOrSubject}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenEditAgreement(agr)} className="p-1 text-slate-400 hover:text-indigo-600">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteAgreement(agr.id)} className="p-1 text-slate-400 hover:text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredAgreements.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Handshake className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                {lang === 'nl' ? 'Geen afspraken gevonden.' : 'No agreements found.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. MEETING CREATE / EDIT MODAL */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingMeeting 
                    ? (lang === 'nl' ? 'Overleg / Meeting Bewerken' : 'Edit Meeting') 
                    : (lang === 'nl' ? 'Nieuw Overleg / Meeting Vastleggen' : 'New Meeting')}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'nl' ? 'Stel details in, bereid de agenda voor met opmaak en afbeeldingen, en beheer deelnemers.' : 'Configure details, prepare agenda with rich text and images, and manage participants.'}
                </p>
              </div>
              <button onClick={() => setIsMeetingModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 gap-1 pt-3 mb-4">
              <button
                type="button"
                onClick={() => setMeetingModalTab('details')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  meetingModalTab === 'details'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {lang === 'nl' ? '1. Details & Deelnemers' : '1. Details & Attendees'}
              </button>
              <button
                type="button"
                onClick={() => setMeetingModalTab('agenda')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  meetingModalTab === 'agenda'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {lang === 'nl' ? '2. Agenda Voorbereiden' : '2. Agenda Preparation'}
                {formAgenda && formAgenda.trim().length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Agenda ingevuld"></span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMeetingModalTab('notes')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  meetingModalTab === 'notes'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {lang === 'nl' ? '3. Notities & Verslag' : '3. Notes & Minutes'}
              </button>
            </div>

            <form onSubmit={handleSaveMeeting} className="space-y-4">
              {/* TAB 1: DETAILS & DEELNEMERS */}
              {meetingModalTab === 'details' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {lang === 'nl' ? 'Titel van het overleg *' : 'Meeting Title *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'nl' ? 'bijv. Stuurgroep RDNG 3.0 of Bila Johan & Aldo' : 'e.g. Steering committee'}
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {lang === 'nl' ? 'Type overleg' : 'Meeting Type'}
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as MeetingType)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      >
                        {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{lang === 'nl' ? v.nl : v.en}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {lang === 'nl' ? 'Datum' : 'Date'}
                      </label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {lang === 'nl' ? 'Tijdstip' : 'Time'}
                      </label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {lang === 'nl' ? 'Duur (minuten)' : 'Duration (min)'}
                      </label>
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={formDurationMinutes}
                        onChange={(e) => setFormDurationMinutes(parseInt(e.target.value, 10) || 60)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Koppeling: Project / Verkenning OF Losse meeting met Thema */}
                  <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
                        <span>{lang === 'nl' ? 'Koppeling van dit overleg' : 'Meeting Linkage'}</span>
                      </label>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setFormLinkType('project');
                            if (!formProjectId && projects.length > 0) {
                              setFormProjectId(projects[0].id);
                              setFormProject(projects[0].title);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            formLinkType === 'project'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📁 {lang === 'nl' ? 'Project / Verkenning' : 'Project / Exploration'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormLinkType('theme');
                            setFormProjectId('');
                            if (!formTheme) {
                              setFormTheme('Algemeen');
                              setFormProject('Algemeen');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            formLinkType === 'theme'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          💡 {lang === 'nl' ? 'Los overleg (Thema)' : 'Standalone (Theme)'}
                        </button>
                      </div>
                    </div>

                    {formLinkType === 'project' ? (
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          {lang === 'nl' ? 'Kies uit uw Projecten & Verkenningen *' : 'Select from Projects & Explorations *'}
                        </label>
                        <select
                          value={formProjectId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            setFormProjectId(pId);
                            const matched = projects.find(p => p.id === pId);
                            if (matched) setFormProject(matched.title);
                          }}
                          className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        >
                          <option value="" disabled>{lang === 'nl' ? '-- Selecteer project of verkenning --' : '-- Select project or exploration --'}</option>
                          <optgroup label={lang === 'nl' ? '📁 Projecten' : '📁 Projects'}>
                            {projects.filter(p => p.type === 'project').map(p => (
                              <option key={p.id} value={p.id}>📁 {p.title}</option>
                            ))}
                          </optgroup>
                          <optgroup label={lang === 'nl' ? '🔭 Verkenningen' : '🔭 Explorations'}>
                            {projects.filter(p => p.type === 'exploration').map(p => (
                              <option key={p.id} value={p.id}>🔭 {p.title}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          {lang === 'nl' ? 'Thema / Onderwerp van het losse overleg *' : 'Theme / Subject of standalone meeting *'}
                        </label>
                        <input
                          type="text"
                          placeholder={lang === 'nl' ? 'bijv. IT Architectuur, Bestuurlijk Overleg, Werkoverleg...' : 'e.g. Architecture, Board Meeting...'}
                          value={formTheme}
                          onChange={(e) => {
                            setFormTheme(e.target.value);
                            setFormProject(e.target.value);
                          }}
                          className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {lang === 'nl' ? 'Locatie / Tool' : 'Location'}
                    </label>
                    <input
                      type="text"
                      placeholder="bijv. Microsoft Teams, Vergaderruimte 2, Enschede"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>

                  {/* Datumprikker Koppeling */}
                  <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <span>🗳️</span>
                        <span>{lang === 'nl' ? 'Koppeling met Datumprikker (optioneel)' : 'Link with Date Poll (optional)'}</span>
                      </label>
                      {formPollId && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormPollId('');
                            setFormPollTitle('');
                          }}
                          className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          {lang === 'nl' ? 'Ontkoppelen' : 'Unlink'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={formPollId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setFormPollId(selectedId);
                          const poll = polls.find(p => p.id === selectedId);
                          if (poll) {
                            setFormPollTitle(poll.title);
                          } else {
                            setFormPollTitle('');
                          }
                        }}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:outline-none text-slate-800 font-medium"
                      >
                        <option value="">{lang === 'nl' ? '-- Geen datumprikker gekoppeld --' : '-- No date poll linked --'}</option>
                        {polls.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.archived ? '📁 [Archief] ' : '📅 '} {p.title} {p.finalizedOptionId ? (lang === 'nl' ? '(Geprikt / Definitief)' : '(Finalized)') : (lang === 'nl' ? '(Loopt nog)' : '(Pending)')}
                          </option>
                        ))}
                      </select>
                      {formPollId && (
                        <button
                          type="button"
                          onClick={() => {
                            const poll = polls.find(p => p.id === formPollId);
                            if (poll) {
                              handleAutoFillFromPoll(poll);
                            }
                          }}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap flex items-center justify-center gap-1.5"
                          title={lang === 'nl' ? 'Neem datum, tijd, locatie en genodigden over' : 'Import details'}
                        >
                          <span>⚡</span>
                          <span>{lang === 'nl' ? 'Gegevens overnemen' : 'Auto-fill'}</span>
                        </button>
                      )}
                    </div>
                    {formPollId && (
                      <p className="text-[11px] text-purple-700 leading-relaxed">
                        💡 {lang === 'nl' 
                          ? 'Klik op "Gegevens overnemen" om datum, tijdstip, locatie en genodigden automatisch over te nemen vanuit deze datumprikker.'
                          : 'Click "Auto-fill" to import date, time, location and participants from this date poll into this meeting.'}
                      </p>
                    )}
                  </div>

                  {/* Participants Section */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-600" />
                        {lang === 'nl' ? 'Deelnemers toevoegen (Contacten of handmatig)' : 'Add Participants'}
                      </label>
                      
                      {/* Searchable alphabetical contact selector */}
                      <div className="w-full sm:w-72">
                        <SearchableContactSelect
                          contacts={contacts}
                          placeholder={lang === 'nl' ? '+ Uit contacten kiezen...' : '+ Select from contacts...'}
                          onSelect={(c) => {
                            if (c) handleSelectContactForMeeting(c.id);
                          }}
                        />
                      </div>
                    </div>

                    {/* Inline manual entry */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder={lang === 'nl' ? 'Naam deelnemer' : 'Name'}
                        value={newPartName}
                        onChange={(e) => setNewPartName(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="email"
                        placeholder="E-mailadres"
                        value={newPartEmail}
                        onChange={(e) => setNewPartEmail(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder={lang === 'nl' ? 'Organisatie (optioneel)' : 'Organization'}
                          value={newPartOrg}
                          onChange={(e) => setNewPartOrg(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={handleAddParticipant}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Participants Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {formParticipants.map((p, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                          <strong>{p.name}</strong> <span className="text-slate-400 text-[10px]">({p.email})</span>
                          <button
                            type="button"
                            onClick={() => setFormParticipants(formParticipants.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AGENDA VOORBEREIDEN (RICH TEXT & IMAGES) */}
              {meetingModalTab === 'agenda' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <span className="text-xs font-bold text-indigo-950 block">
                        {lang === 'nl' ? 'Geavanceerde Agenda Editor' : 'Advanced Agenda Editor'}
                      </span>
                      <p className="text-[11px] text-indigo-700">
                        {lang === 'nl' 
                          ? 'Voeg agendapunten, toelichtingen, tabellen en afbeeldingen/screenshots toe. Genodigden kunnen deze via een unieke link en/of e-mail inzien.' 
                          : 'Format topics, descriptions, and include images or screenshots. Attendees can access this via a unique URL or email.'}
                      </p>
                    </div>

                    {editingMeeting && (
                      <button
                        type="button"
                        onClick={() => handleCopyAgendaUrl(editingMeeting.id)}
                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Share2 className="h-3 w-3" />
                        {copiedMeetingUrlId === editingMeeting.id ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Unieke URL' : 'Unique URL')}
                      </button>
                    )}
                  </div>

                  <AgendaRichEditor
                    value={formAgenda}
                    onChange={setFormAgenda}
                    status={formAgendaStatus}
                    onStatusChange={setFormAgendaStatus}
                    lang={lang}
                    placeholder={lang === 'nl' ? '1. Welkom & Agendaoverzicht\n2. Voortgang project / bespreekpunten\n3. Nieuwe voorstellen (plak gerust afbeeldingen)\n4. Rondvraag & Acties' : '1. Welcome & Announcements\n2. Status update\n3. Decisions & Actions'}
                  />
                </div>
              )}

              {/* TAB 3: NOTITIES & VERSLAG */}
              {meetingModalTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      {lang === 'nl' ? 'Notities, besproken punten & overlegverslag' : 'Meeting Notes & Record'}
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => insertFormatting('**', '**')}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 text-xs font-bold"
                        title="Vetgedrukt"
                      >
                        <Bold className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('### ')}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 text-xs font-bold"
                        title="Koptekst"
                      >
                        <Heading2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('- ')}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 text-xs font-bold"
                        title="Opsomming"
                      >
                        <List className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                    placeholder={lang === 'nl' ? 'Typ hier de notities, besproken punten tijdens de meeting...' : 'Enter your meeting notes and minutes here...'}
                  />
                  <p className="text-[11px] text-slate-400">
                    {lang === 'nl' ? 'Tip: Gebruik het tabblad "2. Agenda Voorbereiden" om vóór het overleg de agenda samen te stellen en te mailen.' : 'Tip: Use the "Agenda Preparation" tab before the meeting to organize topics and distribute them to participants.'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-400">
                  {meetingModalTab === 'details' ? (
                    <button
                      type="button"
                      onClick={() => setMeetingModalTab('agenda')}
                      className="text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      {lang === 'nl' ? 'Volgende: Agenda Voorbereiden →' : 'Next: Prepare Agenda →'}
                    </button>
                  ) : meetingModalTab === 'agenda' ? (
                    <button
                      type="button"
                      onClick={() => setMeetingModalTab('notes')}
                      className="text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      {lang === 'nl' ? 'Volgende: Notities & Verslag →' : 'Next: Notes & Minutes →'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMeetingModalTab('agenda')}
                      className="text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      {lang === 'nl' ? '← Terug naar Agenda' : '← Back to Agenda'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMeetingModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    {lang === 'nl' ? 'Meeting Opslaan' : 'Save Meeting'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ACTION ITEM CREATE / EDIT MODAL */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {editingAction 
                  ? (lang === 'nl' ? 'Actiepunt Bewerken' : 'Edit Action Item') 
                  : (lang === 'nl' ? 'Nieuw Actiepunt Aanmaken' : 'New Action Item')}
              </h3>
              <button onClick={() => setIsActionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAction} className="space-y-4 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Gekoppeld overleg / meeting' : 'Linked Meeting'}
                </label>
                <select
                  value={actionMeetingId}
                  onChange={(e) => setActionMeetingId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                >
                  {meetings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.date}) - {m.projectOrSubject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Titel van het actiepunt *' : 'Action Title *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="bijv. Offerte KPN opvragen of Architectuurdocument afronden"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Omschrijving van de actie' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder="Wat moet er exact gebeuren?"
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Afspraak datum wanneer gereed *' : 'Due Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Status' : 'Status'}
                  </label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value as ActionItemStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="open">{lang === 'nl' ? 'Openstaand' : 'Open'}</option>
                    <option value="in_behandeling">{lang === 'nl' ? 'In behandeling' : 'In Progress'}</option>
                    <option value="gereed">{lang === 'nl' ? 'Gereed' : 'Completed'}</option>
                    <option value="on_hold">{lang === 'nl' ? 'On Hold' : 'On Hold'}</option>
                  </select>
                </div>
              </div>

              {/* Assignees selector from contacts AND create new */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    {lang === 'nl' ? 'Actiehouder(s) / Behandelaar(s)' : 'Assignees'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewAssignee(!isCreatingNewAssignee)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    {isCreatingNewAssignee 
                      ? (lang === 'nl' ? '← Kies uit contacten' : '← Select from contacts') 
                      : (lang === 'nl' ? '+ Nieuw persoon aanmaken' : '+ Create new person')}
                  </button>
                </div>

                {!isCreatingNewAssignee ? (
                  <div className="mb-2">
                    <SearchableContactSelect
                      contacts={contacts}
                      placeholder={lang === 'nl' ? '+ Actiehouder kiezen uit contactpersonen...' : '+ Select assignee from contacts...'}
                      onSelect={(c) => {
                        if (!c) return;
                        if (!actionAssignees.some(a => a.email.toLowerCase() === c.email.toLowerCase())) {
                          setActionAssignees([...actionAssignees, { 
                            name: `${c.firstName} ${c.lastName}`.trim(), 
                            email: c.email,
                            organization: c.organization 
                          }]);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-2 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700">
                      {lang === 'nl' ? 'Nieuw contactpersoon aanmaken (wordt direct opgeslagen in uw contactenlijst):' : 'Create new contact (auto-saved to contacts):'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder={lang === 'nl' ? 'Volledige naam *' : 'Full name *'}
                        value={newAssigneeName}
                        onChange={(e) => setNewAssigneeName(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="email"
                        placeholder={lang === 'nl' ? 'E-mailadres *' : 'Email address *'}
                        value={newAssigneeEmail}
                        onChange={(e) => setNewAssigneeEmail(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder={lang === 'nl' ? 'Organisatie (optioneel)' : 'Organization'}
                        value={newAssigneeOrg}
                        onChange={(e) => setNewAssigneeOrg(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewAssignee(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateAndAddActionAssignee}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {lang === 'nl' ? 'Opslaan en Toewijzen' : 'Save & Assign'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {actionAssignees.map((a, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
                      {a.name}
                      <button
                        type="button"
                        onClick={() => setActionAssignees(actionAssignees.filter((_, i) => i !== idx))}
                        className="text-emerald-500 hover:text-rose-600 ml-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {actionAssignees.length === 0 && (
                    <span className="text-xs text-slate-400 italic">
                      {lang === 'nl' ? 'Geen actiehouder geselecteerd.' : 'No assignee selected.'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsActionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {lang === 'nl' ? 'Actiepunt Opslaan' : 'Save Action Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. AGREEMENT CREATE / EDIT MODAL */}
      {isAgreementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Handshake className="h-4 w-4 text-purple-600" />
                {editingAgreement 
                  ? (lang === 'nl' ? 'Gemaakte Afspraak Bewerken' : 'Edit Agreement') 
                  : (lang === 'nl' ? 'Nieuwe Afspraak Vastleggen' : 'New Agreement')}
              </h3>
              <button onClick={() => setIsAgreementModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAgreement} className="space-y-4 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Gekoppeld overleg' : 'Linked Meeting'}
                </label>
                <select
                  value={agrMeetingId}
                  onChange={(e) => setAgrMeetingId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                >
                  {meetings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.date}) - {m.projectOrSubject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Korte titel / samenvatting *' : 'Summary Title *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="bijv. Afgesproken datum livegang RDNG"
                  value={agrTitle}
                  onChange={(e) => setAgrTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Toelichting op de afspraak' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder="Wat is er precies afgesproken tussen de partijen?"
                  value={agrDesc}
                  onChange={(e) => setAgrDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Afgesproken op datum' : 'Agreed Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={agrDate}
                    onChange={(e) => setAgrDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Status' : 'Status'}
                  </label>
                  <select
                    value={agrStatus}
                    onChange={(e) => setAgrStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="actief">{lang === 'nl' ? 'Actief' : 'Active'}</option>
                    <option value="afgerond">{lang === 'nl' ? 'Afgerond' : 'Completed'}</option>
                    <option value="vervallen">{lang === 'nl' ? 'Vervallen' : 'Cancelled'}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAgreementModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {lang === 'nl' ? 'Afspraak Opslaan' : 'Save Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3b. NOTE & OVERLEGVERSLAG CREATE / EDIT MODAL */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                {editingNote 
                  ? (lang === 'nl' ? 'Notitie / Verslag Bewerken' : 'Edit Note / Record') 
                  : (lang === 'nl' ? 'Nieuwe Notitie / Overlegverslag Vastleggen' : 'New Note / Meeting Record')}
              </h3>
              <button 
                onClick={() => setIsNoteModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Gekoppeld overleg *' : 'Linked Meeting *'}
                </label>
                <select
                  value={noteMeetingId}
                  onChange={(e) => setNoteMeetingId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                  required
                >
                  {meetings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.date}) - {m.projectOrSubject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Categorie / Soort Notitie' : 'Category / Note Type'}
                  </label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value as MeetingNoteCategory)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="overlegverslag">{lang === 'nl' ? 'Overlegverslag' : 'Meeting Record'}</option>
                    <option value="notitie">{lang === 'nl' ? 'Notitie' : 'Note'}</option>
                    <option value="besluit">{lang === 'nl' ? 'Besluit' : 'Decision'}</option>
                    <option value="bespreking">{lang === 'nl' ? 'Bespreking' : 'Discussion'}</option>
                    <option value="aantekening">{lang === 'nl' ? 'Aantekening' : 'Memo'}</option>
                    <option value="rondvraag">{lang === 'nl' ? 'Rondvraag' : 'A.O.B.'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Datum' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Titel / Onderwerp *' : 'Title / Subject *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'nl' ? 'bijv. Bespreking begroting 2025 of Besluit architectuurkeuze' : 'e.g. Discussion 2025 budget or Architecture decision'}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    {lang === 'nl' ? 'Inhoud / Verslagtekst *' : 'Content / Record Text *'}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {noteContent.length} {lang === 'nl' ? 'tekens' : 'chars'}
                  </span>
                </div>
                <textarea
                  rows={6}
                  required
                  placeholder={lang === 'nl' ? 'Wat is er besproken, geconcludeerd of vastgelegd? Typ hier het volledige verslag...' : 'What was discussed, concluded, or recorded? Type the full record here...'}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Auteur / Notulist (optioneel)' : 'Author / Minute Taker (optional)'}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === 'nl' ? 'bijv. Jan Jansen of Secretaris' : 'e.g. John Doe or Secretary'}
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === 'nl' ? 'Trefwoorden / Tags (komma gescheiden)' : 'Tags (comma separated)'}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === 'nl' ? 'bijv. begroting, ict, beleid' : 'e.g. budget, ict, policy'}
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  id="btn-save-note-modal"
                >
                  {lang === 'nl' ? 'Notitie / Verslag Opslaan' : 'Save Note / Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. REMARKS / COMMENTS MODAL */}
      {activeRemarkAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'nl' ? 'Opmerkingen bij actiepunt' : 'Remarks on Action Item'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{activeRemarkAction.title}</p>
              </div>
              <button onClick={() => setActiveRemarkAction(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 max-h-64 overflow-y-auto">
              {activeRemarkAction.remarks && activeRemarkAction.remarks.length > 0 ? (
                activeRemarkAction.remarks.map(r => (
                  <div key={r.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700">{r.author}</span>
                      <span>{new Date(r.date).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800">{r.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  {lang === 'nl' ? 'Nog geen opmerkingen geplaatst.' : 'No remarks yet.'}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                placeholder={lang === 'nl' ? 'Typ een opmerking...' : 'Type a remark...'}
                value={newRemarkText}
                onChange={(e) => setNewRemarkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRemark();
                }}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
              />
              <button
                onClick={handleAddRemark}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {lang === 'nl' ? 'Plaatsen' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. DEDICATED AGENDA EDITOR MODAL */}
      {agendaEditorMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {lang === 'nl' ? 'Agenda Voorbereiden & Delen' : 'Prepare & Share Agenda'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {agendaEditorMeeting.title} • {agendaEditorMeeting.date} {agendaEditorMeeting.time ? `(${agendaEditorMeeting.time})` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyAgendaUrl(agendaEditorMeeting.id)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Kopieer unieke publieke link"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {copiedMeetingUrlId === agendaEditorMeeting.id ? (lang === 'nl' ? 'Link Gekopieerd!' : 'Copied!') : (lang === 'nl' ? 'Kopieer URL' : 'Copy URL')}
                </button>
                <a
                  href={`${getPublicOrigin()}?meeting_agenda=${agendaEditorMeeting.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Open hoe de genodigden de agenda zien"
                >
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  {lang === 'nl' ? 'Bekijk Online' : 'Preview'}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const m = agendaEditorMeeting;
                    setAgendaEditorMeeting(null);
                    handleOpenEmailModal(m, 'agenda');
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-purple-200 transition-colors cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  {lang === 'nl' ? 'Agenda Mailen' : 'Email Agenda'}
                </button>
                <button 
                  onClick={() => setAgendaEditorMeeting(null)} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="py-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{lang === 'nl' ? 'Unieke Web-URL:' : 'Unique Web URL:'}</span>{' '}
                  <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600 font-mono text-[11px] select-all">
                    {`${getPublicOrigin()}?meeting_agenda=${agendaEditorMeeting.id}`}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Status:</label>
                  <select
                    value={agendaEditorStatus}
                    onChange={(e) => setAgendaEditorStatus(e.target.value as any)}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
                  >
                    <option value="concept">{lang === 'nl' ? 'Concept' : 'Draft'}</option>
                    <option value="definitief">{lang === 'nl' ? 'Definitief' : 'Final'}</option>
                    <option value="verzonden">{lang === 'nl' ? 'Verzonden naar genodigden' : 'Sent'}</option>
                  </select>
                </div>
              </div>

              <AgendaRichEditor
                value={agendaEditorContent}
                onChange={setAgendaEditorContent}
                status={agendaEditorStatus}
                onStatusChange={setAgendaEditorStatus}
                lang={lang}
                placeholder={lang === 'nl' ? '1. Welkom & Mededelingen\n2. Terugblik acties & besluiten vorige keer\n3. Hoofdonderwerp(en) (voeg gerust toelichtingen, tabellen of screenshots toe)\n4. Rondvraag & Acties' : '1. Welcome & Announcements\n2. Action items review\n3. Main discussion points\n4. Next steps & decisions'}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAgendaEditorMeeting(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {lang === 'nl' ? 'Sluiten' : 'Close'}
              </button>
              <button
                type="button"
                onClick={handleSaveDedicatedAgenda}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <Check className="h-4 w-4" />
                {lang === 'nl' ? 'Agenda Wijzigingen Opslaan' : 'Save Agenda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. EMAIL DISPATCH MODAL (AGENDA, NOTITIES & ACTIELIJST) */}
      {emailModalMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {emailModalType === 'agenda' && (lang === 'nl' ? 'Agenda Mailen naar Geadresseerden' : 'Email Agenda')}
                  {emailModalType === 'actions' && (lang === 'nl' ? 'Aparte Actielijst Mailen naar Geadresseerden' : 'Email Action List')}
                  {(emailModalType === 'notes_and_actions' || emailModalType === 'minutes') && (lang === 'nl' ? 'Notities & Actiepunten Mailen' : 'Email Notes & Action Items')}
                  {emailModalType === 'combination' && (lang === 'nl' ? 'Overlegdossier Mailen (Agenda, Notities & Acties)' : 'Email Complete Meeting Dossier')}
                </h3>
              </div>
              <button onClick={() => setEmailModalMeeting(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Email Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => handleSelectEmailModalType('agenda')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  emailModalType === 'agenda'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {lang === 'nl' ? 'Agenda' : 'Agenda'}
              </button>
              <button
                type="button"
                onClick={() => handleSelectEmailModalType('notes_and_actions')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  emailModalType === 'notes_and_actions' || emailModalType === 'minutes'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {lang === 'nl' ? 'Notities & Acties' : 'Notes & Actions'}
              </button>
              <button
                type="button"
                onClick={() => handleSelectEmailModalType('actions')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  emailModalType === 'actions'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ListTodo className="h-3.5 w-3.5" />
                {lang === 'nl' ? 'Aparte Actielijst' : 'Action List'}
              </button>
              <button
                type="button"
                onClick={() => handleSelectEmailModalType('combination')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  emailModalType === 'combination'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                {lang === 'nl' ? 'Combinatie (Alles)' : 'Combined'}
              </button>
            </div>

            <div className="space-y-4 pt-3 text-xs">
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <span className="font-bold text-indigo-950 block">{emailModalMeeting.title}</span>
                <span className="text-indigo-600 text-[11px] block mt-0.5">
                  {emailModalMeeting.date} {emailModalMeeting.time ? `• ${emailModalMeeting.time}` : ''} • {emailModalMeeting.projectOrSubject}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Onderwerp e-mail' : 'Email Subject'}
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {lang === 'nl' ? 'Persoonlijke toelichting / introductie (optioneel)' : 'Personal intro note (optional)'}
                </label>
                <textarea
                  rows={2}
                  placeholder={lang === 'nl' ? 'bijv. Beste collega\'s, hierbij het overzicht van ons overleg...' : 'Add a brief greeting or note...'}
                  value={emailCustomIntro}
                  onChange={(e) => setEmailCustomIntro(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">
                    {lang === 'nl' ? 'Geadresseerden / Ontvangers' : 'Recipients'} ({emailRecipients.length})
                  </label>
                  <select
                    onChange={(e) => {
                      const cId = e.target.value;
                      if (!cId) return;
                      const c = contacts.find(item => item.id === cId);
                      if (c && c.email) {
                        const emailClean = c.email.toLowerCase().trim();
                        if (!emailRecipients.includes(emailClean)) {
                          setEmailRecipients([...emailRecipients, emailClean]);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
                  >
                    <option value="">{lang === 'nl' ? '+ Kies uit contactpersonen...' : '+ Pick from contacts...'}</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chips of recipients */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-24 overflow-y-auto mb-2">
                  {emailRecipients.map((rec, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-[11px] shadow-3xs">
                      {rec}
                      <button
                        type="button"
                        onClick={() => setEmailRecipients(emailRecipients.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {emailRecipients.length === 0 && (
                    <span className="text-slate-400 italic">{lang === 'nl' ? 'Geen ontvangers geselecteerd.' : 'No recipients selected.'}</span>
                  )}
                </div>

                {/* Handmatig persoon toevoegen en automatisch opslaan in contacten */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder={lang === 'nl' ? 'Nieuw e-mailadres (of: Naam <email@domein.nl>)' : 'New email address...'}
                    value={newEmailRecipientInput}
                    onChange={(e) => setNewEmailRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmailRecipient();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmailRecipient}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    {lang === 'nl' ? '+ Toevoegen' : '+ Add'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'nl' 
                    ? '💡 Nieuw toegevoegde personen worden automatisch aan uw beheerde contactpersonenlijst toegevoegd.'
                    : '💡 Newly added persons are automatically added to your managed contact list.'}
                </p>
              </div>

              {/* Extra checkboxes for agenda or combined mode */}
              {(emailModalType === 'agenda' || emailModalType === 'combination') && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 space-y-2 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={includePublicUrlInEmail}
                      onChange={(e) => setIncludePublicUrlInEmail(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{lang === 'nl' ? 'Unieke publieke webpagina-link toevoegen aan de mail' : 'Include unique web link in email'}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={includeCalendarInEmail}
                      onChange={(e) => setIncludeCalendarInEmail(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{lang === 'nl' ? 'Directe kalender-knoppen (Google Agenda & Outlook) toevoegen' : 'Include calendar links (Google Calendar & Outlook)'}</span>
                  </label>
                </div>
              )}

              {emailStatusMsg && (
                <div className="p-2.5 bg-indigo-50 text-indigo-700 font-medium rounded-xl text-center text-xs">
                  {emailStatusMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEmailModalMeeting(null)}
                  disabled={isSendingEmail}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSendMeetingEmail}
                  disabled={isSendingEmail || emailRecipients.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSendingEmail ? (lang === 'nl' ? 'Verzenden...' : 'Sending...') : (lang === 'nl' ? 'Verstuur Nu' : 'Send Now')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Modal: Link Datumprikker to Meeting */}
      {isLinkPollModalOpen && linkPollMeeting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <LinkIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {lang === 'nl' ? 'Koppel met Datumprikker' : 'Link with Date Poll'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {linkPollMeeting.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsLinkPollModalOpen(false);
                  setLinkPollMeeting(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                {lang === 'nl' 
                  ? 'Selecteer een datumprikker om aan dit overleg te koppelen. U kunt ook direct datum, tijdstip en deelnemers overnemen.'
                  : 'Select a date poll to link to this meeting. You can also import the scheduled date, time and invitees.'}
              </p>

              {polls.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  {lang === 'nl' ? 'Er zijn nog geen datumprikkers aangemaakt.' : 'No date polls found.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {polls.map(poll => {
                    const isCurrent = linkPollMeeting.pollId === poll.id;
                    const isFinalized = Boolean(poll.finalizedOptionId);
                    return (
                      <div 
                        key={poll.id} 
                        className={`p-3 rounded-xl border transition-all ${
                          isCurrent ? 'bg-purple-50/70 border-purple-300' : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{poll.title}</span>
                              {poll.archived && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                  {lang === 'nl' ? 'Archief' : 'Archived'}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border inline-block mt-0.5 ${
                              isFinalized 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isFinalized ? (lang === 'nl' ? 'Geprikt / Definitief' : 'Finalized') : (lang === 'nl' ? 'Loopt nog' : 'In progress')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleLinkPollToMeeting(linkPollMeeting, poll, false)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer"
                          >
                            {lang === 'nl' ? 'Alleen Koppelen' : 'Link Only'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLinkPollToMeeting(linkPollMeeting, poll, true)}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition-all cursor-pointer"
                          >
                            {lang === 'nl' ? 'Koppelen & Overnemen' : 'Link & Import'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsLinkPollModalOpen(false);
                  setLinkPollMeeting(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {lang === 'nl' ? 'Sluiten' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formatted Agenda Modal */}
      {formattedAgendaMeeting && (
        <FormattedAgendaModal
          meeting={formattedAgendaMeeting}
          onClose={() => setFormattedAgendaMeeting(null)}
          onUpdateMeeting={async (updated) => {
            await dbService.saveMeeting(updated);
            setFormattedAgendaMeeting(updated);
            loadData();
          }}
          lang={lang}
        />
      )}

      {/* Agenda Template Manager Modal */}
      {showTemplateManagerModal && (
        <AgendaTemplateManagerModal
          isOpen={showTemplateManagerModal}
          onClose={() => setShowTemplateManagerModal(false)}
          lang={lang}
        />
      )}

      {/* Bulk Action Items Creation Modal */}
      {isBulkActionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Rows className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    {lang === 'nl' ? 'Bulk Actiepunten Invoeren' : 'Bulk Create Action Items'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'nl'
                      ? 'Voer na een meeting snel meerdere actiepunten in. Je hoeft slechts 1 keer het overleg of project te selecteren.'
                      : 'Quickly input multiple action items after a meeting. Link to the meeting once for all items.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkActionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBulkActions} className="space-y-4">
              {/* Linked Meeting selection (once for all) */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                    {lang === 'nl' ? 'Gekoppeld aan Overleg / Meeting / Project:' : 'Linked Meeting / Project:'}
                  </span>
                  <span className="text-xs text-indigo-700">
                    {lang === 'nl' ? 'Alle onderstaande actiepunten worden automatisch aan dit overleg gekoppeld.' : 'All rows below will link to this meeting.'}
                  </span>
                </div>

                <select
                  value={bulkMeetingId}
                  onChange={(e) => setBulkMeetingId(e.target.value)}
                  className="px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-80 cursor-pointer"
                >
                  <option value="">{lang === 'nl' ? '-- Losse actiepunten (geen meeting) --' : '-- Standalone --'}</option>
                  {meetings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.date}) - {m.projectOrSubject}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rows Table */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {bulkActionRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBulkRow(row.id)}
                        className="text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title={lang === 'nl' ? 'Rij verwijderen' : 'Remove row'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold">{lang === 'nl' ? 'Verwijder rij' : 'Delete'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                      {/* Title */}
                      <div className="md:col-span-4">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          {lang === 'nl' ? 'Actiepunt titel *' : 'Action title *'}
                        </label>
                        <input
                          type="text"
                          required={index === 0}
                          placeholder={lang === 'nl' ? 'bijv. Offerte opvragen bij leverancier' : 'Action title'}
                          value={row.title}
                          onChange={(e) => handleBulkRowChange(row.id, 'title', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Description */}
                      <div className="md:col-span-3">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          {lang === 'nl' ? 'Toelichting (optioneel)' : 'Description'}
                        </label>
                        <input
                          type="text"
                          placeholder={lang === 'nl' ? 'Korte omschrijving...' : 'Description'}
                          value={row.description}
                          onChange={(e) => handleBulkRowChange(row.id, 'description', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Due Date */}
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          {lang === 'nl' ? 'Gereed datum' : 'Due date'}
                        </label>
                        <input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => handleBulkRowChange(row.id, 'dueDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Assignee select */}
                      <div className="md:col-span-3">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          {lang === 'nl' ? 'Actiehouder' : 'Assignee'}
                        </label>
                        <SearchableContactSelect
                          contacts={contacts}
                          placeholder={lang === 'nl' ? 'Selecteer actiehouder...' : 'Select assignee...'}
                          selectedContactId={contacts.find(c => (row.assignees || []).some(a => a.email.toLowerCase() === c.email.toLowerCase()))?.id}
                          onSelect={(c) => {
                            if (!c) {
                              handleBulkRowChange(row.id, 'assignees', []);
                              return;
                            }
                            handleBulkRowChange(row.id, 'assignees', [{
                              name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                              email: c.email,
                              organization: c.organization
                            }]);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Row Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAddBulkRow}
                  className="px-4 py-2 border-2 border-dashed border-indigo-300 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 w-full cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{lang === 'nl' ? '+ Extra actiepunt rij toevoegen' : '+ Add another row'}</span>
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-2">
                <span className="text-xs text-slate-400">
                  {bulkActionRows.filter(r => r.title.trim().length > 0).length} {lang === 'nl' ? 'actiepunt(en) ingevuld' : 'item(s) filled'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkActionModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
                  >
                    {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{lang === 'nl' ? 'Alle Actiepunten Opslaan' : 'Save All Action Items'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingManager;
