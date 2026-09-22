import React, { useState, useMemo } from 'react';
import { Project, ProjectActivity, ActivityStatus, Language } from '../types';
import { 
  Calendar, ChevronLeft, ChevronRight, Filter, Layers, 
  CheckCircle2, Clock, AlertCircle, Edit2, Trash2, Plus, 
  ChevronDown, ChevronRight as ChevronRightIcon, User, Flag, ArrowUpDown, Sparkles,
  Link as LinkIcon, Download, FileText, Image as ImageIcon, Eye, ArrowRight, ShieldCheck, SlidersHorizontal,
  Folder, FolderOpen, ListTree, ArrowUp, ArrowDown, GripVertical
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';

export type MatrixScale = 'day' | 'iso_week' | 'month' | 'quarter' | 'year' | 'multi_year';
export type ColorStrategy = 'status' | 'project' | 'type';

interface ProjectPlannerMatrixTableProps {
  projects: Project[];
  activities: ProjectActivity[];
  selectedProjectId: string;
  lang: Language;
  onEditActivity: (act: ProjectActivity) => void;
  onDeleteActivity: (actId: string, title: string) => void;
  onNewActivity: () => void;
  onUpdateActivityStatus?: (actId: string, newStatus: ActivityStatus) => void;
  onReorderActivities?: (newActivities: ProjectActivity[]) => void;
}

// Helper: Get ISO Week Number
function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper: Parse YMD string safely to local Date
function parseYMD(str: string): Date {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }
  return new Date(str);
}

function toLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export default function ProjectPlannerMatrixTable({
  projects,
  activities,
  selectedProjectId,
  lang,
  onEditActivity,
  onDeleteActivity,
  onNewActivity,
  onUpdateActivityStatus,
  onReorderActivities
}: ProjectPlannerMatrixTableProps) {
  const isNl = lang === 'nl';

  // --- View States ---
  const [scale, setScale] = useState<MatrixScale>('month');
  const [periodCount, setPeriodCount] = useState<number>(12); // Default to 12 compact periods
  const [periodOffset, setPeriodOffset] = useState<number>(0); // Shift backward / forward
  const [colorStrategy, setColorStrategy] = useState<ColorStrategy>('status');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Collapse / Expand tree state
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Column 1 customization states
  const [showDates, setShowDates] = useState<boolean>(true);
  const [showProjectBadge, setShowProjectBadge] = useState<boolean>(true);
  const [showDescription, setShowDescription] = useState<boolean>(false);
  const [isViewConfigOpen, setIsViewConfigOpen] = useState<boolean>(false);

  // Dependency & Interaction states
  const [showDependencies, setShowDependencies] = useState<boolean>(true);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // Helper for cleanly formatting start and end dates on line 2
  const formatDateRange = (startStr?: string, endStr?: string) => {
    if (!startStr) return '';
    const dStart = parseYMD(startStr);
    const startFmt = dStart.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' });
    if (!endStr || endStr === startStr) {
      return startFmt;
    }
    const dEnd = parseYMD(endStr);
    const endFmt = dEnd.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' });
    
    // Include year if start and end span different years
    if (dStart.getFullYear() !== dEnd.getFullYear()) {
      return `${startFmt} '${dStart.getFullYear().toString().slice(-2)} - ${endFmt} '${dEnd.getFullYear().toString().slice(-2)}`;
    }
    return `${startFmt} - ${endFmt}`;
  };

  // Exporting state
  const [isExporting, setIsExporting] = useState<'png' | 'pdf' | null>(null);

  // Project map for quick title lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Activity map for dependency lookups
  const activityMap = useMemo(() => {
    const map = new Map<string, ProjectActivity>();
    activities.forEach(a => map.set(a.id, a));
    return map;
  }, [activities]);

  // Successor map: activityId -> list of activities that depend on it
  const successorsMap = useMemo(() => {
    const map = new Map<string, ProjectActivity[]>();
    activities.forEach(a => {
      if (a.dependencies && Array.isArray(a.dependencies)) {
        a.dependencies.forEach(depId => {
          const list = map.get(depId) || [];
          list.push(a);
          map.set(depId, list);
        });
      }
    });
    return map;
  }, [activities]);

  // Toggle Collapse/Expand
  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter activities by project selection, status and search query
  const filteredActivities = useMemo(() => {
    let pool = selectedProjectId === 'all' 
      ? [...activities]
      : activities.filter(a => a.projectId === selectedProjectId);

    if (filterStatus !== 'all') {
      pool = pool.filter(a => a.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      pool = pool.filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }

    return pool;
  }, [activities, selectedProjectId, filterStatus, searchQuery]);

  // Compute overall min/max date range of activities
  const baseRangeDate = useMemo(() => {
    if (filteredActivities.length === 0) return toLocalMidnight(new Date());
    const validDates = filteredActivities.map(a => parseYMD(a.startDate)).filter(d => !isNaN(d.getTime()));
    if (validDates.length === 0) return toLocalMidnight(new Date());
    const minMs = Math.min(...validDates.map(d => d.getTime()));
    return toLocalMidnight(new Date(minMs));
  }, [filteredActivities]);

  // Calculate Period Columns based on Scale, Period Count and Offset
  const periods = useMemo(() => {
    const list: {
      id: string;
      label: string;
      subLabel?: string;
      startDate: Date;
      endDate: Date;
      isCurrent: boolean;
    }[] = [];

    const today = toLocalMidnight(new Date());

    if (scale === 'day') {
      const startDay = new Date(baseRangeDate);
      startDay.setDate(startDay.getDate() + periodOffset);

      for (let i = 0; i < periodCount; i++) {
        const pStart = new Date(startDay);
        pStart.setDate(startDay.getDate() + i);
        const pEnd = new Date(pStart);
        pEnd.setHours(23, 59, 59, 999);

        const isCurrent = today >= pStart && today <= pEnd;
        const dayName = pStart.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { weekday: 'short' });
        const dayNum = pStart.getDate();
        const monthShort = pStart.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { month: 'short' });

        list.push({
          id: `d-${pStart.getFullYear()}-${pStart.getMonth()}-${dayNum}`,
          label: `${dayNum} ${monthShort}`,
          subLabel: dayName,
          startDate: pStart,
          endDate: pEnd,
          isCurrent
        });
      }
    } else if (scale === 'iso_week') {
      // Find Monday of the base week
      const startMonday = new Date(baseRangeDate);
      const day = startMonday.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      startMonday.setDate(startMonday.getDate() + diffToMon + (periodOffset * 7));

      for (let i = 0; i < periodCount; i++) {
        const pStart = new Date(startMonday);
        pStart.setDate(startMonday.getDate() + (i * 7));
        const pEnd = new Date(pStart);
        pEnd.setDate(pStart.getDate() + 6);
        pEnd.setHours(23, 59, 59, 999);

        const wkNum = getISOWeekNumber(pStart);
        const isCurrent = today >= pStart && today <= pEnd;

        list.push({
          id: `wk-${pStart.getFullYear()}-${wkNum}`,
          label: `wk ${wkNum}`,
          subLabel: `${pStart.getDate()} ${pStart.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { month: 'short' })}`,
          startDate: pStart,
          endDate: pEnd,
          isCurrent
        });
      }
    } else if (scale === 'month') {
      const startMonth = new Date(baseRangeDate.getFullYear(), baseRangeDate.getMonth() + periodOffset, 1);

      for (let i = 0; i < periodCount; i++) {
        const pStart = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
        const pEnd = new Date(pStart.getFullYear(), pStart.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthName = pStart.toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { month: 'short' });
        const yrShort = pStart.getFullYear().toString().slice(-2);
        const isCurrent = today >= pStart && today <= pEnd;

        list.push({
          id: `m-${pStart.getFullYear()}-${pStart.getMonth()}`,
          label: `${monthName} '${yrShort}`,
          startDate: pStart,
          endDate: pEnd,
          isCurrent
        });
      }
    } else if (scale === 'quarter') {
      const startQuarterMonth = Math.floor(baseRangeDate.getMonth() / 3) * 3;
      const startQuarter = new Date(baseRangeDate.getFullYear(), startQuarterMonth + (periodOffset * 3), 1);

      for (let i = 0; i < periodCount; i++) {
        const pStart = new Date(startQuarter.getFullYear(), startQuarter.getMonth() + (i * 3), 1);
        const pEnd = new Date(pStart.getFullYear(), pStart.getMonth() + 3, 0, 23, 59, 59, 999);

        const qNum = Math.floor(pStart.getMonth() / 3) + 1;
        const yrShort = pStart.getFullYear().toString().slice(-2);
        const isCurrent = today >= pStart && today <= pEnd;

        list.push({
          id: `q-${pStart.getFullYear()}-Q${qNum}`,
          label: `Q${qNum} '${yrShort}`,
          startDate: pStart,
          endDate: pEnd,
          isCurrent
        });
      }
    } else if (scale === 'year') {
      const startYear = new Date(baseRangeDate.getFullYear() + periodOffset, 0, 1);

      for (let i = 0; i < periodCount; i++) {
        const pStart = new Date(startYear.getFullYear() + i, 0, 1);
        const pEnd = new Date(pStart.getFullYear(), 11, 31, 23, 59, 59, 999);

        const yrShort = pStart.getFullYear().toString().slice(-2);
        const isCurrent = today >= pStart && today <= pEnd;

        list.push({
          id: `yr-${pStart.getFullYear()}`,
          label: `'${yrShort}`,
          startDate: pStart,
          endDate: pEnd,
          isCurrent
        });
      }
    } else if (scale === 'multi_year') {
      const baseYear = baseRangeDate.getFullYear() + (periodOffset * 2);

      for (let i = 0; i < periodCount; i++) {
        const yStart = baseYear + (i * 2);
        const pStart = new Date(yStart, 0, 1);
        const pEnd = new Date(yStart + 1, 11, 31, 23, 59, 59, 999);

        const yr1Short = yStart.toString().slice(-2);
        const yr2Short = (yStart + 1).toString().slice(-2);
        const isCurrent = today >= pStart && today <= pEnd;

        list.push({
          id: `myr-${yStart}-${yStart + 1}`,
          label: `'${yr1Short}-'${yr2Short}`,
          startDate: pStart,
          endDate: pEnd,
          isCurrent
        });
      }
    }

    return list;
  }, [baseRangeDate, scale, periodCount, periodOffset, isNl]);

  // Helper to check if an activity is overdue (past due date and not completed, on_hold, or cancelled)
  const isActivityOverdue = (act: ProjectActivity): boolean => {
    if (act.status === 'completed' || act.status === 'on_hold' || act.status === 'cancelled') return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    const effectiveDue = act.endDate || act.startDate;
    return Boolean(effectiveDue && effectiveDue < todayStr);
  };

  // Color helper according to selected color strategy
  const getCellColorClass = (act: ProjectActivity) => {
    const isOverdue = isActivityOverdue(act);
    if (isOverdue) {
      return 'bg-rose-600 text-white border-rose-700 shadow-2xs ring-1 ring-rose-300';
    }

    if (colorStrategy === 'status') {
      if (act.isMilestone) return 'bg-purple-600 text-white border-purple-700 shadow-2xs';
      switch (act.status) {
        case 'completed':
          return 'bg-emerald-600 text-white border-emerald-700 shadow-2xs';
        case 'in_progress':
          return 'bg-indigo-600 text-white border-indigo-700 shadow-2xs';
        case 'on_hold':
          return 'bg-amber-500 text-white border-amber-600 shadow-2xs';
        case 'cancelled':
          return 'bg-stone-400 text-stone-100 border-stone-500 shadow-2xs opacity-70';
        case 'todo':
        default:
          return 'bg-slate-500 text-white border-slate-600 shadow-2xs';
      }
    } else if (colorStrategy === 'project') {
      const proj = projectMap.get(act.projectId);
      if (proj?.type === 'exploration') {
        return 'bg-teal-600 text-white border-teal-700 shadow-2xs';
      }
      return 'bg-blue-600 text-white border-blue-700 shadow-2xs';
    } else {
      // Type Strategy
      return act.isMilestone 
        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
        : 'bg-slate-700 text-white border-slate-800 shadow-2xs';
    }
  };

  const getStatusLabel = (stOrAct: ActivityStatus | ProjectActivity) => {
    if (typeof stOrAct === 'object') {
      if (isActivityOverdue(stOrAct)) {
        return isNl ? '⚠️ Overschrijding (te laat)' : '⚠️ Overdue (late)';
      }
      return getStatusLabel(stOrAct.status);
    }
    switch (stOrAct) {
      case 'completed': return isNl ? 'Voltooid' : 'Completed';
      case 'in_progress': return isNl ? 'In Uitvoering' : 'In Progress';
      case 'todo': return isNl ? 'Gepland / Nog uit te voeren' : 'Scheduled / To Do';
      case 'on_hold': return isNl ? 'On Hold (gepauzeerd)' : 'On Hold';
      case 'cancelled': return isNl ? 'Vervallen / Geannuleerd' : 'Cancelled';
    }
  };

  // Grouping Data by Project & Parent Activities
  const groupedTreeData = useMemo(() => {
    const targetProjects = selectedProjectId === 'all'
      ? projects
      : projects.filter(p => p.id === selectedProjectId);

    return targetProjects.map(proj => {
      const projActs = filteredActivities.filter(a => a.projectId === proj.id);
      if (projActs.length === 0) return null;

      // Find parent activities
      const parentActivities = projActs.filter(a => projActs.some(c => c.parentId === a.id));
      const parentIdsSet = new Set(parentActivities.map(p => p.id));

      // Find child activities
      const childActivities = projActs.filter(a => a.parentId && parentIdsSet.has(a.parentId));
      const childIdsSet = new Set(childActivities.map(c => c.id));

      // Standalone activities
      const standaloneActivities = projActs.filter(a => !parentIdsSet.has(a.id) && !childIdsSet.has(a.id));

      // Build parent items with child activities and calculated effective start/end
      const parentGroups = parentActivities.map(parent => {
        const children = projActs.filter(c => c.parentId === parent.id);
        
        const allStarts = [parent.startDate, ...children.map(c => c.startDate)].filter(Boolean);
        const allEnds = [parent.endDate || parent.startDate, ...children.map(c => c.endDate || c.startDate)].filter(Boolean);

        let effStart = parent.startDate || '';
        let effEnd = parent.endDate || parent.startDate || '';

        if (allStarts.length > 0) {
          const minMs = Math.min(...allStarts.map(d => parseYMD(d).getTime()));
          const d = new Date(minMs);
          effStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        if (allEnds.length > 0) {
          const maxMs = Math.max(...allEnds.map(d => parseYMD(d).getTime()));
          const d = new Date(maxMs);
          effEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const completedCount = children.filter(c => c.status === 'completed').length + (parent.status === 'completed' ? 1 : 0);
        const totalCount = children.length + 1;

        return {
          parent,
          children,
          effectiveStart: effStart,
          effectiveEnd: effEnd,
          completedCount,
          totalCount
        };
      });

      // Overall Project dates and counts
      const allProjStarts = projActs.map(a => a.startDate).filter(Boolean);
      const allProjEnds = projActs.map(a => a.endDate || a.startDate).filter(Boolean);

      let projEffStart = '';
      let projEffEnd = '';

      if (allProjStarts.length > 0) {
        const minMs = Math.min(...allProjStarts.map(d => parseYMD(d).getTime()));
        const d = new Date(minMs);
        projEffStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (allProjEnds.length > 0) {
        const maxMs = Math.max(...allProjEnds.map(d => parseYMD(d).getTime()));
        const d = new Date(maxMs);
        projEffEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      const projCompleted = projActs.filter(a => a.status === 'completed').length;

      return {
        project: proj,
        parentGroups,
        standaloneActivities,
        effectiveStart: projEffStart,
        effectiveEnd: projEffEnd,
        completedCount: projCompleted,
        totalCount: projActs.length
      };
    }).filter(Boolean);
  }, [projects, filteredActivities, selectedProjectId]);

  // Expand / Collapse All Handler
  const handleToggleAllCollapse = () => {
    if (collapsedIds.size > 0) {
      setCollapsedIds(new Set());
    } else {
      const allParents = new Set<string>();
      groupedTreeData.forEach(g => {
        if (!g) return;
        allParents.add(`proj-${g.project.id}`);
        g.parentGroups.forEach(pg => {
          allParents.add(pg.parent.id);
        });
      });
      setCollapsedIds(allParents);
    }
  };

  // --- Export to Canvas Helper ---
  const generateMatrixCanvas = async (el: HTMLElement) => {
    return await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(el.scrollWidth, 1200),
      windowHeight: el.scrollHeight,
      onclone: (clonedDoc, clonedEl) => {
        // Hide toolbar/buttons marked print:hidden
        const hiddenEls = clonedEl.querySelectorAll('.print\\:hidden');
        hiddenEls.forEach(h => ((h as HTMLElement).style.display = 'none'));

        // Remove sticky positioning which causes html2canvas clipping/misalignment
        const stickies = clonedEl.querySelectorAll('.sticky');
        stickies.forEach(s => {
          s.classList.remove('sticky', 'left-0', 'top-0', 'z-10', 'z-20', 'z-30', 'backdrop-blur-xs');
          (s as HTMLElement).style.position = 'static';
        });

        // Expand all scrollable containers so the full table is visible
        const scrollables = clonedEl.querySelectorAll('.overflow-x-auto, .overflow-y-auto');
        scrollables.forEach(s => {
          (s as HTMLElement).style.overflow = 'visible';
          (s as HTMLElement).style.maxHeight = 'none';
          (s as HTMLElement).style.height = 'auto';
        });
      }
    });
  };

  // --- Export to PNG Image ---
  const handleExportPng = async () => {
    const el = document.getElementById('project-planner-matrix-export-container');
    if (!el) return;
    setIsExporting('png');
    try {
      const canvas = await generateMatrixCanvas(el);
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `ITPT-Planningstabel-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (err: any) {
      console.error('Failed to export PNG:', err);
      alert(`${isNl ? 'Fout bij het exporteren van de afbeelding' : 'Failed to export PNG image'}: ${err?.message || err}`);
    } finally {
      setIsExporting(null);
    }
  };

  // --- Task Reordering Methods ---
  const [draggingActId, setDraggingActId] = useState<string | null>(null);

  const handleMoveActivity = (actId: string, direction: 'up' | 'down') => {
    const currentList = [...activities];
    const idx = currentList.findIndex(a => a.id === actId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const temp = currentList[idx];
    currentList[idx] = currentList[targetIdx];
    currentList[targetIdx] = temp;

    if (onReorderActivities) {
      onReorderActivities(currentList);
    }
  };

  const handleDragStart = (e: React.DragEvent, actId: string) => {
    setDraggingActId(actId);
    e.dataTransfer.setData('text/plain', actId);
  };

  const handleDropOnActivity = (e: React.DragEvent, targetActId: string) => {
    e.preventDefault();
    if (!draggingActId || draggingActId === targetActId) return;
    const currentList = [...activities];
    const srcIdx = currentList.findIndex(a => a.id === draggingActId);
    const tgtIdx = currentList.findIndex(a => a.id === targetActId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [removed] = currentList.splice(srcIdx, 1);
    currentList.splice(tgtIdx, 0, removed);

    setDraggingActId(null);
    if (onReorderActivities) {
      onReorderActivities(currentList);
    }
  };

  // Check relationship between hovered row and loop row
  const activeHoverTarget = hoveredActivityId || selectedActivityId;
  const isHoveredTarget = (id: string) => activeHoverTarget === id;
  const isPredecessorOfHovered = (id: string) => {
    if (!activeHoverTarget) return false;
    const targetAct = activityMap.get(activeHoverTarget);
    return targetAct?.dependencies?.includes(id) || false;
  };
  const isSuccessorOfHovered = (id: string) => {
    if (!activeHoverTarget) return false;
    const successors = successorsMap.get(activeHoverTarget) || [];
    return successors.some(s => s.id === id);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col" id="project-planner-matrix-export-container">
      
      {/* Top Toolbar */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
        
        {/* View Scale selector & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* View Scale Buttons */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => { setScale('day'); setPeriodOffset(0); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                scale === 'day' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isNl ? 'Dagen' : 'Days'}
            </button>
            <button
              onClick={() => { setScale('iso_week'); setPeriodOffset(0); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                scale === 'iso_week' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isNl ? 'ISO-Weken' : 'ISO Weeks'}
            </button>
            <button
              onClick={() => { setScale('month'); setPeriodOffset(0); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                scale === 'month' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isNl ? 'Maand' : 'Month'}
            </button>
            <button
              onClick={() => { setScale('quarter'); setPeriodOffset(0); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                scale === 'quarter' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isNl ? 'Kwartaal' : 'Quarter'}
            </button>
            <button
              onClick={() => { setScale('year'); setPeriodOffset(0); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                scale === 'year' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isNl ? 'Jaar' : 'Year'}
            </button>
            <button
              onClick={() => { setScale('multi_year'); setPeriodOffset(0); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                scale === 'multi_year' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isNl ? 'Meerdere Jaren' : 'Multi-Year'}
            </button>
          </div>

          {/* Period Count Choice */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs text-slate-700 shadow-2xs">
            <span className="font-medium text-slate-500">{isNl ? 'Periodes:' : 'Periods:'}</span>
            <select
              value={periodCount}
              onChange={(e) => setPeriodCount(Number(e.target.value))}
              className="font-bold text-indigo-600 bg-transparent outline-none cursor-pointer"
            >
              <option value={6}>6 {isNl ? 'periodes' : 'periods'}</option>
              <option value={8}>8 {isNl ? 'periodes' : 'periods'}</option>
              <option value={12}>12 {isNl ? 'periodes' : 'periods'}</option>
              <option value={16}>16 {isNl ? 'periodes' : 'periods'}</option>
              <option value={24}>24 {isNl ? 'periodes' : 'periods'}</option>
              <option value={30}>30 {isNl ? 'periodes' : 'periods'}</option>
            </select>
          </div>

          {/* Expand / Collapse All Toggle */}
          <button
            onClick={handleToggleAllCollapse}
            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title={isNl ? 'Alles in- of uitklappen' : 'Expand / Collapse All'}
          >
            <ListTree className="w-3.5 h-3.5 text-indigo-600" />
            <span>{collapsedIds.size > 0 ? (isNl ? 'Alles Uitklappen' : 'Expand All') : (isNl ? 'Alles Inklappen' : 'Collapse All')}</span>
          </button>

        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Period Shifting */}
          <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-0.5 shadow-2xs">
            <button
              onClick={() => setPeriodOffset(prev => prev - 1)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title={isNl ? 'Vorige periode' : 'Previous period'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPeriodOffset(0)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {isNl ? 'Vandaag' : 'Today'}
            </button>
            <button
              onClick={() => setPeriodOffset(prev => prev + 1)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title={isNl ? 'Volgende periode' : 'Next period'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Column 1 View Config Popup */}
          <div className="relative">
            <button
              onClick={() => setIsViewConfigOpen(!isViewConfigOpen)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isViewConfigOpen || (!showDates || !showProjectBadge || showDescription)
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isNl ? 'Kolom 1 Velden' : 'Col 1 Fields'}</span>
            </button>

            {isViewConfigOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 space-y-2">
                <div className="text-xs font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span>{isNl ? 'Instellingen Kolom 1' : 'Column 1 Settings'}</span>
                  <button onClick={() => setIsViewConfigOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={showDates}
                    onChange={e => setShowDates(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isNl ? 'Begin- & Einddatum' : 'Start & End Date'}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={showProjectBadge}
                    onChange={e => setShowProjectBadge(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isNl ? 'Project Badge' : 'Project Badge'}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={showDependencies}
                    onChange={e => setShowDependencies(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isNl ? 'Afhankelijkheden (Relaties)' : 'Dependencies'}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={showDescription}
                    onChange={e => setShowDescription(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isNl ? 'Omschrijving (Extra regel)' : 'Description (Extra line)'}</span>
                </label>
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={handleExportPng}
              disabled={isExporting !== null}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title={isNl ? 'Exporteer als PNG Afbeelding' : 'Export PNG Image'}
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>PNG {isNl ? 'Export' : 'Export'}</span>
            </button>
          </div>

          {/* New Activity Button */}
          <button
            onClick={onNewActivity}
            className="px-3 py-1 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isNl ? 'Nieuwe Activiteit' : 'New Activity'}
          </button>

        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
        <table className="w-full text-left border-collapse min-w-[900px]">
          
          {/* Table Header */}
          <thead className="bg-slate-100/95 sticky top-0 z-20 border-b border-slate-200 text-slate-700 text-xs font-semibold select-none backdrop-blur-xs">
            <tr>
              {/* Sticky Left Column */}
              <th className="p-2.5 sticky left-0 z-30 bg-slate-100 border-r border-slate-200 min-w-[210px] w-[240px] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="truncate">{isNl ? 'Activiteiten & Structuur' : 'Activities & Hierarchy'}</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full shrink-0">
                    {filteredActivities.length}
                  </span>
                </div>
              </th>

              {/* Compact Dynamic Period Columns */}
              {periods.map(p => (
                <th
                  key={p.id}
                  className={`p-1 text-center border-r border-slate-200 min-w-[36px] transition-colors ${
                    p.isCurrent ? 'bg-indigo-50/90 text-indigo-900 border-indigo-200 font-bold' : ''
                  }`}
                >
                  <div className="font-bold text-[10.5px] whitespace-nowrap">{p.label}</div>
                  {p.subLabel && (
                    <div className="text-[8.5px] font-normal text-slate-500 mt-0.2 whitespace-nowrap">{p.subLabel}</div>
                  )}
                  {p.isCurrent && (
                    <span className="inline-block px-1 py-0.1 text-[7.5px] font-bold bg-indigo-600 text-white rounded-full">
                      {isNl ? 'Nu' : 'Now'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body with Parent Tasks & Multi-column Bars */}
          <tbody className="divide-y divide-slate-200 text-xs">
            {groupedTreeData.length === 0 ? (
              <tr>
                <td colSpan={periods.length + 1} className="p-12 text-center text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="font-medium text-slate-600">
                    {isNl ? 'Geen activiteiten gevonden voor de huidige selectie.' : 'No activities found for current selection.'}
                  </p>
                </td>
              </tr>
            ) : (
              groupedTreeData.map((group) => {
                if (!group) return null;
                const { project, parentGroups, standaloneActivities, effectiveStart, effectiveEnd, completedCount, totalCount } = group;
                
                const projCollapsedKey = `proj-${project.id}`;
                const isProjCollapsed = collapsedIds.has(projCollapsedKey);

                return (
                  <React.Fragment key={`proj-group-${project.id}`}>
                    
                    {/* PROJECT HEADER ROW (if multiple projects or all projects selected) */}
                    {selectedProjectId === 'all' && (
                      <tr className="bg-slate-100/90 font-bold text-slate-800 border-t-2 border-slate-200">
                        {/* Sticky Left Title */}
                        <td className="p-2 sticky left-0 z-10 bg-slate-100 border-r border-slate-200 shadow-xs">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => toggleCollapse(projCollapsedKey)}
                              className="flex items-center gap-1.5 text-left font-black text-indigo-950 text-[11px] truncate cursor-pointer hover:text-indigo-600"
                            >
                              {isProjCollapsed ? (
                                <ChevronRightIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                              <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate" title={project.title}>{project.title}</span>
                              <span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.2 rounded-full shrink-0">
                                {completedCount}/{totalCount} {isNl ? 'voltooid' : 'done'}
                              </span>
                            </button>
                          </div>
                        </td>

                        {/* Project Overall Summary Bar across period columns */}
                        {periods.map((p, pIdx) => {
                          const pStartMs = p.startDate.getTime();
                          const pEndMs = p.endDate.getTime();
                          const sMs = parseYMD(effectiveStart).getTime();
                          const eMs = parseYMD(effectiveEnd).getTime();

                          const isActive = sMs <= pEndMs && eMs >= pStartMs;

                          const activeIndices = periods.map((p2, idx) => {
                            return (sMs <= p2.endDate.getTime() && eMs >= p2.startDate.getTime()) ? idx : -1;
                          }).filter(i => i !== -1);

                          const isFirst = activeIndices[0] === pIdx;
                          const isLast = activeIndices[activeIndices.length - 1] === pIdx;
                          const isSingle = activeIndices.length === 1;

                          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                          const totalActiveCols = activeIndices.length;
                          const colPos = activeIndices.indexOf(pIdx);
                          const filledCols = (pct / 100) * totalActiveCols;

                          let cellFillPct = 0;
                          if (colPos + 1 <= filledCols) {
                            cellFillPct = 100;
                          } else if (colPos < filledCols) {
                            cellFillPct = Math.round((filledCols - colPos) * 100);
                          } else {
                            cellFillPct = 0;
                          }

                          return (
                            <td key={p.id} className="p-0 py-1 text-center border-r border-slate-200 bg-slate-100/60">
                              {isActive ? (
                                <div 
                                  onClick={() => toggleCollapse(projCollapsedKey)}
                                  className={`h-4.5 bg-indigo-950 text-white flex items-center relative overflow-hidden cursor-pointer shadow-2xs ${
                                    isSingle ? 'rounded-lg mx-0.5' :
                                    isFirst ? 'rounded-l-lg ml-0.5' :
                                    isLast ? 'rounded-r-lg mr-0.5' :
                                    'rounded-none border-x-0'
                                  }`}
                                  title={`Project: ${project.title} | ${pct}% (${completedCount}/${totalCount}) | ${formatDateRange(effectiveStart, effectiveEnd)}`}
                                >
                                  <div className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all" style={{ width: `${cellFillPct}%` }} />
                                  <div className="relative z-10 w-full text-[8px] font-extrabold px-1 truncate text-slate-100 flex items-center justify-center">
                                    {isLast && <span className="font-mono bg-slate-900/80 text-emerald-300 px-1 py-0.2 rounded font-bold">{pct}%</span>}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-4.5 flex items-center justify-center">
                                  <span className="w-1 h-1 rounded-full bg-slate-300/60" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* IF PROJECT IS NOT COLLAPSED */}
                    {!isProjCollapsed && (
                      <>
                        {/* PARENT TASKS (HOOFD-TAKEN) */}
                        {parentGroups.map(({ parent, children, effectiveStart: pEffStart, effectiveEnd: pEffEnd, completedCount: pCompleted, totalCount: pTotal }) => {
                          const isParentCollapsed = collapsedIds.has(parent.id);

                          return (
                            <React.Fragment key={`parent-wrap-${parent.id}`}>
                              
                              {/* HOOFD-TAAK HEADER ROW */}
                              <tr className="bg-slate-50/95 font-semibold text-slate-800 hover:bg-indigo-50/40 transition-colors border-t border-slate-250">
                                {/* Left Column: Expand/Collapse & Title */}
                                <td className="p-2 sticky left-0 z-10 bg-slate-50 border-r border-slate-200 shadow-xs">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                      <button
                                        onClick={() => toggleCollapse(parent.id)}
                                        className="p-0.5 rounded text-indigo-700 hover:bg-indigo-100 cursor-pointer shrink-0"
                                      >
                                        {isParentCollapsed ? (
                                          <ChevronRightIcon className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                      <span className="font-extrabold text-slate-900 text-[11px] truncate" title={parent.title}>
                                        {parent.title}
                                      </span>
                                      <span className="text-[8.5px] font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.2 rounded-full shrink-0">
                                        {children.length} {isNl ? 'subtaken' : 'subtasks'} ({pCompleted}/{pTotal})
                                      </span>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveActivity(parent.id, 'up'); }}
                                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                        title={isNl ? 'Naar boven' : 'Move up'}
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveActivity(parent.id, 'down'); }}
                                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                        title={isNl ? 'Naar beneden' : 'Move down'}
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onEditActivity(parent); }}
                                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                        title={isNl ? 'Hoofd-taak bewerken' : 'Edit Main Task'}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteActivity(parent.id, parent.title); }}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                        title={isNl ? 'Hoofd-taak verwijderen' : 'Delete Main Task'}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Line 2: Date Range */}
                                  {showDates && (
                                    <div className="text-[9.5px] text-slate-600 font-mono pl-5 mt-0.5 flex items-center gap-1">
                                      <span>📅 {formatDateRange(pEffStart, pEffEnd)}</span>
                                    </div>
                                  )}
                                </td>

                                {/* HOOFD-TAAK SUMMARY BAR Across Period Columns */}
                                {periods.map((p, pIdx) => {
                                  const pStartMs = p.startDate.getTime();
                                  const pEndMs = p.endDate.getTime();
                                  const sMs = parseYMD(pEffStart).getTime();
                                  const eMs = parseYMD(pEffEnd).getTime();

                                  const isActive = sMs <= pEndMs && eMs >= pStartMs;

                                  const activeIndices = periods.map((p2, idx) => {
                                    return (sMs <= p2.endDate.getTime() && eMs >= p2.startDate.getTime()) ? idx : -1;
                                  }).filter(i => i !== -1);

                                  const isFirst = activeIndices[0] === pIdx;
                                  const isLast = activeIndices[activeIndices.length - 1] === pIdx;
                                  const isSingle = activeIndices.length === 1;

                                  const pct = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
                                  const totalActiveCols = activeIndices.length;
                                  const colPos = activeIndices.indexOf(pIdx);
                                  const filledCols = (pct / 100) * totalActiveCols;

                                  let cellFillPct = 0;
                                  if (colPos + 1 <= filledCols) {
                                    cellFillPct = 100;
                                  } else if (colPos < filledCols) {
                                    cellFillPct = Math.round((filledCols - colPos) * 100);
                                  } else {
                                    cellFillPct = 0;
                                  }

                                  return (
                                    <td key={p.id} className="p-0 py-1 text-center border-r border-slate-200 bg-slate-50/50">
                                      {isActive ? (
                                        <div 
                                          onClick={() => toggleCollapse(parent.id)}
                                          className={`h-5 bg-slate-800 text-white flex items-center relative overflow-hidden cursor-pointer shadow-2xs ${
                                            isSingle ? 'rounded-lg mx-0.5' :
                                            isFirst ? 'rounded-l-lg ml-0.5' :
                                            isLast ? 'rounded-r-lg mr-0.5' :
                                            'rounded-none border-x-0'
                                          }`}
                                          title={`Hoofd-taak: ${parent.title} | ${pct}% (${pCompleted}/${pTotal}) | ${formatDateRange(pEffStart, pEffEnd)}`}
                                        >
                                          <div className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all" style={{ width: `${cellFillPct}%` }} />
                                          <div className="relative z-10 w-full text-[8.5px] font-bold px-1 truncate text-slate-100 flex items-center justify-center">
                                            {isLast && <span className="font-mono bg-slate-900/80 text-emerald-300 px-1 py-0.2 rounded shrink-0 font-bold">{pct}%</span>}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-full h-5 flex items-center justify-center">
                                          <span className="w-1 h-1 rounded-full bg-slate-200" />
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* SUB-ACTIVITIES (When Parent Task is NOT Collapsed) */}
                              {!isParentCollapsed && children.map((act) => {
                                const actStart = parseYMD(act.startDate);
                                const actEnd = parseYMD(act.endDate || act.startDate);

                                const activeIndices: number[] = [];
                                periods.forEach((p, idx) => {
                                  if (actStart <= p.endDate && actEnd >= p.startDate) {
                                    activeIndices.push(idx);
                                  }
                                });

                                const hasDeps = act.dependencies && act.dependencies.length > 0;
                                const depActivities = hasDeps ? act.dependencies.map(id => activityMap.get(id)).filter(Boolean) : [];

                                const isHovered = isHoveredTarget(act.id);
                                const isPredecessor = isPredecessorOfHovered(act.id);
                                const isSuccessor = isSuccessorOfHovered(act.id);
                                const isOverdue = isActivityOverdue(act);

                                return (
                                  <tr 
                                    key={`sub-${act.id}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, act.id)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDropOnActivity(e, act.id)}
                                    onMouseEnter={() => setHoveredActivityId(act.id)}
                                    onMouseLeave={() => setHoveredActivityId(null)}
                                    onClick={() => setSelectedActivityId(selectedActivityId === act.id ? null : act.id)}
                                    className={`transition-colors cursor-pointer group/row ${
                                      draggingActId === act.id ? 'opacity-40 bg-indigo-100' :
                                      isHovered ? 'bg-indigo-50/70' :
                                      isPredecessor ? 'bg-amber-50/80 ring-1 ring-amber-300' :
                                      isSuccessor ? 'bg-sky-50/80 ring-1 ring-sky-300' :
                                      isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/70' :
                                      'hover:bg-slate-50/80'
                                    }`}
                                  >
                                    {/* Left Column: Indented Sub-Activity */}
                                    <td className={`p-2.5 pl-4 sticky left-0 z-10 ${isOverdue ? 'bg-rose-50/60' : 'bg-white'} group-hover/row:bg-slate-50/90 border-r border-slate-200 shadow-xs`}>
                                      <div className="flex items-start justify-between gap-1.5">
                                        <div className="space-y-1 pr-1 overflow-hidden min-w-0 flex-1">
                                          
                                          {/* Title with drag handle and tree connector */}
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5 shrink-0" title={isNl ? 'Sleep om te sorteren' : 'Drag to reorder'}>
                                              <GripVertical className="w-3 h-3" />
                                            </span>
                                            <span className="text-slate-400 font-mono text-[10px] shrink-0">└─</span>
                                            {act.isMilestone ? (
                                              <span className={`p-0.5 rounded ${isOverdue ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-purple-100 text-purple-700'} shrink-0 font-black text-[9px]`}>◆</span>
                                            ) : (
                                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                isOverdue ? 'bg-rose-600 ring-2 ring-rose-300' :
                                                act.status === 'completed' ? 'bg-emerald-500' :
                                                act.status === 'in_progress' ? 'bg-indigo-600' : 'bg-slate-400'
                                              }`} />
                                            )}
                                            <span className={`font-semibold ${isOverdue ? 'text-rose-800 font-bold' : 'text-slate-800'} text-[10.5px] truncate`} title={act.title}>
                                              {act.title}
                                            </span>
                                            {isOverdue && (
                                              <span className="text-[8px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                                ⚠️ {isNl ? 'Te laat' : 'Overdue'}
                                              </span>
                                            )}
                                          </div>

                                          {/* Dates */}
                                          {showDates && act.startDate && (
                                            <div className="pl-8 text-[9.5px] text-slate-600 font-medium">
                                              <span className="text-slate-700 font-mono text-[9px] bg-slate-100 border border-slate-200 px-1 py-0.1 rounded flex items-center gap-1 w-fit">
                                                <span>📅</span>
                                                <span>{formatDateRange(act.startDate, act.endDate)}</span>
                                              </span>
                                            </div>
                                          )}

                                          {/* Dependencies */}
                                          {showDependencies && hasDeps && (
                                            <div className="pl-8 flex items-center gap-1 text-[9px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.1 w-fit mt-0.5">
                                              <LinkIcon className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                              <span className="font-medium truncate max-w-[140px]">
                                                {isNl ? 'Wacht op:' : 'Depends:'} {depActivities.map(d => d?.title).join(', ')}
                                              </span>
                                            </div>
                                          )}

                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleMoveActivity(act.id, 'up'); }}
                                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                            title={isNl ? 'Naar boven' : 'Move up'}
                                          >
                                            <ArrowUp className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleMoveActivity(act.id, 'down'); }}
                                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                            title={isNl ? 'Naar beneden' : 'Move down'}
                                          >
                                            <ArrowDown className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onEditActivity(act); }}
                                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                            title={isNl ? 'Bewerken' : 'Edit'}
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteActivity(act.id, act.title); }}
                                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                            title={isNl ? 'Verwijderen' : 'Delete'}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Matrix Cells - Continuous Multi-column Bar */}
                                    {periods.map((p, pIdx) => {
                                      const isActive = activeIndices.includes(pIdx);
                                      const isFirstCell = activeIndices.length > 0 && activeIndices[0] === pIdx;
                                      const isLastCell = activeIndices.length > 0 && activeIndices[activeIndices.length - 1] === pIdx;
                                      const isSingleCell = activeIndices.length === 1;

                                      return (
                                        <td key={p.id} className={`p-0 py-1 text-center border-r border-slate-200 transition-colors relative ${p.isCurrent ? 'bg-indigo-50/20' : ''}`}>
                                          {act.isMilestone ? (
                                            isActive ? (
                                              <div 
                                                onClick={(e) => { e.stopPropagation(); onEditActivity(act); }}
                                                className="flex items-center justify-center py-0.5 cursor-pointer group/ms"
                                                title={`Mijlpaal: ${act.title} (${act.startDate}) - ${getStatusLabel(act)}`}
                                              >
                                                <div className={`w-4 h-4 rotate-45 ${isOverdue ? 'bg-gradient-to-tr from-rose-600 to-red-600 border-rose-300 ring-2 ring-rose-300' : 'bg-gradient-to-tr from-purple-600 to-indigo-600 border-purple-200'} text-white rounded-xs shadow-2xs border flex items-center justify-center transform group-hover/ms:scale-110 transition-all`}>
                                                  <span className="-rotate-45 text-[8px] font-black">{isOverdue ? '!' : '◆'}</span>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="w-full h-5 flex items-center justify-center"><span className="w-1 h-1 rounded-full bg-slate-200" /></div>
                                            )
                                          ) : (
                                            isActive ? (
                                              <div
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (onUpdateActivityStatus) {
                                                    const nextSt: ActivityStatus = 
                                                      act.status === 'todo' ? 'in_progress' :
                                                      act.status === 'in_progress' ? 'completed' :
                                                      act.status === 'completed' ? 'on_hold' :
                                                      act.status === 'on_hold' ? 'cancelled' : 'todo';
                                                    onUpdateActivityStatus(act.id, nextSt);
                                                  } else {
                                                    onEditActivity(act);
                                                  }
                                                }}
                                                className={`h-5 cursor-pointer transition-all hover:brightness-110 flex items-center justify-center ${getCellColorClass(act)} ${
                                                  isSingleCell ? 'rounded-md mx-0.5 shadow-2xs' :
                                                  isFirstCell ? 'rounded-l-md ml-0.5 shadow-2xs' :
                                                  isLastCell ? 'rounded-r-md mr-0.5 shadow-2xs' :
                                                  'rounded-none border-x-0'
                                                }`}
                                                title={`${act.title} (${getStatusLabel(act)}) | ${act.startDate}${act.endDate ? ` t/m ${act.endDate}` : ''}`}
                                              />
                                            ) : (
                                              <div className="w-full h-5 flex items-center justify-center"><span className="w-1 h-1 rounded-full bg-slate-200" /></div>
                                            )
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}

                            </React.Fragment>
                          );
                        })}

                        {/* STANDALONE ACTIVITIES */}
                        {standaloneActivities.map((act) => {
                          const actStart = parseYMD(act.startDate);
                          const actEnd = parseYMD(act.endDate || act.startDate);
                          const proj = projectMap.get(act.projectId);

                          const activeIndices: number[] = [];
                          periods.forEach((p, idx) => {
                            if (actStart <= p.endDate && actEnd >= p.startDate) {
                              activeIndices.push(idx);
                            }
                          });

                          const hasDeps = act.dependencies && act.dependencies.length > 0;
                          const depActivities = hasDeps ? act.dependencies.map(id => activityMap.get(id)).filter(Boolean) : [];

                          const isHovered = isHoveredTarget(act.id);
                          const isPredecessor = isPredecessorOfHovered(act.id);
                          const isSuccessor = isSuccessorOfHovered(act.id);
                          const isOverdue = isActivityOverdue(act);

                          return (
                            <tr 
                              key={`std-${act.id}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, act.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDropOnActivity(e, act.id)}
                              onMouseEnter={() => setHoveredActivityId(act.id)}
                              onMouseLeave={() => setHoveredActivityId(null)}
                              onClick={() => setSelectedActivityId(selectedActivityId === act.id ? null : act.id)}
                              className={`transition-colors cursor-pointer group/row ${
                                draggingActId === act.id ? 'opacity-40 bg-indigo-100' :
                                isHovered ? 'bg-indigo-50/70' :
                                isPredecessor ? 'bg-amber-50/80 ring-1 ring-amber-300' :
                                isSuccessor ? 'bg-sky-50/80 ring-1 ring-sky-300' :
                                isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/70' :
                                'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* Left Column */}
                              <td className={`p-2.5 pl-3 sticky left-0 z-10 ${isOverdue ? 'bg-rose-50/60' : 'bg-white'} group-hover/row:bg-slate-50/90 border-r border-slate-200 shadow-xs`}>
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="space-y-1 pr-1 overflow-hidden min-w-0 flex-1">
                                    
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5 shrink-0" title={isNl ? 'Sleep om te sorteren' : 'Drag to reorder'}>
                                        <GripVertical className="w-3 h-3" />
                                      </span>
                                      {act.isMilestone ? (
                                        <span className={`p-0.5 rounded ${isOverdue ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-purple-100 text-purple-700'} shrink-0 font-black text-[9px]`}>◆</span>
                                      ) : (
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                                          isOverdue ? 'bg-rose-600 ring-2 ring-rose-300' :
                                          act.status === 'completed' ? 'bg-emerald-500' :
                                          act.status === 'in_progress' ? 'bg-indigo-600' : 'bg-slate-400'
                                        }`} />
                                      )}
                                      <span className={`font-bold ${isOverdue ? 'text-rose-800' : 'text-slate-800'} text-[11px] truncate`} title={act.title}>
                                        {act.title}
                                      </span>
                                      {isOverdue && (
                                        <span className="text-[8.5px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                          ⚠️ {isNl ? 'Te laat' : 'Overdue'}
                                        </span>
                                      )}
                                    </div>

                                    {(showDates || (showProjectBadge && proj)) && (
                                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 font-medium pl-5">
                                        {showDates && act.startDate && (
                                          <span className="text-slate-700 font-mono text-[9.5px] bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded flex items-center gap-1 shadow-2xs">
                                            <span>📅</span>
                                            <span>{formatDateRange(act.startDate, act.endDate)}</span>
                                          </span>
                                        )}
                                        {showProjectBadge && proj && selectedProjectId === 'all' && (
                                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-150 text-indigo-900 font-bold truncate max-w-[100px]" title={proj.title}>
                                            {proj.title}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {showDependencies && hasDeps && (
                                      <div className="flex items-center gap-1 text-[9.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2 w-fit mt-0.5 pl-5">
                                        <LinkIcon className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                        <span className="font-medium truncate max-w-[150px]">
                                          {isNl ? 'Wacht op:' : 'Depends:'} {depActivities.map(d => d?.title).join(', ')}
                                        </span>
                                      </div>
                                    )}

                                    {showDescription && act.description && (
                                      <div className="text-[9.5px] text-slate-500 line-clamp-1 italic mt-0.5 pl-5" title={act.description}>
                                        {act.description}
                                      </div>
                                    )}

                                  </div>

                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveActivity(act.id, 'up'); }}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                      title={isNl ? 'Naar boven' : 'Move up'}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveActivity(act.id, 'down'); }}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                      title={isNl ? 'Naar beneden' : 'Move down'}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onEditActivity(act); }}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                      title={isNl ? 'Bewerken' : 'Edit'}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onDeleteActivity(act.id, act.title); }}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                      title={isNl ? 'Verwijderen' : 'Delete'}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Matrix Cells */}
                              {periods.map((p, pIdx) => {
                                const isActive = activeIndices.includes(pIdx);
                                const isFirstCell = activeIndices.length > 0 && activeIndices[0] === pIdx;
                                const isLastCell = activeIndices.length > 0 && activeIndices[activeIndices.length - 1] === pIdx;
                                const isSingleCell = activeIndices.length === 1;

                                return (
                                  <td key={p.id} className={`p-0 py-1 text-center border-r border-slate-200 transition-colors relative ${p.isCurrent ? 'bg-indigo-50/20' : ''}`}>
                                    {act.isMilestone ? (
                                      isActive ? (
                                        <div 
                                          onClick={(e) => { e.stopPropagation(); onEditActivity(act); }}
                                          className="flex items-center justify-center py-0.5 cursor-pointer group/ms"
                                          title={`Mijlpaal: ${act.title} (${act.startDate}) - ${getStatusLabel(act)}`}
                                        >
                                          <div className={`w-4 h-4 rotate-45 ${isOverdue ? 'bg-gradient-to-tr from-rose-600 to-red-600 border-rose-300 ring-2 ring-rose-300' : 'bg-gradient-to-tr from-purple-600 to-indigo-600 border-purple-200'} text-white rounded-xs shadow-2xs border flex items-center justify-center transform group-hover/ms:scale-110 transition-all`}>
                                            <span className="-rotate-45 text-[8px] font-black">{isOverdue ? '!' : '◆'}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-full h-5 flex items-center justify-center"><span className="w-1 h-1 rounded-full bg-slate-200" /></div>
                                      )
                                    ) : (
                                      isActive ? (
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onUpdateActivityStatus) {
                                              const nextSt: ActivityStatus = 
                                                act.status === 'todo' ? 'in_progress' :
                                                act.status === 'in_progress' ? 'completed' :
                                                act.status === 'completed' ? 'on_hold' :
                                                act.status === 'on_hold' ? 'cancelled' : 'todo';
                                              onUpdateActivityStatus(act.id, nextSt);
                                            } else {
                                              onEditActivity(act);
                                            }
                                          }}
                                          className={`h-5 cursor-pointer transition-all hover:brightness-110 flex items-center justify-center ${getCellColorClass(act)} ${
                                            isSingleCell ? 'rounded-md mx-0.5 shadow-2xs' :
                                            isFirstCell ? 'rounded-l-md ml-0.5 shadow-2xs' :
                                            isLastCell ? 'rounded-r-md mr-0.5 shadow-2xs' :
                                            'rounded-none border-x-0'
                                          }`}
                                          title={`${act.title} (${getStatusLabel(act)}) | ${act.startDate}${act.endDate ? ` t/m ${act.endDate}` : ''}`}
                                        />
                                      ) : (
                                        <div className="w-full h-5 flex items-center justify-center"><span className="w-1 h-1 rounded-full bg-slate-200" /></div>
                                      )
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </>
                    )}

                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend & Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="font-bold text-slate-800">{isNl ? 'Legenda:' : 'Legend:'}</span>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3 rounded bg-slate-800 text-white font-black text-[8px] flex items-center justify-center">★</span>
            <span className="font-semibold text-slate-700">{isNl ? 'Hoofd-taak (Overzichtsbalk)' : 'Main Task (Summary Bar)'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-xs bg-purple-600 text-white font-bold flex items-center justify-center text-[9px]">◆</span>
            <span>{isNl ? 'Mijlpaal' : 'Milestone'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-slate-500 border border-slate-600" />
            <span>{isNl ? 'Gepland / Nog uit te voeren' : 'Scheduled / To Do'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-indigo-600" />
            <span>{isNl ? 'In Uitvoering' : 'In Progress'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-emerald-600" />
            <span>{isNl ? 'Voltooid' : 'Completed'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-rose-600 border border-rose-700 shadow-2xs" />
            <span className="font-bold text-rose-700">{isNl ? 'Overschrijding (te laat)' : 'Overdue (late)'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-amber-500" />
            <span>{isNl ? 'On Hold (gepauzeerd)' : 'On Hold'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-stone-400 opacity-70" />
            <span>{isNl ? 'Vervallen / Geannuleerd' : 'Cancelled'}</span>
          </div>
        </div>

        <div className="text-slate-500 text-[10.5px] flex items-center gap-2">
          <span>💡 {isNl ? 'Klik op een hoofd-taak of project om subtaken in of uit te klappen.' : 'Click a main task or project to expand or collapse subtasks.'}</span>
        </div>
      </div>

    </div>
  );
}
