import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  User,
  Users,
  Tag,
  Star,
  MessageSquare,
  Send,
  Save,
  ArrowLeft,
  Filter,
  Search,
  Check,
  AlertCircle,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  FolderKanban
} from 'lucide-react';
import { Task, TaskStatus, TaskCategory, Contact, Project, TaskProgressUpdate, Language } from '../types';
import { dbService } from '../services/db';
import { SearchableContactSelect } from './SearchableContactSelect';

interface TaskParticipantPageProps {
  taskId?: string | null;
  assigneeContactId?: string | null;
  contactId?: string | null;
  assigneeEmail?: string | null;
  lang?: Language;
  onNavigateHome?: () => void;
  onOpenMainApp?: () => void;
}

export const TaskParticipantPage: React.FC<TaskParticipantPageProps> = ({
  taskId,
  assigneeContactId,
  contactId,
  assigneeEmail,
  lang = 'nl',
  onNavigateHome,
  onOpenMainApp
}) => {
  const isNl = lang === 'nl';
  const handleGoHome = onOpenMainApp || onNavigateHome;

  // Contact Selection state
  const initialContactId = assigneeContactId || contactId || localStorage.getItem('itpt_selected_contact_id') || '';
  const [selectedContactId, setSelectedContactId] = useState<string>(initialContactId);
  const [isChangingContact, setIsChangingContact] = useState<boolean>(false);

  // Core Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Participant Form state for updates
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authorName, setAuthorName] = useState(() => {
    return localStorage.getItem('itpt_participant_name') || '';
  });
  const [newRemarkText, setNewRemarkText] = useState('');
  const [editingNotesTaskId, setEditingNotesTaskId] = useState<string | null>(null);
  const [taskNotesValue, setTaskNotesValue] = useState<string>('');
  
  // List Filter in multi-task mode
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('open');
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  const loadData = () => {
    setTasks(dbService.getTasks());
    setStatuses(dbService.getTaskStatuses());
    setCategories(dbService.getTaskCategories());
    setContacts(dbService.getContacts());
    setProjects(dbService.getProjects());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return () => unsub();
  }, []);

  // Sync props to state if props update
  useEffect(() => {
    const id = assigneeContactId || contactId;
    if (id) {
      setSelectedContactId(id);
      localStorage.setItem('itpt_selected_contact_id', id);
    }
  }, [assigneeContactId, contactId]);

  // Determine identified contact if contactId, selectedContactId or email provided
  const identifiedContact = useMemo(() => {
    if (selectedContactId) {
      return contacts.find(c => c.id === selectedContactId) || null;
    }
    if (assigneeContactId) {
      return contacts.find(c => c.id === assigneeContactId) || null;
    }
    if (contactId) {
      return contacts.find(c => c.id === contactId) || null;
    }
    if (assigneeEmail) {
      return contacts.find(c => c.email.toLowerCase().trim() === assigneeEmail.toLowerCase().trim()) || null;
    }
    return null;
  }, [contacts, selectedContactId, assigneeContactId, contactId, assigneeEmail]);

  // Set default author name if identified
  useEffect(() => {
    if (identifiedContact && !authorName) {
      const name = `${identifiedContact.firstName} ${identifiedContact.lastName}`.trim();
      setAuthorName(name);
      localStorage.setItem('itpt_participant_name', name);
    }
  }, [identifiedContact, authorName]);

  // Switch or Select Contact handler
  const handleSelectContact = (c: Contact | null) => {
    if (!c) {
      setSelectedContactId('');
      localStorage.removeItem('itpt_selected_contact_id');
      const url = new URL(window.location.href);
      url.searchParams.delete('assignee_tasks');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      setIsChangingContact(true);
      return;
    }
    setSelectedContactId(c.id);
    localStorage.setItem('itpt_selected_contact_id', c.id);
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    setAuthorName(fullName);
    localStorage.setItem('itpt_participant_name', fullName);
    setIsChangingContact(false);

    // Update URL query param so refresh preserves selection
    const url = new URL(window.location.href);
    url.searchParams.set('assignee_tasks', c.id);
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));

    showFeedback(isNl ? `Welkom ${c.firstName}! Jouw takenoverzicht is geopend.` : `Welcome ${c.firstName}!`);
  };

  // Determine tasks to show
  const relevantTasks = useMemo(() => {
    if (taskId) {
      return tasks.filter(t => t.id === taskId);
    }
    if (identifiedContact) {
      return tasks.filter(t => {
        const hasId = (t.assigneeIds || []).includes(identifiedContact.id);
        const hasEmail = (t.assignees || []).some(a => a.email.toLowerCase().trim() === identifiedContact.email.toLowerCase().trim());
        return hasId || hasEmail;
      });
    }
    return [];
  }, [tasks, taskId, identifiedContact]);

  // Filtered tasks for multi-task view
  const displayTasks = useMemo(() => {
    return relevantTasks.filter(t => {
      if (statusFilter === 'open' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        return matchTitle || matchDesc;
      }
      return true;
    });
  }, [relevantTasks, statusFilter, searchQuery]);

  // Show temporary alert
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Update Status of a task
  const handleUpdateStatus = async (task: Task, newStatusId: string) => {
    const statusObj = statuses.find(s => s.id === newStatusId);
    const isGereed = statusObj?.name.toLowerCase().includes('gereed') || statusObj?.name.toLowerCase().includes('done') || statusObj?.name.toLowerCase().includes('voltooid');
    
    const statusUpdateName = statusObj ? statusObj.name : newStatusId;
    const author = authorName.trim() || identifiedContact?.firstName || (isNl ? 'Actiehouder' : 'Assignee');

    const updateLog: TaskProgressUpdate = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      author,
      date: new Date().toISOString(),
      text: isNl 
        ? `Status gewijzigd naar "${statusUpdateName}"`
        : `Status changed to "${statusUpdateName}"`,
      statusChange: statusUpdateName
    };

    const updatedTask: Task = {
      ...task,
      statusId: newStatusId,
      completed: !!isGereed,
      completedAt: isGereed ? (task.completedAt || new Date().toISOString()) : null,
      progressUpdates: [...(task.progressUpdates || []), updateLog],
      updatedAt: new Date().toISOString()
    };

    await dbService.saveTask(updatedTask);
    showFeedback(isNl ? `Taakstatus succesvol bijgewerkt naar: ${statusUpdateName}` : `Task status updated to: ${statusUpdateName}`);
  };

  // Toggle Completed checkbox
  const handleToggleCompleted = async (task: Task) => {
    const willBeCompleted = !task.completed;
    const author = authorName.trim() || identifiedContact?.firstName || (isNl ? 'Actiehouder' : 'Assignee');

    // Find a 'gereed' or 'todo' status if possible
    let targetStatusId = task.statusId;
    if (willBeCompleted) {
      const gereedStatus = statuses.find(s => s.name.toLowerCase().includes('gereed') || s.name.toLowerCase().includes('done'));
      if (gereedStatus) targetStatusId = gereedStatus.id;
    } else {
      const todoStatus = statuses.find(s => s.name.toLowerCase().includes('bezig') || s.name.toLowerCase().includes('todo') || s.name.toLowerCase().includes('te doen'));
      if (todoStatus) targetStatusId = todoStatus.id;
    }

    const updateLog: TaskProgressUpdate = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      author,
      date: new Date().toISOString(),
      text: willBeCompleted 
        ? (isNl ? 'Taak gemarkeerd als gereed.' : 'Task marked as completed.')
        : (isNl ? 'Taak heropend (onvoltooid).' : 'Task reopened.')
    };

    const updatedTask: Task = {
      ...task,
      completed: willBeCompleted,
      statusId: targetStatusId,
      completedAt: willBeCompleted ? new Date().toISOString() : null,
      progressUpdates: [...(task.progressUpdates || []), updateLog],
      updatedAt: new Date().toISOString()
    };

    await dbService.saveTask(updatedTask);
    showFeedback(willBeCompleted 
      ? (isNl ? 'Taak succesvol gereedgemeld! Goed werk.' : 'Task marked as completed!')
      : (isNl ? 'Taak heropend.' : 'Task reopened.')
    );
  };

  // Add Remark / Progress update note
  const handleAddRemark = async (task: Task) => {
    if (!newRemarkText.trim()) return;
    const author = authorName.trim() || identifiedContact?.firstName || (isNl ? 'Actiehouder' : 'Assignee');

    const updateLog: TaskProgressUpdate = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      author,
      date: new Date().toISOString(),
      text: newRemarkText.trim()
    };

    const updatedTask: Task = {
      ...task,
      progressUpdates: [...(task.progressUpdates || []), updateLog],
      updatedAt: new Date().toISOString()
    };

    await dbService.saveTask(updatedTask);
    setNewRemarkText('');
    showFeedback(isNl ? 'Voortgangsbericht opgeslagen!' : 'Progress note saved!');
  };

  // Save private/additional notes for task
  const handleSaveNotes = async (task: Task) => {
    const updatedTask: Task = {
      ...task,
      notes: taskNotesValue,
      updatedAt: new Date().toISOString()
    };
    await dbService.saveTask(updatedTask);
    setEditingNotesTaskId(null);
    showFeedback(isNl ? 'Notities opgeslagen!' : 'Notes saved!');
  };

  // Format date helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format datetime helper
  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(isNl ? 'nl-NL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Color classes helper
  const getColorClasses = (colorName?: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
      rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
      sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' },
      violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
    };
    return map[colorName || 'slate'] || map.slate;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-bold text-slate-600">{isNl ? 'Taakgegevens laden...' : 'Loading task details...'}</p>
        </div>
      </div>
    );
  }

  // If no task found for single task ID
  if (taskId && relevantTasks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            {isNl ? 'Taak niet gevonden of verplaatst' : 'Task not found or moved'}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isNl
              ? 'Deze taak bestaat niet meer of is definitief verwijderd. Neem contact op met de projectleider of beheerder.'
              : 'This task no longer exists. Please contact the administrator.'}
          </p>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer"
            >
              {isNl ? 'Naar Hoofdscherm' : 'Go to Main Screen'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const singleTask = taskId && relevantTasks.length > 0 ? relevantTasks[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-16">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/90">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-linear-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-xs">
              IT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-tight text-slate-900">IT Platform Twente</span>
                <span className="px-2 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold rounded-full">
                  {isNl ? 'Taak Portal' : 'Task Portal'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {singleTask ? (isNl ? 'Taak bijwerken & gereedmelden' : 'Update & complete task') : (isNl ? 'Mijn Toegewezen Taken' : 'My Assigned Tasks')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isNl ? 'Alle Tools' : 'All Tools'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating feedback alert */}
      {feedbackMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce max-w-md w-full px-4">
          <div className={`p-3.5 rounded-2xl shadow-lg border flex items-center gap-2.5 text-xs font-bold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* Identification Banner */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-base shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">{isNl ? 'Ingelogd / Geopend als:' : 'Opened as:'}</span>
                <span className="text-xs font-bold text-slate-800">
                  {authorName || identifiedContact?.firstName || (isNl ? 'Actiehouder' : 'Assignee')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {identifiedContact?.email || (isNl ? 'Wijzigingen worden direct realtime opgeslagen' : 'Changes are saved in real-time')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <input
              type="text"
              placeholder={isNl ? 'Jouw naam voor logboek...' : 'Your name for updates...'}
              value={authorName}
              onChange={(e) => {
                setAuthorName(e.target.value);
                localStorage.setItem('itpt_participant_name', e.target.value);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>
        </div>

        {/* SINGLE TASK VIEW MODE */}
        {singleTask ? (
          <div className="space-y-6">
            {/* Task Main Card */}
            <div className={`bg-white rounded-3xl p-5 sm:p-7 border shadow-xs space-y-5 transition-all ${
              singleTask.completed ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200/80'
            }`}>
              {/* Header: Status badge & Complete Checkbox */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  {singleTask.priority && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-extrabold flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      <span>{isNl ? 'Hoge Prioriteit' : 'High Priority'}</span>
                    </span>
                  )}

                  {/* Current Status Pill */}
                  {(() => {
                    const stat = statuses.find(s => s.id === singleTask.statusId);
                    const colors = getColorClasses(stat?.color);
                    return (
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${colors.bg} ${colors.text} ${colors.border}`}>
                        📊 {stat ? stat.name : (isNl ? 'Status onbekend' : 'Unknown')}
                      </span>
                    );
                  })()}

                  {/* Project Tag */}
                  {(() => {
                    const proj = projects.find(p => p.id === singleTask.projectId);
                    if (!proj) return null;
                    return (
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        <span>{proj.title}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Big 1-Click Complete Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleCompleted(singleTask)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs ${
                    singleTask.completed
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200'
                  }`}
                >
                  {singleTask.completed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 fill-white text-emerald-600" />
                      <span>{isNl ? 'Gereed gemeld ✓' : 'Completed ✓'}</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" />
                      <span>{isNl ? 'Markeer als Gereed' : 'Mark as Completed'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h1 className={`text-xl sm:text-2xl font-black text-slate-800 leading-snug ${
                  singleTask.completed ? 'line-through text-slate-400' : ''
                }`}>
                  {singleTask.title}
                </h1>

                {singleTask.description && (
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    {singleTask.description}
                  </p>
                )}
              </div>

              {/* Meta Info: Dates & Assignees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      {isNl ? 'Planning / Looptijd' : 'Schedule / Timeline'}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {formatDate(singleTask.startDate)}
                      {singleTask.endDate && ` tot ${formatDate(singleTask.endDate)}`}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <Users className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      {isNl ? 'Actiehouder(s)' : 'Assignee(s)'}
                    </span>
                    <span className="text-xs font-bold text-slate-700 truncate block max-w-xs">
                      {(singleTask.assigneeIds || []).map(id => {
                        const c = contacts.find(contact => contact.id === id);
                        return c ? `${c.firstName} ${c.lastName}` : '';
                      }).filter(Boolean).join(', ') || (isNl ? 'Nog niet toegewezen' : 'Unassigned')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Update Quick Buttons */}
              <div className="pt-3 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  {isNl ? 'Status wijzigen:' : 'Change status:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {statuses.map(st => {
                    const isSelected = singleTask.statusId === st.id;
                    const col = getColorClasses(st.color);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleUpdateStatus(singleTask, st.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? `${col.bg} ${col.text} ${col.border} ring-2 ring-indigo-500 shadow-2xs`
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${col.border} bg-current`} />
                        <span>{st.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Progress Updates & Comments Log */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    {isNl ? 'Voortgang, Toelichting & Berichten' : 'Progress & Notes'}
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {(singleTask.progressUpdates || []).length} {isNl ? 'berichten' : 'messages'}
                </span>
              </div>

              {/* Add Remark Form */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                <textarea
                  rows={2}
                  placeholder={isNl ? 'Plaats een toelichting of voortgangsbericht...' : 'Add a progress note or update...'}
                  value={newRemarkText}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleAddRemark(singleTask)}
                    disabled={!newRemarkText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isNl ? 'Bericht Opslaan' : 'Post Update'}</span>
                  </button>
                </div>
              </div>

              {/* Existing Updates Feed */}
              <div className="space-y-3 pt-2">
                {(singleTask.progressUpdates || []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {isNl ? 'Nog geen voortgangsberichten bij deze taak geplaatst.' : 'No progress notes posted yet.'}
                  </p>
                ) : (
                  [...(singleTask.progressUpdates || [])].reverse().map(update => (
                    <div key={update.id} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-700">{update.author}</span>
                        <span className="text-slate-400">{formatDateTime(update.date)}</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        {update.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ASSIGNEE MULTI-TASK OVERVIEW MODE */
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800 tracking-tight">
                    {isNl ? 'Jouw Toegewezen Taken' : 'Your Assigned Tasks'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isNl
                      ? 'Hier zie je al je openstaande en afgeronde taken. Wijzig de status of vink taken direct af.'
                      : 'View, update, or complete your assigned tasks in one place.'}
                  </p>
                </div>

                {/* Filter Tabs: Open vs Completed vs All */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
                  <button
                    onClick={() => setStatusFilter('open')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === 'open'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isNl ? 'Openstaand' : 'Open'} ({relevantTasks.filter(t => !t.completed).length})
                  </button>

                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === 'completed'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isNl ? 'Gereed' : 'Completed'} ({relevantTasks.filter(t => t.completed).length})
                  </button>

                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-white text-slate-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isNl ? 'Alles' : 'All'} ({relevantTasks.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={isNl ? 'Zoek binnen jouw taken...' : 'Search your tasks...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Tasks List */}
            {displayTasks.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">
                  {statusFilter === 'open' 
                    ? (isNl ? 'Geweldig! Geen openstaande taken' : 'All caught up! No open tasks')
                    : (isNl ? 'Geen taken gevonden' : 'No tasks found')}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {statusFilter === 'open'
                    ? (isNl ? 'Al je toegewezen taken zijn afgerond of er zijn momenteel geen taken aan jou gekoppeld.' : 'You have no pending tasks assigned at this moment.')
                    : (isNl ? 'Geen taken voldoen aan het huidige zoek- of filtercriterium.' : 'No tasks match current filter.')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayTasks.map(task => {
                  const stat = statuses.find(s => s.id === task.statusId);
                  const statColor = getColorClasses(stat?.color);
                  const cat = categories.find(c => c.id === task.categoryId);
                  const catColor = getColorClasses(cat?.color);
                  const proj = projects.find(p => p.id === task.projectId);

                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all shadow-xs space-y-3 ${
                        task.completed ? 'bg-slate-50/60 border-slate-200/60 opacity-80' : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleCompleted(task)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition cursor-pointer shrink-0"
                            title={task.completed ? (isNl ? 'Markeer als onvoltooid' : 'Reopen') : (isNl ? 'Markeer als gereed' : 'Mark as completed')}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-50" />
                            ) : (
                              <Circle className="h-5 w-5 hover:text-slate-600" />
                            )}
                          </button>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {task.priority && (
                                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
                              )}
                              <h3 className={`text-sm font-bold text-slate-800 ${
                                task.completed ? 'line-through text-slate-400' : ''
                              }`}>
                                {task.title}
                              </h3>

                              {/* Badges */}
                              {stat && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${statColor.bg} ${statColor.text} ${statColor.border}`}>
                                  {stat.name}
                                </span>
                              )}

                              {cat && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
                                  {cat.name}
                                </span>
                              )}

                              {proj && (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                                  {proj.title}
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Date info */}
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                              {task.startDate && (
                                <span className="flex items-center gap-1 font-medium">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(task.startDate)}</span>
                                  {task.endDate && <span>tot {formatDate(task.endDate)}</span>}
                                </span>
                              )}

                              {(task.progressUpdates || []).length > 0 && (
                                <span className="flex items-center gap-1 font-medium text-indigo-600">
                                  <MessageSquare className="h-3 w-3" />
                                  <span>{(task.progressUpdates || []).length} {isNl ? 'notities' : 'notes'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Status Select */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          <select
                            value={task.statusId}
                            onChange={(e) => handleUpdateStatus(task, e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            {statuses.map(st => (
                              <option key={st.id} value={st.id}>{st.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Expandable Quick Note Adder */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                        <span className="text-[11px] text-slate-400">
                          {task.completedAt 
                            ? `${isNl ? 'Gereed gemeld op:' : 'Completed on:'} ${formatDate(task.completedAt)}`
                            : (isNl ? 'Status wijzigen kan direct via het menu rechtsboven' : 'Change status via the dropdown')}
                        </span>

                        <a
                          href={`?task_id=${task.id}`}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span>{isNl ? 'Details & Toelichting' : 'Details & Notes'}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
