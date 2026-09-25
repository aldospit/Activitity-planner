import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskCategory, Attachment } from '../types';
import { dbService, isSampleTask } from '../services/db';
import { 
  getISOWeek, 
  getISOWeekYear, 
  getWeekDates, 
  formatDateString 
} from '../utils/dateUtils';
import { 
  Calendar, Plus, Trash2, Edit2, Check, CheckSquare, 
  Square, Star, Tag, Sliders, Settings, Search, 
  Archive, Trello, ChevronLeft, ChevronRight, X, 
  Clock, RefreshCw, Layers, ArrowUpRight, CheckSquare2, ListTodo, Paperclip, FileText, Download
} from 'lucide-react';

interface WeekplannerProps {
  lang: 'nl' | 'en';
}

export default function Weekplanner({ lang }: WeekplannerProps) {
  const isNl = lang === 'nl';

  // --- Core State Variables ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  
  // --- View states ---
  // views: 'planner' (agenda/days grid), 'board' (kanban columns), 'archive' (completed tasks list), 'list' (all active tasks filterable list)
  const [activeView, setActiveView] = useState<'planner' | 'board' | 'archive' | 'list'>('planner');
  const [showSettings, setShowSettings] = useState(false);

  // --- Date navigation states ---
  const [currentDateState, setCurrentDateState] = useState<Date>(() => new Date());
  const currentWeek = getISOWeek(currentDateState);
  const currentYear = getISOWeekYear(currentDateState);
  const weekDates = getWeekDates(currentYear, currentWeek);

  // --- Task Modal / Editing states ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // --- New / Edited Task Form States ---
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStartDate, setTaskStartDate] = useState(() => formatDateString(new Date()));
  const [taskEndDate, setTaskEndDate] = useState<string>('');
  const [taskStatusId, setTaskStatusId] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState('');
  const [taskPriority, setTaskPriority] = useState(false);
  const [taskIsCalendarItem, setTaskIsCalendarItem] = useState(false);
  const [taskStartTime, setTaskStartTime] = useState<string>('');
  const [taskEndTime, setTaskEndTime] = useState<string>('');
  const [taskRecurrence, setTaskRecurrence] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [taskAttachments, setTaskAttachments] = useState<Attachment[]>([]);

  // --- Quick Add Form states ---
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategoryId, setQuickCategoryId] = useState('');

  // --- Filter and Search States (for Unfinished and Scheduled lists) ---
  const [uncompletedSearch, setUncompletedSearch] = useState('');
  const [uncompletedSort, setUncompletedSort] = useState<'date' | 'alphabetical' | 'priority'>('priority');

  const [scheduledSearch, setScheduledSearch] = useState('');
  const [scheduledSort, setScheduledSort] = useState<'date' | 'alphabetical' | 'priority'>('date');

  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFilterCategory, setArchiveFilterCategory] = useState<string>('all');

  // --- Takenlijst (Task List) Views States ---
  const [listSearch, setListSearch] = useState('');
  const [listFilterCategory, setListFilterCategory] = useState<string>('all');
  const [listFilterStatus, setListFilterStatus] = useState<string>('all');
  const [listSortField, setListSortField] = useState<'title' | 'startDate' | 'endDate' | 'category' | 'status'>('startDate');
  const [listSortDirection, setListSortDirection] = useState<'asc' | 'desc'>('asc');

  // --- Custom Entities Form States ---
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('blue');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('indigo');

  // --- Custom Entities Editing States ---
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [editingStatusColor, setEditingStatusColor] = useState('blue');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('indigo');

  // --- Dynamic Column Widening States ---
  const [activeDayWidthIndex, setActiveDayWidthIndex] = useState<number>(0);

  useEffect(() => {
    const todayStr = formatDateString(new Date());
    const todayIndex = weekDates.findIndex(date => formatDateString(date) === todayStr);
    if (todayIndex !== -1) {
      setActiveDayWidthIndex(todayIndex > 4 ? 5 : todayIndex);
    } else {
      setActiveDayWidthIndex(0);
    }
  }, [currentWeek, currentYear]);

  // --- Load Data & Real-Time Sync Subscription ---
  const loadData = () => {
    const allTasks = dbService.getTasks();
    setTasks(allTasks.filter(t => t.showInWeekPlanner !== false));
    
    const dbStatuses = dbService.getTaskStatuses();
    setStatuses(dbStatuses);
    
    const dbCategories = dbService.getTaskCategories();
    setCategories(dbCategories);

    // Safeguard selected IDs against background upgrades or deletions
    setTaskStatusId(current => {
      if (current && !dbStatuses.some(s => s.id === current) && dbStatuses.length > 0) {
        return dbStatuses[0].id;
      }
      return current || (dbStatuses[0]?.id || '');
    });

    setTaskCategoryId(current => {
      if (current && !dbCategories.some(c => c.id === current) && dbCategories.length > 0) {
        return dbCategories[0].id;
      }
      return current || (dbCategories[0]?.id || '');
    });
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const handleCleanSampleTasks = async () => {
    const count = await dbService.cleanSampleTasks();
    loadData();
    if (count > 0) {
      alert(isNl ? `${count} voorbeeldtaak/taken succesvol verwijderd.` : `${count} sample task(s) removed.`);
    }
  };

  // Update default selectors once statuses/categories are resolved
  useEffect(() => {
    if (statuses.length > 0 && !taskStatusId) {
      setTaskStatusId(statuses[0].id);
    }
    if (categories.length > 0) {
      if (!taskCategoryId) {
        setTaskCategoryId(categories[0].id);
      }
      if (!quickCategoryId) {
        setQuickCategoryId(categories[0].id);
      }
    }
  }, [statuses, categories, taskStatusId, taskCategoryId, quickCategoryId]);

  // --- Date Math Helpers ---
  const handlePrevWeek = () => {
    const prev = new Date(currentDateState.getTime());
    prev.setDate(prev.getDate() - 7);
    setCurrentDateState(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDateState.getTime());
    next.setDate(next.getDate() + 7);
    setCurrentDateState(next);
  };

  const handleCurrentWeek = () => {
    setCurrentDateState(new Date());
  };

  // --- Safe Native Browser Dialogs and Skew-Free Date Parsing ---
  const parseDateString = (str: string): Date => {
    const parts = (str || '').split('-');
    if (parts.length !== 3) return new Date();
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  const safeAlert = (message: string) => {
    try {
      window.alert(message);
    } catch (e) {
      console.warn("Alert blocked:", message);
    }
  };

  const safeConfirm = (message: string): boolean => {
    try {
      return window.confirm(message);
    } catch (e) {
      return true; // default proceed in sandbox wrappers if blocked
    }
  };

  // --- Task Modallers & CRUD ---
  const openNewTaskModal = (selectedDate?: string) => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskStartDate(selectedDate || formatDateString(new Date()));
    setTaskEndDate('');
    setTaskStatusId(statuses[0]?.id || '');
    setTaskCategoryId(categories[0]?.id || '');
    setTaskPriority(false);
    setTaskIsCalendarItem(false);
    setTaskStartTime('09:00');
    setTaskEndTime('10:00');
    setTaskRecurrence('none');
    setTaskAttachments([]);
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title || '');
    setTaskDescription(task.description || '');
    setTaskStartDate(task.startDate || '');
    setTaskEndDate(task.endDate || '');
    setTaskStatusId(task.statusId || '');
    setTaskCategoryId(task.categoryId || '');
    setTaskPriority(!!task.priority);
    setTaskIsCalendarItem(!!task.isCalendarItem);
    setTaskStartTime(task.startTime || '09:00');
    setTaskEndTime(task.endTime || '10:00');
    setTaskRecurrence(task.recurrence || 'none');
    setTaskAttachments(task.attachments || []);
    setIsTaskModalOpen(true);
  };

  const handleSaveTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskTitle.trim()) {
      safeAlert(isNl ? 'Titel is verplicht!' : 'Title is required!');
      return;
    }

    const taskId = editingTask ? editingTask.id : 'task-' + Math.random().toString(36).substr(2, 9);
    
    const startObj = taskStartDate ? parseDateString(taskStartDate) : null;
    const recurrenceDay = startObj ? startObj.getDay() : null;

    const updatedTask: Task = {
      ...(editingTask || {}),
      id: taskId,
      title: taskTitle.trim(),
      description: (taskDescription || '').trim(),
      startDate: taskStartDate ? taskStartDate : '',
      endDate: taskEndDate ? taskEndDate : null,
      completed: editingTask ? editingTask.completed : false,
      archived: editingTask ? editingTask.archived : false,
      priority: !!taskPriority,
      statusId: taskStatusId,
      categoryId: taskCategoryId,
      isCalendarItem: !!taskIsCalendarItem,
      startTime: taskIsCalendarItem ? taskStartTime : null,
      endTime: taskIsCalendarItem ? taskEndTime : null,
      recurrence: taskRecurrence,
      recurrenceDay: taskRecurrence !== 'none' ? recurrenceDay : null,
      recurrenceExceptions: editingTask?.recurrenceExceptions || [],
      attachments: taskAttachments,
    };

    // Close modal instantly for snappy UX
    setIsTaskModalOpen(false);
    setEditingTask(null);

    await dbService.saveTask(updatedTask);
  };

  const handleSaveAndAddAnother = async () => {
    if (!taskTitle || !taskTitle.trim()) {
      safeAlert(isNl ? 'Titel is verplicht!' : 'Title is required!');
      return;
    }

    const taskId = 'task-' + Math.random().toString(36).substr(2, 9);
    const startObj = taskStartDate ? parseDateString(taskStartDate) : null;
    const recurrenceDay = startObj ? startObj.getDay() : null;

    const updatedTask: Task = {
      id: taskId,
      title: taskTitle.trim(),
      description: (taskDescription || '').trim(),
      startDate: taskStartDate ? taskStartDate : '',
      endDate: taskEndDate ? taskEndDate : null,
      completed: false,
      archived: false,
      priority: !!taskPriority,
      statusId: taskStatusId,
      categoryId: taskCategoryId,
      isCalendarItem: !!taskIsCalendarItem,
      startTime: taskIsCalendarItem ? taskStartTime : null,
      endTime: taskIsCalendarItem ? taskEndTime : null,
      recurrence: taskRecurrence,
      recurrenceDay: taskRecurrence !== 'none' ? recurrenceDay : null,
      recurrenceExceptions: [],
      attachments: taskAttachments,
    };

    await dbService.saveTask(updatedTask);

    // Clear form fields for next task creation
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority(false);
    setTaskIsCalendarItem(false);
    setTaskAttachments([]);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    const catId = quickCategoryId || (categories.length > 0 ? categories[0].id : '');
    const todayStr = formatDateString(new Date());

    const newTask: Task = {
      id: 'task-' + Math.random().toString(36).substr(2, 9),
      title: quickTitle.trim(),
      description: '',
      startDate: todayStr,
      endDate: null,
      completed: false,
      archived: false,
      priority: false,
      statusId: statuses.length > 0 ? statuses[0].id : '',
      categoryId: catId,
      isCalendarItem: false,
      startTime: null,
      endTime: null,
      recurrence: 'none',
      recurrenceDay: null,
      recurrenceExceptions: [],
    };

    await dbService.saveTask(newTask);
    setQuickTitle('');
  };

  const handleDeleteTask = async (id: string) => {
    const confirmMessage = isNl 
      ? 'Weet u zeker dat u deze taak wilt verwijderen?' 
      : 'Are you sure you want to delete this task?';
    if (safeConfirm(confirmMessage)) {
      setIsTaskModalOpen(false);
      setEditingTask(null);
      await dbService.deleteTask(id);
    }
  };

  const handleClearWholeArchive = async () => {
    const confirmMessage = isNl
      ? 'Weet u zeker dat u het HELE archief van afgeronde taken wilt opschonen? Alle gearchiveerde en afgeronde taken worden permanent verwijderd.'
      : 'Are you sure you want to clear the WHOLE archive of completed tasks? All completed and archived tasks will be permanently deleted.';
    if (safeConfirm(confirmMessage)) {
      const archivedTasks = tasks.filter(t => t.completed || t.archived);
      await Promise.all(
        archivedTasks.map(async (t) => {
          try {
            await dbService.deleteTask(t.id);
          } catch (err) {
            console.error(`Failed to delete archived task ${t.id}:`, err);
          }
        })
      );
    }
  };

  // Checking off a task
  const handleToggleCompleted = async (task: Task, dateStr: string) => {
    const isRecurring = task.recurrence !== 'none';

    if (isRecurring) {
      // Complete individual recurrence instance
      const exceptions = task.recurrenceExceptions || [];
      const updatedExceptions = [...exceptions, dateStr];

      // Save updated parent task with exception
      await dbService.saveTask({
        ...task,
        recurrenceExceptions: updatedExceptions
      });

      // Save a local independent archived footprint for history Log
      const completedInstanceId = `completed-${task.id}-${dateStr}`;
      await dbService.saveTask({
        id: completedInstanceId,
        title: `${task.title} (${isNl ? 'Herhaling' : 'Recurrence'} - ${dateStr})`,
        description: task.description,
        startDate: dateStr,
        endDate: dateStr,
        completed: true,
        archived: true,
        priority: task.priority,
        statusId: task.statusId,
        categoryId: task.categoryId,
        isCalendarItem: task.isCalendarItem,
        startTime: task.startTime,
        endTime: task.endTime,
        recurrence: 'none',
        recurrenceDay: null,
        recurrenceExceptions: []
      });
    } else {
      // Toggle standard task
      const updated: Task = {
        ...task,
        completed: !task.completed,
        archived: !task.completed, // auto archive standard non-recurrent task when completed
      };
      await dbService.saveTask(updated);
    }
  };

  const handleRestoreTask = async (task: Task) => {
    // If it's a generated recurring instance: completed-PARENTID-YYYY-MM-DD
    if (task.id.startsWith('completed-')) {
      const parts = task.id.split('-');
      // originalId format: parts[1] (sometimes contains multiple dashes if we used random tokens)
      // Best to search parent task matching title or description, or stripPrefix
      // Let's find if we can parse the parent taskId and dateStr:
      // ID scheme: completed-PARENTID-YYYY-MM-DD
      const dateStr = parts.slice(-3).join('-'); // YYYY-MM-DD is always last 3 elements
      const parentId = task.id.replace('completed-', '').replace(`-${dateStr}`, '');

      const parentTask = tasks.find(t => t.id === parentId);
      if (parentTask) {
        const exceptions = parentTask.recurrenceExceptions || [];
        const updatedExceptions = exceptions.filter(exc => exc !== dateStr);
        await dbService.saveTask({
          ...parentTask,
          recurrenceExceptions: updatedExceptions
        });
      }

      await dbService.deleteTask(task.id);
    } else {
      // Normal task restore
      const updated: Task = {
        ...task,
        completed: false,
        archived: false,
      };
      await dbService.saveTask(updated);
    }
  };

  // --- Dynamic Recurrence Calculator ---
  const getTasksScheduledForDate = (date: Date): Task[] => {
    const dateStr = formatDateString(date);
    const dateMs = date.getTime();

    return tasks.filter(task => {
      if (task.archived) return false;
      if (!task.startDate) return false;

      // Handle standard exceptions (when this instance has been deleted/checked off)
      if (task.recurrenceExceptions && task.recurrenceExceptions.includes(dateStr)) {
        return false;
      }

      const tStart = new Date(task.startDate);
      tStart.setHours(0,0,0,0);
      const tStartMs = tStart.getTime();

      const tEnd = task.endDate ? new Date(task.endDate) : null;
      if (tEnd) tEnd.setHours(0,0,0,0);
      const tEndMs = tEnd ? tEnd.getTime() : tStartMs;

      if (task.recurrence === 'none') {
        if (task.endDate) {
          // Span multi-days
          return dateMs >= tStartMs && dateMs <= tEndMs;
        } else {
          return dateStr === task.startDate;
        }
      } else if (task.recurrence === 'weekly') {
        // On or after start date and weekday matches
        if (dateMs >= tStartMs) {
          return date.getDay() === tStart.getDay();
        }
      } else if (task.recurrence === 'monthly') {
        // On or after start date and day of month matches
        if (dateMs >= tStartMs) {
          return date.getDate() === tStart.getDate();
        }
      }
      return false;
    });
  };

  // --- Native Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.setData('text', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (err) {}
  };

  const handleDropOnDate = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Shift start date
    const targetDate = parseDateString(targetDateStr);
    let updatedEndDate: string | null = null;
    if (task.startDate) {
      const taskStartDateObj = parseDateString(task.startDate);
      const offsetDiff = targetDate.getTime() - taskStartDateObj.getTime();
      
      if (task.endDate) {
        const originalEnd = parseDateString(task.endDate);
        const newEnd = new Date(originalEnd.getTime() + offsetDiff);
        updatedEndDate = formatDateString(newEnd);
      }
    }

    const updatedTask: Task = {
      ...task,
      startDate: targetDateStr,
      endDate: updatedEndDate,
      recurrenceDay: task.recurrence !== 'none' ? targetDate.getDay() : null,
    };

    await dbService.saveTask(updatedTask);
  };

  const handleDropOnStatus = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask: Task = {
      ...task,
      statusId: statusId
    };

    await dbService.saveTask(updatedTask);
  };

  // --- Entity Management (Settings Panel) ---
  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;

    const id = 'status-' + Math.random().toString(36).substr(2, 9);
    const order = statuses.length;

    await dbService.saveTaskStatus({
      id,
      name: newStatusName.trim(),
      color: newStatusColor,
      order
    });

    setNewStatusName('');
  };

  const handleDeleteStatus = async (id: string) => {
    if (statuses.length <= 1) {
      safeAlert(isNl ? 'U moet minimaal één status behouden.' : 'You must retain at least one status.');
      return;
    }
    const inUse = tasks.some(t => t.statusId === id);
    if (inUse) {
      safeAlert(isNl 
        ? 'Deze status is momenteel in gebruik door actieve taken en kan niet worden verwijderd.' 
        : 'This status is currently assigned to tasks and cannot be deleted.');
      return;
    }
    await dbService.deleteTaskStatus(id);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const id = 'cat-' + Math.random().toString(36).substr(2, 9);

    await dbService.saveTaskCategory({
      id,
      name: newCategoryName.trim(),
      color: newCategoryColor
    });

    setNewCategoryName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (categories.length <= 1) {
      safeAlert(isNl ? 'U moet minimaal één categorie behouden.' : 'You must retain at least one category.');
      return;
    }
    const inUse = tasks.some(t => t.categoryId === id);
    if (inUse) {
      safeAlert(isNl 
        ? 'Deze categorie is momenteel in gebruik door actieve taken en kan niet worden verwijderd.' 
        : 'This category is currently assigned to tasks and cannot be deleted.');
      return;
    }
    await dbService.deleteTaskCategory(id);
  };

  const handleSaveStatusEdit = async (id: string) => {
    if (!editingStatusName.trim()) {
      safeAlert(isNl ? 'Statusnaam mag niet leeg zijn.' : 'Status name cannot be empty.');
      return;
    }
    const existing = statuses.find(s => s.id === id);
    if (!existing) return;

    await dbService.saveTaskStatus({
      ...existing,
      name: editingStatusName.trim(),
      color: editingStatusColor
    });
    setEditingStatusId(null);
  };

  const handleSaveCategoryEdit = async (id: string) => {
    if (!editingCategoryName.trim()) {
      safeAlert(isNl ? 'Categorienaam mag niet leeg zijn.' : 'Category name cannot be empty.');
      return;
    }
    const existing = categories.find(c => c.id === id);
    if (!existing) return;

    await dbService.saveTaskCategory({
      ...existing,
      name: editingCategoryName.trim(),
      color: editingCategoryColor
    });
    setEditingCategoryId(null);
  };

  // --- Dynamic Queries & Sidepanel Lists ---
  const todayString = formatDateString(new Date());

  // Past unfinished tasks (Excluding archived, completed)
  const filteredUnfinished = tasks.filter(t => {
    if (t.completed || t.archived) return false;
    
    // Recurring tasks don't have isPast state easily. One-off tasks:
    if (t.recurrence === 'none') {
      const isPast = t.startDate < todayString;
      if (!isPast) return false;
    } else {
      // Recurring tasks are always conceptually active and not "past due".
      return false;
    }

    if (uncompletedSearch.trim()) {
      const query = uncompletedSearch.toLowerCase();
      return t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query);
    }
    return true;
  }).sort((a, b) => {
    if (uncompletedSort === 'priority') {
      return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
    }
    if (uncompletedSort === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return a.startDate.localeCompare(b.startDate);
  });

  // Upcoming scheduled tasks (present/future)
  const filteredScheduled = tasks.filter(t => {
    if (t.completed || t.archived) return false;
    
    // Regular active/future series
    const isFutureOrPresent = t.startDate >= todayString || t.recurrence !== 'none';
    if (!isFutureOrPresent) return false;

    if (scheduledSearch.trim()) {
      const query = scheduledSearch.toLowerCase();
      return t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query);
    }
    return true;
  }).sort((a, b) => {
    if (scheduledSort === 'priority') {
      return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
    }
    if (scheduledSort === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return a.startDate.localeCompare(b.startDate);
  });

  // Archived complete tasks
  const filteredArchive = tasks.filter(t => {
    if (!t.completed && !t.archived) return false;

    if (archiveFilterCategory !== 'all' && t.categoryId !== archiveFilterCategory) {
      return false;
    }

    if (archiveSearch.trim()) {
      const q = archiveSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  }).sort((a,b) => b.startDate.localeCompare(a.startDate));

  // --- Filtered and Sorted Active Tasks List ---
  const filteredActiveTasks = tasks.filter(t => {
    // Only return unarchived tasks
    if (t.archived) return false;

    // Search query matching
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc) return false;
    }

    // Category filter matching
    if (listFilterCategory !== 'all' && t.categoryId !== listFilterCategory) {
      return false;
    }

    // Status filter matching
    if (listFilterStatus !== 'all' && t.statusId !== listFilterStatus) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    let check = 0;
    
    if (listSortField === 'title') {
      check = a.title.localeCompare(b.title);
    } else if (listSortField === 'startDate') {
      check = a.startDate.localeCompare(b.startDate);
    } else if (listSortField === 'endDate') {
      const endA = a.endDate || '';
      const endB = b.endDate || '';
      check = endA.localeCompare(endB);
    } else if (listSortField === 'category') {
      const catA = categories.find(c => c.id === a.categoryId)?.name || '';
      const catB = categories.find(c => c.id === b.categoryId)?.name || '';
      check = catA.localeCompare(catB);
    } else if (listSortField === 'status') {
      const statA = statuses.find(s => s.id === a.statusId)?.name || '';
      const statB = statuses.find(s => s.id === b.statusId)?.name || '';
      check = statA.localeCompare(statB);
    }

    return listSortDirection === 'asc' ? check : -check;
  });

  // --- Constants mapping for colors ---
  const getTailwindBgPrefix = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'rose': return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'violet': return 'bg-violet-50 border-violet-200 text-violet-700';
      case 'amber': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'emerald': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'blue': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'pink': return 'bg-pink-50 border-pink-200 text-pink-700';
      case 'orange': return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'green': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getTailwindBadgeStyle = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-600';
      case 'rose': return 'bg-rose-600';
      case 'violet': return 'bg-violet-600';
      case 'amber': return 'bg-amber-500';
      case 'emerald': return 'bg-emerald-600';
      case 'blue': return 'bg-blue-600';
      case 'pink': return 'bg-pink-600';
      case 'orange': return 'bg-orange-500';
      case 'green': return 'bg-emerald-600';
      default: return 'bg-slate-600';
    }
  };

  return (
    <div className="space-y-6" id="weekplanner-root">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare2 className="h-6 w-6 text-indigo-600" />
            {isNl ? 'Weekplanner' : 'Week Planner'}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isNl 
              ? 'Plan uw wekelijkse taken, bekijk uw agenda en groepeer taken in kolommen.'
              : 'Plan your weekly tasks, access your agenda, and arrange tasks in columns.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggles */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
            <button
              onClick={() => setActiveView('planner')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'planner' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {isNl ? 'Planner' : 'Planner'}
            </button>
            <button
              onClick={() => setActiveView('board')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trello className="h-3.5 w-3.5" />
              {isNl ? 'Trello Bord' : 'Kanban Board'}
            </button>
            <button
              onClick={() => setActiveView('archive')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'archive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              {isNl ? 'Archief' : 'Archive'}
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListTodo className="h-3.5 w-3.5" />
              {isNl ? 'Takenlijst' : 'Task List'}
            </button>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
            title={isNl ? 'Beheer Statussen & Categorieën' : 'Manage Statuses & Categories'}
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={() => openNewTaskModal()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {isNl ? 'Taak toevoegen' : 'Add Task'}
          </button>
        </div>
      </div>

      {/* Settings Panel Expansion (For Custom Category / Status lanes) */}
      {showSettings && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-md grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-250">
          
          {/* Status Beheer */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-slate-500" />
              {isNl ? 'Beheer Statussen (Trello Kolommen)' : 'Manage Status lanes'}
            </h3>

            {/* List Statuses */}
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => {
                const isEditing = editingStatusId === s.id;
                if (isEditing) {
                  return (
                    <div key={s.id} className="inline-flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-md animate-in zoom-in-95 duration-150">
                      <input 
                        type="text" 
                        value={editingStatusName} 
                        onChange={e => setEditingStatusName(e.target.value)} 
                        className="text-xs px-1.5 py-0.5 rounded border border-slate-300 focus:outline-indigo-600 max-w-[100px]"
                        autoFocus
                      />
                      <select
                        value={editingStatusColor}
                        onChange={e => setEditingStatusColor(e.target.value)}
                        className="text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white font-medium text-slate-700"
                      >
                        <option value="blue">Blauw</option>
                        <option value="orange">Oranje</option>
                        <option value="green">Groen</option>
                        <option value="amber">Amber</option>
                        <option value="rose">Rose</option>
                      </select>
                      <button 
                        onClick={() => handleSaveStatusEdit(s.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                        title={isNl ? 'Opslaan' : 'Save'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => setEditingStatusId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title={isNl ? 'Annuleren' : 'Cancel'}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                }
                return (
                  <span 
                    key={s.id} 
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border ${getTailwindBgPrefix(s.color)}`}
                  >
                    {s.name}
                    <button 
                      onClick={() => {
                        setEditingStatusId(s.id);
                        setEditingStatusName(s.name);
                        setEditingStatusColor(s.color);
                      }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors ml-1 cursor-pointer"
                      title={isNl ? 'Bewerken' : 'Edit'}
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteStatus(s.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title={isNl ? 'Verwijderen' : 'Delete'}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Form to Create Status */}
            <form onSubmit={handleAddStatus} className="flex gap-2">
              <input 
                type="text" 
                placeholder={isNl ? 'Nieuwe statusnaam...' : 'New status name...'}
                value={newStatusName}
                onChange={e => setNewStatusName(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-indigo-600"
              />
              <select
                value={newStatusColor}
                onChange={e => setNewStatusColor(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2"
              >
                <option value="blue">Blauw</option>
                <option value="orange">Oranje</option>
                <option value="green">Groen</option>
                <option value="amber">Amber</option>
                <option value="rose">Rose</option>
              </select>
              <button 
                type="submit" 
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                +
              </button>
            </form>
          </div>

          {/* Category Beheer */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-slate-500" />
              {isNl ? 'Beheer Categorieën (Labels)' : 'Manage Categories'}
            </h3>

            {/* List Categories */}
            <div className="flex flex-wrap gap-2">
              {categories.map(c => {
                const isEditing = editingCategoryId === c.id;
                if (isEditing) {
                  return (
                    <div key={c.id} className="inline-flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-md animate-in zoom-in-95 duration-150">
                      <input 
                        type="text" 
                        value={editingCategoryName} 
                        onChange={e => setEditingCategoryName(e.target.value)} 
                        className="text-xs px-1.5 py-0.5 rounded border border-slate-300 focus:outline-indigo-600 max-w-[100px]"
                        autoFocus
                      />
                      <select
                        value={editingCategoryColor}
                        onChange={e => setEditingCategoryColor(e.target.value)}
                        className="text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white font-medium text-slate-700"
                      >
                        <option value="indigo">Indigo</option>
                        <option value="rose">Rose</option>
                        <option value="violet">Violet</option>
                        <option value="amber">Amber</option>
                        <option value="emerald">Smaragd</option>
                        <option value="pink">Roze</option>
                      </select>
                      <button 
                        onClick={() => handleSaveCategoryEdit(c.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                        title={isNl ? 'Opslaan' : 'Save'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => setEditingCategoryId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title={isNl ? 'Annuleren' : 'Cancel'}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                }
                return (
                  <span 
                    key={c.id} 
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border ${getTailwindBgPrefix(c.color)}`}
                  >
                    {c.name}
                    <button 
                      onClick={() => {
                        setEditingCategoryId(c.id);
                        setEditingCategoryName(c.name);
                        setEditingCategoryColor(c.color);
                      }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors ml-1 cursor-pointer"
                      title={isNl ? 'Bewerken' : 'Edit'}
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteCategory(c.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title={isNl ? 'Verwijderen' : 'Delete'}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Form to Create Category */}
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input 
                type="text" 
                placeholder={isNl ? 'Nieuwe categorie...' : 'New category name...'}
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-indigo-600"
              />
              <select
                value={newCategoryColor}
                onChange={e => setNewCategoryColor(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2"
              >
                <option value="indigo">Indigo</option>
                <option value="rose">Rose</option>
                <option value="violet">Violet</option>
                <option value="amber">Amber</option>
                <option value="emerald">Smaragd</option>
                <option value="pink">Roze</option>
              </select>
              <button 
                type="submit" 
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                +
              </button>
            </form>
          </div>

        </div>
      )}

      {/* VIEW 1: WEEK CALENDAR PLANNER */}
      {activeView === 'planner' && (
        <div className="space-y-6">
          
          {/* Calendar Days Grid (Full Width for Maximum Readability) */}
          <div className="space-y-4">
            
            {/* Week Selector bar */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-150">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevWeek}
                  className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title={isNl ? 'Vorige Week' : 'Previous Week'}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title={isNl ? 'Volgende Week' : 'Next Week'}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                <h2 className="text-sm font-bold text-slate-700 ml-2">
                  {isNl ? `Week ${currentWeek}` : `Week ${currentWeek}`}, {currentYear}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {tasks.some(t => isSampleTask(t)) && (
                  <button
                    onClick={handleCleanSampleTasks}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    title={isNl ? 'Voorbeeldtaken definitief verwijderen' : 'Remove sample tasks'}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>{isNl ? 'Voorbeeldtaken wissen' : 'Purge sample tasks'}</span>
                  </button>
                )}
                <button
                  onClick={handleCurrentWeek}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {isNl ? 'Vandaag' : 'Today'}
                </button>
              </div>
            </div>

            {/* Empty state banner */}
            {tasks.filter(t => !t.archived).length === 0 && (
              <div className="p-3.5 mb-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-slate-700 text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>
                    {isNl 
                      ? 'Geen actieve taken gevonden voor deze periode. Klik op "+ Taak" om een nieuwe taak aan te maken.' 
                      : 'No active tasks found for this period. Click "+ Task" to create a new task.'}
                  </span>
                </div>
                <button
                  onClick={() => openNewTaskModal()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shrink-0 cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isNl ? 'Nieuwe taak' : 'New task'}
                </button>
              </div>
            )}

            {/* Grid structure: 5 weekdays + 1 weekend column containing Sat and Sun stacked */}
            <div className="flex flex-col md:flex-row md:items-stretch gap-2 w-full">
              
              {/* Monday to Friday rendered as full height lanes */}
              {weekDates.slice(0, 5).map((date, idx) => {
                const dayName = date.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { weekday: 'long' });
                const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                const isToday = formatDateString(date) === formatDateString(new Date());
                const dateStr = formatDateString(date);
                const dayTasks = getTasksScheduledForDate(date);

                // Group tasks: Calendar items (with start/end times at top) and normal items
                const calendarItems = dayTasks.filter(t => t.isCalendarItem).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
                const normalItems = dayTasks.filter(t => !t.isCalendarItem);

                const isColumnActive = activeDayWidthIndex === idx;

                return (
                  <div 
                    key={idx}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDate(e, dateStr)}
                    onClick={() => setActiveDayWidthIndex(idx)}
                    className={`bg-white rounded-xl border min-h-[360px] p-2 flex flex-col transition-all duration-300 cursor-pointer ${
                      isColumnActive 
                        ? 'md:flex-[1.9] md:min-w-[195px] ring-2 ring-indigo-100 shadow-sm border-indigo-400 bg-indigo-50/10' 
                        : isToday 
                          ? 'md:flex-[0.82] md:min-w-[100px] border-indigo-300 ring-1 ring-indigo-100 bg-indigo-50/5' 
                          : 'md:flex-[0.82] md:min-w-[100px] border-slate-100 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    {/* Header */}
                    <div className="pb-1 border-b border-slate-100 mb-1.5 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-black tracking-wide uppercase ${isToday ? 'text-indigo-600 font-extrabold' : 'text-slate-505'}`}>
                            {capitalizedDay}
                          </span>
                          {dayTasks.some(t => t.startDate && t.endDate) && (
                            <span 
                              className="w-2 h-2 rounded bg-indigo-500 border border-indigo-600 shrink-0 self-center cursor-help animate-pulse" 
                              title={isNl ? 'Geplande taak met een begin- en einddatum' : 'Scheduled task with set start & end dates'}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-bold text-[9px]">
                            {date.getDate()} {date.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { month: 'short' })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewTaskModal(dateStr);
                            }}
                            className="p-0.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title={isNl ? 'Taak toevoegen' : 'Add task'}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Draggable Area & Items container */}
                    <div 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnDate(e, dateStr)}
                      className="flex-1 space-y-1.5 overflow-y-auto max-h-[320px]"
                    >
                      
                      {/* 1. AGENDAS (CALENDAR ITEMS) AT THE TOP */}
                      {calendarItems.length > 0 && (
                        <div className="space-y-1 pb-1">
                          {calendarItems.map(t => {
                            const cat = categories.find(c => c.id === t.categoryId);
                            return (
                              <div
                                key={t.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, t.id)}
                                onClick={() => openEditTaskModal(t)}
                                className={`p-1 rounded bg-slate-900 text-white border-l-2 border-l-amber-400 transition-all cursor-pointer ${
                                  t.priority ? 'ring-1 ring-amber-300' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[7.5px] font-black text-amber-300 flex items-center gap-0.5 truncate">
                                    <Clock className="h-1.5 w-1.5" />
                                    {t.startTime}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {t.attachments && t.attachments.length > 0 && (
                                      <span className="text-[7.5px] text-amber-300" title={`${t.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>📎</span>
                                    )}
                                    {t.priority && <Star className="h-1.5 w-1.5 fill-amber-400 text-amber-400 shrink-0" />}
                                  </div>
                                </div>
                                <h4 className="text-[9px] font-bold truncate tracking-tight text-white/95 mt-0.5">
                                  {t.title}
                                </h4>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Divider if we have both */}
                      {calendarItems.length > 0 && normalItems.length > 0 && (
                        <div className="border-t border-dashed border-slate-100 my-1" />
                      )}

                      {/* 2. REGULAR TASKS */}
                      {normalItems.length === 0 && calendarItems.length === 0 ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            openNewTaskModal(dateStr);
                          }}
                          className="h-full min-h-[80px] flex flex-col items-center justify-center text-slate-350 hover:text-indigo-600 cursor-pointer rounded-lg hover:bg-indigo-50/40 border border-dashed border-slate-150 hover:border-indigo-200 transition-all group"
                        >
                          <Plus className="h-3.5 w-3.5 mb-0.5 text-slate-400 group-hover:text-indigo-600" />
                          <span className="text-[8.5px] font-bold text-center text-slate-400 group-hover:text-indigo-600">{isNl ? 'Taak toevoegen' : 'Add task'}</span>
                        </div>
                      ) : (
                        <>
                          {normalItems.map(t => {
                            const isCompleted = t.completed;
                            return (
                              <div
                                key={t.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, t.id)}
                                onClick={() => openEditTaskModal(t)}
                                className={`p-1 px-1.5 rounded-md border border-slate-150 bg-white hover:bg-slate-50 hover:border-indigo-250 transition-all flex items-center justify-between gap-1.5 cursor-pointer relative group ${
                                  t.priority ? 'border-amber-300 ring-1 ring-amber-200/50 bg-amber-50/10' : ''
                                } ${isCompleted ? 'opacity-55' : ''}`}
                                title={`${t.title}${t.description ? ` - ${t.description}` : ''}`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleCompleted(t, dateStr);
                                    }}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                                  >
                                    {isCompleted ? (
                                      <CheckSquare2 className="h-2.8 w-2.8 text-emerald-500 fill-emerald-50" />
                                    ) : (
                                      <Square className="h-2.8 w-2.8 text-slate-400" />
                                    )}
                                  </button>
                                  
                                  <div className="flex items-center gap-1 min-w-0 flex-1 select-none">
                                    {t.priority && (
                                      <span className="text-amber-600 font-extrabold text-[8px] tracking-tight uppercase shrink-0">
                                        [PRIO]
                                      </span>
                                    )}
                                    {t.recurrence !== 'none' && (
                                      <span className="text-blue-600 font-extrabold text-[8px] tracking-tight uppercase shrink-0">
                                        [{isNl ? 'HERH' : 'HERH'}]
                                      </span>
                                    )}
                                    <span className={`text-[9.5px] font-medium text-slate-700 line-clamp-2 leading-tight break-words tracking-tight ${
                                      isCompleted ? 'line-through text-slate-400 font-normal' : t.priority ? 'text-amber-950 font-bold' : ''
                                    }`}>
                                      {t.title}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 select-none">
                                  {t.attachments && t.attachments.length > 0 && (
                                    <span className="text-[7.5px] text-indigo-500 font-bold flex items-center" title={`${t.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>📎</span>
                                  )}
                                  {t.priority && (
                                    <Star className="h-2 w-2 fill-amber-500 text-amber-500 shrink-0" />
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewTaskModal(dateStr);
                            }}
                            className="w-full mt-1.5 py-1 px-1.5 text-[8.5px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 rounded-md border border-dashed border-slate-200 hover:border-indigo-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            <span>{isNl ? 'Taak toevoegen' : 'Add task'}</span>
                          </button>
                        </>
                      )}

                    </div>
                  </div>
                );
              })}

              {/* Saturday and Sunday (Stacked column to fulfill under each other spacing requirement) */}
              <div 
                onClick={() => setActiveDayWidthIndex(5)}
                className={`flex flex-col gap-2 min-h-[365px] transition-all duration-300 cursor-pointer ${
                  activeDayWidthIndex === 5 
                    ? 'md:flex-[1.9] md:min-w-[195px] ring-2 ring-indigo-100 shadow-sm border-indigo-400 bg-indigo-50/10 p-1 rounded-2xl' 
                    : 'md:flex-[0.82] md:min-w-[100px]'
                }`}
              >
                
                {/* Saturday Loop */}
                {[weekDates[5], weekDates[6]].map((date, sIdx) => {
                  const dayName = date.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { weekday: 'long' });
                  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                  const isToday = formatDateString(date) === formatDateString(new Date());
                  const dateStr = formatDateString(date);
                  const dayTasks = getTasksScheduledForDate(date);

                  const calendarItems = dayTasks.filter(t => t.isCalendarItem).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
                  const normalItems = dayTasks.filter(t => !t.isCalendarItem);

                  return (
                    <div 
                      key={sIdx}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnDate(e, dateStr)}
                      className={`bg-white rounded-xl border p-2 flex flex-col flex-1 ${
                        isToday ? 'border-indigo-500 ring-2 ring-indigo-150/40 bg-indigo-50/5' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="pb-1 border-b border-slate-100 mb-1 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-black uppercase ${isToday ? 'text-indigo-600 font-extrabold' : 'text-slate-505'}`}>
                            {capitalizedDay}
                          </span>
                          {dayTasks.some(t => t.startDate && t.endDate) && (
                            <span 
                              className="w-2 h-2 rounded bg-indigo-500 border border-indigo-600 shrink-0 self-center cursor-help animate-pulse" 
                              title={isNl ? 'Geplande taak met een begin- en einddatum' : 'Scheduled task with set start & end dates'}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-bold text-[9px] shrink-0">
                            {date.getDate()} {date.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { month: 'short' })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewTaskModal(dateStr);
                            }}
                            className="p-0.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title={isNl ? 'Taak toevoegen' : 'Add task'}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Items */}
                      <div 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnDate(e, dateStr)}
                        className="flex-1 space-y-1 overflow-y-auto max-h-[140px]"
                      >
                        
                        {/* Agendas list */}
                        {calendarItems.map(t => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, t.id)}
                            onClick={() => openEditTaskModal(t)}
                            className="p-1 rounded bg-slate-900 text-white min-h-[22px]"
                          >
                            <span className="text-[7px] font-bold text-amber-300 block leading-none">{t.startTime}</span>
                            <h4 className="text-[8.5px] font-semibold truncate text-white leading-tight">{t.title}</h4>
                          </div>
                        ))}

                        {/* Normal list */}
                        {normalItems.length === 0 && calendarItems.length === 0 ? (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewTaskModal(dateStr);
                            }}
                            className="h-full min-h-[35px] flex items-center justify-center text-slate-350 hover:text-indigo-600 border border-dashed border-slate-150 hover:border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-50/40 transition-all text-[8.5px] font-bold gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            <span>{isNl ? 'Taak toevoegen' : 'Add task'}</span>
                          </div>
                        ) : (
                          <>
                            {normalItems.map(t => {
                              const isCompleted = t.completed;
                              return (
                                <div
                                  key={t.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, t.id)}
                                  onClick={() => openEditTaskModal(t)}
                                  className={`p-1 px-1.5 rounded-md border border-slate-150 bg-white hover:bg-slate-50 hover:border-indigo-250 transition-all flex items-center justify-between gap-1.5 cursor-pointer relative group ${
                                    t.priority ? 'border-amber-300 ring-1 ring-amber-200/50 bg-amber-50/10' : ''
                                  } ${isCompleted ? 'opacity-55' : ''}`}
                                  title={`${t.title}${t.description ? ` - ${t.description}` : ''}`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleCompleted(t, dateStr);
                                      }}
                                      className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                                    >
                                      {isCompleted ? (
                                        <CheckSquare2 className="h-2.8 w-2.8 text-emerald-500 fill-emerald-50" />
                                      ) : (
                                        <Square className="h-2.8 w-2.8 text-slate-400" />
                                      )}
                                    </button>
                                    
                                    <div className="flex items-center gap-1 min-w-0 flex-1 select-none">
                                      {t.priority && (
                                        <span className="text-amber-600 font-extrabold text-[8px] tracking-tight uppercase shrink-0">
                                          [PRIO]
                                        </span>
                                      )}
                                      {t.recurrence !== 'none' && (
                                        <span className="text-blue-600 font-extrabold text-[8px] tracking-tight uppercase shrink-0">
                                          [{isNl ? 'HERH' : 'HERH'}]
                                        </span>
                                      )}
                                      <span className={`text-[9.5px] font-medium text-slate-700 line-clamp-2 leading-tight break-words tracking-tight ${
                                        isCompleted ? 'line-through text-slate-400 font-normal' : t.priority ? 'text-amber-950 font-bold' : ''
                                      }`}>
                                        {t.title}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 select-none">
                                    {t.attachments && t.attachments.length > 0 && (
                                      <span className="text-[7.5px] text-indigo-500 font-bold flex items-center" title={`${t.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>📎</span>
                                    )}
                                    {t.priority && (
                                      <Star className="h-2 w-2 fill-amber-500 text-amber-500 shrink-0" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNewTaskModal(dateStr);
                              }}
                              className="w-full mt-1 py-0.5 px-1 text-[8px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 rounded-md border border-dashed border-slate-200 hover:border-indigo-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <Plus className="h-2.5 w-2.5" />
                              <span>{isNl ? 'Taak toevoegen' : 'Add task'}</span>
                            </button>
                          </>
                        )}

                      </div>
                    </div>
                  );
                })}

              </div>

            </div>

          </div>

          {/* Bottom lists and Quick Creator section (Highly visible, draggable directly to top columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            
            {/* 1. Compacter Snel taak toevoegen form */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 mb-1 bg-indigo-50/50 p-2 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 bg-indigo-600" />
                  {isNl ? 'Snel taak toevoegen' : 'Quick Task Creator'}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isNl 
                    ? 'Voeg onmiddellijk een taak toe met alleen een titel en categorie voor vandaag.' 
                    : 'Add a task instantly for today with only a title and category.'}
                </p>
              </div>

              <form onSubmit={handleQuickAddSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">
                    {isNl ? 'Titel' : 'Title'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isNl ? 'bijv. Bel de loodgieter...' : 'e.g. Call plumber...'}
                    value={quickTitle}
                    onChange={e => setQuickTitle(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-indigo-600 font-bold bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">
                    {isNl ? 'Categorie (Label)' : 'Category label'}
                  </label>
                  <select
                    value={quickCategoryId}
                    onChange={e => setQuickCategoryId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="h-4 w-4" />
                  {isNl ? 'Snel toevoegen' : 'Quick Add'}
                </button>
              </form>
            </div>

            {/* 2. Niet afgeronde taken box */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-red-650 text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    {isNl ? 'Niet afgeronde taken' : 'Unfinished Tasks'}
                  </h3>
                  <span className="text-[10px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md">
                    {filteredUnfinished.length}
                  </span>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isNl ? 'Zoeken...' : 'Search...'}
                      value={uncompletedSearch}
                      onChange={e => setUncompletedSearch(e.target.value)}
                      className="w-full text-[11px] pl-8 pr-2.5 py-2 rounded-lg border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{isNl ? 'Sorteer:' : 'Sort:'}</span>
                    <select
                      value={uncompletedSort}
                      onChange={e => setUncompletedSort(e.target.value as any)}
                      className="bg-transparent font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="priority">{isNl ? 'Prioriteit' : 'Priority'}</option>
                      <option value="date">{isNl ? 'Datum' : 'Date'}</option>
                      <option value="alphabetical">{isNl ? 'Naam' : 'Name'}</option>
                    </select>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {filteredUnfinished.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-4 italic">
                      {isNl ? 'Geen openstaande verlopen taken' : 'No overdue uncompleted tasks'}
                    </p>
                  ) : (
                    filteredUnfinished.map(t => (
                      <div 
                        key={t.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        onClick={() => openEditTaskModal(t)}
                        className={`p-2.5 rounded-xl border border-slate-200/60 bg-slate-50 hover:bg-slate-100/70 hover:border-indigo-200 transition-all flex items-start gap-2 group relative cursor-pointer ${
                          t.priority ? 'border-amber-300 ring-1 ring-amber-200/50 hover:bg-amber-50/20' : ''
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompleted(t, t.startDate);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-bold text-slate-700 truncate ${t.priority ? 'text-amber-800 font-extrabold' : ''}`}>
                            {t.title}
                            {t.priority && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500 inline ml-1" />}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-400 truncate">{t.startDate}</span>
                            {t.attachments && t.attachments.length > 0 && (
                              <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-1 rounded flex items-center gap-0.5 shrink-0" title={`${t.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>
                                📎 {t.attachments.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 3. Geplande taken box */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    {isNl ? 'Geplande taken' : 'Scheduled Tasks'}
                  </h3>
                  <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md">
                    {filteredScheduled.length}
                  </span>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isNl ? 'Zoeken...' : 'Search...'}
                      value={scheduledSearch}
                      onChange={e => setScheduledSearch(e.target.value)}
                      className="w-full text-[11px] pl-8 pr-2.5 py-2 rounded-lg border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{isNl ? 'Sorteer:' : 'Sort:'}</span>
                    <select
                      value={scheduledSort}
                      onChange={e => setScheduledSort(e.target.value as any)}
                      className="bg-transparent font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="date">{isNl ? 'Datum' : 'Date'}</option>
                      <option value="priority">{isNl ? 'Prioriteit' : 'Priority'}</option>
                      <option value="alphabetical">{isNl ? 'Naam' : 'Name'}</option>
                    </select>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {filteredScheduled.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-4 italic">
                      {isNl ? 'Geen geplande taken' : 'No upcoming scheduled tasks'}
                    </p>
                  ) : (
                    filteredScheduled.map(t => (
                      <div 
                        key={t.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        onClick={() => openEditTaskModal(t)}
                        className={`p-2.5 rounded-xl border border-slate-200/60 bg-slate-50 hover:bg-slate-100/70 hover:border-indigo-200 transition-all flex items-start gap-2 group relative cursor-pointer ${
                          t.priority ? 'border-amber-300 ring-1 ring-amber-200/50 hover:bg-amber-50/20' : ''
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompleted(t, t.startDate);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-bold text-slate-700 truncate ${t.priority ? 'text-amber-800 font-extrabold' : ''}`}>
                            {t.title}
                            {t.priority && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500 inline ml-1" />}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[9px] text-slate-400 truncate">{t.startDate}</span>
                            {t.attachments && t.attachments.length > 0 && (
                              <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-1 rounded flex items-center gap-0.5 shrink-0" title={`${t.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>
                                📎 {t.attachments.length}
                              </span>
                            )}
                            {t.recurrence !== 'none' && (
                              <span className="text-[8px] font-extrabold bg-blue-50 text-blue-600 px-1 rounded flex items-center gap-0.5">
                                <RefreshCw className="h-2 w-2" />
                                {t.recurrence === 'weekly' ? 'Week' : 'Maand'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* VIEW 2: TRELLO BOARD GROUPED BY STATUS */}
      {activeView === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4" id="trello-board-container">
          {statuses.map(status => {
            // Get non-archived, non-completed tasks for this list status
            const statusTasks = tasks.filter(t => !t.archived && !t.completed && t.statusId === status.id);

            return (
              <div 
                key={status.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnStatus(e, status.id)}
                className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/50 min-h-[460px] flex flex-col"
              >
                {/* Column Title and count */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                  <span className={`inline-flex items-center text-xs font-black px-2.5 py-1 rounded-md border ${getTailwindBgPrefix(status.color)}`}>
                    {status.name}
                  </span>
                  <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-sm">
                    {statusTasks.length}
                  </span>
                </div>

                {/* Cards holder */}
                <div className="flex-grow space-y-2 overflow-y-auto max-h-[440px] p-0.5">
                  {statusTasks.length === 0 ? (
                    <div 
                      onClick={() => {
                        openNewTaskModal();
                        setTaskStatusId(status.id);
                      }}
                      className="h-full min-h-[140px] flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border border-dashed border-slate-200 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4 mb-1" />
                      <span className="text-[10px] font-bold">{isNl ? 'Plaats taak' : 'Place task'}</span>
                    </div>
                  ) : (
                    statusTasks.map(t => {
                      const cat = categories.find(c => c.id === t.categoryId);
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onClick={() => openEditTaskModal(t)}
                          className={`bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all flex flex-col gap-1.5 relative ${
                            t.priority ? 'border-amber-400 ring-1 ring-amber-300' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="font-bold text-xs text-slate-800 tracking-tight leading-snug">
                              {t.title}
                            </span>
                            {t.priority && (
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500 text-right shrink-0" />
                            )}
                          </div>

                          {t.description && (
                            <p className="text-[10px] text-slate-400 line-clamp-2">
                              {t.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[9px] text-slate-500 mt-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>{t.startDate}</span>
                              {t.attachments && t.attachments.length > 0 && (
                                <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-1 rounded flex items-center gap-0.5 shrink-0" title={`${t.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>
                                  📎 {t.attachments.length}
                                </span>
                              )}
                            </div>

                            {cat && (
                              <span className={`px-1.5 py-0.5 rounded font-black ${getTailwindBgPrefix(cat.color)}`}>
                                {cat.name}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: ARCHIVE */}
      {activeView === 'archive' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm space-y-4" id="archive-view-container">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Archive className="h-5 w-5 text-indigo-600" />
                {isNl ? 'Gearchiveerde en afgeronde taken' : 'Completed & Archived Tasks'}
              </h2>
              <p className="text-xs text-slate-500">
                {isNl 
                  ? 'Alle taken die zijn afgerond worden hier bewaard. U kunt ze bewerken, terugzetten of permanent verwijderen.'
                  : 'All finished tasks are organized here. You can modify them, restore them, or permanently delete them.'}
              </p>
            </div>
            {filteredArchive.length > 0 && (
              <button
                type="button"
                onClick={handleClearWholeArchive}
                className="px-4 py-2 hover:brightness-95 bg-red-500 hover:bg-red-650 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md select-none border border-red-600/10 active:scale-95"
                title={isNl ? 'Volledig archief permanent wissen' : 'Permanently clear all archive tasks'}
              >
                <span>🗑️ {isNl ? 'Archief Opschonen' : 'Clear Archive'}</span>
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={isNl ? 'Zoeken in archief...' : 'Search in archive...'}
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-indigo-600"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">{isNl ? 'Filter Op:' : 'Filter By:'}</span>
              <select
                value={archiveFilterCategory}
                onChange={e => setArchiveFilterCategory(e.target.value)}
                className="border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 font-semibold text-slate-700"
              >
                <option value="all">{isNl ? 'Alle labels' : 'All categories'}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table display */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="p-3.5">{isNl ? 'Status' : 'Status'}</th>
                  <th className="p-3.5">{isNl ? 'Titel' : 'Title'}</th>
                  <th className="p-3.5">{isNl ? 'Voltooid op' : 'Done range'}</th>
                  <th className="p-3.5">{isNl ? 'Categorie' : 'Category'}</th>
                  <th className="p-3.5 text-right">{isNl ? 'Acties' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredArchive.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-450 italic">
                      {isNl ? 'Geen overeenkomende archiefitems gevonden.' : 'No matching archived tasks found.'}
                    </td>
                  </tr>
                ) : (
                  filteredArchive.map(task => {
                    const cat = categories.find(c => c.id === task.categoryId);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-55 bg-emerald-100/50 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                            <Check className="h-3 w-3" />
                            {isNl ? 'Gereed' : 'Completed'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">{task.title}</div>
                          {task.description && (
                            <div className="text-[10px] text-slate-450 mt-0.5">{task.description}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-[10px]">
                          {task.startDate} {task.endDate ? ` t/m ${task.endDate}` : ''}
                        </td>
                        <td className="p-3.5">
                          {cat && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${getTailwindBgPrefix(cat.color)}`}>
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleRestoreTask(task)}
                            className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 text-slate-600 rounded font-bold cursor-pointer transition-colors"
                          >
                            {isNl ? 'Terugzetten' : 'Restore'}
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 px-1.5 text-red-600 hover:bg-red-50 hover:border-red-200 border border-transparent rounded cursor-pointer transition-colors"
                            title={isNl ? 'Permanent Verwijderen' : 'Delete Permanently'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: TASK LIST (ALL ACTIVE) */}
      {activeView === 'list' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm space-y-4" id="task-list-view-container">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-indigo-600" />
                {isNl ? 'Alle actieve taken' : 'All Active Tasks'}
              </h2>
              <p className="text-xs text-slate-500">
                {isNl 
                  ? 'Een compleet, doorzoekbaar, filterbaar en sorteerbaar overzicht van al uw actieve taken.'
                  : 'A complete, searchable, filterable, and sortable overview of all your active tasks.'}
              </p>
            </div>
            
            <button
              onClick={() => openNewTaskModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {isNl ? 'Taak toevoegen' : 'Add Task'}
            </button>
          </div>

          {/* Filters Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={isNl ? 'Zoeken in actieve taken...' : 'Search in active tasks...'}
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-indigo-600"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 shrink-0">{isNl ? 'Categorie:' : 'Category:'}</span>
              <select
                value={listFilterCategory}
                onChange={e => setListFilterCategory(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-2 font-semibold text-slate-700"
              >
                <option value="all">{isNl ? 'Alle categorieën' : 'All categories'}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 shrink-0">{isNl ? 'Status:' : 'Status:'}</span>
              <select
                value={listFilterStatus}
                onChange={e => setListFilterStatus(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-2 font-semibold text-slate-700"
              >
                <option value="all">{isNl ? 'Alle statussen' : 'All statuses'}</option>
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table display */}
          <div className="overflow-x-auto rounded-xl border border-slate-150">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="p-3.5 w-12 text-center">✓</th>
                  
                  {/* Sortable headers */}
                  <th 
                    onClick={() => {
                      if (listSortField === 'title') {
                        setListSortDirection(p => p === 'asc' ? 'desc' : 'asc');
                      } else {
                        setListSortField('title');
                        setListSortDirection('asc');
                      }
                    }}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {isNl ? 'Titel' : 'Title'}
                      {listSortField === 'title' && (listSortDirection === 'asc' ? ' 🔼' : ' 🔽')}
                    </div>
                  </th>
                  
                  <th 
                    onClick={() => {
                      if (listSortField === 'startDate') {
                        setListSortDirection(p => p === 'asc' ? 'desc' : 'asc');
                      } else {
                        setListSortField('startDate');
                        setListSortDirection('asc');
                      }
                    }}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {isNl ? 'Begindatum' : 'Start Date'}
                      {listSortField === 'startDate' && (listSortDirection === 'asc' ? ' 🔼' : ' 🔽')}
                    </div>
                  </th>

                  <th 
                    onClick={() => {
                      if (listSortField === 'endDate') {
                        setListSortDirection(p => p === 'asc' ? 'desc' : 'asc');
                      } else {
                        setListSortField('endDate');
                        setListSortDirection('asc');
                      }
                    }}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {isNl ? 'Einddatum' : 'End Date'}
                      {listSortField === 'endDate' && (listSortDirection === 'asc' ? ' 🔼' : ' 🔽')}
                    </div>
                  </th>

                  <th 
                    onClick={() => {
                      if (listSortField === 'category') {
                        setListSortDirection(p => p === 'asc' ? 'desc' : 'asc');
                      } else {
                        setListSortField('category');
                        setListSortDirection('asc');
                      }
                    }}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {isNl ? 'Categorie' : 'Category'}
                      {listSortField === 'category' && (listSortDirection === 'asc' ? ' 🔼' : ' 🔽')}
                    </div>
                  </th>

                  <th 
                    onClick={() => {
                      if (listSortField === 'status') {
                        setListSortDirection(p => p === 'asc' ? 'desc' : 'asc');
                      } else {
                        setListSortField('status');
                        setListSortDirection('asc');
                      }
                    }}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {isNl ? 'Status' : 'Status'}
                      {listSortField === 'status' && (listSortDirection === 'asc' ? ' 🔼' : ' 🔽')}
                    </div>
                  </th>

                  <th className="p-3.5 text-right">{isNl ? 'Acties' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredActiveTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      {isNl ? 'Geen actieve taken gevonden.' : 'No active tasks found.'}
                    </td>
                  </tr>
                ) : (
                  filteredActiveTasks.map(task => {
                    const cat = categories.find(c => c.id === task.categoryId);
                    const stat = statuses.find(s => s.id === task.statusId);
                    
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                        {/* Checkbox checkbox block */}
                        <td className="p-3.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCompleted(task, task.startDate);
                            }}
                            className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer inline-flex items-center justify-center p-1 rounded-md hover:bg-slate-100"
                            title={isNl ? 'Vink taak af' : 'Complete task'}
                          >
                            <Square className="h-4 w-4" />
                          </button>
                        </td>

                        {/* Title & Description Click to Edit */}
                        <td 
                          onClick={() => openEditTaskModal(task)}
                          className="p-3.5 cursor-pointer group-hover:text-indigo-600 transition-colors"
                        >
                          <div className="font-bold text-slate-800 group-hover:underline flex items-center gap-1.5 flex-wrap">
                            {task.title}
                            {task.priority && (
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                            )}
                            {task.attachments && task.attachments.length > 0 && (
                              <span className="text-[8.5px] font-black bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full px-1.5 py-0.2 shrink-0 select-none" title={`${task.attachments.length} ${isNl ? 'bijlagen' : 'attachments'}`}>
                                📎 {task.attachments.length}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{task.description}</div>
                          )}
                          {task.attachments && task.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 text-[9px] font-medium" onClick={e => e.stopPropagation()}>
                              {task.attachments.map(att => (
                                <button
                                  key={att.id}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const link = document.createElement('a');
                                    link.href = att.dataUrl;
                                    link.download = att.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  className="inline-flex items-center gap-0.5 font-bold bg-white border border-slate-200 text-indigo-700 hover:bg-slate-50 rounded px-1.5 py-0.2 cursor-pointer shadow-3xs transition-all pointer-events-auto"
                                >
                                  {att.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Start Date */}
                        <td className="p-3.5 text-slate-500 font-mono text-[10px]">
                          {task.startDate}
                        </td>

                        {/* End Date */}
                        <td className="p-3.5 text-slate-500 font-mono text-[10px]">
                          {task.endDate || '-'}
                        </td>

                        {/* Category badge */}
                        <td className="p-3.5">
                          {cat && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${getTailwindBgPrefix(cat.color)}`}>
                              {cat.name}
                            </span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="p-3.5">
                          {stat && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border bg-slate-50 text-slate-700 border-slate-200/60`}>
                              {stat.name}
                            </span>
                          )}
                        </td>

                        {/* Actions block */}
                        <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => openEditTaskModal(task)}
                            className="px-2.5 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 text-slate-600 rounded font-bold cursor-pointer transition-colors"
                          >
                            {isNl ? 'Aanpassen' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 px-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded cursor-pointer transition-colors inline-block"
                            title={isNl ? 'Verwijderen' : 'Delete'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TASK ADD & EDIT MODAL OUTLAY */}
      {isTaskModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsTaskModalOpen(false);
              setEditingTask(null);
            }
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] overflow-y-auto text-left flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                {editingTask ? (
                  <>
                    <Edit2 className="h-5 w-5 text-indigo-600" />
                    {isNl ? 'Taak wijzigen' : 'Modify task'}
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-indigo-600" />
                    {isNl ? 'Nieuwe taak toevoegen' : 'Add new task'}
                  </>
                )}
              </h3>
              <button 
                onClick={() => {
                  setIsTaskModalOpen(false);
                  setEditingTask(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTaskSubmit} className="space-y-4 flex-1">
              
              {/* Title input */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 block">
                  {isNl ? 'Titel' : 'Title'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isNl ? 'bijv. Wekelijkse standup' : 'e.g. Weekly standup'}
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-indigo-600 font-bold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 block">
                  {isNl ? 'Beschrijving' : 'Description'}
                </label>
                <textarea
                  placeholder={isNl ? 'Taakinhoud of notities...' : 'Task notes and actions...'}
                  value={taskDescription}
                  onChange={e => setTaskDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-indigo-600"
                />
              </div>

              {/* Date pickers (Start and End range) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">
                    {isNl ? 'Begindatum (Optioneel)' : 'Start Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={e => setTaskStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">
                    {isNl ? 'Einddatum (Optioneel)' : 'End Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    value={taskEndDate}
                    onChange={e => setTaskEndDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Recurrence and Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">
                    {isNl ? 'Herhaal-optie' : 'Recurrence'}
                  </label>
                  <select
                    value={taskRecurrence}
                    onChange={e => setTaskRecurrence(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="none">{isNl ? 'Geen herhaling' : 'No repetition'}</option>
                    <option value="weekly">{isNl ? 'Elke week' : 'Every week'}</option>
                    <option value="monthly">{isNl ? 'Elke maand' : 'Every month'}</option>
                  </select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border border-slate-100 hover:bg-slate-50 relative">
                    <input
                      type="checkbox"
                      checked={taskPriority}
                      onChange={e => setTaskPriority(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700">{isNl ? 'Prioriteit-taak' : 'Priority task'}</span>
                      <span className="text-[9px] text-slate-400">{isNl ? 'Star ⭐ en bold' : 'Star ⭐ and bold emphasis'}</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Calendar Item Toggle */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taskIsCalendarItem}
                    onChange={e => setTaskIsCalendarItem(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-700">
                      {isNl ? 'Zet op de agenda (Agenda-item)' : 'Set as calendar appointment'}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {isNl 
                        ? 'Wordt bovenaan getoond met specifieke tijden in een donkere badge.' 
                        : 'Displays at the top of the day with structured times inside a dark badge.'}
                    </span>
                  </div>
                </label>

                {taskIsCalendarItem && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        {isNl ? 'Begintijd' : 'Start Time'}
                      </label>
                      <input
                        type="time"
                        value={taskStartTime}
                        onChange={e => setTaskStartTime(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        {isNl ? 'Eindtijd' : 'End Time'}
                      </label>
                      <input
                        type="time"
                        value={taskEndTime}
                        onChange={e => setTaskEndTime(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status and Category selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">
                    {isNl ? 'Status (Kolom)' : 'Status lane'}
                  </label>
                  <select
                    value={taskStatusId}
                    onChange={e => setTaskStatusId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    {statuses.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">
                    {isNl ? 'Categorie (Label)' : 'Category label'}
                  </label>
                  <select
                    value={taskCategoryId}
                    onChange={e => setTaskCategoryId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ATTACHMENTS (BIJLAGEN) SELECTION */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 block">
                  {isNl ? 'Bijlagen (Documenten/Afbeeldingen)' : 'Attachments (Documents/Images)'}
                </label>
                
                {/* Drag and Drop Container */}
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer?.files) {
                      const files = e.dataTransfer.files;
                      if (files.length > 0) {
                        Array.from(files).forEach((fItem) => {
                          const file = fItem as File;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              const newAttachment: Attachment = {
                                id: 'att-' + Math.random().toString(36).substr(2, 9),
                                name: file.name,
                                type: file.type || file.name.split('.').pop() || 'unknown',
                                size: file.size,
                                dataUrl: event.target.result as string
                              };
                              setTaskAttachments(prev => [...prev, newAttachment]);
                            }
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }
                  }}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 bg-slate-50/30 flex flex-col items-center justify-center transition-colors cursor-pointer relative"
                >
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const files = e.target.files;
                        Array.from(files).forEach((fItem) => {
                          const file = fItem as File;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              const newAttachment: Attachment = {
                                id: 'att-' + Math.random().toString(36).substr(2, 9),
                                name: file.name,
                                type: file.type || file.name.split('.').pop() || 'unknown',
                                size: file.size,
                                dataUrl: event.target.result as string
                              };
                              setTaskAttachments(prev => [...prev, newAttachment]);
                            }
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Paperclip className="h-4.5 w-4.5 text-indigo-500 mb-1" />
                  <p className="text-[10px] text-slate-500 font-bold">
                    {isNl ? 'Sleep bestanden hierheen of klik om te bladeren' : 'Drag files here or click to browse'}
                  </p>
                  <p className="text-[8px] text-slate-400 font-medium">
                    {isNl ? 'Bestanden worden lokaal opgeslagen' : 'Files are securely saved locally'}
                  </p>
                </div>

                {/* Attachments List */}
                {taskAttachments.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                    {taskAttachments.map(att => (
                      <div 
                        key={att.id} 
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-150 text-[10.5px]"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                          <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span className="font-bold text-slate-700 truncate" title={att.name}>
                            {att.name}
                          </span>
                          <span className="text-[8.5px] font-mono text-slate-400 shrink-0">
                            ({(att.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 relative z-20">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = att.dataUrl;
                              link.download = att.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 shrink-0 font-medium cursor-pointer"
                            title={isNl ? 'Bekijk / Downloaden' : 'View / Download'}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTaskAttachments(prev => prev.filter(x => x.id !== att.id));
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50/50 shrink-0 font-medium cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="px-3 py-2 text-xs bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isNl ? 'Verwijderen' : 'Delete'}
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTaskModalOpen(false);
                      setEditingTask(null);
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {isNl ? 'Annuleren' : 'Cancel'}
                  </button>
                  
                  {!editingTask && (
                    <button
                      type="button"
                      onClick={handleSaveAndAddAnother}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      {isNl ? 'Opslaan & nog een toevoegen' : 'Save & add another'}
                    </button>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer transition-colors"
                  >
                    {isNl ? 'Opslaan' : 'Save'}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
