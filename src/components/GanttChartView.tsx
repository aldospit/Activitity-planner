import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Project, ProjectActivity, ActivityStatus, ProjectType, Language 
} from '../types';
import { 
  Calendar, ChevronLeft, ChevronRight, Filter, Layers, 
  CheckCircle2, Clock, AlertCircle, Edit2, Trash2, Plus, 
  ChevronDown, ChevronRight as ChevronRightIcon, User, Flag,
  Download, FileText, Image as ImageIcon, Eye, ArrowRight, SlidersHorizontal,
  Folder, FolderOpen, GripVertical, ZoomIn, ZoomOut, Search, X,
  Link as LinkIcon, Unlink, RotateCcw, Sparkles, Check, ArrowUp, ArrowDown,
  Info, Compass, FolderGit, Loader2, Maximize2, Globe
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import ITPlatformTwenteLogo from './ITPlatformTwenteLogo';

export type GanttTimeScale = 'day' | 'iso_week' | 'month' | 'quarter' | 'year';

interface GanttChartViewProps {
  projects: Project[];
  activities: ProjectActivity[];
  selectedProjectId: string;
  lang: Language;
  onSelectProject?: (projectId: string) => void;
  onEditActivity: (act: ProjectActivity) => void;
  onDeleteActivity: (actId: string, title: string) => void;
  onNewActivity: (presetProjectId?: string, parentId?: string) => void;
  onUpdateActivity?: (act: ProjectActivity) => void;
  onUpdateActivityStatus?: (actId: string, newStatus: ActivityStatus) => void;
  onReorderActivities?: (newActivities: ProjectActivity[]) => void;
}

// Helper: Parse YMD string to local Date at 00:00:00.000
function parseYMD(str: string): Date {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Parse YMD string to local Date at 23:59:59.999 (end of calendar day)
function parseYMDEndOfDay(str: string): Date {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 23, 59, 59, 999);
  }
  const d = new Date(str);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Helper: Format Date to YMD
function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: Get ISO Week Number
function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Status styles
const STATUS_CONFIG: Record<ActivityStatus, { labelNl: string; labelEn: string; bg: string; text: string; border: string; barBg: string; barBorder: string }> = {
  todo: {
    labelNl: 'Nog te doen',
    labelEn: 'To Do',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    barBg: 'bg-slate-400',
    barBorder: 'border-slate-500'
  },
  in_progress: {
    labelNl: 'In uitvoering',
    labelEn: 'In Progress',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    barBg: 'bg-blue-500',
    barBorder: 'border-blue-600'
  },
  completed: {
    labelNl: 'Voltooid',
    labelEn: 'Completed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    barBg: 'bg-emerald-500',
    barBorder: 'border-emerald-600'
  },
  on_hold: {
    labelNl: 'On Hold (gepauzeerd)',
    labelEn: 'On Hold',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    barBg: 'bg-amber-500',
    barBorder: 'border-amber-600'
  },
  cancelled: {
    labelNl: 'Vervallen / Geannuleerd',
    labelEn: 'Cancelled',
    bg: 'bg-stone-100',
    text: 'text-stone-500 line-through',
    border: 'border-stone-300',
    barBg: 'bg-stone-400 opacity-70',
    barBorder: 'border-stone-500'
  }
};

export default function GanttChartView({
  projects,
  activities,
  selectedProjectId,
  lang,
  onSelectProject,
  onEditActivity,
  onDeleteActivity,
  onNewActivity,
  onUpdateActivity,
  onUpdateActivityStatus,
  onReorderActivities
}: GanttChartViewProps) {
  const isNl = lang === 'nl';
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // --- Filtering & Search States ---
  const [currentProjectFilter, setCurrentProjectFilter] = useState<string>(selectedProjectId || 'all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'project' | 'exploration'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const selectedProjectObj = useMemo(() => {
    if (!currentProjectFilter || currentProjectFilter === 'all') return null;
    return projects.find(p => p.id === currentProjectFilter) || null;
  }, [projects, currentProjectFilter]);

  // Synchronize when parent changes selectedProjectId
  useEffect(() => {
    if (selectedProjectId) {
      setCurrentProjectFilter(selectedProjectId);
    }
  }, [selectedProjectId]);

  // --- Zoom & Time Scale States ---
  const [timeScale, setTimeScale] = useState<GanttTimeScale>('iso_week');
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 50% to 200%

  // --- Custom Date Range States ---
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');

  // --- Collapsed Task IDs (for parent/summary tasks) ---
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  // --- Drag & Drop Reordering ---
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [dragOverActivityId, setDragOverActivityId] = useState<string | null>(null);

  // --- Dependency Management Modal State ---
  const [dependencyModalAct, setDependencyModalAct] = useState<ProjectActivity | null>(null);

  // --- Export State ---
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Helper: compute resolved start and end dates for a task (taking subtasks into account)
  const resolveTaskDates = useCallback((act: ProjectActivity, allActs: ProjectActivity[]) => {
    const children = allActs.filter(c => c.parentId === act.id);
    if (children.length === 0) {
      return { 
        startDate: act.startDate || '', 
        endDate: act.isMilestone ? (act.startDate || '') : (act.endDate || act.startDate || ''),
        isSummary: false,
        subtaskCount: 0,
        completedCount: 0
      };
    }

    // Has subtasks: Roll up!
    let minStart = act.startDate || '';
    let maxEnd = act.endDate || '';
    let completedCount = 0;

    children.forEach(c => {
      const childResolved = resolveTaskDates(c, allActs);
      if (childResolved.startDate) {
        if (!minStart || childResolved.startDate < minStart) minStart = childResolved.startDate;
      }
      if (childResolved.endDate) {
        if (!maxEnd || childResolved.endDate > maxEnd) maxEnd = childResolved.endDate;
      }
      if (c.status === 'completed') completedCount++;
    });

    return {
      startDate: minStart || act.startDate || '',
      endDate: maxEnd || act.endDate || minStart || '',
      isSummary: true,
      subtaskCount: children.length,
      completedCount
    };
  }, []);

  // Compute full project boundary from activities
  const fullTasksBoundary = useMemo(() => {
    const relevantActs = activities.filter(a => {
      if (currentProjectFilter !== 'all' && a.projectId !== currentProjectFilter) return false;
      return true;
    });

    let minD = '';
    let maxD = '';

    relevantActs.forEach(a => {
      const res = resolveTaskDates(a, activities);
      if (res.startDate) {
        if (!minD || res.startDate < minD) minD = res.startDate;
      }
      if (res.endDate) {
        if (!maxD || res.endDate > maxD) maxD = res.endDate;
      }
    });

    // Defaults if no activities or dates
    if (!minD || !maxD) {
      const today = new Date();
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 4, 0);
      return { start: formatYMD(s), end: formatYMD(e) };
    }

    // Add gentle padding before and after (e.g. 7 days before, 14 days after)
    const sDate = parseYMD(minD);
    sDate.setDate(sDate.getDate() - 7);
    const eDate = parseYMD(maxD);
    eDate.setDate(eDate.getDate() + 14);

    return {
      start: formatYMD(sDate),
      end: formatYMD(eDate)
    };
  }, [activities, currentProjectFilter, resolveTaskDates]);

  // Initialize start & end date if empty
  useEffect(() => {
    if (!startDateStr || !endDateStr) {
      setStartDateStr(fullTasksBoundary.start);
      setEndDateStr(fullTasksBoundary.end);
    }
  }, [fullTasksBoundary, startDateStr, endDateStr]);

  // Actual active range Date objects
  const activeTimelineRange = useMemo(() => {
    const s = parseYMD(startDateStr || fullTasksBoundary.start);
    const e = parseYMD(endDateStr || fullTasksBoundary.end);
    if (e.getTime() <= s.getTime()) {
      e.setTime(s.getTime() + 30 * 86400000);
    }
    return { start: s, end: e, totalMs: e.getTime() - s.getTime() };
  }, [startDateStr, endDateStr, fullTasksBoundary]);

  // Quick preset period adjustments
  const applyPresetPeriod = (preset: 'fit_all' | 'this_quarter' | 'this_year' | 'next_quarter' | 'next_6_months') => {
    const now = new Date();
    if (preset === 'fit_all') {
      setStartDateStr(fullTasksBoundary.start);
      setEndDateStr(fullTasksBoundary.end);
    } else if (preset === 'this_quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      const e = new Date(now.getFullYear(), q * 3 + 3, 0);
      setStartDateStr(formatYMD(s));
      setEndDateStr(formatYMD(e));
    } else if (preset === 'this_year') {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31);
      setStartDateStr(formatYMD(s));
      setEndDateStr(formatYMD(e));
    } else if (preset === 'next_quarter') {
      const q = Math.floor(now.getMonth() / 3) + 1;
      const s = new Date(now.getFullYear(), q * 3, 1);
      const e = new Date(now.getFullYear(), q * 3 + 3, 0);
      setStartDateStr(formatYMD(s));
      setEndDateStr(formatYMD(e));
    } else if (preset === 'next_6_months') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 6, 0);
      setStartDateStr(formatYMD(s));
      setEndDateStr(formatYMD(e));
    }
  };

  // Shift period backward or forward
  const shiftPeriod = (direction: 'prev' | 'next') => {
    const s = parseYMD(startDateStr || fullTasksBoundary.start);
    const e = parseYMD(endDateStr || fullTasksBoundary.end);
    const diffDays = Math.max(7, Math.round((e.getTime() - s.getTime()) / 86400000));
    const shiftStep = Math.max(7, Math.round(diffDays * 0.4));

    if (direction === 'prev') {
      s.setDate(s.getDate() - shiftStep);
      e.setDate(e.getDate() - shiftStep);
    } else {
      s.setDate(s.getDate() + shiftStep);
      e.setDate(e.getDate() + shiftStep);
    }
    setStartDateStr(formatYMD(s));
    setEndDateStr(formatYMD(e));
  };

  // Jump to today
  const jumpToToday = () => {
    const today = new Date();
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
    const e = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45);
    setStartDateStr(formatYMD(s));
    setEndDateStr(formatYMD(e));

    setTimeout(() => {
      if (timelineScrollRef.current) {
        const container = timelineScrollRef.current;
        const calcTodayX = getPixelXForDate(new Date());
        if (calcTodayX > 0) {
          const targetScroll = Math.max(0, calcTodayX - (container.clientWidth - 380) / 2);
          container.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
      }
    }, 150);
  };

  // Fit all tasks to screen
  const fitAllTasks = () => {
    setStartDateStr(fullTasksBoundary.start);
    setEndDateStr(fullTasksBoundary.end);
    setZoomLevel(100);
    // choose optimal scale based on range
    const s = parseYMD(fullTasksBoundary.start);
    const e = parseYMD(fullTasksBoundary.end);
    const days = Math.round((e.getTime() - s.getTime()) / 86400000);
    if (days <= 45) {
      setTimeScale('day');
    } else if (days <= 180) {
      setTimeScale('iso_week');
    } else if (days <= 500) {
      setTimeScale('month');
    } else {
      setTimeScale('quarter');
    }
  };

  // Filter projects by type
  const availableProjects = useMemo(() => {
    return projects.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      return true;
    });
  }, [projects, typeFilter]);

  // Collate tasks in a clean hierarchical tree (Roots and nested subtasks)
  const hierarchicalActivities = useMemo(() => {
    // 1. Filter activities by project and type
    let pool = activities.filter(act => {
      const proj = projects.find(p => p.id === act.projectId);
      if (!proj) return false;
      if (typeFilter !== 'all' && proj.type !== typeFilter) return false;
      if (currentProjectFilter !== 'all' && act.projectId !== currentProjectFilter) return false;
      return true;
    });

    // 2. Hide completed filter
    if (hideCompleted) {
      pool = pool.filter(act => {
        if (act.status === 'completed') {
          // If it's a summary task, hide only if all subtasks are completed too
          const children = activities.filter(c => c.parentId === act.id);
          if (children.length === 0) return false;
          const allChildrenCompleted = children.every(c => c.status === 'completed');
          if (allChildrenCompleted) return false;
        }
        return true;
      });
    }

    // 3. Status filter
    if (statusFilter !== 'all') {
      pool = pool.filter(act => act.status === statusFilter);
    }

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      pool = pool.filter(act => {
        const titleMatch = act.title.toLowerCase().includes(q);
        const descMatch = (act.description || '').toLowerCase().includes(q);
        const assigneeMatch = (act.assignee || '').toLowerCase().includes(q);
        return titleMatch || descMatch || assigneeMatch;
      });
    }

    // 5. Structure into roots and children
    // Roots are items with no parentId OR whose parentId is not in pool
    const roots = pool.filter(a => !a.parentId || !pool.some(p => p.id === a.parentId));

    // Sort roots by order, then startDate
    roots.sort((a, b) => {
      const ordA = a.order !== undefined ? a.order : 1000;
      const ordB = b.order !== undefined ? b.order : 1000;
      if (ordA !== ordB) return ordA - ordB;
      const sA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const sB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return sA - sB;
    });

    const result: {
      activity: ProjectActivity;
      isRoot: boolean;
      hasChildren: boolean;
      depth: number;
      isCollapsed: boolean;
      resolved: ReturnType<typeof resolveTaskDates>;
    }[] = [];

    roots.forEach(root => {
      const rootResolved = resolveTaskDates(root, activities);
      const isCollapsed = collapsedParentIds.has(root.id);
      const children = pool.filter(a => a.parentId === root.id);

      result.push({
        activity: root,
        isRoot: true,
        hasChildren: children.length > 0 || rootResolved.isSummary,
        depth: 0,
        isCollapsed,
        resolved: rootResolved
      });

      // If not collapsed, append children
      if (!isCollapsed) {
        // Sort children
        children.sort((a, b) => {
          const ordA = a.order !== undefined ? a.order : 1000;
          const ordB = b.order !== undefined ? b.order : 1000;
          if (ordA !== ordB) return ordA - ordB;
          const sA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
          const sB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
          return sA - sB;
        });

        children.forEach(child => {
          const childResolved = resolveTaskDates(child, activities);
          result.push({
            activity: child,
            isRoot: false,
            hasChildren: childResolved.isSummary,
            depth: 1,
            isCollapsed: false,
            resolved: childResolved
          });
        });
      }
    });

    return result;
  }, [activities, projects, currentProjectFilter, typeFilter, hideCompleted, statusFilter, searchQuery, collapsedParentIds, resolveTaskDates]);

  // Toggle collapse for a parent task
  const toggleCollapse = (id: string) => {
    setCollapsedParentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => {
    const parentIds = activities
      .filter(a => activities.some(c => c.parentId === a.id))
      .map(a => a.id);
    setCollapsedParentIds(new Set(parentIds));
  };

  const expandAll = () => {
    setCollapsedParentIds(new Set());
  };

  // Reordering handler
  const handleDragStart = (actId: string) => {
    setDraggedActivityId(actId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedActivityId !== targetId) {
      setDragOverActivityId(targetId);
    }
  };

  const handleDrop = (targetId: string) => {
    if (!draggedActivityId || draggedActivityId === targetId) {
      setDraggedActivityId(null);
      setDragOverActivityId(null);
      return;
    }

    const sourceAct = activities.find(a => a.id === draggedActivityId);
    const targetAct = activities.find(a => a.id === targetId);

    if (!sourceAct || !targetAct) {
      setDraggedActivityId(null);
      setDragOverActivityId(null);
      return;
    }

    // Work with the full activities array
    const newActs = [...activities];
    const sIdx = newActs.findIndex(a => a.id === draggedActivityId);
    const tIdx = newActs.findIndex(a => a.id === targetId);

    if (sIdx !== -1 && tIdx !== -1) {
      const [removed] = newActs.splice(sIdx, 1);
      newActs.splice(tIdx, 0, removed);

      // Re-index orders
      const updated = newActs.map((act, idx) => ({
        ...act,
        order: idx
      }));

      if (onReorderActivities) {
        onReorderActivities(updated);
      }
    }

    setDraggedActivityId(null);
    setDragOverActivityId(null);
  };

  // Move single item up or down
  const moveTask = (actId: string, direction: 'up' | 'down') => {
    const idx = activities.findIndex(a => a.id === actId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= activities.length) return;

    const newActs = [...activities];
    const temp = newActs[idx];
    newActs[idx] = newActs[targetIdx];
    newActs[targetIdx] = temp;

    const updated = newActs.map((act, i) => ({ ...act, order: i }));
    if (onReorderActivities) {
      onReorderActivities(updated);
    }
  };

  // --- Dependency Linking & Modification ---
  const addDependency = (actId: string, predecessorId: string) => {
    if (!predecessorId || actId === predecessorId) return;
    const act = activities.find(a => a.id === actId);
    if (!act) return;

    const existing = act.dependencies || [];
    if (existing.includes(predecessorId)) return;

    const updated = {
      ...act,
      dependencies: [...existing, predecessorId]
    };

    if (onUpdateActivity) {
      onUpdateActivity(updated);
    }
  };

  const removeDependency = (actId: string, predecessorId: string) => {
    const act = activities.find(a => a.id === actId);
    if (!act) return;

    const updated = {
      ...act,
      dependencies: (act.dependencies || []).filter(id => id !== predecessorId)
    };

    if (onUpdateActivity) {
      onUpdateActivity(updated);
    }
  };

  // --- Timeline Columns Generation ---
  const timelineColumns = useMemo(() => {
    const { start, end } = activeTimelineRange;
    const cols: {
      key: string;
      label: string;
      subLabel?: string;
      startDate: Date;
      endDate: Date;
      widthPx: number;
    }[] = [];

    // Base column width adjusted by zoomLevel
    const zoomFactor = zoomLevel / 100;

    if (timeScale === 'day') {
      const cur = new Date(start);
      const baseColWidth = Math.round(44 * zoomFactor);
      while (cur <= end) {
        const s = new Date(cur);
        const dayNum = s.getDate();
        const dayOfWeek = s.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short' });
        const monthShort = s.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' });
        const isWeekend = s.getDay() === 0 || s.getDay() === 6;

        cols.push({
          key: formatYMD(s),
          label: `${dayOfWeek} ${dayNum}`,
          subLabel: monthShort,
          startDate: s,
          endDate: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1, 0, 0, 0, 0),
          widthPx: baseColWidth
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else if (timeScale === 'iso_week') {
      const cur = new Date(start);
      // align to Monday
      const day = cur.getDay() || 7;
      cur.setDate(cur.getDate() - (day - 1));
      const baseColWidth = Math.round(68 * zoomFactor);

      while (cur <= end) {
        const s = new Date(cur);
        const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7, 0, 0, 0, 0);
        const wNum = getISOWeekNumber(s);
        const mShort = s.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' });

        cols.push({
          key: `W${wNum}-${s.getFullYear()}-${s.getMonth()}`,
          label: `W${wNum}`,
          subLabel: `${s.getDate()} ${mShort}`,
          startDate: s,
          endDate: e,
          widthPx: baseColWidth
        });
        cur.setDate(cur.getDate() + 7);
      }
    } else if (timeScale === 'month') {
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      const baseColWidth = Math.round(90 * zoomFactor);

      while (cur <= end) {
        const s = new Date(cur);
        const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const mName = s.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' });

        cols.push({
          key: `${s.getFullYear()}-${s.getMonth()}`,
          label: mName,
          subLabel: `${s.getFullYear()}`,
          startDate: s,
          endDate: nextMonth,
          widthPx: baseColWidth
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else if (timeScale === 'quarter') {
      const qStartMonth = Math.floor(start.getMonth() / 3) * 3;
      const cur = new Date(start.getFullYear(), qStartMonth, 1);
      const baseColWidth = Math.round(130 * zoomFactor);

      while (cur <= end) {
        const s = new Date(cur);
        const qNum = Math.floor(s.getMonth() / 3) + 1;
        const nextQuarter = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);

        cols.push({
          key: `Q${qNum}-${s.getFullYear()}`,
          label: `Q${qNum}`,
          subLabel: `${s.getFullYear()}`,
          startDate: s,
          endDate: nextQuarter,
          widthPx: baseColWidth
        });
        cur.setMonth(cur.getMonth() + 3);
      }
    } else if (timeScale === 'year') {
      const cur = new Date(start.getFullYear(), 0, 1);
      const baseColWidth = Math.round(180 * zoomFactor);

      while (cur <= end) {
        const s = new Date(cur);
        const nextYear = new Date(cur.getFullYear() + 1, 0, 1);

        cols.push({
          key: `${s.getFullYear()}`,
          label: `${s.getFullYear()}`,
          startDate: s,
          endDate: nextYear,
          widthPx: baseColWidth
        });
        cur.setFullYear(cur.getFullYear() + 1);
      }
    }

    return cols;
  }, [activeTimelineRange, timeScale, zoomLevel, lang]);

  // Total width of the timeline grid area in pixels
  const totalTimelineWidthPx = useMemo(() => {
    return timelineColumns.reduce((sum, c) => sum + c.widthPx, 0);
  }, [timelineColumns]);

  // Convert a Date to a Pixel X coordinate relative to the timeline grid start
  const getPixelXForDate = useCallback((date: Date): number => {
    if (timelineColumns.length === 0) return 0;
    const gridStart = timelineColumns[0].startDate.getTime();
    const gridEnd = timelineColumns[timelineColumns.length - 1].endDate.getTime();
    const target = date.getTime();

    if (target <= gridStart) return 0;
    if (target >= gridEnd) return totalTimelineWidthPx;

    // Search which column contains this date
    let accumulatedX = 0;
    for (const col of timelineColumns) {
      const colStart = col.startDate.getTime();
      const colEnd = col.endDate.getTime();
      if (target >= colStart && target <= colEnd) {
        const colDuration = colEnd - colStart;
        const offsetInCol = target - colStart;
        const ratio = colDuration > 0 ? offsetInCol / colDuration : 0;
        return accumulatedX + ratio * col.widthPx;
      }
      accumulatedX += col.widthPx;
    }
    return totalTimelineWidthPx;
  }, [timelineColumns, totalTimelineWidthPx]);

  // Today marker X position
  const todayX = useMemo(() => {
    const today = new Date();
    if (timelineColumns.length === 0) return null;
    const gridStart = timelineColumns[0].startDate.getTime();
    const gridEnd = timelineColumns[timelineColumns.length - 1].endDate.getTime();
    const todayMs = today.getTime();
    if (todayMs < gridStart || todayMs > gridEnd) return null;
    return getPixelXForDate(today);
  }, [timelineColumns, getPixelXForDate]);

  // --- High-Fidelity Canvas Preparation for Export (PNG, JPG, PDF) ---
  const prepareAndRenderCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!chartContainerRef.current) return null;
    const element = chartContainerRef.current;

    // Temporarily reset horizontal scroll so nothing is clipped from the left or right
    const scrollBox = timelineScrollRef.current;
    const originalScrollLeft = scrollBox?.scrollLeft ?? 0;
    if (scrollBox) {
      scrollBox.scrollLeft = 0;
    }

    const leftColWidth = 380;
    const rightMarginPadding = 60; // Generous breathing room so rightmost milestones/tasks are never cut off
    const totalWidth = leftColWidth + Math.max(600, totalTimelineWidthPx) + rightMarginPadding;
    const totalHeight = element.scrollHeight || (220 + (hierarchicalActivities.length * rowHeightPx));

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: totalWidth,
        height: totalHeight,
        windowWidth: totalWidth + 150,
        windowHeight: totalHeight + 150,
        onclone: (clonedDoc, clonedEl) => {
          // 1. Force root documentElement & body to stretch to full width without scroll clipping
          clonedDoc.documentElement.style.width = `${totalWidth + 100}px`;
          clonedDoc.documentElement.style.minWidth = `${totalWidth + 100}px`;
          clonedDoc.documentElement.style.maxWidth = 'none';
          clonedDoc.documentElement.style.overflow = 'visible';

          clonedDoc.body.style.width = `${totalWidth + 100}px`;
          clonedDoc.body.style.minWidth = `${totalWidth + 100}px`;
          clonedDoc.body.style.maxWidth = 'none';
          clonedDoc.body.style.overflow = 'visible';

          // 2. Expand all parent containers of clonedEl so container rules (e.g. max-w-7xl) don't clip
          let parent: HTMLElement | null = clonedEl;
          while (parent) {
            parent.style.width = `${totalWidth}px`;
            parent.style.minWidth = `${totalWidth}px`;
            parent.style.maxWidth = 'none';
            parent.style.overflow = 'visible';
            parent = parent.parentElement;
          }

          // 3. Expand the horizontal scroll container and reset scroll
          const clonedScrollBox = clonedDoc.querySelector('[data-gantt-scroll-container]') as HTMLElement;
          if (clonedScrollBox) {
            clonedScrollBox.scrollLeft = 0;
            clonedScrollBox.scrollTop = 0;
            clonedScrollBox.style.width = `${totalWidth}px`;
            clonedScrollBox.style.minWidth = `${totalWidth}px`;
            clonedScrollBox.style.maxWidth = 'none';
            clonedScrollBox.style.overflow = 'visible';
          }

          // 4. Force exact width on task list column
          const leftCol = clonedDoc.querySelector('[data-gantt-left-col]') as HTMLElement;
          if (leftCol) {
            leftCol.style.width = `${leftColWidth}px`;
            leftCol.style.minWidth = `${leftColWidth}px`;
            leftCol.style.maxWidth = `${leftColWidth}px`;
            leftCol.style.flexShrink = '0';
          }

          // 5. Force exact width on timeline column with safety margin
          const timelineCol = clonedDoc.querySelector('[data-gantt-timeline-col]') as HTMLElement;
          if (timelineCol) {
            timelineCol.style.width = `${totalTimelineWidthPx + rightMarginPadding}px`;
            timelineCol.style.minWidth = `${totalTimelineWidthPx + rightMarginPadding}px`;
            timelineCol.style.maxWidth = 'none';
            timelineCol.style.overflow = 'visible';
            timelineCol.style.flexShrink = '0';
          }

          // 6. Expand header and legend bar to full width
          const exportHeader = clonedDoc.querySelector('[data-gantt-export-header]') as HTMLElement;
          if (exportHeader) {
            exportHeader.style.width = `${totalWidth}px`;
            exportHeader.style.minWidth = `${totalWidth}px`;
            exportHeader.style.maxWidth = 'none';
          }

          const legendBar = clonedDoc.querySelector('[data-gantt-legend-bar]') as HTMLElement;
          if (legendBar) {
            legendBar.style.width = `${totalWidth}px`;
            legendBar.style.minWidth = `${totalWidth}px`;
            legendBar.style.maxWidth = 'none';
          }

          // Hide navigation hint text in the export so only the clean legend remains
          const navHint = clonedDoc.querySelector('[data-gantt-nav-hint]') as HTMLElement;
          if (navHint) {
            navHint.style.display = 'none';
          }

          // 7. Reset sticky elements so they align predictably in the clone
          const stickyEls = clonedDoc.querySelectorAll('.sticky');
          stickyEls.forEach(el => {
            (el as HTMLElement).style.position = 'relative';
          });
        }
      });

      return canvas;
    } finally {
      // Restore user scroll position
      if (scrollBox) {
        scrollBox.scrollLeft = originalScrollLeft;
      }
    }
  };

  // Export to Image (PNG or JPG)
  const exportImage = async (format: 'png' | 'jpeg') => {
    if (!chartContainerRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);
    setExportSuccessMsg(null);

    try {
      const canvas = await prepareAndRenderCanvas();
      if (!canvas) throw new Error('Canvas rendering failed');

      const projName = currentProjectFilter === 'all' 
        ? 'Alle_Projecten_Gantt' 
        : (projects.find(p => p.id === currentProjectFilter)?.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Gantt');
      const filename = `${projName}_${formatYMD(new Date())}.${format === 'png' ? 'png' : 'jpg'}`;

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            const imgData = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = filename;
            link.href = imgData;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => document.body.removeChild(link), 300);
          } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }, 1000);
          }
          setExportSuccessMsg(
            isNl 
              ? `Afbeelding gedownload (${filename})` 
              : `Image downloaded (${filename})`
          );
          setTimeout(() => setExportSuccessMsg(null), 5000);
        }, format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
      } else {
        const imgData = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
        const link = document.createElement('a');
        link.download = filename;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 300);
        setExportSuccessMsg(
          isNl 
            ? `Afbeelding gedownload (${filename})` 
            : `Image downloaded (${filename})`
        );
        setTimeout(() => setExportSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('Export image error:', err);
      alert(isNl ? 'Fout bij het exporteren van de afbeelding. Probeer het opnieuw.' : 'Failed to export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF (A4 Landscape)
  const exportPdf = async () => {
    if (!chartContainerRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);
    setExportSuccessMsg(null);

    try {
      const canvas = await prepareAndRenderCanvas();
      if (!canvas) throw new Error('Canvas rendering failed');

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();   // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

      const margin = 8;
      const printableWidth = pageWidth - (margin * 2);      // 281mm
      const printableHeight = pageHeight - (margin * 2);    // 194mm

      const canvasAspectRatio = canvas.width / canvas.height;
      const printableAspectRatio = printableWidth / printableHeight;

      let renderWidth = printableWidth;
      let renderHeight = printableWidth / canvasAspectRatio;

      if (renderHeight > printableHeight) {
        renderHeight = printableHeight;
        renderWidth = printableHeight * canvasAspectRatio;
      }

      const xOffset = margin + ((printableWidth - renderWidth) / 2);
      const yOffset = margin + ((printableHeight - renderHeight) / 2);

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');

      const projName = currentProjectFilter === 'all' 
        ? 'Alle_Projecten_Gantt' 
        : (projects.find(p => p.id === currentProjectFilter)?.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Gantt');
      const filename = `${projName}_${formatYMD(new Date())}.pdf`;
      pdf.save(filename);

      setExportSuccessMsg(
        isNl 
          ? `PDF gedownload (${filename})` 
          : `PDF downloaded (${filename})`
      );
      setTimeout(() => setExportSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Export PDF error:', err);
      alert(isNl ? 'Fout bij het exporteren van het PDF document.' : 'Failed to export PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Predecessor options for dependency modal
  const dependencyPredecessors = useMemo(() => {
    if (!dependencyModalAct) return [];
    return activities.filter(a => a.id !== dependencyModalAct.id && a.projectId === dependencyModalAct.projectId);
  }, [dependencyModalAct, activities]);

  const rowHeightPx = 46;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-800">
      
      {/* --- TOP TOOLBAR & CONTROLS --- */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3.5">
        
        {/* Row 1: Project / Exploration Selector & Search & Key Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Left: Project / Exploration Dropdown + Type Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              <span>{isNl ? 'Project / Verkenning:' : 'Project / Exploration:'}</span>
            </label>

            <select
              value={currentProjectFilter}
              onChange={(e) => {
                const val = e.target.value;
                setCurrentProjectFilter(val);
                if (onSelectProject) onSelectProject(val);
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[220px]"
            >
              <option value="all">🌐 {isNl ? 'Alle Projecten & Verkenningen' : 'All Projects & Explorations'}</option>
              <optgroup label={isNl ? '📁 Projecten' : '📁 Projects'}>
                {projects.filter(p => p.type === 'project').map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </optgroup>
              <optgroup label={isNl ? '🧭 Verkenningen' : '🧭 Explorations'}>
                {projects.filter(p => p.type === 'exploration').map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </optgroup>
            </select>

            {/* Type Filter Buttons */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  typeFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isNl ? 'Alles' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('project')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'project' ? 'bg-white text-indigo-700 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderGit className="h-3 w-3 text-blue-500" />
                <span>{isNl ? 'Projecten' : 'Projects'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('exploration')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'exploration' ? 'bg-white text-indigo-700 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass className="h-3 w-3 text-teal-500" />
                <span>{isNl ? 'Verkenningen' : 'Explorations'}</span>
              </button>
            </div>
          </div>

          {/* Right: Search + Hide Completed + Export dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isNl ? 'Zoeken in taken/subtaken...' : 'Search tasks/subtasks...'}
                className="pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Completed Tasks Button */}
            <button
              type="button"
              onClick={() => setHideCompleted(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                hideCompleted 
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' 
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
              title={hideCompleted ? (isNl ? 'Klik om voltooide taken te tonen' : 'Show completed') : (isNl ? 'Klik om afgeronde taken te verbergen' : 'Hide completed')}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${hideCompleted ? 'text-white' : 'text-emerald-600'}`} />
              <span>{isNl ? (hideCompleted ? '✓ Afgerond verborgen' : 'Verberg afgerond') : (hideCompleted ? '✓ Completed hidden' : 'Hide completed')}</span>
            </button>

            {/* Export Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(prev => !prev)}
                disabled={isExporting}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExporting ? (isNl ? 'Exporteren...' : 'Exporting...') : (isNl ? 'Exporteren' : 'Export')}</span>
                <ChevronDown className="h-3 w-3 opacity-80" />
              </button>

              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      {isNl ? 'Download Afbeelding' : 'Download Image'}
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => exportImage('png')}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                        <span>PNG {isNl ? '(Hoge Resolutie)' : '(High-Res)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportImage('jpeg')}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                        <span>JPG {isNl ? '(Gecomprimeerd)' : '(Compressed)'}</span>
                      </button>
                    </div>
                    <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      {isNl ? 'Document' : 'Document'}
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={exportPdf}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-rose-500" />
                        <span>PDF {isNl ? '(A4 Liggend Document)' : '(A4 Landscape)'}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* New Task Button */}
            <button
              type="button"
              onClick={() => onNewActivity(currentProjectFilter !== 'all' ? currentProjectFilter : undefined)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isNl ? 'Nieuwe Taak' : 'New Task'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Timeline Period (Begindatum t/m Einddatum) + Scale & Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
          
          {/* Left: Custom Period Adjustment Inputs & Nav Arrows */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              <span>{isNl ? 'Periode:' : 'Period:'}</span>
            </span>

            {/* Shift Arrows */}
            <div className="flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => shiftPeriod('prev')}
                className="px-2 py-1 bg-white hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title={isNl ? 'Verschuif naar het verleden' : 'Shift earlier'}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={jumpToToday}
                className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 font-extrabold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                title={isNl ? 'Spring naar datum van vandaag' : 'Jump to today'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                <span>{isNl ? 'Vandaag' : 'Today'}</span>
              </button>
              <button
                type="button"
                onClick={() => shiftPeriod('next')}
                className="px-2 py-1 bg-white hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title={isNl ? 'Verschuif naar de toekomst' : 'Shift later'}
              >
                ▶
              </button>
            </div>

            {/* Date Pickers: Begindatum t/m Einddatum */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-slate-300 rounded-xl shadow-2xs">
              <span className="text-[10.5px] font-bold text-slate-400">{isNl ? 'Van:' : 'From:'}</span>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
              <span className="text-slate-300 font-normal">→</span>
              <span className="text-[10.5px] font-bold text-slate-400">{isNl ? 'Tot:' : 'To:'}</span>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            {/* Quick Period Presets */}
            <div className="hidden lg:flex items-center gap-1">
              <button
                type="button"
                onClick={fitAllTasks}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                title={isNl ? 'Toon alle taken in beeld' : 'Fit all tasks'}
              >
                🔍 {isNl ? 'Alles in beeld' : 'Fit All'}
              </button>
              <button
                type="button"
                onClick={() => applyPresetPeriod('this_quarter')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                {isNl ? 'Dit kwartaal' : 'This Quarter'}
              </button>
              <button
                type="button"
                onClick={() => applyPresetPeriod('this_year')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                {isNl ? 'Dit jaar' : 'This Year'}
              </button>
            </div>
          </div>

          {/* Right: Scale selection & Zoom slider / buttons */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Scale: Dagen, Weken, Maanden, Kwartalen, Jaren */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold">
              <span className="text-[10px] font-black text-slate-500 uppercase px-1.5 hidden sm:inline">
                {isNl ? 'Schaal:' : 'Scale:'}
              </span>
              {(['day', 'iso_week', 'month', 'quarter', 'year'] as GanttTimeScale[]).map(sc => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setTimeScale(sc)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    timeScale === sc 
                      ? 'bg-white text-indigo-700 font-extrabold shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sc === 'day' && (isNl ? 'Dagen' : 'Days')}
                  {sc === 'iso_week' && (isNl ? 'Weken' : 'Weeks')}
                  {sc === 'month' && (isNl ? 'Maanden' : 'Months')}
                  {sc === 'quarter' && (isNl ? 'Kwartalen' : 'Quarters')}
                  {sc === 'year' && (isNl ? 'Jaren' : 'Years')}
                </button>
              ))}
            </div>

            {/* Zoom Controls: Zoom in / Zoom out & Slider */}
            <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                className="p-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg shadow-xs cursor-pointer"
                title={isNl ? 'Uitzoomen' : 'Zoom out'}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-mono font-black text-slate-700 px-1 min-w-[38px] text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(220, prev + 15))}
                className="p-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg shadow-xs cursor-pointer"
                title={isNl ? 'Inzoomen' : 'Zoom in'}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="px-1.5 py-0.5 text-[9px] font-black text-indigo-700 bg-white hover:bg-indigo-50 rounded-md cursor-pointer border border-indigo-100"
                title={isNl ? 'Herstel zoom' : 'Reset zoom'}
              >
                100%
              </button>
            </div>

            {/* Expand / Collapse All Subtasks */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={collapseAll}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
                title={isNl ? 'Klap alle subtaken in' : 'Collapse all subtasks'}
              >
                <Folder className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={expandAll}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
                title={isNl ? 'Klap alle subtaken uit' : 'Expand all subtasks'}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* --- MAIN GANTT CHART CANVAS CONTAINER (Target for Print & Export) --- */}
      <div 
        ref={chartContainerRef}
        className="flex flex-col bg-white overflow-hidden relative select-none"
      >
        {/* Top Header Banner: Project/Exploration Title, Details & IT Platform Twente Logo */}
        <div 
          data-gantt-export-header="true"
          className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-6"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md ${
                selectedProjectObj?.type === 'exploration'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
              }`}>
                {selectedProjectObj
                  ? (selectedProjectObj.type === 'exploration' ? (isNl ? 'Verkenning' : 'Exploration') : (isNl ? 'Project' : 'Project'))
                  : (isNl ? 'Totaaloverzicht' : 'Overview')}
              </span>
              {selectedProjectObj?.status && (
                <span className="text-xs font-bold text-slate-500">
                  • {selectedProjectObj.status}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {selectedProjectObj 
                ? selectedProjectObj.title 
                : (isNl ? 'Gantt-Tijdlijn: Alle Projecten & Verkenningen' : 'Gantt Timeline: All Projects & Explorations')}
            </h2>

            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-500 font-medium">
              <span>
                <strong className="text-slate-700">{isNl ? 'Periode:' : 'Period:'}</strong> {startDateStr} t/m {endDateStr}
              </span>
              <span>
                <strong className="text-slate-700">{isNl ? 'Schaal:' : 'Scale:'}</strong> {
                  timeScale === 'day' ? (isNl ? 'Dagen' : 'Days') :
                  timeScale === 'iso_week' ? (isNl ? 'Weken' : 'Weeks') :
                  timeScale === 'month' ? (isNl ? 'Maanden' : 'Months') :
                  timeScale === 'quarter' ? (isNl ? 'Kwartalen' : 'Quarters') :
                  (isNl ? 'Jaren' : 'Years')
                }
              </span>
              <span>
                <strong className="text-slate-700">{isNl ? 'Datum export:' : 'Date:'}</strong> {new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Logo iT Platform Twente (rechtsbovenin) */}
          <div className="shrink-0 flex items-center justify-end pl-4">
            <ITPlatformTwenteLogo className="h-12 w-auto" />
          </div>
        </div>

        {/* Sub-header Legend and Hints */}
        <div 
          data-gantt-legend-bar="true"
          className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold text-slate-600"
        >
          {/* Navigation guidance: shown on web, hidden during export via onclone */}
          <div data-gantt-nav-hint="true" className="flex items-center gap-2 text-slate-500">
            <span className="text-indigo-700 font-extrabold">💡 {isNl ? 'Gantt-navigatie:' : 'Gantt guidance:'}</span>
            <span>{isNl ? 'Sleep taken om te herordenen. Klik op 🔗 om afhankelijkheden te leggen of te verwijderen. Taken met subtaken tonen als totaalbalk.' : 'Drag tasks to reorder. Click 🔗 to manage dependencies. Tasks with subtasks show as summary bars.'}</span>
          </div>

          <div data-gantt-legend="true" className="flex items-center gap-4 flex-wrap text-[10.5px] ml-auto">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-slate-800 rounded-xs inline-block"></span>
              <span className="font-extrabold text-slate-800">{isNl ? 'Totaalbalk (Samenvatting)' : 'Summary Bar'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rotate-45 inline-block border border-white shadow-2xs"></span>
              <span className="font-extrabold text-amber-700">{isNl ? 'Mijlpaal ◆' : 'Milestone ◆'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-slate-400 border border-slate-500 rounded-xs inline-block"></span>
              <span className="text-slate-700 font-semibold">{isNl ? 'Nog te doen (gepland / nog uit te voeren)' : 'To Do (planned / not yet executed)'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-xs inline-block"></span>
              <span className="text-slate-700 font-semibold">{isNl ? 'In uitvoering' : 'In Progress'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs inline-block"></span>
              <span className="text-slate-700 font-semibold">{isNl ? 'Voltooid' : 'Completed'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-600 border border-rose-700 rounded-xs inline-block shadow-2xs"></span>
              <span className="text-rose-700 font-bold">{isNl ? 'Overschrijding (te laat)' : 'Overdue (late)'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs inline-block"></span>
              <span className="text-amber-800 font-semibold">{isNl ? 'On Hold (gepauzeerd)' : 'On Hold'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-stone-300 border border-stone-400 rounded-xs inline-block"></span>
              <span className="text-stone-600 font-semibold">{isNl ? 'Vervallen / Geannuleerd' : 'Cancelled'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-500 inline-block"></span>
              <span className="text-indigo-700 font-semibold">{isNl ? 'Afhankelijkheid ➔' : 'Dependency ➔'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-0.5 h-2.5 bg-rose-500 inline-block"></span>
              <span className="text-rose-700 font-semibold">{isNl ? 'Vandaag' : 'Today'}</span>
            </span>
          </div>
        </div>

        {/* Scrollable Layout Container */}
        <div 
          ref={timelineScrollRef}
          data-gantt-scroll-container="true"
          className="flex overflow-x-auto relative divide-x divide-slate-200"
        >
          {/* ================= LEFT COLUMN: HIERARCHICAL TASK LIST ================= */}
          <div 
            data-gantt-left-col="true"
            className="w-[320px] sm:w-[380px] shrink-0 bg-white z-20 shadow-xs border-r border-slate-200"
          >
            
            {/* Header row for task list */}
            <div className="h-12 bg-slate-100 border-b border-slate-200 px-3 flex items-center justify-between text-xs font-black text-slate-600 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                <span>{isNl ? 'Taak / Mijlpaal' : 'Task / Milestone'}</span>
                <span className="text-[10px] text-slate-400 font-normal">({hierarchicalActivities.length})</span>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400">
                {isNl ? 'Datums & Acties' : 'Dates & Actions'}
              </span>
            </div>

            {/* Empty State */}
            {hierarchicalActivities.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold">{isNl ? 'Geen taken gevonden met de huidige filters.' : 'No tasks found with current filters.'}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setHideCompleted(false);
                    setStatusFilter('all');
                  }}
                  className="mt-3 px-3 py-1 bg-indigo-50 text-indigo-600 font-bold rounded-lg text-xs"
                >
                  {isNl ? 'Filters herstellen' : 'Reset filters'}
                </button>
              </div>
            ) : (
              /* Rows */
              <div className="divide-y divide-slate-150">
                {hierarchicalActivities.map((item, rowIdx) => {
                  const { activity, isRoot, hasChildren, depth, isCollapsed, resolved } = item;
                  const isDraggingThis = draggedActivityId === activity.id;
                  const isDragOverThis = dragOverActivityId === activity.id;
                  const actProject = projects.find(p => p.id === activity.projectId);
                  const todayStr = formatYMD(new Date());
                  const isCompleted = activity.status === 'completed';
                  const isExcludedFromOverdue = isCompleted || activity.status === 'on_hold' || activity.status === 'cancelled';
                  const effectiveDueDate = resolved.endDate || resolved.startDate;
                  const isOverdue = !isExcludedFromOverdue && Boolean(effectiveDueDate && effectiveDueDate < todayStr);

                  return (
                    <div
                      key={activity.id}
                      draggable
                      onDragStart={() => handleDragStart(activity.id)}
                      onDragOver={(e) => handleDragOver(e, activity.id)}
                      onDrop={() => handleDrop(activity.id)}
                      style={{ height: `${rowHeightPx}px` }}
                      className={`flex items-center justify-between px-2.5 transition-colors group relative ${
                        isDraggingThis ? 'opacity-30 bg-indigo-50' : ''
                      } ${isDragOverThis ? 'border-t-2 border-indigo-600 bg-indigo-50/60' : ''} ${
                        resolved.isSummary 
                          ? 'bg-slate-50/70 font-black' 
                          : isOverdue 
                            ? 'bg-rose-50/40 hover:bg-rose-50/70' 
                            : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Left: Drag Grip + Nesting Depth + Expand/Collapse + Milestone/Completed Icon + Title */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                        
                        {/* Drag Handle */}
                        <div 
                          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 shrink-0" 
                          title={isNl ? 'Sleep om te herordenen' : 'Drag to reorder'}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>

                        {/* Indentation for subtasks */}
                        {depth > 0 && (
                          <div className="flex items-center text-slate-300 select-none pl-1">
                            <span className="text-slate-400 font-black text-xs mr-1">↳</span>
                          </div>
                        )}

                        {/* Expand / Collapse Button for Summary tasks */}
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(activity.id)}
                            className="p-0.5 text-indigo-700 hover:bg-indigo-100 rounded cursor-pointer shrink-0"
                            title={isCollapsed ? (isNl ? 'Subtaken uitklappen' : 'Expand') : (isNl ? 'Subtaken inklappen' : 'Collapse')}
                          >
                            {isCollapsed ? (
                              <ChevronRightIcon className="h-3.5 w-3.5 text-indigo-700" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-indigo-700" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}

                        {/* Milestone Diamond Icon */}
                        {activity.isMilestone && (
                          <div 
                            className={`w-3.5 h-3.5 ${
                              isOverdue 
                                ? 'bg-rose-600 ring-1 ring-rose-300' 
                                : isCompleted 
                                  ? 'bg-emerald-600' 
                                  : 'bg-amber-500'
                            } rotate-45 border border-white shrink-0 flex items-center justify-center shadow-xs`} 
                            title={isOverdue ? (isNl ? '⚠️ Mijlpaal overschreden (te laat)' : '⚠️ Milestone overdue') : (isNl ? 'Mijlpaal' : 'Milestone')}
                          >
                            <span className={`text-[7px] ${isOverdue || isCompleted ? 'text-white' : 'text-amber-950'} -rotate-45 font-black`}>
                              {isOverdue ? '!' : '◆'}
                            </span>
                          </div>
                        )}

                        {/* Status Check Icon */}
                        {isCompleted && !activity.isMilestone && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" title={isNl ? 'Voltooid' : 'Completed'} />
                        )}

                        {/* Summary Bar Folder Icon */}
                        {resolved.isSummary && (
                          <Folder className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                        )}

                        {/* Title text */}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              onClick={() => onEditActivity(activity)}
                              className={`truncate cursor-pointer hover:underline ${
                                resolved.isSummary 
                                  ? 'font-black text-slate-900 text-xs' 
                                  : isOverdue 
                                    ? 'font-black text-rose-700 text-xs' 
                                    : activity.isMilestone 
                                      ? 'font-black text-amber-900 text-xs' 
                                      : 'font-bold text-slate-700 text-xs'
                              }`}
                              title={isOverdue ? `${activity.title} (${isNl ? '⚠️ Overschrijding: niet op tijd afgerond' : '⚠️ Overdue'})` : activity.title}
                            >
                              {activity.title}
                            </span>

                            {/* Overdue Badge */}
                            {isOverdue && (
                              <span className="text-[8px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5" title={isNl ? 'Niet op tijd afgerond' : 'Not completed in time'}>
                                <span>⚠️</span>
                                <span>{isNl ? 'Te laat' : 'Overdue'}</span>
                              </span>
                            )}

                            {/* Collapsed subtask counter badge */}
                            {resolved.isSummary && isCollapsed && (
                              <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md shrink-0">
                                +{resolved.subtaskCount}
                              </span>
                            )}
                          </div>

                          {/* Date and assignee subtext */}
                          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-mono truncate">
                            <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                              {resolved.startDate ? parseYMD(resolved.startDate).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' }) : '-'}
                              {!activity.isMilestone && resolved.endDate && ` → ${parseYMD(resolved.endDate).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })}`}
                            </span>
                            {activity.assignee && (
                              <span className="text-indigo-600 font-sans font-bold">
                                👤 {activity.assignee}
                              </span>
                            )}
                            {currentProjectFilter === 'all' && actProject && (
                              <span className="text-slate-500 font-sans font-semibold">
                                • {actProject.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Actions (Dependencies 🔗, Edit ✏️, Move ▲▼) */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        
                        {/* Dependency Link Button */}
                        <button
                          type="button"
                          onClick={() => setDependencyModalAct(activity)}
                          className={`p-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-0.5 ${
                            activity.dependencies && activity.dependencies.length > 0
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-200'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'
                          }`}
                          title={isNl ? `Afhankelijkheden beheren (${activity.dependencies?.length || 0})` : `Manage dependencies (${activity.dependencies?.length || 0})`}
                        >
                          <LinkIcon className="h-3 w-3" />
                          {activity.dependencies && activity.dependencies.length > 0 && (
                            <span className="text-[9px]">{activity.dependencies.length}</span>
                          )}
                        </button>

                        {/* Move Up/Down Accessibility */}
                        <div className="hidden sm:flex flex-col">
                          <button
                            type="button"
                            onClick={() => moveTask(activity.id, 'up')}
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                            title={isNl ? 'Omhoog verplaatsen' : 'Move up'}
                          >
                            <ArrowUp className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTask(activity.id, 'down')}
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                            title={isNl ? 'Omlaag verplaatsen' : 'Move down'}
                          >
                            <ArrowDown className="h-2.5 w-2.5" />
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => onEditActivity(activity)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title={isNl ? 'Bewerken' : 'Edit'}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>

                        {/* Add Subtask shortcut */}
                        {isRoot && (
                          <button
                            type="button"
                            onClick={() => onNewActivity(activity.projectId, activity.id)}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer hidden md:block"
                            title={isNl ? '+ Subtaak toevoegen onder deze taak' : '+ Add subtask'}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= RIGHT COLUMN: GANTT CHART TIMELINE BARS & SVG DEPENDENCY ARROWS ================= */}
          <div 
            data-gantt-timeline-col="true"
            className="flex-1 bg-white relative overflow-hidden"
            style={{ minWidth: `${Math.max(600, totalTimelineWidthPx)}px` }}
          >
            {/* Timeline Header Ruler (Two Tiers) */}
            <div className="h-12 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 flex flex-col select-none">
              
              {/* Top Tier: Months / Quarters / Years */}
              <div className="h-6 flex items-center border-b border-slate-200 bg-indigo-50/70 font-mono text-[10px] font-black text-indigo-900">
                {timelineColumns.map((col, idx) => (
                  <div
                    key={`top-${col.key}-${idx}`}
                    style={{ width: `${col.widthPx}px` }}
                    className="h-full flex items-center justify-center border-r border-indigo-150 truncate px-1"
                    title={col.subLabel || col.label}
                  >
                    <span className="truncate">{col.subLabel || col.label}</span>
                  </div>
                ))}
              </div>

              {/* Bottom Tier: Days / ISO Weeks / Months */}
              <div className="h-6 flex items-center font-mono text-[9.5px] font-bold text-slate-600">
                {timelineColumns.map((col, idx) => {
                  const todayMs = new Date().getTime();
                  const isTodayCol = col.startDate.getTime() <= todayMs && todayMs < col.endDate.getTime();
                  return (
                    <div
                      key={`bot-${col.key}-${idx}`}
                      style={{ width: `${col.widthPx}px` }}
                      className={`h-full flex items-center justify-center border-r truncate px-0.5 relative transition-colors ${
                        isTodayCol 
                          ? 'bg-rose-100/90 text-rose-950 font-black border-r-rose-300' 
                          : 'border-slate-200/80 text-slate-600'
                      }`}
                      title={`${col.label}${isTodayCol ? ` (${isNl ? 'Vandaag' : 'Today'})` : ''}`}
                    >
                      {isTodayCol && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 shrink-0 animate-pulse"></span>
                      )}
                      <span className="truncate">{col.label}</span>
                      {isTodayCol && (
                        <span className="absolute bottom-0 inset-x-0 h-0.5 bg-rose-600"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Grid Container with Absolute Overlay Lines */}
            <div 
              className="relative"
              style={{ height: `${hierarchicalActivities.length * rowHeightPx}px` }}
            >
              {/* 1. Vertical Grid Lines */}
              <div className="absolute inset-0 pointer-events-none z-0 flex">
                {timelineColumns.map((col, idx) => {
                  const todayMs = new Date().getTime();
                  const isTodayCol = col.startDate.getTime() <= todayMs && todayMs < col.endDate.getTime();
                  return (
                    <div
                      key={`grid-${col.key}-${idx}`}
                      style={{ width: `${col.widthPx}px` }}
                      className={`h-full border-r shrink-0 transition-colors ${
                        isTodayCol 
                          ? 'bg-rose-50/20 border-r-rose-100' 
                          : 'border-slate-100'
                      }`}
                    />
                  );
                })}
              </div>

              {/* 2. Today's Vertical Line */}
              {todayX !== null && todayX >= 0 && todayX <= totalTimelineWidthPx && (
                <div 
                  className="absolute top-0 bottom-0 pointer-events-none z-20 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${todayX}px` }}
                >
                  <div className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider select-none whitespace-nowrap z-30 mt-0.5">
                    {isNl ? 'Vandaag' : 'Today'}
                  </div>
                  <div className="w-[2px] h-full bg-rose-500 shadow-xs"></div>
                </div>
              )}

              {/* 3. SVG DEPENDENCY ARROW OVERLAY */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible"
              >
                <defs>
                  <marker 
                    id="gantt-arrow-indigo" 
                    viewBox="0 0 10 10" 
                    refX="7" 
                    refY="5" 
                    markerWidth="6" 
                    markerHeight="6" 
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
                  </marker>
                  <marker 
                    id="gantt-arrow-emerald" 
                    viewBox="0 0 10 10" 
                    refX="7" 
                    refY="5" 
                    markerWidth="6" 
                    markerHeight="6" 
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                  </marker>
                </defs>

                {hierarchicalActivities.flatMap((item, curRowIdx) => {
                  const act = item.activity;
                  if (!act.dependencies || act.dependencies.length === 0) return [];

                  return act.dependencies.map(depId => {
                    const predRowIdx = hierarchicalActivities.findIndex(h => h.activity.id === depId);
                    if (predRowIdx === -1) return null;

                    const predItem = hierarchicalActivities[predRowIdx];
                    const predResolved = predItem.resolved;
                    const curResolved = item.resolved;

                    if (!predResolved.startDate || !curResolved.startDate) return null;

                    const predEndDate = predItem.activity.isMilestone 
                      ? (predResolved.startDate 
                          ? new Date(parseYMD(predResolved.startDate).getFullYear(), parseYMD(predResolved.startDate).getMonth(), parseYMD(predResolved.startDate).getDate(), 12, 0, 0)
                          : new Date())
                      : (predResolved.endDate ? parseYMDEndOfDay(predResolved.endDate) : (predResolved.startDate ? parseYMDEndOfDay(predResolved.startDate) : new Date()));
                    const curStartDate = curResolved.startDate ? parseYMD(curResolved.startDate) : new Date();

                    const x1 = getPixelXForDate(predEndDate);
                    const x2 = getPixelXForDate(curStartDate);

                    const y1 = predRowIdx * rowHeightPx + (rowHeightPx / 2);
                    const y2 = curRowIdx * rowHeightPx + (rowHeightPx / 2);

                    const isCompleted = predItem.activity.status === 'completed';

                    // Orthogonal routing path
                    let pathData = '';
                    if (x2 > x1 + 14) {
                      pathData = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${y2} L ${x2} ${y2}`;
                    } else {
                      const midY = (y1 + y2) / 2;
                      pathData = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${midY} L ${Math.max(0, x2 - 12)} ${midY} L ${Math.max(0, x2 - 12)} ${y2} L ${x2} ${y2}`;
                    }

                    return (
                      <g key={`dep-${depId}-${act.id}`}>
                        <path
                          d={pathData}
                          fill="none"
                          stroke={isCompleted ? '#10b981' : '#6366f1'}
                          strokeWidth="2"
                          strokeDasharray={isCompleted ? 'none' : '4,3'}
                          markerEnd={isCompleted ? 'url(#gantt-arrow-emerald)' : 'url(#gantt-arrow-indigo)'}
                          opacity="0.85"
                        />
                      </g>
                    );
                  });
                })}
              </svg>

              {/* 4. GANTT BARS RENDERED IN ROWS */}
              {hierarchicalActivities.map((item, rowIdx) => {
                const { activity, resolved } = item;
                const sDate = resolved.startDate ? parseYMD(resolved.startDate) : null;
                const eDate = resolved.endDate 
                  ? parseYMDEndOfDay(resolved.endDate) 
                  : (sDate ? parseYMDEndOfDay(resolved.startDate) : null);

                if (!sDate) {
                  return (
                    <div 
                      key={`row-bar-${activity.id}`} 
                      style={{ height: `${rowHeightPx}px`, top: `${rowIdx * rowHeightPx}px` }}
                      className="absolute inset-x-0 border-b border-slate-100 flex items-center px-4"
                    >
                      <span className="text-[10px] text-amber-600 italic">
                        {isNl ? 'Geen datum ingesteld' : 'No date set'}
                      </span>
                    </div>
                  );
                }

                const milestoneDate = resolved.startDate 
                  ? new Date(parseYMD(resolved.startDate).getFullYear(), parseYMD(resolved.startDate).getMonth(), parseYMD(resolved.startDate).getDate(), 12, 0, 0)
                  : null;

                const startX = activity.isMilestone && milestoneDate
                  ? getPixelXForDate(milestoneDate)
                  : getPixelXForDate(sDate);
                
                const endX = activity.isMilestone 
                  ? startX 
                  : (eDate ? getPixelXForDate(eDate) : startX + 40);
                
                const barWidth = activity.isMilestone ? 0 : Math.max(20, endX - startX);
                const topPx = rowIdx * rowHeightPx;
                const statusConf = STATUS_CONFIG[activity.status] || STATUS_CONFIG.todo;
                const todayStr = formatYMD(new Date());
                const isCompleted = activity.status === 'completed';
                const isExcludedFromOverdue = isCompleted || activity.status === 'on_hold' || activity.status === 'cancelled';
                const effectiveDueDate = resolved.endDate || resolved.startDate;
                const isOverdue = !isExcludedFromOverdue && Boolean(effectiveDueDate && effectiveDueDate < todayStr);

                return (
                  <div
                    key={`row-bar-${activity.id}`}
                    style={{ 
                      height: `${rowHeightPx}px`, 
                      top: `${topPx}px` 
                    }}
                    className="absolute inset-x-0 border-b border-slate-100/90 flex items-center"
                  >
                    {/* CASE A: MILESTONE (DIAMOND ICON) */}
                    {activity.isMilestone ? (
                      <div
                        onClick={() => onEditActivity(activity)}
                        style={{ left: `${startX - 10}px` }}
                        className={`absolute w-5 h-5 ${
                          isOverdue 
                            ? 'bg-rose-600 hover:bg-rose-700 border-2 border-white ring-2 ring-rose-400 shadow-md' 
                            : isCompleted 
                              ? 'bg-emerald-600 hover:bg-emerald-700 border-2 border-white shadow-md' 
                              : 'bg-amber-500 hover:bg-amber-600 border-2 border-white shadow-md'
                        } rotate-45 cursor-pointer z-10 flex items-center justify-center transition-transform hover:scale-125`}
                        title={`${activity.title} (${resolved.startDate}) - ${
                          isOverdue 
                            ? (isNl ? '⚠️ Mijlpaal overschreden (niet op tijd afgerond)' : '⚠️ Milestone overdue') 
                            : (isNl ? 'Mijlpaal' : 'Milestone')
                        }`}
                      >
                        <span className={`text-[8px] font-black ${isOverdue || isCompleted ? 'text-white' : 'text-amber-950'} -rotate-45`}>
                          {isOverdue ? '!' : '◆'}
                        </span>
                      </div>
                    ) : resolved.isSummary ? (
                      /* CASE B: SUMMARY / TOTAALBALK (Parent task roll-up bar) */
                      <div
                        onClick={() => onEditActivity(activity)}
                        style={{ 
                          left: `${startX}px`, 
                          width: `${barWidth}px` 
                        }}
                        className={`absolute h-4 ${isOverdue ? 'bg-rose-950 border border-rose-600' : 'bg-slate-900'} rounded-xs cursor-pointer select-none shadow-sm transition-all hover:brightness-110 z-10 flex items-center`}
                        title={`${activity.title} [${isNl ? 'Totaalbalk' : 'Summary'}${isOverdue ? (isNl ? ' • ⚠️ Overschrijding' : ' • ⚠️ Overdue') : ''}]: ${resolved.startDate} t/m ${resolved.endDate} (${resolved.completedCount}/${resolved.subtaskCount} ${isNl ? 'voltooid' : 'completed'})`}
                      >
                        {/* Downward bracket ears (left and right) */}
                        <div 
                          className={`absolute -left-1 top-0 bottom-0 w-2.5 h-6 ${isOverdue ? 'bg-rose-900' : 'bg-slate-950'}`} 
                          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 60%)' }} 
                        />
                        <div 
                          className={`absolute -right-1 top-0 bottom-0 w-2.5 h-6 ${isOverdue ? 'bg-rose-900' : 'bg-slate-950'}`} 
                          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 0% 100%)' }} 
                        />

                        {/* Internal progress fill for summary */}
                        {resolved.subtaskCount > 0 && (
                          <div 
                            className="h-full bg-emerald-500/80 rounded-xs transition-all"
                            style={{ width: `${Math.round((resolved.completedCount / resolved.subtaskCount) * 100)}%` }}
                          />
                        )}

                        {/* Text label inside or next to summary bar */}
                        {barWidth > 60 && (
                          <span className="absolute inset-0 flex items-center justify-center px-2 text-[8.5px] font-extrabold text-white truncate pointer-events-none">
                            📁 {activity.title} ({Math.round((resolved.completedCount / Math.max(1, resolved.subtaskCount)) * 100)}%)
                            {isOverdue && ' ⚠️'}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* CASE C: STANDARD TASK / SUBTASK BAR */
                      <div
                        onClick={() => onEditActivity(activity)}
                        style={{ 
                          left: `${startX}px`, 
                          width: `${barWidth}px` 
                        }}
                        className={`absolute h-6 rounded-lg border text-[10px] font-black px-2 flex items-center justify-between cursor-pointer select-none truncate shadow-xs transition-all hover:scale-[1.01] hover:shadow-md z-10 ${
                          isOverdue 
                            ? 'bg-rose-600 border-rose-700 text-white ring-1 ring-rose-300' 
                            : `${statusConf.barBg} ${statusConf.barBorder} text-white`
                        }`}
                        title={`${activity.title} [${
                          isOverdue 
                            ? (isNl ? '⚠️ Overschrijding: niet op tijd afgerond' : '⚠️ Overdue: not completed in time') 
                            : statusConf.labelNl
                        }] (${resolved.startDate} tot ${resolved.endDate})`}
                      >
                        {/* Label */}
                        {barWidth > 35 && (
                          <span className="truncate pr-1 flex items-center gap-1">
                            {isOverdue && <span className="text-[9px] shrink-0">⚠️</span>}
                            <span className="truncate">{activity.title}</span>
                          </span>
                        )}

                        {/* Status Icon Indicator */}
                        <span className="text-[9px] shrink-0 font-mono">
                          {isOverdue && '⚠️'}
                          {!isOverdue && activity.status === 'completed' && '✓'}
                          {!isOverdue && activity.status === 'in_progress' && '⚡'}
                          {!isOverdue && activity.status === 'on_hold' && '⏸'}
                          {!isOverdue && activity.status === 'cancelled' && '✕'}
                          {!isOverdue && activity.status === 'todo' && '○'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- DEPENDENCY MANAGEMENT MODAL --- */}
      {dependencyModalAct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-800">
                  {isNl ? 'Afhankelijkheden Beheren' : 'Manage Dependencies'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDependencyModalAct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 flex flex-col gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{isNl ? 'Geselecteerde taak:' : 'Selected task:'}</span>
                <p className="font-black text-slate-800 text-sm mt-0.5">{dependencyModalAct.title}</p>
                <p className="text-slate-500 text-[11px]">
                  {isNl ? 'Moet wachten op het voltooien van onderstaande voorgangers:' : 'Must wait for completion of the following predecessors:'}
                </p>
              </div>

              {/* Current Dependencies List */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
                  {isNl ? 'Huidige Voorgangers (Afhankelijkheden):' : 'Current Predecessors:'}
                </span>

                {(!dependencyModalAct.dependencies || dependencyModalAct.dependencies.length === 0) ? (
                  <p className="text-slate-400 italic text-center py-2">
                    {isNl ? 'Geen afhankelijkheden geconfigureerd. Deze taak kan direct starten.' : 'No dependencies configured. This task can start immediately.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {dependencyModalAct.dependencies.map(depId => {
                      const pred = activities.find(a => a.id === depId);
                      if (!pred) return null;
                      return (
                        <div 
                          key={pred.id} 
                          className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-indigo-600 font-black">➔</span>
                            <span className="font-bold text-slate-800 truncate">{pred.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({pred.endDate || pred.startDate || '-'})</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              removeDependency(dependencyModalAct.id, pred.id);
                              setDependencyModalAct(prev => prev ? {
                                ...prev,
                                dependencies: (prev.dependencies || []).filter(id => id !== pred.id)
                              } : null);
                            }}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                            title={isNl ? 'Verwijder afhankelijkheid' : 'Remove dependency'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New Dependency Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider">
                  {isNl ? '+ Voeg nieuwe afhankelijkheid toe:' : '+ Add new dependency:'}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="new-dep-select"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500"
                    defaultValue=""
                  >
                    <option value="" disabled>{isNl ? 'Kies een taak om op te wachten...' : 'Select task to wait for...'}</option>
                    {dependencyPredecessors
                      .filter(p => !dependencyModalAct.dependencies?.includes(p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.title} ({p.startDate} t/m {p.endDate || p.startDate})</option>
                      ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById('new-dep-select') as HTMLSelectElement;
                      if (sel && sel.value) {
                        addDependency(dependencyModalAct.id, sel.value);
                        setDependencyModalAct(prev => prev ? {
                          ...prev,
                          dependencies: [...(prev.dependencies || []), sel.value]
                        } : null);
                        sel.value = '';
                      }
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-xs cursor-pointer transition-all shrink-0"
                  >
                    {isNl ? 'Koppelen' : 'Link'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-150 flex justify-end">
              <button
                type="button"
                onClick={() => setDependencyModalAct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs cursor-pointer"
              >
                {isNl ? 'Klaar' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Export Toast Notification */}
      {exportSuccessMsg && (
        <div 
          id="gantt-export-toast"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-slate-700 animate-in fade-in slide-in-from-bottom-3"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
            <Check className="h-3 w-3" />
          </div>
          <span>{exportSuccessMsg}</span>
          <button 
            type="button" 
            onClick={() => setExportSuccessMsg(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
