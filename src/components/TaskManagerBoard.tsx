import React, { useState, useEffect, useMemo } from 'react';
import {
  Kanban,
  List,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  Clock,
  User,
  Users,
  Tag,
  FolderKanban,
  Star,
  CheckSquare,
  AlertCircle,
  Edit,
  MoreVertical,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Check,
  Smartphone,
  SlidersHorizontal,
  RefreshCw,
  Bell,
  Mail,
  Send,
  Copy,
  Share2
} from 'lucide-react';
import { Task, TaskStatus, TaskCategory, Contact, Project, ProjectActivity, Language } from '../types';
import { dbService } from '../services/db';
import { getPublicOrigin } from '../utils/url';
import { wrapInHtmlEmailTemplate } from '../services/gmail';

interface TaskManagerBoardProps {
  lang?: Language;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToWeekplanner?: () => void;
  onOpenProjectPlanner?: (projectId: string) => void;
  onOpenWeekPlanner?: () => void;
  onOpenNotifications?: () => void;
  sendEmailUnified?: (params: { to: string; subject: string; bodyHtml: string }) => Promise<any>;
}

export const TaskManagerBoard: React.FC<TaskManagerBoardProps> = ({
  lang = 'nl',
  onNavigateToProject,
  onNavigateToWeekplanner,
  onOpenProjectPlanner,
  onOpenWeekPlanner,
  onOpenNotifications,
  sendEmailUnified
}) => {
  const isNl = lang === 'nl';

  // Core Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // View States
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [groupBy, setGroupBy] = useState<'status' | 'category'>('status');
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [weekplannerOnlyFilter, setWeekplannerOnlyFilter] = useState<boolean>(false);

  // Modal / Form States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [showMobileQuickAdd, setShowMobileQuickAdd] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddCategoryId, setQuickAddCategoryId] = useState('');
  const [quickAddStatusId, setQuickAddStatusId] = useState('');
  const [archiveSuccessMessage, setArchiveSuccessMessage] = useState<string | null>(null);

  // New Category inline form
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');

  // New Status inline form
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('amber');

  // Contact quick-create inside task modal
  const [isAddingNewContact, setIsAddingNewContact] = useState(false);
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  // Task form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatusId, setTaskStatusId] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState('');
  const [taskPriority, setTaskPriority] = useState(false);
  const [taskStartDate, setTaskStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskEndDate, setTaskEndDate] = useState<string>('');
  const [taskStartTime, setTaskStartTime] = useState<string>('');
  const [taskEndTime, setTaskEndTime] = useState<string>('');
  const [taskShowInWeekPlanner, setTaskShowInWeekPlanner] = useState(true);
  const [taskProjectId, setTaskProjectId] = useState<string>('');
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);

  // Load and subscribe to DB data
  const loadData = () => {
    setTasks(dbService.getTasks());
    setStatuses(dbService.getTaskStatuses());
    setCategories(dbService.getTaskCategories());
    setContacts(dbService.getContacts());
    setProjects(dbService.getProjects());
    setActivities(dbService.getProjectActivities());
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return () => unsub();
  }, []);

  // Set default category and status for quick add when available
  useEffect(() => {
    if (categories.length > 0 && !quickAddCategoryId) {
      setQuickAddCategoryId(categories[0].id);
    }
    if (statuses.length > 0 && !quickAddStatusId) {
      setQuickAddStatusId(statuses[0].id);
    }
  }, [categories, statuses]);

  // Color helper mappings for badges
  const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: 'text-indigo-700', border: 'border-indigo-400' },
    emerald: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', border: 'border-emerald-400' },
    amber: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', border: 'border-amber-400' },
    rose: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700', border: 'border-rose-400' },
    blue: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', border: 'border-blue-400' },
    purple: { bg: 'bg-purple-50 text-purple-700 border-purple-200', text: 'text-purple-700', border: 'border-purple-400' },
    violet: { bg: 'bg-violet-50 text-violet-700 border-violet-200', text: 'text-violet-700', border: 'border-violet-400' },
    sky: { bg: 'bg-sky-50 text-sky-700 border-sky-200', text: 'text-sky-700', border: 'border-sky-400' },
    slate: { bg: 'bg-slate-100 text-slate-700 border-slate-300', text: 'text-slate-700', border: 'border-slate-400' }
  };

  const getColorClasses = (colorName: string = 'slate') => {
    return COLOR_MAP[colorName] || COLOR_MAP.slate;
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Archive vs Active tab
      if (activeTab === 'active' && t.archived) return false;
      if (activeTab === 'archive' && !t.archived) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        const matchesAssignees = (t.assigneeIds || []).some(id => {
          const contact = contacts.find(c => c.id === id);
          return contact && `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(q);
        });
        if (!matchesTitle && !matchesDesc && !matchesAssignees) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'all' && t.categoryId !== selectedCategoryFilter) return false;

      // Status filter
      if (selectedStatusFilter !== 'all' && t.statusId !== selectedStatusFilter) return false;

      // Assignee filter
      if (selectedAssigneeFilter !== 'all' && !(t.assigneeIds || []).includes(selectedAssigneeFilter)) return false;

      // Project filter
      if (selectedProjectFilter !== 'all' && t.projectId !== selectedProjectFilter) return false;

      // Weekplanner only filter
      if (weekplannerOnlyFilter && t.showInWeekPlanner === false) return false;

      return true;
    });
  }, [tasks, activeTab, searchQuery, selectedCategoryFilter, selectedStatusFilter, selectedAssigneeFilter, selectedProjectFilter, weekplannerOnlyFilter, contacts]);

  // Count active vs archived
  const activeCount = tasks.filter(t => !t.archived).length;
  const archivedCount = tasks.filter(t => t.archived).length;
  const completedUnarchivedCount = tasks.filter(t => !t.archived && (t.completed || t.statusId.toLowerCase().includes('gereed') || t.statusId.toLowerCase().includes('done'))).length;

  // Open modal for new task
  const handleOpenNewTask = (initialStatusId?: string, initialCategoryId?: string) => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatusId(initialStatusId || (statuses[0]?.id || ''));
    setTaskCategoryId(initialCategoryId || (categories[0]?.id || ''));
    setTaskPriority(false);
    setTaskStartDate(new Date().toISOString().split('T')[0]);
    setTaskEndDate('');
    setTaskStartTime('');
    setTaskEndTime('');
    setTaskShowInWeekPlanner(true);
    setTaskProjectId('');
    setTaskAssigneeIds([]);
    setIsAddingNewContact(false);
    setIsTaskModalOpen(true);
  };

  // Open modal for editing task
  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskStatusId(task.statusId || (statuses[0]?.id || ''));
    setTaskCategoryId(task.categoryId || (categories[0]?.id || ''));
    setTaskPriority(!!task.priority);
    setTaskStartDate(task.startDate || new Date().toISOString().split('T')[0]);
    setTaskEndDate(task.endDate || '');
    setTaskStartTime(task.startTime || '');
    setTaskEndTime(task.endTime || '');
    setTaskShowInWeekPlanner(task.showInWeekPlanner !== false);
    setTaskProjectId(task.projectId || '');
    setTaskAssigneeIds(task.assigneeIds || []);
    setIsAddingNewContact(false);
    setIsTaskModalOpen(true);
  };

  // Save task
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const matchedProject = projects.find(p => p.id === taskProjectId);
    const assignedContacts = contacts
      .filter(c => taskAssigneeIds.includes(c.id))
      .map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email }));

    const taskData: Task = {
      id: editingTask?.id || 't-' + Math.random().toString(36).substr(2, 9),
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      startDate: taskStartDate,
      endDate: taskEndDate || null,
      completed: editingTask?.completed || false,
      archived: editingTask?.archived || false,
      priority: taskPriority,
      statusId: taskStatusId || (statuses[0]?.id || 'status-todo'),
      categoryId: taskCategoryId || (categories[0]?.id || 'cat-werk'),
      isCalendarItem: false,
      startTime: taskStartTime || null,
      endTime: taskEndTime || null,
      recurrence: editingTask?.recurrence || 'none',
      recurrenceDay: editingTask?.recurrenceDay ?? null,
      recurrenceExceptions: editingTask?.recurrenceExceptions || [],
      assigneeIds: taskAssigneeIds,
      assignees: assignedContacts,
      showInWeekPlanner: taskShowInWeekPlanner,
      projectId: taskProjectId || undefined,
      projectType: matchedProject?.type,
      projectTitle: matchedProject?.title,
      activityId: editingTask?.activityId,
      completedAt: editingTask?.completedAt,
      createdAt: editingTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveTask(taskData);
    setIsTaskModalOpen(false);
  };

  // Toggle complete
  const handleToggleComplete = async (task: Task, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newCompleted = !task.completed;
    
    // Find gereed status if completing
    let newStatusId = task.statusId;
    if (newCompleted) {
      const gereedStatus = statuses.find(s => s.name.toLowerCase().includes('gereed') || s.name.toLowerCase().includes('done'));
      if (gereedStatus) newStatusId = gereedStatus.id;
    }

    const updated: Task = {
      ...task,
      completed: newCompleted,
      statusId: newStatusId,
      completedAt: newCompleted ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };
    await dbService.saveTask(updated);
  };

  // Quick Add from top mobile bar
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    const newTask: Task = {
      id: 't-' + Math.random().toString(36).substr(2, 9),
      title: quickAddTitle.trim(),
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      completed: false,
      archived: false,
      priority: false,
      statusId: quickAddStatusId || statuses[0]?.id || 'status-todo',
      categoryId: quickAddCategoryId || categories[0]?.id || 'cat-werk',
      isCalendarItem: false,
      startTime: null,
      endTime: null,
      recurrence: 'none',
      recurrenceDay: null,
      recurrenceExceptions: [],
      showInWeekPlanner: true,
      assigneeIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbService.saveTask(newTask);
    setQuickAddTitle('');
    setShowMobileQuickAdd(false);
  };

  // Quick move status (drag or 1-click select)
  const handleMoveStatus = async (task: Task, targetStatusId: string) => {
    const isDone = statuses.find(s => s.id === targetStatusId)?.name.toLowerCase().includes('gereed');
    const updated: Task = {
      ...task,
      statusId: targetStatusId,
      completed: !!isDone,
      completedAt: isDone ? new Date().toISOString() : (task.completed ? null : task.completedAt),
      updatedAt: new Date().toISOString()
    };
    await dbService.saveTask(updated);
  };

  // Quick move category
  const handleMoveCategory = async (task: Task, targetCategoryId: string) => {
    const updated: Task = {
      ...task,
      categoryId: targetCategoryId,
      updatedAt: new Date().toISOString()
    };
    await dbService.saveTask(updated);
  };

  // Archive single task
  const handleArchiveTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated: Task = {
      ...task,
      archived: true,
      completed: true,
      completedAt: task.completedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbService.saveTask(updated);
    setArchiveSuccessMessage(isNl ? 'Taak verplaatst naar het archief.' : 'Task moved to archive.');
    setTimeout(() => setArchiveSuccessMessage(null), 3000);
  };

  // Archive completed tasks in bulk
  const handleArchiveCompletedTasks = async () => {
    const count = await dbService.archiveCompletedTasks();
    setArchiveSuccessMessage(
      isNl 
        ? `${count} gereed gemelde taken zijn succesvol overgezet naar het archief.` 
        : `${count} completed tasks successfully moved to archive.`
    );
    setTimeout(() => setArchiveSuccessMessage(null), 4000);
  };

  // Restore task from archive
  const handleRestoreTask = async (taskId: string) => {
    await dbService.restoreArchivedTask(taskId);
  };

  // Delete single archived task
  const handleDeleteArchivedTask = async (taskId: string) => {
    if (window.confirm(isNl ? 'Weet u zeker dat u deze gearchiveerde taak definitief wilt verwijderen?' : 'Delete this archived task permanently?')) {
      await dbService.deleteArchivedTask(taskId);
    }
  };

  // Delete all archived tasks
  const handleDeleteAllArchivedTasks = async () => {
    if (window.confirm(isNl ? 'WAARSCHUWING: Weet u zeker dat u ALLE taken in het archief definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.' : 'WARNING: Are you sure you want to delete ALL archived tasks permanently?')) {
      const count = await dbService.deleteAllArchivedTasks();
      setArchiveSuccessMessage(
        isNl ? `Alle ${count} taken uit het archief zijn definitief verwijderd.` : `All ${count} tasks in archive deleted.`
      );
      setTimeout(() => setArchiveSuccessMessage(null), 4000);
    }
  };

  // Quick Notification Modal State
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyTask, setNotifyTask] = useState<Task | null>(null);
  const [notifyCopied, setNotifyCopied] = useState<string | null>(null);
  const [notifySuccessMsg, setNotifySuccessMsg] = useState<string | null>(null);
  const [isDispatchingNotify, setIsDispatchingNotify] = useState(false);

  // Compute public URLs
  const origin = getPublicOrigin();
  const getSingleTaskUrl = (tId: string) => `${origin}/?task_id=${tId}`;
  const getPersonalTaskPortalUrl = (contactId: string) => `${origin}/?assignee_tasks=${contactId}`;

  const handleNotifySingleTask = (task: Task) => {
    setNotifyTask(task);
    setNotifyModalOpen(true);
    setNotifySuccessMsg(null);
  };

  const handleOpenBatchNotify = () => {
    setNotifyTask(null);
    setNotifyModalOpen(true);
    setNotifySuccessMsg(null);
  };

  const handleDispatchQuickNotify = async (
    recipients: { name: string; email: string; contactId?: string }[],
    subject: string,
    messageText: string,
    uniqueUrl: string
  ) => {
    if (recipients.length === 0) {
      alert(isNl ? 'Geen actiehouders met een geldig e-mailadres gevonden.' : 'No assignees with email found.');
      return;
    }

    setIsDispatchingNotify(true);
    let successCount = 0;

    for (const r of recipients) {
      if (!r.email) continue;
      const personalUrl = r.contactId ? getPersonalTaskPortalUrl(r.contactId) : uniqueUrl;
      const personalizedMsg = messageText
        .replace(/{name}/g, r.name)
        .replace(/{unique_url}/g, personalUrl);

      const html = wrapInHtmlEmailTemplate(
        subject,
        personalizedMsg.replace(/\n/g, '<br/>'),
        personalUrl,
        isNl ? 'Taak / Taken Bekijken & Bijwerken' : 'View & Update Tasks'
      );

      try {
        if (sendEmailUnified) {
          await sendEmailUnified({
            to: r.email,
            subject,
            bodyHtml: html
          });
        }
        await dbService.logNotification({
          type: 'task_reminder',
          title: subject,
          message: personalizedMsg,
          recipientEmail: r.email,
          recipientName: r.name,
          uniqueUrl: personalUrl,
          itemType: 'task',
          itemId: notifyTask?.id || undefined,
          status: 'sent'
        });
        successCount++;
      } catch (err) {
        console.error('Error sending task notification:', err);
      }
    }

    setIsDispatchingNotify(false);
    setNotifySuccessMsg(
      isNl 
        ? `Notificatie succesvol verstuurd naar ${successCount} actiehouder(s)!` 
        : `Notification sent to ${successCount} assignee(s)!`
    );
    setTimeout(() => {
      setNotifySuccessMsg(null);
      setNotifyModalOpen(false);
    }, 2500);
  };

  // Create new contact inline
  const handleCreateContactInline = async () => {
    if (!newContactFirstName.trim() || !newContactEmail.trim()) return;

    const newContact: Contact = {
      id: 'c-' + Math.random().toString(36).substr(2, 9),
      firstName: newContactFirstName.trim(),
      lastName: newContactLastName.trim(),
      email: newContactEmail.trim()
    };

    await dbService.saveContact(newContact);
    setContacts(dbService.getContacts());
    // Auto-select this newly created contact
    setTaskAssigneeIds(prev => [...prev, newContact.id]);
    // Reset inline inputs
    setNewContactFirstName('');
    setNewContactLastName('');
    setNewContactEmail('');
    setIsAddingNewContact(false);
  };

  // Create new category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: TaskCategory = {
      id: 'cat-' + Math.random().toString(36).substr(2, 9),
      name: newCatName.trim(),
      color: newCatColor
    };

    await dbService.saveTaskCategory(newCat);
    setCategories(dbService.getTaskCategories());
    setNewCatName('');
  };

  // Delete category
  const handleDeleteCategory = async (catId: string) => {
    if (categories.length <= 1) {
      alert(isNl ? 'Er moet minimaal één categorie behouden blijven.' : 'At least one category must remain.');
      return;
    }
    if (window.confirm(isNl ? 'Categorie verwijderen?' : 'Delete category?')) {
      await dbService.deleteTaskCategory(catId);
      setCategories(dbService.getTaskCategories());
    }
  };

  // Create new status column
  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;

    const newStat: TaskStatus = {
      id: 'status-' + Math.random().toString(36).substr(2, 9),
      name: newStatusName.trim(),
      color: newStatusColor,
      order: statuses.length
    };

    await dbService.saveTaskStatus(newStat);
    setStatuses(dbService.getTaskStatuses());
    setNewStatusName('');
  };

  // Delete status column
  const handleDeleteStatus = async (statusId: string) => {
    if (statuses.length <= 1) {
      alert(isNl ? 'Er moet minimaal één statuskolom behouden blijven.' : 'At least one status column must remain.');
      return;
    }
    if (window.confirm(isNl ? 'Statuskolom verwijderen?' : 'Delete status column?')) {
      await dbService.deleteTaskStatus(statusId);
      setStatuses(dbService.getTaskStatuses());
    }
  };

  // Render Individual Task Card for Kanban Columns
  const renderTaskCard = (task: Task) => {
    const taskCat = categories.find(c => c.id === task.categoryId);
    const taskStat = statuses.find(s => s.id === task.statusId);
    const taskProj = projects.find(p => p.id === task.projectId);
    const catColors = getColorClasses(taskCat?.color);
    const statColors = getColorClasses(taskStat?.color);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
        onDragEnd={() => setDraggedTaskId(null)}
        onClick={() => handleOpenEditTask(task)}
        className={`bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2.5 relative group ${
          task.completed ? 'opacity-75 bg-slate-50/70' : ''
        }`}
      >
        {/* Header: Title and Checkbox */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={(e) => handleToggleComplete(task, e)}
              className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0 cursor-pointer"
              title={task.completed ? (isNl ? 'Markeer als onvoltooid' : 'Mark incomplete') : (isNl ? 'Markeer als voltooid' : 'Mark completed')}
            >
              {task.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 fill-emerald-50" />
              ) : (
                <Circle className="h-4 w-4 hover:text-slate-600" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {task.priority && (
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                )}
                <h4 className={`text-xs font-bold leading-snug line-clamp-2 ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {task.title}
                </h4>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
            {task.completed && !task.archived && (
              <button
                type="button"
                onClick={() => handleArchiveTask(task.id)}
                className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded text-[10px] cursor-pointer"
                title={isNl ? 'Archiveer deze taak' : 'Archive task'}
              >
                <Archive className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNotifySingleTask(task)}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded text-[10px] cursor-pointer"
              title={isNl ? 'Stuur herinnering naar actiehouder(s)' : 'Notify assignee'}
            >
              <Bell className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenEditTask(task)}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded text-[10px] cursor-pointer"
              title={isNl ? 'Bewerken' : 'Edit'}
            >
              <Edit className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Description snippet if any */}
        {task.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Badges: Category, Status, Project, Weekplanner */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {groupBy === 'status' && taskCat && (
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${catColors.bg} truncate max-w-[120px]`}>
              {taskCat.name}
            </span>
          )}

          {groupBy === 'category' && taskStat && (
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${statColors.bg} truncate max-w-[120px]`}>
              {taskStat.name}
            </span>
          )}

          {task.showInWeekPlanner !== false && (
            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded text-[8.5px] font-black flex items-center gap-0.5" title="Zichtbaar in Weekplanner takenlijst">
              <span>🗓️</span>
              <span className="hidden sm:inline">Week</span>
            </span>
          )}

          {taskProj && (
            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded text-[8.5px] font-black flex items-center gap-0.5 truncate max-w-[130px]" title={`Project: ${taskProj.title}`}>
              <span>{taskProj.type === 'exploration' ? '🔍' : '🚀'}</span>
              <span className="truncate">{taskProj.title}</span>
            </span>
          )}
        </div>

        {/* Footer: Date Range and Assignees Contacts */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-400">
          <div className="flex items-center gap-1 truncate">
            {task.startDate && (
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="h-2.5 w-2.5" />
                <span>{task.startDate}</span>
              </span>
            )}
          </div>

          {(task.assigneeIds || []).length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <Users className="h-2.5 w-2.5 text-slate-400" />
              <span className="font-semibold text-slate-600 truncate max-w-[100px]">
                {(task.assigneeIds || []).map(id => {
                  const c = contacts.find(contact => contact.id === id);
                  return c ? `${c.firstName}` : '';
                }).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in" id="task-manager-board-container">
      {/* Top Banner / Mobile Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl font-black">
              <Kanban className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {isNl ? 'Takenoverzicht & Trello Bord' : 'Task Overview & Kanban Board'}
            </h1>
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold rounded-full">
              {activeTab === 'active' ? `${activeCount} ${isNl ? 'actief' : 'active'}` : `${archivedCount} ${isNl ? 'in archief' : 'archived'}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {isNl
              ? 'Beheer alle taken in een flexibel Trello-bord of totaallijst. Groepeer op status of categorie, wijs contactpersonen toe en koppel eenvoudig aan de Weekplanner en Projecten & Verkenningen.'
              : 'Manage all tasks in a flexible Kanban board or master list. Group by status or category, assign contacts and sync with Weekplanner and Projects.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Add Button (Prominent for Mobile) */}
          <button
            onClick={() => handleOpenNewTask()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all cursor-pointer flex-1 sm:flex-none"
            id="create-new-task-btn"
          >
            <Plus className="h-4 w-4" />
            <span>{isNl ? '+ Nieuwe Taak' : '+ New Task'}</span>
          </button>

          {/* Quick Mobile Inline Input Toggle */}
          <button
            onClick={() => setShowMobileQuickAdd(!showMobileQuickAdd)}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer sm:hidden"
            title={isNl ? 'Snel taak invoeren' : 'Quick add'}
          >
            <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
            <span>{isNl ? 'Snelle Invoer' : 'Quick'}</span>
          </button>

          {/* Archive Completed in 1 Click */}
          {activeTab === 'active' && completedUnarchivedCount > 0 && (
            <button
              onClick={handleArchiveCompletedTasks}
              className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title={isNl ? 'Verplaats alle voltooide taken in 1 klik naar het archief' : 'Move completed tasks to archive'}
            >
              <Archive className="h-3.5 w-3.5 text-amber-700" />
              <span>{isNl ? `Archiveer Gereed (${completedUnarchivedCount})` : `Archive Done (${completedUnarchivedCount})`}</span>
            </button>
          )}

          {/* Manage Categories & Statuses */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              title={isNl ? 'Categorieën beheren' : 'Manage categories'}
            >
              <Tag className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden md:inline">{isNl ? 'Categorieën' : 'Categories'}</span>
            </button>

            <button
              onClick={() => setIsStatusModalOpen(true)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              title={isNl ? 'Statussen & Kolommen beheren' : 'Manage statuses'}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden md:inline">{isNl ? 'Statussen' : 'Statuses'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {archiveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{archiveSuccessMessage}</span>
          </div>
          <button onClick={() => setArchiveSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Mobile Quick Add Inline Bar */}
      {showMobileQuickAdd && (
        <form onSubmit={handleQuickAdd} className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-100 space-y-2.5 shadow-sm sm:hidden">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
              {isNl ? 'Snel taak aanmaken op mobiel' : 'Quick add task'}
            </span>
            <button type="button" onClick={() => setShowMobileQuickAdd(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <input
            type="text"
            placeholder={isNl ? 'Wat moet er gebeuren? Typ titel...' : 'What needs to be done? Type title...'}
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={quickAddCategoryId}
              onChange={(e) => setQuickAddCategoryId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>🏷️ {c.name}</option>
              ))}
            </select>
            <select
              value={quickAddStatusId}
              onChange={(e) => setQuickAddStatusId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs"
            >
              {statuses.map(s => (
                <option key={s.id} value={s.id}>📊 {s.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-2xs"
          >
            {isNl ? '+ Taak Toevoegen' : '+ Add Task'}
          </button>
        </form>
      )}

      {/* Control Navigation & Filter Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/60 shadow-xs space-y-3">
        {/* Main Tabs (Actief vs Archief) and View Switcher (Board vs List) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Active / Archive Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{isNl ? 'Actieve Taken' : 'Active Tasks'}</span>
              <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[10px] rounded-full font-black">
                {activeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'archive'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>{isNl ? 'Archief' : 'Archive'}</span>
              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 text-[10px] rounded-full font-black">
                {archivedCount}
              </span>
            </button>
          </div>

          {/* Group By and View Mode Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Group By (Only in Board mode) */}
            {viewMode === 'board' && activeTab === 'active' && (
              <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-xl">
                <span>{isNl ? 'Groepeer op:' : 'Group by:'}</span>
                <button
                  onClick={() => setGroupBy('status')}
                  className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    groupBy === 'status' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  {isNl ? 'Status' : 'Status'}
                </button>
                <button
                  onClick={() => setGroupBy('category')}
                  className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    groupBy === 'category' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  {isNl ? 'Categorie' : 'Category'}
                </button>
              </div>
            )}

            {/* Quick Notify Assignees Button */}
            <button
              onClick={handleOpenBatchNotify}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title={isNl ? 'Herinner actiehouders met openstaande taken' : 'Notify assignees with open tasks'}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{isNl ? 'Notificeer Actiehouders' : 'Notify Assignees'}</span>
            </button>

            {/* View Mode Toggle: Board vs List */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setViewMode('board')}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'board' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isNl ? 'Trello Bord weergave' : 'Board view'}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isNl ? 'Bord' : 'Board'}</span>
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'list' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isNl ? 'Totaallijst weergave' : 'List view'}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isNl ? 'Totaallijst' : 'List'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Search Input */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={isNl ? 'Zoek taken, actiehouders...' : 'Search tasks...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
            >
              <option value="all">{isNl ? '🏷️ Alle Categorieën' : '🏷️ All Categories'}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
            >
              <option value="all">{isNl ? '📊 Alle Statussen' : '📊 All Statuses'}</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee Filter */}
          <div>
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
            >
              <option value="all">{isNl ? '👥 Alle Actiehouders' : '👥 All Assignees'}</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>

          {/* Project Filter & Weekplanner checkbox */}
          <div className="flex items-center gap-2">
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium truncate"
            >
              <option value="all">{isNl ? '📁 Alle Projecten' : '📁 All Projects'}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.type === 'exploration' ? '🔍 ' : '🚀 '}{p.title}</option>
              ))}
            </select>

            <button
              onClick={() => setWeekplannerOnlyFilter(!weekplannerOnlyFilter)}
              className={`p-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                weekplannerOnlyFilter
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
              title={isNl ? 'Alleen taken die zichtbaar zijn in Weekplanner' : 'Only tasks in Weekplanner'}
            >
              🗓️ <span className="hidden xl:inline">{isNl ? 'In Weekplanner' : 'In Weekplanner'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Archive View Header Actions */}
      {activeTab === 'archive' && (
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                {isNl ? 'Gearchiveerde Taken' : 'Archived Tasks'} ({archivedCount})
              </h3>
              <p className="text-xs text-amber-700">
                {isNl
                  ? 'Hier staan alle afgesloten en gearchiveerde taken. U kunt ze 1 voor 1 herstellen of definitief verwijderen, of alles ineens wissen.'
                  : 'All closed and archived tasks. Restore or permanently delete one-by-one or all at once.'}
              </p>
            </div>
          </div>

          {archivedCount > 0 && (
            <button
              onClick={handleDeleteAllArchivedTasks}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isNl ? 'Archief Geheel Legen' : 'Empty Whole Archive'}</span>
            </button>
          )}
        </div>
      )}

      {/* CONTENT AREA: BOARD OR LIST */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/60 shadow-xs">
          {activeTab === 'archive' ? (
            <>
              <Archive className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">{isNl ? 'Het archief is leeg' : 'Archive is empty'}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {isNl
                  ? 'Wanneer u voltooide taken archiveert, komen ze hier terecht om uw actieve bord netjes en overzichtelijk te houden.'
                  : 'Completed tasks moved to archive will show up here.'}
              </p>
            </>
          ) : (
            <>
              <CheckSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">{isNl ? 'Geen taken gevonden' : 'No tasks found'}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {searchQuery || selectedCategoryFilter !== 'all' || selectedStatusFilter !== 'all'
                  ? (isNl ? 'Geen taken voldoen aan de geselecteerde zoek- of filtercriteria.' : 'No tasks match current filter criteria.')
                  : (isNl ? 'Begin door je eerste taak aan te maken via de knop hierboven!' : 'Start by creating your first task above!')}
              </p>
              <button
                onClick={() => handleOpenNewTask()}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                {isNl ? '+ Nieuwe Taak Aanmaken' : '+ Create New Task'}
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'board' && activeTab === 'active' ? (
        /* KANBAN TRELLO BOARD VIEW */
        <div className="overflow-x-auto pb-4 pt-1">
          <div className="flex items-start gap-4 min-w-max">
            {groupBy === 'status' ? (
              /* GROUPED BY STATUS COLUMNS */
              statuses.map(columnStatus => {
                const columnTasks = filteredTasks.filter(t => t.statusId === columnStatus.id);
                const colColors = getColorClasses(columnStatus.color);

                return (
                  <div
                    key={columnStatus.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedTaskId) {
                        const draggedTask = tasks.find(t => t.id === draggedTaskId);
                        if (draggedTask && draggedTask.statusId !== columnStatus.id) {
                          handleMoveStatus(draggedTask, columnStatus.id);
                        }
                        setDraggedTaskId(null);
                      }
                    }}
                    className="w-80 shrink-0 bg-slate-100/70 rounded-2xl p-3 border border-slate-200/80 flex flex-col max-h-[calc(100vh-220px)] transition-colors hover:border-slate-300"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${colColors.border} border-2 bg-white`} />
                        <h3 className="font-extrabold text-sm text-slate-800">{columnStatus.name}</h3>
                        <span className="px-2 py-0.5 bg-white text-slate-600 border border-slate-200/80 rounded-full text-[10px] font-black">
                          {columnTasks.length}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenNewTask(columnStatus.id)}
                        className="p-1 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title={isNl ? 'Taak toevoegen in deze kolom' : 'Add task here'}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                      {columnTasks.map(task => renderTaskCard(task))}
                      {columnTasks.length === 0 && (
                        <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-[11px] text-slate-400 bg-white/40">
                          {isNl ? 'Geen taken in deze status' : 'No tasks'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* GROUPED BY CATEGORY COLUMNS */
              categories.map(columnCategory => {
                const columnTasks = filteredTasks.filter(t => t.categoryId === columnCategory.id);
                const catColors = getColorClasses(columnCategory.color);

                return (
                  <div
                    key={columnCategory.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedTaskId) {
                        const draggedTask = tasks.find(t => t.id === draggedTaskId);
                        if (draggedTask && draggedTask.categoryId !== columnCategory.id) {
                          handleMoveCategory(draggedTask, columnCategory.id);
                        }
                        setDraggedTaskId(null);
                      }
                    }}
                    className="w-80 shrink-0 bg-slate-100/70 rounded-2xl p-3 border border-slate-200/80 flex flex-col max-h-[calc(100vh-220px)] transition-colors hover:border-slate-300"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${catColors.border} border-2 bg-white`} />
                        <h3 className="font-extrabold text-sm text-slate-800">{columnCategory.name}</h3>
                        <span className="px-2 py-0.5 bg-white text-slate-600 border border-slate-200/80 rounded-full text-[10px] font-black">
                          {columnTasks.length}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenNewTask(undefined, columnCategory.id)}
                        className="p-1 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title={isNl ? 'Taak toevoegen in deze categorie' : 'Add task here'}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                      {columnTasks.map(task => renderTaskCard(task))}
                      {columnTasks.length === 0 && (
                        <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-[11px] text-slate-400 bg-white/40">
                          {isNl ? 'Geen taken in deze categorie' : 'No tasks'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* MASTER LIST VIEW (RESPONSIVE & MOBILE FRIENDLY) */
        <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {filteredTasks.map(task => {
              const taskCat = categories.find(c => c.id === task.categoryId);
              const taskStat = statuses.find(s => s.id === task.statusId);
              const taskProj = projects.find(p => p.id === task.projectId);
              const catColors = getColorClasses(taskCat?.color);
              const statColors = getColorClasses(taskStat?.color);

              return (
                <div
                  key={task.id}
                  onClick={() => handleOpenEditTask(task)}
                  className={`p-3.5 sm:p-4 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                    task.completed ? 'bg-slate-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox toggle */}
                    <button
                      onClick={(e) => handleToggleComplete(task, e)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0 transition-colors"
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
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <h4 className={`text-sm font-bold truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {task.title}
                        </h4>

                        {/* Category badge */}
                        {taskCat && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catColors.bg}`}>
                            {taskCat.name}
                          </span>
                        )}

                        {/* Status badge */}
                        {taskStat && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${statColors.bg}`}>
                            {taskStat.name}
                          </span>
                        )}

                        {/* Weekplanner indicator */}
                        {task.showInWeekPlanner !== false && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-black flex items-center gap-0.5" title="Zichtbaar in Weekplanner takenlijst">
                            <span>🗓️</span> <span className="hidden md:inline">Weekplanner</span>
                          </span>
                        )}

                        {/* Project indicator */}
                        {taskProj && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black flex items-center gap-0.5" title={`Gekoppeld aan project: ${taskProj.title}`}>
                            <span>{taskProj.type === 'exploration' ? '🔍' : '🚀'}</span>
                            <span className="truncate max-w-[120px]">{taskProj.title}</span>
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      {/* Meta info: dates & assignees */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{task.startDate}</span>
                          {task.endDate && <span>tot {task.endDate}</span>}
                        </span>

                        {/* Assignees avatars / chips */}
                        {(task.assigneeIds || []).length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-slate-400" />
                            <span className="font-semibold text-slate-600">
                              {(task.assigneeIds || []).map(id => {
                                const c = contacts.find(contact => contact.id === id);
                                return c ? `${c.firstName} ${c.lastName}` : '';
                              }).filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    {activeTab === 'archive' ? (
                      <>
                        <button
                          onClick={() => handleRestoreTask(task.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1 cursor-pointer"
                          title={isNl ? 'Zet taak terug uit archief' : 'Restore from archive'}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          <span>{isNl ? 'Herstel' : 'Restore'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteArchivedTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title={isNl ? 'Definitief verwijderen' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleNotifySingleTask(task)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                          title={isNl ? 'Stuur herinnering naar actiehouder(s)' : 'Notify assignee'}
                        >
                          <Bell className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditTask(task)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                          title={isNl ? 'Bewerken' : 'Edit'}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RENDER FUNCTION: TASK CARD FOR KANBAN BOARD */}
      {function renderTaskCard(task: Task) {
        const taskCat = categories.find(c => c.id === task.categoryId);
        const taskStat = statuses.find(s => s.id === task.statusId);
        const taskProj = projects.find(p => p.id === task.projectId);
        const catColors = getColorClasses(taskCat?.color);
        const statColors = getColorClasses(taskStat?.color);

        return (
          <div
            key={task.id}
            onClick={() => handleOpenEditTask(task)}
            className={`bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2.5 ${
              task.completed ? 'opacity-70 bg-slate-50' : ''
            }`}
          >
            {/* Header: Priority, Badges, Checkbox */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {task.priority && (
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                )}
                {taskCat && (
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${catColors.bg}`}>
                    {taskCat.name}
                  </span>
                )}
                {groupBy === 'category' && taskStat && (
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${statColors.bg}`}>
                    {taskStat.name}
                  </span>
                )}
              </div>

              <button
                onClick={(e) => handleToggleComplete(task, e)}
                className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0 transition-colors"
              >
                {task.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 fill-emerald-50" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Title & Description */}
            <div>
              <h4 className={`text-xs font-bold leading-snug ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                {task.title}
              </h4>
              {task.description && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>

            {/* Badges for Project Link and Weekplanner */}
            {(taskProj || task.showInWeekPlanner !== false) && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {taskProj && (
                  <span
                    onClick={(e) => {
                      if (onNavigateToProject) {
                        e.stopPropagation();
                        onNavigateToProject(taskProj.id);
                      }
                    }}
                    className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                    title={`Gekoppeld aan: ${taskProj.title}`}
                  >
                    <span>{taskProj.type === 'exploration' ? '🔍' : '🚀'}</span>
                    <span className="truncate max-w-[130px]">{taskProj.title}</span>
                  </span>
                )}

                {task.showInWeekPlanner !== false && (
                  <span
                    onClick={(e) => {
                      if (onNavigateToWeekplanner) {
                        e.stopPropagation();
                        onNavigateToWeekplanner();
                      }
                    }}
                    className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-black flex items-center gap-0.5 cursor-pointer transition-colors"
                    title="Beschikbaar in Weekplanner takenlijst"
                  >
                    <span>🗓️</span> <span>Weekplanner</span>
                  </span>
                )}
              </div>
            )}

            {/* Footer: Date and Assignees */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{task.startDate}</span>
              </span>

              {/* Assignees initials/chips */}
              {(task.assigneeIds || []).length > 0 && (
                <div className="flex items-center -space-x-1 overflow-hidden" title="Actiehouders">
                  {(task.assigneeIds || []).slice(0, 3).map(id => {
                    const c = contacts.find(contact => contact.id === id);
                    if (!c) return null;
                    const initials = `${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase();
                    return (
                      <div
                        key={c.id}
                        className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[8px] flex items-center justify-center border border-white shadow-2xs"
                        title={`${c.firstName} ${c.lastName}`}
                      >
                        {initials}
                      </div>
                    );
                  })}
                  {(task.assigneeIds || []).length > 3 && (
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[8px] flex items-center justify-center border border-white">
                      +{(task.assigneeIds || []).length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick status mover dropdown in Board mode */}
            <div className="pt-1 flex items-center justify-between text-[10px]" onClick={(e) => e.stopPropagation()}>
              <span className="text-slate-400">{isNl ? 'Status:' : 'Status:'}</span>
              <select
                value={task.statusId}
                onChange={(e) => handleMoveStatus(task, e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        );
      }}

      {/* MODAL: CREATE / EDIT TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 my-8 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <CheckSquare className="h-4 w-4" />
                </span>
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingTask ? (isNl ? 'Taak Wijzigen' : 'Edit Task') : (isNl ? 'Nieuwe Taak Aanmaken' : 'Create New Task')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {editingTask && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTaskModalOpen(false);
                      handleNotifySingleTask(editingTask);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 cursor-pointer"
                    title={isNl ? 'Stuur herinnering naar actiehouder(s)' : 'Notify assignee'}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>{isNl ? 'Herinneren' : 'Notify'}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsTaskModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
              {/* Title & Priority */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Titel van de taak *' : 'Task Title *'}
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <Star className={`h-3.5 w-3.5 ${taskPriority ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                    <span>{isNl ? 'Hoge Prioriteit' : 'High Priority'}</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  placeholder={isNl ? 'Bijv. Overleg voorbereiden voor stuurgroep...' : 'Task title...'}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                  {isNl ? 'Omschrijving & Toelichting' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder={isNl ? 'Beschrijf de details, verwachtingen of te ondernemen stappen...' : 'Task description...'}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Status *' : 'Status *'}
                  </label>
                  <select
                    value={taskStatusId}
                    onChange={(e) => setTaskStatusId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {statuses.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Categorie *' : 'Category *'}
                  </label>
                  <select
                    value={taskCategoryId}
                    onChange={(e) => setTaskCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Startdatum *' : 'Start Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    {isNl ? 'Einddatum / Deadline (optioneel)' : 'Due Date'}
                  </label>
                  <input
                    type="date"
                    value={taskEndDate}
                    onChange={(e) => setTaskEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Actiehouders (= Contactpersonen) Multi-Select */}
              <div className="space-y-2 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isNl ? 'Actiehouders (= Contactpersonen)' : 'Assignees (= Contacts)'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewContact(!isAddingNewContact)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer"
                  >
                    {isAddingNewContact ? (isNl ? 'Annuleer' : 'Cancel') : (isNl ? '+ Nieuwe Contactpersoon' : '+ New Contact')}
                  </button>
                </div>

                {/* Inline form to create brand new contact and immediately assign */}
                {isAddingNewContact && (
                  <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2 shadow-2xs">
                    <span className="text-[10px] font-bold text-indigo-900 block">
                      {isNl ? 'Nieuw contact toevoegen aan adresboek & selecteren:' : 'Add new contact:'}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder={isNl ? 'Voornaam *' : 'First Name *'}
                        value={newContactFirstName}
                        onChange={(e) => setNewContactFirstName(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder={isNl ? 'Achternaam' : 'Last Name'}
                        value={newContactLastName}
                        onChange={(e) => setNewContactLastName(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder={isNl ? 'E-mailadres *' : 'Email *'}
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleCreateContactInline}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                      >
                        {isNl ? 'Opslaan & Koppel' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contact Checkbox List */}
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-white p-2 rounded-lg border border-slate-200">
                  {contacts.length === 0 ? (
                    <div className="text-[11px] text-slate-400 text-center py-2">
                      {isNl ? 'Geen contactpersonen opgeslagen. Voeg hierboven een contact toe.' : 'No contacts saved yet.'}
                    </div>
                  ) : (
                    contacts.map(c => {
                      const isSelected = taskAssigneeIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                            isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' : 'hover:bg-slate-50 border-transparent text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTaskAssigneeIds(prev => [...prev, c.id]);
                                } else {
                                  setTaskAssigneeIds(prev => prev.filter(id => id !== c.id));
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{c.firstName} {c.lastName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{c.email}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* INTEGRATION 1: Vinkje Weekplanner */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2.5 font-bold text-emerald-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={taskShowInWeekPlanner}
                    onChange={(e) => setTaskShowInWeekPlanner(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs font-black">
                    {isNl ? 'Beschikbaar stellen op de takenlijst in de Weekplanner' : 'Make available on Weekplanner task list'}
                  </span>
                </label>
                <p className="text-[11px] text-emerald-800 pl-6.5">
                  {isNl
                    ? 'Als dit vinkje aan staat, wordt deze taak direct getoond in het takenoverzicht en rooster van de Weekplanner.'
                    : 'When checked, this task shows up in the Weekplanner.'}
                </p>
              </div>

              {/* INTEGRATION 2: Koppeling aan Project / Verkenning */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                <label className="font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                  <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{isNl ? 'Koppelen aan Project en/of Verkenning' : 'Link to Project or Exploration'}</span>
                </label>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">{isNl ? '-- Geen projectkoppeling (losse taak) --' : '-- No project link --'}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.type === 'exploration' ? '🔍 [Verkenning] ' : '🚀 [Project] '} {p.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-indigo-700">
                  {isNl
                    ? 'Gekoppelde taken kunnen in het onderdeel Projecten & Verkenningen direct worden ingepland op de Gantt-chart tijdlijn of in de tabelweergave.'
                    : 'Linked tasks can be planned directly in the Gantt chart of Projects & Explorations.'}
                </p>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(isNl ? 'Taak verwijderen?' : 'Delete task?')) {
                        await dbService.deleteTask(editingTask.id);
                        setIsTaskModalOpen(false);
                      }
                    }}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isNl ? 'Verwijder' : 'Delete'}</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {isNl ? 'Annuleren' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer"
                  >
                    {editingTask ? (isNl ? 'Opslaan' : 'Save') : (isNl ? 'Aanmaken' : 'Create')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CATEGORY MANAGER */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-800">
                  {isNl ? 'Categorieën Beheren' : 'Manage Categories'}
                </h3>
              </div>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Create new category form */}
            <form onSubmit={handleCreateCategory} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {isNl ? '+ Nieuwe Categorie Toevoegen' : '+ Add New Category'}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isNl ? 'Categorienaam...' : 'Category name...'}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  required
                />
                <select
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                >
                  <option value="indigo">Indigo</option>
                  <option value="emerald">Groen</option>
                  <option value="amber">Oranje</option>
                  <option value="rose">Rood</option>
                  <option value="blue">Blauw</option>
                  <option value="purple">Paars</option>
                  <option value="violet">Violet</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-2xs"
                >
                  +
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {categories.map(cat => {
                const colors = getColorClasses(cat.color);
                const count = tasks.filter(t => t.categoryId === cat.id && !t.archived).length;
                return (
                  <div
                    key={cat.id}
                    className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${colors.border} border-2 bg-white`} />
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                        {count} {isNl ? 'taken' : 'tasks'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title={isNl ? 'Verwijderen' : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                {isNl ? 'Sluiten' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STATUS / COLUMN MANAGER */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-800">
                  {isNl ? 'Statussen & Kolommen Beheren' : 'Manage Status Columns'}
                </h3>
              </div>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Create new status form */}
            <form onSubmit={handleCreateStatus} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {isNl ? '+ Nieuwe Statuskolom Toevoegen' : '+ Add New Status'}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isNl ? 'Statusnaam (bijv. In behandeling)...' : 'Status name...'}
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  required
                />
                <select
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                >
                  <option value="amber">Oranje</option>
                  <option value="blue">Blauw</option>
                  <option value="emerald">Groen</option>
                  <option value="indigo">Indigo</option>
                  <option value="purple">Paars</option>
                  <option value="rose">Rood</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-2xs"
                >
                  +
                </button>
              </div>
            </form>

            {/* Existing Statuses List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {statuses.map(stat => {
                const colors = getColorClasses(stat.color);
                const count = tasks.filter(t => t.statusId === stat.id && !t.archived).length;
                return (
                  <div
                    key={stat.id}
                    className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${colors.border} border-2 bg-white`} />
                      <span className="font-bold text-slate-800">{stat.name}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                        {count} {isNl ? 'taken' : 'tasks'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteStatus(stat.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title={isNl ? 'Verwijderen' : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                {isNl ? 'Sluiten' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK NOTIFICATION MODAL */}
      {notifyModalOpen && (() => {
        // Determine recipients and defaults
        const isSingle = !!notifyTask;
        const targetRecipients: { name: string; email: string; contactId?: string }[] = isSingle
          ? (notifyTask.assigneeIds || [])
              .map(id => contacts.find(c => c.id === id))
              .filter((c): c is Contact => !!c)
              .map(c => ({ name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, contactId: c.id }))
          : contacts
              .filter(c => tasks.some(t => !t.completed && !t.archived && (t.assigneeIds || []).includes(c.id)))
              .map(c => ({ name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, contactId: c.id }));

        const uniqueUrl = isSingle ? getSingleTaskUrl(notifyTask.id) : origin;
        const defaultSubject = isSingle
          ? (isNl ? `Herinnering taak: ${notifyTask.title}` : `Reminder task: ${notifyTask.title}`)
          : (isNl ? `Herinnering: Jouw openstaande taken bijwerken` : `Reminder: Update your open tasks`);

        const defaultBody = isSingle
          ? (isNl
              ? `Beste {name},\n\nDit is een herinnering voor de taak "${notifyTask.title}".\n\nVia onderstaande link kun je de taak direct inzien, notities toevoegen en de status bijwerken (bijv. 'In behandeling' of 'Gereed'):\n{unique_url}\n\nMet vriendelijke groet,\nIT Platform Twente`
              : `Dear {name},\n\nThis is a reminder for the task "${notifyTask.title}".\n\nYou can view and update the task here:\n{unique_url}\n\nBest regards,\nIT Platform Twente`)
          : (isNl
              ? `Beste {name},\n\nEr staan momenteel taken aan jou toegewezen binnen IT Platform Twente die nog openstaan of in behandeling zijn.\n\nVia jouw unieke persoonlijke portaallink kun je direct jouw taken inzien, voortgang noteren of gereedmelden:\n{unique_url}\n\nMet vriendelijke groet,\nIT Platform Twente`
              : `Dear {name},\n\nYou have pending tasks assigned to you.\n\nPlease check and update them here:\n{unique_url}\n\nBest regards,\nIT Platform Twente`);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 my-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Bell className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-black text-slate-800">
                    {isSingle
                      ? (isNl ? 'Herinnering voor Taak Versturen' : 'Send Task Reminder')
                      : (isNl ? 'Alle Actiehouders Notificeren' : 'Notify All Assignees')}
                  </h3>
                </div>
                <button
                  onClick={() => setNotifyModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {notifySuccessMsg ? (
                <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{notifySuccessMsg}</span>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {isNl ? 'Ontvanger(s):' : 'Recipients:'} ({targetRecipients.length})
                    </span>
                    <p className="font-bold text-slate-800">
                      {targetRecipients.length > 0
                        ? targetRecipients.map(r => r.name || r.email).join(', ')
                        : (isNl ? 'Geen actiehouder(s) gekoppeld aan deze taak!' : 'No assignees assigned!')}
                    </p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="font-bold text-slate-700 block">
                      {isNl ? 'Unieke URL in herinneringsmail:' : 'Unique URL in email:'}
                    </label>
                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl font-mono text-[11px] text-indigo-900 break-all flex items-center justify-between gap-2">
                      <span className="truncate">{isSingle ? uniqueUrl : '{persoonlijke_portaal_url_per_ontvanger}'}</span>
                      {isSingle && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(uniqueUrl);
                            setNotifyCopied('link');
                            setTimeout(() => setNotifyCopied(null), 2000);
                          }}
                          className="px-2 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          {notifyCopied === 'link' ? (isNl ? 'Gekopieerd!' : 'Copied!') : (isNl ? 'Kopieer' : 'Copy')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="font-bold text-slate-700 block">
                      {isNl ? 'Berichtvoorbeeld:' : 'Message preview:'}
                    </label>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                      {defaultBody}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const copyText = `${defaultSubject}\n\n${defaultBody.replace('{unique_url}', uniqueUrl)}`;
                        navigator.clipboard.writeText(copyText);
                        setNotifyCopied('text');
                        setTimeout(() => setNotifyCopied(null), 2000);
                      }}
                      className="px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{notifyCopied === 'text' ? (isNl ? 'Gekopieerd!' : 'Copied!') : (isNl ? 'Kopieer Tekst' : 'Copy text')}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {onOpenNotifications && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyModalOpen(false);
                            onOpenNotifications();
                          }}
                          className="px-3 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl font-bold cursor-pointer"
                        >
                          {isNl ? 'Notificatie Hub' : 'Notification Hub'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDispatchQuickNotify(targetRecipients, defaultSubject, defaultBody, uniqueUrl)}
                        disabled={targetRecipients.length === 0 || isDispatchingNotify}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        {isDispatchingNotify ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        <span>
                          {isDispatchingNotify
                            ? (isNl ? 'Verzenden...' : 'Sending...')
                            : (isNl ? `Verstuur (${targetRecipients.length})` : `Send (${targetRecipients.length})`)}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TaskManagerBoard;
