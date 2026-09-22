import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ProjectPlannerMatrixTable from './ProjectPlannerMatrixTable';
import GanttChartView from './GanttChartView';
import { Project, ProjectActivity, ProjectType, ActivityStatus, Language, Attachment } from '../types';
import { dbService } from '../services/db';
import { DataImportExportModal } from './DataImportExportModal';
import { 
  FolderGit, Compass, Plus, Calendar, Settings, ArrowRight,
  TrendingUp, Trash2, Edit2, CheckCircle, Search, Filter, 
  ChevronDown, HelpCircle, Download, Upload, AlertCircle, Play, Info, Layers, Paperclip, FileText, X,
  ListTodo, User, GripVertical, Printer, Eye, EyeOff, Globe, ChevronRight, CheckCircle2, FolderClosed, FolderOpen, Copy, ZoomIn,
  RotateCcw, FolderKanban
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface ProjectPlannerProps {
  lang: Language;
}

type TimelineViewScale = 'year' | 'quarter' | 'month' | 'week' | 'multi_year';

// Prefilled Seed Projects
const defaultProjects: Project[] = [
  {
    id: 'proj-1',
    title: 'Nieuw Kantoor Ontwerp',
    description: 'Het herinrichten en moderniseren van ons centrale hoofdkantoor.',
    type: 'project',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj-2',
    title: 'Zonnepanelen Verkenning',
    description: 'Verkennend onderzoek naar de haalbaarheid van zonnepanelen op ons platte dak.',
    type: 'exploration',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const getTodayOffsetYMD = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const parseYMD = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 0, 0, 0, 0); // Local midnight
  }
  return new Date(str);
};

const toLocalMidnight = (d: Date): Date => {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

const defaultActivities: ProjectActivity[] = [
  // Office Design project activities
  {
    id: 'act-1-1',
    projectId: 'proj-1',
    title: 'Bouwkundige metingen uitvoeren',
    description: 'In kaart brengen van de muren, ramen en pilaren in het kantoor.',
    startDate: getTodayOffsetYMD(-12),
    endDate: getTodayOffsetYMD(-7),
    status: 'completed',
    isMilestone: false,
    dependencies: [],
  },
  {
    id: 'act-1-2',
    projectId: 'proj-1',
    title: 'Vlekkenplan en indelingsontwerpen',
    description: 'Eerste schetsen van bureaus, vergaderruimtes en lounge zones maken.',
    startDate: getTodayOffsetYMD(-6),
    endDate: getTodayOffsetYMD(-1),
    status: 'completed',
    isMilestone: false,
    dependencies: ['act-1-1'],
  },
  {
    id: 'act-1-3',
    projectId: 'proj-1',
    title: 'Feedbackronde medewerkers',
    description: 'Enquête uitsturen en inloopsessies houden over het indelingsontwerp.',
    startDate: getTodayOffsetYMD(0),
    endDate: getTodayOffsetYMD(5),
    status: 'in_progress',
    isMilestone: false,
    dependencies: ['act-1-2'],
  },
  {
    id: 'act-1-4',
    projectId: 'proj-1',
    title: 'Definitief inrichtingsplan opleveren',
    description: 'Het integreren van feedback en het uitwerken van de 3D-renders.',
    startDate: getTodayOffsetYMD(6),
    endDate: getTodayOffsetYMD(14),
    status: 'todo',
    isMilestone: false,
    dependencies: ['act-1-3'],
  },
  {
    id: 'act-1-5',
    projectId: 'proj-1',
    title: 'Mijlpaal: Goedkeuring directie',
    description: 'Formeel akkoord van het MT op de investering en het definitieve ontwerp.',
    startDate: getTodayOffsetYMD(15),
    endDate: getTodayOffsetYMD(15),
    status: 'todo',
    isMilestone: true,
    dependencies: ['act-1-4'],
  },

  // Solar Exploration activities
  {
    id: 'act-2-1',
    projectId: 'proj-2',
    title: 'Subsidiemogelijkheden in kaart brengen',
    description: 'Analyseren van SDE++ regelingen en lokale duurzaamheidssubsidies.',
    startDate: getTodayOffsetYMD(-8),
    endDate: getTodayOffsetYMD(-3),
    status: 'completed',
    isMilestone: false,
    dependencies: [],
  },
  {
    id: 'act-2-2',
    projectId: 'proj-2',
    title: 'Constructieberekening dak belasting',
    description: 'Onderzoek of het dak het extra gewicht van de panelen en ballast kan dragen.',
    startDate: getTodayOffsetYMD(-2),
    endDate: getTodayOffsetYMD(4),
    status: 'in_progress',
    isMilestone: false,
    dependencies: [],
  },
  {
    id: 'act-2-3',
    projectId: 'proj-2',
    title: 'Offertes opvragen bij 3 partijen',
    description: 'Technisch bestek toesturen aan installateurs en offertes verzamelen.',
    startDate: getTodayOffsetYMD(3),
    endDate: getTodayOffsetYMD(10),
    status: 'todo',
    isMilestone: false,
    dependencies: ['act-2-1'],
  },
  {
    id: 'act-2-4',
    projectId: 'proj-2',
    title: 'Rendementsberekening & businesscase',
    description: 'Terreugverdientijd uitrekenen op basis van offertes en energieprijzen.',
    startDate: getTodayOffsetYMD(11),
    endDate: getTodayOffsetYMD(16),
    status: 'todo',
    isMilestone: false,
    dependencies: ['act-2-2', 'act-2-3'],
  },
  {
    id: 'act-2-5',
    projectId: 'proj-2',
    title: 'Mijlpaal: Go-NoGo Advies rapport',
    description: 'Finale presentatie met advies aan de stuurgroep energietransitie.',
    startDate: getTodayOffsetYMD(18),
    endDate: getTodayOffsetYMD(18),
    status: 'todo',
    isMilestone: true,
    dependencies: ['act-2-4'],
  }
];

export default function ProjectPlanner({ lang }: ProjectPlannerProps) {
  const isNl = lang === 'nl';

  // Resolves computed dates for an activity based on its sub-activities
  const resolveActivityDates = (act: ProjectActivity, allActs: ProjectActivity[]) => {
    const children = allActs.filter(c => c.parentId === act.id);
    if (children.length === 0) {
      return { startDate: act.startDate, endDate: act.endDate };
    }
    
    // Dynamic summary bar is composed strictly from children dates
    const startDates = children.map(c => {
      const resolvedChild = resolveActivityDates(c, allActs);
      return resolvedChild.startDate;
    }).filter(Boolean);

    const endDates = children.map(c => {
      const resolvedChild = resolveActivityDates(c, allActs);
      return resolvedChild.endDate;
    }).filter(Boolean);
    
    if (startDates.length === 0 && endDates.length === 0) {
      return { startDate: '', endDate: '' };
    }

    const startDate = startDates.length > 0 ? startDates.reduce((min, d) => d < min ? d : min) : '';
    const endDate = endDates.length > 0 ? endDates.reduce((max, d) => d > max ? d : max) : '';
    return { startDate, endDate };
  };

  // --- CRUD States ---
  const [projects, setProjects] = useState<Project[]>(() => {
    const dbProjs = dbService.getProjects();
    return dbProjs.length > 0 ? dbProjs : defaultProjects;
  });

  const [activities, setActivities] = useState<ProjectActivity[]>(() => {
    const dbActs = dbService.getProjectActivities();
    return dbActs.length > 0 ? dbActs : defaultActivities;
  });

  // Subscribe to central db updates
  useEffect(() => {
    const unsub = dbService.subscribe(() => {
      setProjects(dbService.getProjects());
      setActivities(dbService.getProjectActivities());
    });
    return () => unsub();
  }, []);

  // --- Filter & Selection States ---
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : 'all'
  );
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all'); // all, project, exploration
  const [ganttScale, setGanttScale] = useState<TimelineViewScale>('month');
  const [zoomMultiplier, setZoomMultiplier] = useState(1.0);

  // --- Sub-task Collapsing and Visibility Filters ---
  const [collapsedActivityIds, setCollapsedActivityIds] = useState<string[]>([]);
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [hideMilestones, setHideMilestones] = useState<boolean>(false);

  const toggleCollapseActivity = (actId: string) => {
    setCollapsedActivityIds(prev => 
      prev.includes(actId) ? prev.filter(id => id !== actId) : [...prev, actId]
    );
  };

  const handleCollapseAll = () => {
    const parentIds = currentProjectActivities
      .filter(act => currentProjectActivities.some(c => c.parentId === act.id))
      .map(act => act.id);
    setCollapsedActivityIds(parentIds);
  };

  const handleExpandAll = () => {
    setCollapsedActivityIds([]);
  };

  const isAncestorCollapsed = (act: ProjectActivity, pool: ProjectActivity[], collapsedIds: string[]): boolean => {
    if (!act.parentId) return false;
    if (collapsedIds.includes(act.parentId)) return true;
    const parent = pool.find(p => p.id === act.parentId);
    if (!parent) return false;
    return isAncestorCollapsed(parent, pool, collapsedIds);
  };

  // --- List, Table & Gantt View States for Project Actions ---
  const [plannerViewMode, setPlannerViewMode] = useState<'table' | 'gantt' | 'list'>('table');
  const [plannerListSearch, setPlannerListSearch] = useState('');
  const [plannerListFilterStatus, setPlannerListFilterStatus] = useState('all');
  const [plannerListFilterType, setPlannerListFilterType] = useState('all'); // 'all', 'milestone', 'activity'
  const [plannerListFilterAssignee, setPlannerListFilterAssignee] = useState('all');
  const [plannerListSortField, setPlannerListSortField] = useState<'title' | 'startDate' | 'endDate' | 'status' | 'project' | 'assignee'>('startDate');
  const [plannerListSortDirection, setPlannerListSortDirection] = useState<'asc' | 'desc'>('asc');
  const [plannerListFilterProject, setPlannerListFilterProject] = useState<string>('current'); // 'current' or 'all'

  // --- Export States ---
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportLoadingMsg, setExportLoadingMsg] = useState<string | null>(null);
  const [showDataRecoveryModal, setShowDataRecoveryModal] = useState(false);
  const [recoveryInitialTab, setRecoveryInitialTab] = useState<'export' | 'import' | 'recovery'>('recovery');

  // --- modals ---
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projType, setProjType] = useState<ProjectType>('project');

  const [isActModalOpen, setIsActModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(null);
  const [actProjectId, setActProjectId] = useState<string>('');
  const [actTitle, setActTitle] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actStart, setActStart] = useState('');
  const [actEnd, setActEnd] = useState('');
  const [actStatus, setActStatus] = useState<ActivityStatus>('todo');
  const [actIsMilestone, setActIsMilestone] = useState(false);
  const [actDependencies, setActDependencies] = useState<string[]>([]);
  const [actParentId, setActParentId] = useState<string>('');
  const [actAttachments, setActAttachments] = useState<Attachment[]>([]);
  const [actAssignee, setActAssignee] = useState<string>('');

  // Activity modal filter & search states
  const [modalDepSearch, setModalDepSearch] = useState('');
  const [modalDepFilter, setModalDepFilter] = useState<'all' | 'milestones' | 'tasks' | 'selected'>('all');
  const [modalDepScope, setModalDepScope] = useState<'project' | 'all'>('project');
  const [modalParentSearch, setModalParentSearch] = useState('');
  const [modalParentFilter, setModalParentFilter] = useState<'all' | 'root_only'>('all');
  const [isParentPickerOpen, setIsParentPickerOpen] = useState(false);
  const [modalTemplateSearch, setModalTemplateSearch] = useState('');
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

  // Move or Copy activity to another project / exploration
  const [isMoveCopyModalOpen, setIsMoveCopyModalOpen] = useState(false);
  const [moveCopyActivity, setMoveCopyActivity] = useState<ProjectActivity | null>(null);
  const [moveCopyTargetProjectId, setMoveCopyTargetProjectId] = useState<string>('');
  const [moveCopyAction, setMoveCopyAction] = useState<'move' | 'copy'>('move');

  // Selected project object reference
  const currentProject = useMemo(() => {
    if (selectedProjectId === 'all') {
      return {
        id: 'all',
        title: isNl ? 'Alle Projecten & Verkenningen' : 'All Projects & Explorations',
        description: isNl 
          ? 'Gecombineerd totaaloverzicht van alle geplande projecten, verkenningen, activiteiten en mijlpalen.' 
          : 'Combined total overview of all scheduled projects, explorations, activities, and milestones.',
        type: 'project' as ProjectType,
        createdAt: new Date().toISOString()
      };
    }
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId, isNl]);

  // --- Filter and Search logic ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === 'all' || p.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [projects, searchQuery, typeFilter]);

  // If selectedProjectId is filtered out, fallback to 'all' or first project
  useEffect(() => {
    if (selectedProjectId !== 'all' && filteredProjects.length > 0) {
      const stillExists = filteredProjects.some(p => p.id === selectedProjectId);
      if (!stillExists) {
        setSelectedProjectId('all');
      }
    }
  }, [filteredProjects, selectedProjectId]);

  // Get activities for selected project
  const currentProjectActivities = useMemo(() => {
    if (!selectedProjectId) return [];
    if (selectedProjectId === 'all') return activities;
    return activities.filter(act => act.projectId === selectedProjectId);
  }, [activities, selectedProjectId]);

  // Target project and its complete activities list for the activity modal
  const modalTargetProjectId = useMemo(() => {
    if (actProjectId && projects.some(p => p.id === actProjectId)) {
      return actProjectId;
    }
    if (selectedProjectId && selectedProjectId !== 'all' && projects.some(p => p.id === selectedProjectId)) {
      return selectedProjectId;
    }
    return projects[0]?.id || '';
  }, [actProjectId, selectedProjectId, projects]);

  const modalTargetProject = useMemo(() => {
    return projects.find(p => p.id === modalTargetProjectId);
  }, [projects, modalTargetProjectId]);

  // ALL activities belonging to the project currently selected in the activity modal
  const modalProjectActivities = useMemo(() => {
    if (!modalTargetProjectId) return [];
    return activities.filter(a => a.projectId === modalTargetProjectId);
  }, [activities, modalTargetProjectId]);

  // Pool of activities for dependencies in the modal
  const availableDependencyActivities = useMemo(() => {
    const baseList = modalDepScope === 'all' ? activities : modalProjectActivities;
    return baseList.filter(a => !editingActivity || a.id !== editingActivity.id);
  }, [modalDepScope, activities, modalProjectActivities, editingActivity]);

  const filteredDependencyActivities = useMemo(() => {
    return availableDependencyActivities.filter(a => {
      if (modalDepSearch.trim()) {
        const q = modalDepSearch.toLowerCase().trim();
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesAssignee = a.assignee?.toLowerCase().includes(q);
        const matchesDesc = a.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAssignee && !matchesDesc) return false;
      }

      if (modalDepFilter === 'milestones') {
        if (!a.isMilestone) return false;
      } else if (modalDepFilter === 'tasks') {
        if (a.isMilestone) return false;
      } else if (modalDepFilter === 'selected') {
        if (!actDependencies.includes(a.id)) return false;
      }

      return true;
    });
  }, [availableDependencyActivities, modalDepSearch, modalDepFilter, actDependencies]);

  // Pool of available parent activities in the current project
  const availableParentActivities = useMemo(() => {
    return modalProjectActivities.filter(a => {
      if (editingActivity && a.id === editingActivity.id) return false;
      if (editingActivity) {
        let currentParent: string | undefined = a.parentId;
        while (currentParent) {
          if (currentParent === editingActivity.id) return false;
          const next = modalProjectActivities.find(p => p.id === currentParent);
          currentParent = next?.parentId;
        }
      }
      return true;
    });
  }, [modalProjectActivities, editingActivity]);

  const filteredParentActivities = useMemo(() => {
    return availableParentActivities.filter(a => {
      if (modalParentFilter === 'root_only' && a.parentId) {
        return false;
      }
      if (modalParentSearch.trim()) {
        const q = modalParentSearch.toLowerCase().trim();
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesAssignee = a.assignee?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAssignee) return false;
      }
      return true;
    });
  }, [availableParentActivities, modalParentFilter, modalParentSearch]);

  // Pool of activities for template/duplication in the modal
  const filteredTemplateActivities = useMemo(() => {
    return modalProjectActivities.filter(a => {
      if (editingActivity && a.id === editingActivity.id) return false;
      if (modalTemplateSearch.trim()) {
        const q = modalTemplateSearch.toLowerCase().trim();
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesAssignee = a.assignee?.toLowerCase().includes(q);
        return matchesTitle || !!matchesAssignee;
      }
      return true;
    });
  }, [modalProjectActivities, editingActivity, modalTemplateSearch]);

  // Bulk cleanup of completed activities
  const handleDeleteCompleted = () => {
    const completedActs = selectedProjectId === 'all'
      ? activities.filter(a => a.status === 'completed')
      : activities.filter(a => a.projectId === selectedProjectId && a.status === 'completed');

    if (completedActs.length === 0) {
      alert(isNl ? 'Er zijn geen voltooide activiteiten om te verwijderen.' : 'No completed activities found to delete.');
      return;
    }

    const confirmMsg = isNl
      ? `Weet u zeker dat u ${completedActs.length} voltooide activiteit(en) definitief wilt verwijderen?`
      : `Are you sure you want to permanently delete ${completedActs.length} completed activity(ies)?`;

    if (window.confirm(confirmMsg)) {
      const idsToRemove = new Set(completedActs.map(a => a.id));
      setActivities(prev => 
        prev
          .filter(a => !idsToRemove.has(a.id))
          .map(a => ({
            ...a,
            dependencies: a.dependencies ? a.dependencies.filter(depId => !idsToRemove.has(depId)) : []
          }))
      );
      for (const act of completedActs) {
        dbService.deleteProjectActivity(act.id);
      }
    }
  };

  // Reordering activities via drag and drop
  const handleActivityDrop = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;

    const sourceAct = activities.find(a => a.id === sourceId);
    const targetAct = activities.find(a => a.id === targetId);
    if (!sourceAct || !targetAct) return;

    const projId = targetAct.projectId;
    const projActs = activities.filter(a => a.projectId === projId);
    const sorted = [...projActs].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 1000;
      const orderB = b.order !== undefined ? b.order : 1000;
      return orderA - orderB;
    });

    const sIdx = sorted.findIndex(a => a.id === sourceId);
    const tIdx = sorted.findIndex(a => a.id === targetId);
    if (sIdx === -1 || tIdx === -1) return;

    const [removed] = sorted.splice(sIdx, 1);
    sorted.splice(tIdx, 0, removed);

    const newOrderMap = new Map(sorted.map((act, idx) => [act.id, idx]));

    setActivities(prev =>
      prev.map(a => {
        if (newOrderMap.has(a.id)) {
          return { ...a, order: newOrderMap.get(a.id)! };
        }
        return a;
      })
    );

    setDraggedActivityId(null);
  };

  // Filtered and sorted activities inside current project view
  const displayActivities = useMemo(() => {
    let pool = [...currentProjectActivities];
    
    if (statusFilter !== 'all') {
      pool = pool.filter(act => act.status === statusFilter);
    }

    if (hideCompleted) {
      pool = pool.filter(act => act.status !== 'completed');
    }

    if (hideMilestones) {
      pool = pool.filter(act => !act.isMilestone);
    }

    // Filter out activities whose ancestor is collapsed
    pool = pool.filter(act => !isAncestorCollapsed(act, currentProjectActivities, collapsedActivityIds));

    // Identify root-level items (activities with no parent, or parent does not exist in pool)
    const roots = pool.filter(act => !act.parentId || !pool.some(p => p.id === act.parentId));
    
    // Sort root activities
    roots.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 1000;
      const orderB = b.order !== undefined ? b.order : 1000;
      if (orderA !== orderB) return orderA - orderB;

      const resA = resolveActivityDates(a, currentProjectActivities);
      const resB = resolveActivityDates(b, currentProjectActivities);

      const dateA = resA.startDate ? new Date(resA.startDate).getTime() : Infinity;
      const dateB = resB.startDate ? new Date(resB.startDate).getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
      return (a.isMilestone ? 1 : 0) - (b.isMilestone ? 1 : 0);
    });

    const collated: ProjectActivity[] = [];
    roots.forEach(root => {
      collated.push(root);
      const children = pool.filter(act => act.parentId === root.id);
      
      // Sort children
      children.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 1000;
        const orderB = b.order !== undefined ? b.order : 1000;
        if (orderA !== orderB) return orderA - orderB;
        const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        return dateA - dateB;
      });
      
      collated.push(...children);
    });

    // Safeguard: Add any remaining orphaned activities
    pool.forEach(act => {
      if (!collated.some(c => c.id === act.id)) {
        collated.push(act);
      }
    });

    return collated;
  }, [currentProjectActivities, statusFilter, hideCompleted, hideMilestones, collapsedActivityIds]);

  // Dynamic list of unique assignees among all activities
  const uniqueAssignees = useMemo(() => {
    const list = activities.map(act => act.assignee).filter(Boolean) as string[];
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [activities]);

  // --- Total Consolidated Actions & Activities List (Totaallijst) ---
  const totalListActivities = useMemo(() => {
    let pool = plannerListFilterProject === 'all' 
      ? [...activities]
      : activities.filter(act => act.projectId === selectedProjectId);

    if (hideCompleted) {
      pool = pool.filter(act => act.status !== 'completed');
    }

    if (hideMilestones) {
      pool = pool.filter(act => !act.isMilestone);
    }

    if (plannerListSearch.trim()) {
      const q = plannerListSearch.toLowerCase().trim();
      pool = pool.filter(act => 
        act.title.toLowerCase().includes(q) || 
        act.description.toLowerCase().includes(q)
      );
    }

    if (plannerListFilterStatus !== 'all') {
      pool = pool.filter(act => act.status === plannerListFilterStatus);
    }

    if (plannerListFilterType !== 'all') {
      if (plannerListFilterType === 'milestone') {
        pool = pool.filter(act => act.isMilestone);
      } else if (plannerListFilterType === 'activity') {
        pool = pool.filter(act => !act.isMilestone);
      }
    }

    if (plannerListFilterAssignee !== 'all') {
      pool = pool.filter(act => act.assignee === plannerListFilterAssignee);
    }

    pool.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (plannerListSortField === 'title') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (plannerListSortField === 'startDate') {
        valA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        valB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      } else if (plannerListSortField === 'endDate') {
        valA = a.endDate ? new Date(a.endDate).getTime() : Infinity;
        valB = b.endDate ? new Date(b.endDate).getTime() : Infinity;
      } else if (plannerListSortField === 'status') {
        valA = a.status;
        valB = b.status;
      } else if (plannerListSortField === 'project') {
        const projA = projects.find(p => p.id === a.projectId)?.title || '';
        const projB = projects.find(p => p.id === b.projectId)?.title || '';
        valA = projA.toLowerCase();
        valB = projB.toLowerCase();
      } else if (plannerListSortField === 'assignee') {
        valA = (a.assignee || '').toLowerCase();
        valB = (b.assignee || '').toLowerCase();
      }

      if (valA < valB) return plannerListSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return plannerListSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return pool;
  }, [activities, projects, selectedProjectId, plannerListFilterProject, plannerListSearch, plannerListFilterStatus, plannerListFilterType, plannerListFilterAssignee, plannerListSortField, plannerListSortDirection]);

  // --- Project Add/Edit ---
  const openNewProjectModal = () => {
    setEditingProject(null);
    setProjTitle('');
    setProjDesc('');
    setProjType('project');
    setIsProjModalOpen(true);
  };

  const openEditProjectModal = (proj: Project) => {
    setEditingProject(proj);
    setProjTitle(proj.title);
    setProjDesc(proj.description);
    setProjType(proj.type);
    setIsProjModalOpen(true);
  };

  const handleSaveProject = () => {
    if (!projTitle.trim()) {
      alert(isNl ? 'Titel is verplicht.' : 'Title is required.');
      return;
    }

    if (editingProject) {
      // Edit
      const updated: Project = {
        ...editingProject,
        title: projTitle.trim(),
        description: projDesc.trim(),
        type: projType
      };
      setProjects(prev => prev.map(p => p.id === editingProject.id ? updated : p));
      dbService.saveProject(updated);
    } else {
      // Add
      const newProjId = 'proj-' + Math.random().toString(36).substr(2, 9);
      const newProj: Project = {
        id: newProjId,
        title: projTitle.trim(),
        description: projDesc.trim(),
        type: projType,
        createdAt: new Date().toISOString()
      };
      setProjects(prev => [newProj, ...prev]);
      setSelectedProjectId(newProjId);
      dbService.saveProject(newProj);
    }
    setIsProjModalOpen(false);
  };

  const handleDeleteProject = (projId: string, title: string) => {
    const msg = isNl 
      ? `Weet u zeker dat u het project "${title}" met ALLE bijbehorende activiteiten wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
      : `Are you sure you want to delete the project "${title}" with ALL its activities? This cannot be undone.`;
    if (window.confirm(msg)) {
      setProjects(prev => prev.filter(p => p.id !== projId));
      setActivities(prev => prev.filter(act => act.projectId !== projId));
      if (selectedProjectId === projId) {
        setSelectedProjectId('all');
      }
      dbService.deleteProject(projId);
    }
  };

  // --- Activity Add/Edit & Move/Copy ---
  const openNewActivityModal = (presetProjectId?: string | unknown, parentId?: string | unknown) => {
    const cleanPresetId = (typeof presetProjectId === 'string' && projects.some(p => p.id === presetProjectId))
      ? presetProjectId
      : undefined;
    const cleanParentId = typeof parentId === 'string' ? parentId : undefined;

    const targetProjId = cleanPresetId
      || (selectedProjectId !== 'all' && projects.some(p => p.id === selectedProjectId) ? selectedProjectId : undefined)
      || (projects.length > 0 ? projects[0].id : '');

    if (!targetProjId) {
      alert(isNl ? 'Selecteer of maak eerst een project of verkenning aan.' : 'Please select or create a project or exploration first.');
      return;
    }
    if (cleanPresetId && cleanPresetId !== selectedProjectId && selectedProjectId !== 'all') {
      setSelectedProjectId(cleanPresetId);
    }
    setEditingActivity(null);
    setActProjectId(targetProjId);
    setActTitle('');
    setActDesc('');
    setActStart(new Date().toISOString().split('T')[0]);
    setActEnd(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setActStatus('todo');
    setActIsMilestone(false);
    setActDependencies([]);
    setActParentId(cleanParentId || '');
    setActAttachments([]);
    setActAssignee('');
    setModalDepSearch('');
    setModalDepFilter('all');
    setModalDepScope('project');
    setModalParentSearch('');
    setModalParentFilter('all');
    setIsParentPickerOpen(false);
    setModalTemplateSearch('');
    setIsTemplatePickerOpen(false);
    setIsActModalOpen(true);
  };

  const openEditActivityModal = (act: ProjectActivity) => {
    setEditingActivity(act);
    setActProjectId(act.projectId);
    setActTitle(act.title);
    setActDesc(act.description);
    setActStart(act.startDate);
    setActEnd(act.endDate);
    setActStatus(act.status);
    setActIsMilestone(act.isMilestone);
    setActDependencies(act.dependencies);
    setActParentId(act.parentId || '');
    setActAttachments(act.attachments || []);
    setActAssignee(act.assignee || '');
    setModalDepSearch('');
    setModalDepFilter('all');
    setModalDepScope('project');
    setModalParentSearch('');
    setModalParentFilter('all');
    setIsParentPickerOpen(false);
    setModalTemplateSearch('');
    setIsTemplatePickerOpen(false);
    setIsActModalOpen(true);
  };

  const openMoveCopyModal = (act: ProjectActivity, defaultAction: 'move' | 'copy' = 'move') => {
    setMoveCopyActivity(act);
    setMoveCopyAction(defaultAction);
    const otherProj = projects.find(p => p.id !== act.projectId);
    setMoveCopyTargetProjectId(otherProj?.id || act.projectId);
    setIsMoveCopyModalOpen(true);
  };

  const handleExecuteMoveCopy = () => {
    if (!moveCopyActivity || !moveCopyTargetProjectId) return;
    const targetProj = projects.find(p => p.id === moveCopyTargetProjectId);
    if (!targetProj) return;

    if (moveCopyAction === 'move') {
      if (moveCopyTargetProjectId === moveCopyActivity.projectId) {
        alert(isNl ? 'De activiteit is al gekoppeld aan dit project.' : 'The activity is already linked to this project.');
        return;
      }
      const updated: ProjectActivity = {
        ...moveCopyActivity,
        projectId: moveCopyTargetProjectId,
        parentId: undefined, // Clear parent since target project has different hierarchy
        dependencies: [] // Clear dependencies from old project
      };
      setActivities(prev => prev.map(a => a.id === moveCopyActivity.id ? updated : a));
      dbService.saveProjectActivity(updated);
      setIsMoveCopyModalOpen(false);
      if (isActModalOpen && editingActivity?.id === moveCopyActivity.id) {
        setIsActModalOpen(false);
      }
    } else {
      // Copy
      const targetActivities = activities.filter(a => a.projectId === moveCopyTargetProjectId);
      const copyAct: ProjectActivity = {
        ...moveCopyActivity,
        id: 'act-' + Math.random().toString(36).substr(2, 9),
        projectId: moveCopyTargetProjectId,
        title: `${moveCopyActivity.title} (${isNl ? 'Kopie' : 'Copy'})`,
        parentId: undefined,
        dependencies: [],
        order: targetActivities.length,
      };
      setActivities(prev => [...prev, copyAct]);
      dbService.saveProjectActivity(copyAct);
      setIsMoveCopyModalOpen(false);
    }
  };

  const handleDuplicateActivity = (act: ProjectActivity) => {
    const newAct: ProjectActivity = {
      ...act,
      id: 'act-' + Math.random().toString(36).substr(2, 9),
      title: `${act.title} (${isNl ? 'Kopie' : 'Copy'})`,
      order: currentProjectActivities.length,
    };
    setActivities(prev => [...prev, newAct]);
    openEditActivityModal(newAct);
  };

  const handleSaveActivity = (andDuplicate: boolean = false) => {
    if (!actTitle.trim()) {
      alert(isNl ? 'Activiteitstitel is verplicht.' : 'Activity title is required.');
      return;
    }

    const resolvedProjId = (typeof actProjectId === 'string' && projects.some(p => p.id === actProjectId))
      ? actProjectId
      : (selectedProjectId !== 'all' && projects.some(p => p.id === selectedProjectId))
        ? selectedProjectId
        : (projects[0]?.id || '');

    if (!resolvedProjId) {
      alert(isNl ? 'Selecteer een project of verkenning waaraan deze activiteit gekoppeld moet worden.' : 'Please select a project or exploration to link this activity to.');
      return;
    }

    const isParentAct = editingActivity
      ? activities.some(c => c.parentId === editingActivity.id)
      : false;

    const finalStart = isParentAct ? '' : (actStart || '');
    const finalEnd = isParentAct ? '' : (actIsMilestone ? (actStart || '') : (actEnd || ''));

    if (!isParentAct && finalStart && finalEnd) {
      const startMs = new Date(finalStart).getTime();
      const endMs = new Date(finalEnd).getTime();
      if (endMs < startMs) {
        alert(isNl ? 'Einddatum kan niet vóór de begindatum liggen.' : 'End date cannot be before start date.');
        return;
      }
    }

    if (editingActivity) {
      // Edit or Move to different project
      const projectChanged = editingActivity.projectId !== resolvedProjId;
      const updated: ProjectActivity = {
        ...editingActivity,
        projectId: resolvedProjId,
        title: actTitle.trim(),
        description: actDesc.trim(),
        startDate: finalStart,
        endDate: finalEnd,
        status: actStatus,
        isMilestone: actIsMilestone,
        dependencies: projectChanged ? [] : actDependencies,
        parentId: projectChanged ? undefined : (actParentId || undefined),
        attachments: actAttachments,
        assignee: actAssignee.trim() || undefined
      };
      setActivities(prev => prev.map(a => a.id === editingActivity.id ? updated : a));
      dbService.saveProjectActivity(updated);
    } else {
      // Create with explicit project link
      const newAct: ProjectActivity = {
        id: 'act-' + Math.random().toString(36).substr(2, 9),
        projectId: resolvedProjId,
        title: actTitle.trim(),
        description: actDesc.trim(),
        startDate: finalStart,
        endDate: finalEnd,
        status: actStatus,
        isMilestone: actIsMilestone,
        dependencies: actDependencies,
        parentId: actParentId || undefined,
        order: activities.filter(a => a.projectId === resolvedProjId).length,
        attachments: actAttachments,
        assignee: actAssignee.trim() || undefined
      };
      setActivities(prev => [...prev, newAct]);
      dbService.saveProjectActivity(newAct);
    }

    if (andDuplicate) {
      setEditingActivity(null);
      setActTitle(prev => `${prev} (${isNl ? 'Kopie' : 'Copy'})`);
      // Keep other modal state (description, dates, milestone, status, assignee, parent) ready for next copy!
    } else {
      setIsActModalOpen(false);
    }
  };

  const handleDeleteActivity = (actId: string, title: string) => {
    const msg = isNl 
      ? `Weet u zeker dat u de activiteit "${title}" wilt verwijderen?`
      : `Are you sure you want to delete the activity "${title}"?`;
    if (window.confirm(msg)) {
      setActivities(prev => 
        prev
          .filter(a => a.id !== actId)
          .map(a => ({
            ...a,
            dependencies: a.dependencies ? a.dependencies.filter(depId => depId !== actId) : []
          }))
      );
      setCollapsedActivityIds(prev => prev.filter(id => id !== actId));
      dbService.deleteProjectActivity(actId);
    }
  };

  const handleToggleDependency = (id: string) => {
    if (actDependencies.includes(id)) {
      setActDependencies(prev => prev.filter(d => d !== id));
    } else {
      setActDependencies(prev => [...prev, id]);
    }
  };

  const handleSelectAllFilteredDependencies = () => {
    const idsToAdd = filteredDependencyActivities.map(a => a.id);
    setActDependencies(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleClearDependencies = () => {
    setActDependencies([]);
  };

  const handleApplyActivityTemplate = (srcAct: ProjectActivity) => {
    setActTitle(srcAct.title);
    setActDesc(srcAct.description || '');
    setActIsMilestone(srcAct.isMilestone || false);
    setActStart(srcAct.startDate || '');
    setActEnd(srcAct.endDate || '');
    setActStatus(srcAct.status || 'todo');
    setActAssignee(srcAct.assignee || '');
    if (srcAct.parentId) {
      setActParentId(srcAct.parentId);
    }
    setIsTemplatePickerOpen(false);
  };

  // --- HTML5 Drag and Drop Vertical Sorting for Gantt Chart ---
  const handleGanttDragStart = (e: React.DragEvent, act: ProjectActivity) => {
    e.dataTransfer.setData('text/plain', act.id);
    setDraggedActivityId(act.id);
  };

  const handleGanttDragOver = (e: React.DragEvent, act: ProjectActivity) => {
    e.preventDefault();
  };

  const handleGanttDrop = (e: React.DragEvent, targetAct: ProjectActivity) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedActivityId;
    if (!sourceId || sourceId === targetAct.id) return;

    const currentActs = [...currentProjectActivities];
    const sortedCurrentActs = [...currentActs].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 1000;
      const orderB = b.order !== undefined ? b.order : 1000;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const sourceIndex = sortedCurrentActs.findIndex(a => a.id === sourceId);
    const targetIndex = sortedCurrentActs.findIndex(a => a.id === targetAct.id);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [removed] = sortedCurrentActs.splice(sourceIndex, 1);
    sortedCurrentActs.splice(targetIndex, 0, removed);

    // sequential integers
    const updatedWithWeight = sortedCurrentActs.map((item, idx) => ({
      ...item,
      order: idx
    }));

    setActivities(prev => {
      return prev.map(a => {
        const match = updatedWithWeight.find(u => u.id === a.id);
        return match ? match : a;
      });
    });

    setDraggedActivityId(null);
  };

  // --- Dynamic measurement of Gantt portion for drawing connections ---
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const ganttScrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);

  // Gantt timeline dragging state
  const [isDraggingGantt, setIsDraggingGantt] = useState(false);
  const [ganttDragStartX, setGanttDragStartX] = useState(0);
  const [ganttDragScrollLeft, setGanttDragScrollLeft] = useState(0);

  const handleGanttMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;

    if (ganttScrollContainerRef.current) {
      setIsDraggingGantt(true);
      setGanttDragStartX(e.pageX - ganttScrollContainerRef.current.offsetLeft);
      setGanttDragScrollLeft(ganttScrollContainerRef.current.scrollLeft);
    }
  };

  const handleGanttMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingGantt || !ganttScrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - ganttScrollContainerRef.current.offsetLeft;
    const walk = (x - ganttDragStartX) * 1.5;
    ganttScrollContainerRef.current.scrollLeft = ganttDragScrollLeft - walk;
  };

  const handleGanttMouseUpOrLeave = () => {
    setIsDraggingGantt(false);
  };

  useEffect(() => {
    if (!timelineRef.current) return;
    const updateWidth = () => {
      setTimelineWidth(timelineRef.current?.getBoundingClientRect().width || 0);
    };
    // Run after a short delay so styling changes are complete
    const t = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateWidth);
    };
  }, [displayActivities, zoomMultiplier]);

  // Zoom handling logic that steps both zoomMultiplier and ganttScale
  const SCALES_IN_ORDER: TimelineViewScale[] = useMemo(() => ['week', 'month', 'quarter', 'year', 'multi_year'], []);

  const handleZoomIn = useCallback(() => {
    if (zoomMultiplier < 1.35) {
      setZoomMultiplier(prev => Math.round((prev + 0.15) * 100) / 100);
    } else {
      const currentIndex = SCALES_IN_ORDER.indexOf(ganttScale);
      if (currentIndex > 0) {
        setGanttScale(SCALES_IN_ORDER[currentIndex - 1]);
        setZoomMultiplier(1.0);
      } else {
        setZoomMultiplier(prev => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
      }
    }
  }, [zoomMultiplier, ganttScale, SCALES_IN_ORDER]);

  const handleZoomOut = useCallback(() => {
    if (zoomMultiplier > 0.85) {
      setZoomMultiplier(prev => Math.round((prev - 0.15) * 100) / 100);
    } else {
      const currentIndex = SCALES_IN_ORDER.indexOf(ganttScale);
      if (currentIndex < SCALES_IN_ORDER.length - 1) {
        setGanttScale(SCALES_IN_ORDER[currentIndex + 1]);
        setZoomMultiplier(1.0);
      } else {
        setZoomMultiplier(prev => Math.max(0.5, Math.round((prev - 0.15) * 100) / 100));
      }
    }
  }, [zoomMultiplier, ganttScale, SCALES_IN_ORDER]);

  // Non-passive native wheel listener for mouse wheel zooming
  useEffect(() => {
    const el = ganttScrollContainerRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else if (e.deltaY > 0) {
          handleZoomOut();
        }
      }
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelNative);
    };
  }, [handleZoomIn, handleZoomOut]);

  // Find project's actual date range
  const projectDateRange = useMemo(() => {
    if (currentProjectActivities.length === 0) {
      const today = new Date();
      const end = new Date(today);
      end.setDate(today.getDate() + 14);
      return { min: toLocalMidnight(today), max: toLocalMidnight(end) };
    }
    const dates = currentProjectActivities.map(a => {
      const res = resolveActivityDates(a, currentProjectActivities);
      return [parseYMD(res.startDate), parseYMD(res.endDate)];
    }).flat();
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    return { min: toLocalMidnight(min), max: toLocalMidnight(max) };
  }, [currentProjectActivities]);

  // A state for navigable view start date
  const [viewStartDate, setViewStartDate] = useState<Date | null>(null);

  // Helper to align raw start date to the beginning of the scale period
  function alignStartDateToScale(d: Date, scale: TimelineViewScale): Date {
    const date = toLocalMidnight(new Date(d));
    if (scale === 'week') {
      const day = date.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diffToMon);
    } else if (scale === 'month') {
      date.setDate(1);
    } else if (scale === 'quarter') {
      const qMonth = Math.floor(date.getMonth() / 3) * 3;
      date.setMonth(qMonth, 1);
    } else if (scale === 'year' || scale === 'multi_year') {
      date.setMonth(0, 1);
    }
    return date;
  }

  // Focus view start date when project or scale changes
  useEffect(() => {
    if (projectDateRange.min) {
      const initialDate = alignStartDateToScale(projectDateRange.min, ganttScale);
      setViewStartDate(initialDate);
    }
  }, [selectedProjectId, ganttScale, projectDateRange.min]);

  // Handle shifted increments over time
  const handleShiftTimeline = (direction: 'prev' | 'next') => {
    if (!viewStartDate) return;
    const current = new Date(viewStartDate);
    const aligned = alignStartDateToScale(current, ganttScale);
    const multiplier = direction === 'prev' ? -1 : 1;
    
    if (ganttScale === 'week') {
      aligned.setDate(aligned.getDate() + multiplier * 7);
    } else if (ganttScale === 'month') {
      aligned.setMonth(aligned.getMonth() + multiplier * 1);
    } else if (ganttScale === 'quarter') {
      aligned.setMonth(aligned.getMonth() + multiplier * 3);
    } else if (ganttScale === 'year') {
      aligned.setFullYear(aligned.getFullYear() + multiplier * 1);
    } else {
      aligned.setFullYear(aligned.getFullYear() + multiplier * 2);
    }
    setViewStartDate(aligned);
  };

  const handleResetTimeline = () => {
    if (projectDateRange.min) {
      const initialDate = alignStartDateToScale(projectDateRange.min, ganttScale);
      setViewStartDate(initialDate);
    }
  };

  // Zoom & view range calculation to show ALL tasks in project in one single view
  const handleFitAllTasks = () => {
    if (currentProjectActivities.length === 0) return;

    const dates: Date[] = [];
    currentProjectActivities.forEach(act => {
      const res = resolveActivityDates(act, currentProjectActivities);
      if (res.startDate) {
        const d = parseYMD(res.startDate);
        if (!isNaN(d.getTime())) dates.push(d);
      }
      if (res.endDate) {
        const d = parseYMD(res.endDate);
        if (!isNaN(d.getTime())) dates.push(d);
      }
    });

    if (dates.length === 0) return;

    const minTime = Math.min(...dates.map(d => d.getTime()));
    const maxTime = Math.max(...dates.map(d => d.getTime()));

    const minDate = toLocalMidnight(new Date(minTime));
    const maxDate = toLocalMidnight(new Date(maxTime));

    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

    let optimalScale: TimelineViewScale = 'month';
    if (totalDays <= 14) {
      optimalScale = 'week';
    } else if (totalDays <= 45) {
      optimalScale = 'month';
    } else if (totalDays <= 180) {
      optimalScale = 'quarter';
    } else if (totalDays <= 730) {
      optimalScale = 'year';
    } else {
      optimalScale = 'multi_year';
    }

    const fitStartDate = alignStartDateToScale(minDate, optimalScale);

    setGanttScale(optimalScale);
    setViewStartDate(fitStartDate);
    setZoomMultiplier(1.0);
  };

  // --- Dynamic Gantt Timeline Dates Generation ---
  const timelineDates = useMemo(() => {
    const rawStart = viewStartDate ? new Date(viewStartDate) : new Date();
    const midnightStart = alignStartDateToScale(rawStart, ganttScale);
    const datesList: Date[] = [];
    
    let durationDays = 30;
    if (ganttScale === 'week') {
      durationDays = 14;
    } else if (ganttScale === 'month') {
      const nextMonth = new Date(midnightStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const diffMs = nextMonth.getTime() - midnightStart.getTime();
      durationDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    } else if (ganttScale === 'quarter') {
      const nextQuarter = new Date(midnightStart);
      nextQuarter.setMonth(nextQuarter.getMonth() + 3);
      const diffMs = nextQuarter.getTime() - midnightStart.getTime();
      durationDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    } else if (ganttScale === 'year') {
      const nextYear = new Date(midnightStart);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const diffMs = nextYear.getTime() - midnightStart.getTime();
      durationDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    } else if (ganttScale === 'multi_year') {
      const nextYears = new Date(midnightStart);
      nextYears.setFullYear(nextYears.getFullYear() + 2);
      const diffMs = nextYears.getTime() - midnightStart.getTime();
      durationDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    for (let i = 0; i < durationDays; i++) {
      const next = new Date(midnightStart);
      next.setDate(midnightStart.getDate() + i);
      datesList.push(next);
    }
    return datesList;
  }, [viewStartDate, ganttScale]);

  const timelineStart = useMemo(() => {
    return timelineDates[0] ? toLocalMidnight(timelineDates[0]) : toLocalMidnight(new Date());
  }, [timelineDates]);

  const timelineEnd = useMemo(() => {
    return timelineDates[timelineDates.length - 1] ? toLocalMidnight(timelineDates[timelineDates.length - 1]) : toLocalMidnight(new Date());
  }, [timelineDates]);

  const totalTimelineDays = useMemo(() => {
    return timelineDates.length;
  }, [timelineDates]);

  // --- Today's Date and Positioning on Timeline ---
  const todayDate = useMemo(() => toLocalMidnight(new Date()), []);

  const todayLeftPercent = useMemo(() => {
    const todayMs = todayDate.getTime() + 43200000; // Noon of today
    const startMs = timelineStart.getTime();
    const totalMs = totalTimelineDays * 86400000;
    const endMs = startMs + totalMs;

    if (todayMs < startMs || todayMs > endMs) return null;

    const diffMs = todayMs - startMs;
    return (diffMs / totalMs) * 100;
  }, [todayDate, timelineStart, totalTimelineDays]);

  // Jump timeline to center around Today
  const handleJumpToToday = () => {
    const newStart = alignStartDateToScale(todayDate, ganttScale);
    setViewStartDate(newStart);
  };

  // --- Calculate Time Remaining until Project End (Furthest date / last milestone) ---
  const projectRemainingInfo = useMemo(() => {
    if (currentProjectActivities.length === 0) return null;

    const allDates: Date[] = [];
    currentProjectActivities.forEach(act => {
      const resolved = resolveActivityDates(act, currentProjectActivities);
      const sStr = resolved.startDate || act.startDate;
      const eStr = act.isMilestone ? sStr : (resolved.endDate || act.endDate || sStr);
      if (sStr) {
        const d = parseYMD(sStr);
        if (!isNaN(d.getTime())) allDates.push(d);
      }
      if (eStr) {
        const d = parseYMD(eStr);
        if (!isNaN(d.getTime())) allDates.push(d);
      }
    });

    if (allDates.length === 0) return null;

    // Latest date in project (furthest in future or last milestone)
    const maxMs = Math.max(...allDates.map(d => d.getTime()));
    const endDate = toLocalMidnight(new Date(maxMs));

    const todayMs = todayDate.getTime();
    const diffMs = endDate.getTime() - todayMs;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const diffWeeks = (diffDays / 7).toFixed(1);
    const diffMonths = (diffDays / 30.4375).toFixed(1);

    const formattedEndDate = endDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return {
      endDate,
      diffDays,
      diffWeeks,
      diffMonths,
      formattedEndDate,
      isFuture: diffDays > 0,
      isToday: diffDays === 0,
      isPast: diffDays < 0
    };
  }, [currentProjectActivities, todayDate, lang]);

  // Helper calculation for ISO week number
  function getWeekNumber(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Dynamic 2-tier timeline ruler headers matching current zoom scale
  const ganttTimelineHeaders = useMemo(() => {
    if (!timelineDates || timelineDates.length === 0) {
      return {
        topTitle: isNl ? 'Periode' : 'Period',
        topHeaders: [],
        bottomTitle: isNl ? 'Tijdstappen' : 'Time steps',
        bottomHeaders: []
      };
    }

    const totalDays = timelineDates.length;

    // Scale 1 & 2: 'week' or 'month'
    if (ganttScale === 'week' || ganttScale === 'month') {
      // Top Tier: ISO Calendar Weeks
      const weekGroups: { weekNum: number; year: number; dates: Date[]; mondayDate: Date }[] = [];
      timelineDates.forEach((date) => {
        const weekNum = getWeekNumber(date);
        let isoYear = date.getFullYear();
        if (date.getMonth() === 11 && weekNum === 1) isoYear += 1;
        if (date.getMonth() === 0 && weekNum >= 52) isoYear -= 1;

        const lastGroup = weekGroups[weekGroups.length - 1];
        if (lastGroup && lastGroup.weekNum === weekNum && lastGroup.year === isoYear) {
          lastGroup.dates.push(date);
        } else {
          const mon = new Date(date);
          const day = mon.getDay();
          const diffToMon = day === 0 ? -6 : 1 - day;
          mon.setDate(mon.getDate() + diffToMon);

          weekGroups.push({
            weekNum,
            year: isoYear,
            dates: [date],
            mondayDate: toLocalMidnight(mon)
          });
        }
      });

      const topHeaders = weekGroups.map((g) => {
        const widthPercent = (g.dates.length / totalDays) * 100;
        const monStr = g.mondayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
          day: 'numeric',
          month: 'short'
        });
        const label = `Week ${g.weekNum}`;
        const subLabel = lang === 'nl' 
          ? `(ma ${monStr})` 
          : `(Mon ${monStr})`;

        return {
          label,
          subLabel,
          widthPercent,
          title: `Week ${g.weekNum} - ${isNl ? '1e dag (maandag)' : '1st day (Monday)'}: ${g.mondayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')}`
        };
      });

      // Bottom Tier: Days
      const colWidthPercent = 100 / totalDays;
      const bottomHeaders = timelineDates.map((date) => {
        const weekday = date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        const monthShort = date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' });
        
        const label = ganttScale === 'week' 
          ? `${weekday} ${dayNum}`
          : (totalDays <= 31 ? `${dayNum}` : `${dayNum} ${monthShort}`);

        return {
          label,
          widthPercent: colWidthPercent,
          date
        };
      });

      return {
        topTitle: isNl ? '📅 ISO-Kalenderweken' : '📅 ISO Calendar Weeks',
        topHeaders,
        bottomTitle: isNl ? 'Dagen' : 'Days',
        bottomHeaders
      };
    }

    // Scale 2: 'month'
    if (ganttScale === 'month') {
      // Top Tier: Month Name + Year
      const monthGroups: { yearMonth: string; dates: Date[]; monthName: string }[] = [];
      timelineDates.forEach((date) => {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const last = monthGroups[monthGroups.length - 1];
        if (last && last.yearMonth === key) {
          last.dates.push(date);
        } else {
          const monthName = date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'long', year: 'numeric' });
          monthGroups.push({ yearMonth: key, dates: [date], monthName });
        }
      });

      const topHeaders = monthGroups.map((g) => ({
        label: g.monthName,
        widthPercent: (g.dates.length / totalDays) * 100,
        title: g.monthName
      }));

      // Bottom Tier: Days of the month 1..31
      const colWidthPercent = 100 / totalDays;
      const bottomHeaders = timelineDates.map((date) => {
        const dayNum = date.getDate();
        return {
          label: `${dayNum}`,
          widthPercent: colWidthPercent,
          date,
          title: date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        };
      });

      return {
        topTitle: isNl ? '📅 Maand' : '📅 Month',
        topHeaders,
        bottomTitle: isNl ? 'Dagen' : 'Days',
        bottomHeaders
      };
    }

    // Scale 3: 'quarter'
    if (ganttScale === 'quarter') {
      // Top Tier: Months
      const monthGroups: { yearMonth: string; dates: Date[]; monthName: string }[] = [];
      timelineDates.forEach((date) => {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const last = monthGroups[monthGroups.length - 1];
        if (last && last.yearMonth === key) {
          last.dates.push(date);
        } else {
          const monthName = date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'long', year: 'numeric' });
          monthGroups.push({ yearMonth: key, dates: [date], monthName });
        }
      });

      const topHeaders = monthGroups.map((g) => ({
        label: g.monthName,
        widthPercent: (g.dates.length / totalDays) * 100,
        title: g.monthName
      }));

      // Bottom Tier: ISO Weeks
      const weekGroups: { weekNum: number; year: number; dates: Date[]; mondayDate: Date }[] = [];
      timelineDates.forEach((date) => {
        const weekNum = getWeekNumber(date);
        let isoYear = date.getFullYear();
        if (date.getMonth() === 11 && weekNum === 1) isoYear += 1;
        if (date.getMonth() === 0 && weekNum >= 52) isoYear -= 1;

        const lastGroup = weekGroups[weekGroups.length - 1];
        if (lastGroup && lastGroup.weekNum === weekNum && lastGroup.year === isoYear) {
          lastGroup.dates.push(date);
        } else {
          const mon = new Date(date);
          const day = mon.getDay();
          const diffToMon = day === 0 ? -6 : 1 - day;
          mon.setDate(mon.getDate() + diffToMon);

          weekGroups.push({
            weekNum,
            year: isoYear,
            dates: [date],
            mondayDate: toLocalMidnight(mon)
          });
        }
      });

      const bottomHeaders = weekGroups.map((g) => {
        const widthPercent = (g.dates.length / totalDays) * 100;
        const monStr = g.mondayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
          day: 'numeric',
          month: 'numeric'
        });
        return {
          label: `W${g.weekNum} (${monStr})`,
          widthPercent
        };
      });

      return {
        topTitle: isNl ? '📅 Maanden' : '📅 Months',
        topHeaders,
        bottomTitle: isNl ? 'ISO-Weken' : 'ISO Weeks',
        bottomHeaders
      };
    }

    // Scale 4: 'year'
    if (ganttScale === 'year') {
      // Top Tier: Quarters
      const quarterGroups: { quarterKey: string; dates: Date[]; label: string }[] = [];
      timelineDates.forEach((date) => {
        const q = Math.floor(date.getMonth() / 3) + 1;
        const key = `${date.getFullYear()}-Q${q}`;
        const last = quarterGroups[quarterGroups.length - 1];
        if (last && last.quarterKey === key) {
          last.dates.push(date);
        } else {
          quarterGroups.push({
            quarterKey: key,
            dates: [date],
            label: `Q${q} ${date.getFullYear()}`
          });
        }
      });

      const topHeaders = quarterGroups.map((g) => ({
        label: g.label,
        widthPercent: (g.dates.length / totalDays) * 100,
        title: g.label
      }));

      // Bottom Tier: Months
      const monthGroups: { yearMonth: string; dates: Date[]; monthShort: string }[] = [];
      timelineDates.forEach((date) => {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const last = monthGroups[monthGroups.length - 1];
        if (last && last.yearMonth === key) {
          last.dates.push(date);
        } else {
          const monthShort = date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { month: 'short' });
          monthGroups.push({ yearMonth: key, dates: [date], monthShort });
        }
      });

      const bottomHeaders = monthGroups.map((g) => ({
        label: g.monthShort,
        widthPercent: (g.dates.length / totalDays) * 100
      }));

      return {
        topTitle: isNl ? '📅 Kwartalen' : '📅 Quarters',
        topHeaders,
        bottomTitle: isNl ? 'Maanden' : 'Months',
        bottomHeaders
      };
    }

    // Scale 5: 'multi_year'
    // Top Tier: Years
    const yearGroups: { year: number; dates: Date[] }[] = [];
    timelineDates.forEach((date) => {
      const y = date.getFullYear();
      const last = yearGroups[yearGroups.length - 1];
      if (last && last.year === y) {
        last.dates.push(date);
      } else {
        yearGroups.push({ year: y, dates: [date] });
      }
    });

    const topHeaders = yearGroups.map((g) => ({
      label: `${g.year}`,
      widthPercent: (g.dates.length / totalDays) * 100,
      title: `${g.year}`
    }));

    // Bottom Tier: Quarters
    const quarterGroups: { quarterKey: string; dates: Date[]; label: string }[] = [];
    timelineDates.forEach((date) => {
      const q = Math.floor(date.getMonth() / 3) + 1;
      const key = `${date.getFullYear()}-Q${q}`;
      const last = quarterGroups[quarterGroups.length - 1];
      if (last && last.quarterKey === key) {
        last.dates.push(date);
      } else {
        quarterGroups.push({
          quarterKey: key,
          dates: [date],
          label: `Q${q}`
        });
      }
    });

    const bottomHeaders = quarterGroups.map((g) => ({
      label: g.label,
      widthPercent: (g.dates.length / totalDays) * 100
    }));

    return {
      topTitle: isNl ? '📅 Jaren' : '📅 Years',
      topHeaders,
      bottomTitle: isNl ? 'Kwartalen' : 'Quarters',
      bottomHeaders
    };
  }, [timelineDates, ganttScale, lang, isNl]);

  const gridLines = useMemo(() => {
    const lines: { leftPercent: number }[] = [];
    let currentLeft = 0;
    ganttTimelineHeaders.bottomHeaders.forEach((h, idx) => {
      if (idx > 0) {
        lines.push({ leftPercent: currentLeft });
      }
      currentLeft += h.widthPercent;
    });
    return lines;
  }, [ganttTimelineHeaders]);

  // Config object to bundle start and end cleanly for utilities
  const timelineConfig = useMemo(() => {
    return {
      startDate: timelineStart,
      endDate: timelineEnd,
      columns: ganttTimelineHeaders.bottomHeaders
    };
  }, [timelineStart, timelineEnd, ganttTimelineHeaders]);

  // --- Calculate offset and width percentage of an activity bar ---
  const getActBarCoords = (act: ProjectActivity) => {
    const resolved = resolveActivityDates(act, currentProjectActivities);
    let sDateStr = resolved.startDate || act.startDate;
    let eDateStr = act.isMilestone ? sDateStr : (resolved.endDate || act.endDate);

    if (sDateStr && !eDateStr) eDateStr = sDateStr;
    if (!sDateStr && eDateStr) sDateStr = eDateStr;

    if (!sDateStr && !eDateStr) {
      return { left: 0, width: 0, isOutside: true, isUnscheduled: true };
    }

    const actStart = parseYMD(sDateStr);
    const actEnd = parseYMD(eDateStr);

    if (isNaN(actStart.getTime()) || isNaN(actEnd.getTime())) {
      return { left: 0, width: 0, isOutside: true, isUnscheduled: true };
    }

    const tStartMs = timelineStart.getTime();
    const totalMs = totalTimelineDays * 86400000;
    const tEndMs = tStartMs + totalMs;

    const actStartMs = actStart.getTime();
    const actEndMs = act.isMilestone ? actStartMs : actEnd.getTime() + 86400000;

    if (actEndMs < tStartMs || actStartMs > tEndMs) {
      return { left: 0, width: 0, isOutside: true, isUnscheduled: false };
    }

    if (act.isMilestone) {
      const midMs = actStartMs + 43200000;
      let leftPercent = ((midMs - tStartMs) / totalMs) * 100;
      if (leftPercent < 0) leftPercent = 0;
      if (leftPercent > 100) leftPercent = 100;
      return { left: leftPercent, width: 0, isOutside: false, isUnscheduled: false };
    }

    const currentStartMs = Math.max(tStartMs, actStartMs);
    const currentEndMs = Math.min(tEndMs, actEndMs);

    let leftPercent = ((currentStartMs - tStartMs) / totalMs) * 100;
    let widthPercent = ((currentEndMs - currentStartMs) / totalMs) * 100;

    if (leftPercent < 0) leftPercent = 0;
    if (leftPercent > 100) leftPercent = 98;
    if (leftPercent + widthPercent > 100) widthPercent = 100 - leftPercent;
    if (widthPercent <= 0) widthPercent = 0.5;

    return { left: leftPercent, width: widthPercent, isOutside: false, isUnscheduled: false };
  };

  // --- HTML offscreen builder for printing high-DPI reports ---
  const buildExportDom = (mode: 'single' | 'multi', pageActivities: ProjectActivity[] = [], pageNum = 1, totalPages = 1) => {
    const root = document.createElement('div');
    root.style.width = '1120px';
    root.style.backgroundColor = '#ffffff';
    root.style.color = '#0f172a';
    root.style.padding = '24px';
    root.style.borderRadius = '0px';
    root.style.fontFamily = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    
    const typeLabel = currentProject?.type === 'exploration' 
      ? (isNl ? 'VERKENNING' : 'EXPLORATION')
      : (isNl ? 'PROJECT' : 'PROJECT');
    
    const typeColor = currentProject?.type === 'exploration' ? '#0d9488' : '#2563eb';
    const typeBgColor = currentProject?.type === 'exploration' ? '#f0fdfa' : '#eff6ff';
    const typeBorderColor = currentProject?.type === 'exploration' ? '#ccfbf1' : '#dbeafe';
    
    // Header section
    let html = `
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 8.5px; font-weight: 800; color: ${typeColor}; background-color: ${typeBgColor}; border: 1px solid ${typeBorderColor}; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.75px; display: inline-block; margin-bottom: 6px; text-transform: uppercase;">
              ${typeLabel}
            </span>
            <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2;">
              ${currentProject?.title || ''}
            </h1>
            <p style="font-size: 11px; color: #475569; margin-top: 6px; margin-bottom: 0; max-width: 800px; line-height: 1.5;">
              ${currentProject?.description || (isNl ? 'Geen beschrijving opgegeven.' : 'No description provided.')}
            </p>
          </div>
          <div style="text-align: right; min-width: 200px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center;">
            <div style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.75px;">
              ${isNl ? 'EXPORT DATUM' : 'EXPORT DATE'}
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #1e293b; margin-top: 2px;">
              ${new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            ${mode === 'multi' ? `
              <div style="font-size: 9.5px; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #dbeafe; padding: 3px 10px; border-radius: 4px; margin-top: 6px; display: inline-block;">
                ${isNl ? 'Pagina' : 'Page'} ${pageNum} / ${totalPages}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Visual Gantt schedule (only on single view, or page 1 of multi view)
    if (mode === 'single' || pageNum === 1) {
      const topHeadersForPdf = ganttTimelineHeaders.topHeaders.map((w: any) => `
        <div style="width: ${w.widthPercent}%; text-align: center; font-size: 8.5px; font-weight: 800; color: #1e1b4b; border-left: 1px solid #c7d2fe; padding: 4px 0; font-family: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${w.label}
        </div>
      `).join('');

      const bottomHeadersForPdf = ganttTimelineHeaders.bottomHeaders.map((col: any) => `
        <div style="width: ${col.widthPercent}%; text-align: center; font-size: 9px; font-weight: 700; color: #475569; border-left: 1px solid #e2e8f0; padding: 5px 0; font-family: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${col.label}
        </div>
      `).join('');

      let chartRows = '';
      const actsForChart = mode === 'single' ? displayActivities : (pageActivities.length > 0 ? pageActivities : displayActivities);

      if (actsForChart.length === 0) {
        chartRows = `
          <div style="padding: 30px; text-align: center; color: #64748b; font-size: 12px; border: 2px dashed #e2e8f0; border-radius: 8px; margin-top: 10px; font-family: inherit;">
            ${isNl ? 'Geen activiteiten geregistreerd.' : 'No activities recorded.'}
          </div>
        `;
      } else {
        actsForChart.forEach(act => {
          const coords = getActBarCoords(act);
          const isSubActivity = act.parentId && currentProjectActivities.some(p => p.id === act.parentId);
          const isParent = currentProjectActivities.some(c => c.parentId === act.id);
          const resolved = resolveActivityDates(act, currentProjectActivities);

          const isOverdue = isActivityOverdue(act);

          const barColor = isOverdue ? '#e11d48' :
                           act.status === 'completed' ? '#10b981' : 
                           act.status === 'in_progress' ? '#3b82f6' :
                           act.status === 'on_hold' ? '#f59e0b' :
                           act.status === 'cancelled' ? '#a8a29e' : '#64748b';

          const borderCol = isOverdue ? '#be123c' :
                            act.status === 'completed' ? '#059669' : 
                            act.status === 'in_progress' ? '#2563eb' :
                            act.status === 'on_hold' ? '#d97706' :
                            act.status === 'cancelled' ? '#78716c' : '#475569';

          const depTitles = act.dependencies
            .map(depId => currentProjectActivities.find(a => a.id === depId)?.title)
            .filter(Boolean)
            .join(', ');

          // Padding left for sub-activities
          const titleIndent = isSubActivity ? 'padding-left: 18px;' : '';
          const parentBgStyle = isParent ? 'background-color: #f8fafc;' : '';

          chartRows += `
            <div style="display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; padding: 8px 0; min-height: 48px; position: relative; font-family: inherit; box-sizing: border-box; ${parentBgStyle}">
              <!-- Title wrap layout to prevent line overlap -->
              <div style="width: 280px; padding-right: 15px; display: flex; flex-direction: column; justify-content: center; flex-shrink: 0; box-sizing: border-box; ${titleIndent}">
                <span style="font-size: 10.5px; ${isParent ? 'font-weight: 800; color: #1e1b4b;' : 'font-weight: 700; color: #0f172a;'} line-height: 1.4; white-space: normal; word-wrap: break-word; overflow-wrap: break-word; display: block; margin-bottom: 2px;">
                  ${isSubActivity ? '↳ ' : ''}${isParent ? '📂 ' : ''}${act.isMilestone ? '◆ ' : ''}${act.title}
                </span>
                <span style="font-size: 8px; font-weight: 700; color: ${isParent ? '#3730a3' : act.status === 'completed' ? '#047857' : '#475569'}; background: ${isParent ? '#e0eafe' : act.status === 'completed' ? '#ecfdf5' : '#e2e8f0'}; border-radius: 4px; padding: 2px 6px; display: inline-block; width: fit-content; margin-top: 2px; font-family: inherit; box-sizing: border-box;">
                  📅 ${resolved.startDate || resolved.endDate ? `${resolved.startDate || ''}${act.isMilestone ? '' : ` ${(isNl ? 't/m' : 'to')} ${resolved.endDate || ''}`}` : (act.status === 'completed' ? `✓ ${isNl ? 'Afgerond' : 'Completed'}` : (isNl ? 'Geen datum' : 'No date'))}
                </span>
              </div>
              
              <!-- Timeline strip -->
              <div style="flex: 1; height: 32px; position: relative; background-image: linear-gradient(to right, #f8fafc 1px, transparent 1px); background-size: calc(100% / ${timelineConfig.columns.length}) 100%; box-sizing: border-box;">
                ${coords.isOutside ? '' : (
                  act.isMilestone ? `
                    <!-- Diamond -->
                    <div style="position: absolute; left: ${coords.left}%; top: 10px; width: 10px; height: 10px; background-color: #d97706; border: 2px solid #ffffff; transform: rotate(45deg); margin-left: -5px; box-shadow: 0 1px 2px rgba(0,0,0,0.15); z-index: 5;"></div>
                  ` : isParent ? `
                    <!-- Parent Bracket summary timeline bar -->
                    <div style="position: absolute; left: ${coords.left}%; width: ${coords.width}%; top: 11px; height: 4px; background-color: #0f172a; z-index: 5;">
                      <div style="position: absolute; left: 0; top: 0; width: 2px; background: #0f172a; height: 10px; transform: skewY(35deg); margin-top: -3px;"></div>
                      <div style="position: absolute; right: 0; top: 0; width: 2px; background: #0f172a; height: 10px; transform: skewY(-35deg); margin-top: -3px;"></div>
                    </div>
                  ` : `
                    <!-- Standard Bar -->
                    <div style="position: absolute; left: ${coords.left}%; width: ${coords.width}%; top: 7px; height: 18px; border-radius: 4px; border: 1px solid ${borderCol}; background-color: ${barColor}; color: #ffffff; font-size: 9px; font-weight: 800; display: flex; align-items: center; padding: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.12); z-index: 5;">
                      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-shadow: 0 1px 1px rgba(0,0,0,0.15);">${act.title}</span>
                    </div>
                  `
                )}
                
                ${depTitles ? `
                  <div style="position: absolute; left: ${coords.left}%; top: 26px; font-size: 8px; color: #4f46e5; font-weight: 700; white-space: nowrap; z-index: 2;">
                    🔗 ${isNl ? 'Afhankelijk van' : 'Requires'}: <span style="text-decoration: underline;">${depTitles}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        });
      }

      html += `
        <div style="margin-bottom: 20px; font-family: inherit;">
          <h2 style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; margin-top: 10px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span>📅</span> ${isNl ? 'SCHEMA TIJDLIJN (GANTT CHART)' : 'SCHEDULE TIMELINE (GANTT CHART)'}
          </h2>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <!-- Top Header bar -->
            <div style="display: flex; background-color: #e0e7ff; border-bottom: 1px solid #c7d2fe; padding-right: 5px;">
              <div style="width: 280px; font-size: 8.5px; font-weight: 800; color: #3730a3; padding: 5px 15px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${ganttTimelineHeaders.topTitle}
              </div>
              <div style="flex: 1; display: flex;">
                ${topHeadersForPdf}
              </div>
            </div>
            <!-- Sub-period ticks Header bar -->
            <div style="display: flex; background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; padding-right: 5px;">
              <div style="width: 280px; font-size: 9.5px; font-weight: 700; color: #1e293b; padding: 8px 15px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${isNl ? 'Activiteiten & Mijlpalen' : 'Activities & Milestones'} (${ganttTimelineHeaders.bottomTitle})
              </div>
              <div style="flex: 1; display: flex;">
                ${bottomHeadersForPdf}
              </div>
            </div>
            <!-- Rows block -->
            <div style="padding: 0 15px; background: #ffffff;">
              ${chartRows}
            </div>
          </div>
        </div>
      `;
    }

    // Report sign-off footer
    html += `
      <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #64748b; font-weight: bold; font-family: inherit;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>📈</span> ${isNl ? 'Gegenereerd via IT Platform Twente (Projecten, Taken & Datums)' : 'Generated via IT Platform Twente Management System'}
        </div>
        <div>UTC: ${new Date().toISOString().split('T')[0]} • ${currentProject?.title || ''}</div>
      </div>
    `;

    root.innerHTML = html;
    return root;
  };

  // --- Export as high-resolution image PNG or JPEG ---
  const exportToImage = async (format: 'png' | 'jpeg') => {
    if (!currentProject) return;
    setExportLoadingMsg(isNl ? 'Afbeelding exporteren...' : 'Generating high-resolution image...');
    
    try {
      // Build clean sandbox DOM
      const pageClone = buildExportDom('single');
      document.body.appendChild(pageClone);
      
      // Allow minor delay for layout calculations
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const canvas = await html2canvas(pageClone, {
        scale: 2, // High resolution crispness
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      document.body.removeChild(pageClone);
      
      const link = document.createElement('a');
      const safeTitle = currentProject.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${safeTitle}_planning.${format}`;
      link.href = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error('Error during image export:', err);
      alert(isNl ? 'Er is een fout opgetreden bij het exporteren.' : 'An error occurred during export.');
    } finally {
      setExportLoadingMsg(null);
    }
  };

  // --- Export as landscape A4 PDF report ---
  const exportToPdf = async (mode: 'single' | 'multi') => {
    if (!currentProject) return;
    setExportLoadingMsg(isNl ? 'PDF rapport opstellen...' : 'Compiling PDF A4 report...');
    
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      if (mode === 'single') {
        const pageClone = buildExportDom('single');
        document.body.appendChild(pageClone);
        await new Promise(resolve => setTimeout(resolve, 350));
        
        const canvas = await html2canvas(pageClone, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        document.body.removeChild(pageClone);
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 297; // exact A4 landscape width
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        // Add single page
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 210));
      } else {
        // Multi-page export batches activities to prevent vertical clipping on small layouts
        const acts = [...displayActivities];
        const batchSize = 6; // Max items per page to guarantee beautiful padding
        const totalPages = Math.ceil(acts.length / batchSize) || 1;
        
        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
          if (pageIdx > 0) {
            pdf.addPage();
          }
          
          const start = pageIdx * batchSize;
          const pageActs = acts.slice(start, start + batchSize);
          
          const pageClone = buildExportDom('multi', pageActs, pageIdx + 1, totalPages);
          document.body.appendChild(pageClone);
          await new Promise(resolve => setTimeout(resolve, 350));
          
          const canvas = await html2canvas(pageClone, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
          });
          document.body.removeChild(pageClone);
          
          const imgData = canvas.toDataURL('image/png');
          const pdfWidth = 297;
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 210));
        }
      }
      
      const safeTitle = currentProject.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safeTitle}_rapport.pdf`);
    } catch (err) {
      console.error('Error during PDF synthesis:', err);
      alert(isNl ? 'Er is een fout opgetreden bij de PDF aanmaak.' : 'Failed to compile PDF.');
    } finally {
      setExportLoadingMsg(null);
    }
  };

  // Helper to check if activity is overdue (past end/start date and not completed, on_hold, or cancelled)
  const isActivityOverdue = (act: ProjectActivity): boolean => {
    if (act.status === 'completed' || act.status === 'on_hold' || act.status === 'cancelled') return false;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const effectiveDue = act.endDate || act.startDate;
    return Boolean(effectiveDue && effectiveDue < todayStr);
  };

  // Activity Status stylings helper
  const getStatusColor = (status: ActivityStatus, isOverdue?: boolean) => {
    if (isOverdue) return 'bg-rose-600 border-rose-700 text-white shadow-xs';
    switch (status) {
      case 'completed': return 'bg-emerald-500 border-emerald-600 text-white';
      case 'in_progress': return 'bg-sky-500 border-sky-600 text-white animate-pulse-subtle';
      case 'on_hold': return 'bg-amber-500 border-amber-600 text-white';
      case 'cancelled': return 'bg-stone-400 border-stone-500 text-stone-100 line-through';
      default: return 'bg-slate-400 border-slate-500 text-white';
    }
  };

  const getStatusBgLight = (status: ActivityStatus, isOverdue?: boolean) => {
    if (isOverdue) return 'bg-rose-50 border border-rose-300 text-rose-800 font-bold';
    switch (status) {
      case 'completed': return 'bg-emerald-50 border border-emerald-200 text-emerald-800';
      case 'in_progress': return 'bg-sky-50 border border-sky-200 text-sky-800';
      case 'on_hold': return 'bg-amber-50 border border-amber-200 text-amber-800';
      case 'cancelled': return 'bg-stone-100 border border-stone-300 text-stone-600 line-through';
      default: return 'bg-slate-100 border border-slate-200 text-slate-700';
    }
  };

  const getStatusText = (status: ActivityStatus, isOverdue?: boolean) => {
    if (isOverdue) return isNl ? '⚠️ Overschrijding (te laat)' : '⚠️ Overdue (late)';
    switch (status) {
      case 'completed': return isNl ? 'Voltooid' : 'Completed';
      case 'in_progress': return isNl ? 'In uitvoering' : 'In Progress';
      case 'on_hold': return isNl ? 'On Hold' : 'On Hold';
      case 'cancelled': return isNl ? 'Vervallen / Geannuleerd' : 'Cancelled';
      case 'todo': return isNl ? 'Nog te doen (gepland)' : 'To Do (planned)';
    }
  };

  return (
    <div className="space-y-6" id="project-planner-view">
      
      {/* Intro and upper layout cards - Compact Header & Filter Layout */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch justify-between print:hidden">
        {/* Compact Blue Block */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white p-3.5 sm:p-4 rounded-xl flex-1 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="p-1 bg-indigo-500/20 rounded-md border border-indigo-400/30">
                <FolderGit className="h-3.5 w-3.5 text-indigo-300" />
              </span>
              <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                {isNl ? 'Projecten & Verkenningen Planner' : 'Projects & Explorations Planner'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
              {isNl ? 'Visualiseer & Organiseer Projecten' : 'Visualize & Organize Projects'}
            </h2>
            <p className="text-[11px] text-slate-300 mt-1 max-w-xl leading-normal line-clamp-1 sm:line-clamp-2">
              {isNl 
                ? 'Definieer projecten of verkenningen, breek ze op in activiteiten en volg afhankelijkheden & mijlpalen in de Gantt-chart.'
                : 'Define projects or explorations, break them down into sequenced activities, and track milestones.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-indigo-400/15">
            <button
              onClick={openNewProjectModal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isNl ? 'Nieuwe Verkenning / Project' : 'New Project / Exploration'}</span>
            </button>

            <button
              onClick={() => openNewActivityModal()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>{isNl ? 'Activiteit Toevoegen' : 'Add Activity'}</span>
            </button>

            <button
              onClick={() => {
                setRecoveryInitialTab('recovery');
                setShowDataRecoveryModal(true);
              }}
              className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ml-auto"
              title={isNl ? 'Data herstellen uit browsercache of backup beheren' : 'Recover data from snapshots or manage backups'}
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
              <span>{isNl ? 'Data Herstel & Backup' : 'Data Recovery'}</span>
            </button>
          </div>
        </div>

        {/* Compact Filters Panel beside blue block */}
        <div className="bg-white border border-slate-200 p-3 sm:p-3.5 rounded-xl w-full lg:w-72 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Filter className="h-3 w-3 text-indigo-500" />
                <span>{isNl ? 'Filter & Zoeken' : 'Filters & Search'}</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {filteredProjects.length} {isNl ? 'projecten' : 'projects'}
              </span>
            </div>
            
            <div className="space-y-2">
              {/* Search projects */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={isNl ? 'Zoek projecten...' : 'Search projects...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-7.5 pr-2 py-1.5 border border-slate-200 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50/50 font-medium"
                />
              </div>

              {/* Type and Status filter 2-column grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full text-[11px] p-1.5 border border-slate-200 rounded-lg bg-slate-50/50 font-semibold text-slate-700 outline-none"
                >
                  <option value="all">{isNl ? 'Alle typen' : 'All types'}</option>
                  <option value="project">🚀 {isNl ? 'Projecten' : 'Projects'}</option>
                  <option value="exploration">🔍 {isNl ? 'Verkenningen' : 'Explorations'}</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-[11px] p-1.5 border border-slate-200 rounded-lg bg-slate-50/50 font-semibold text-slate-700 outline-none"
                >
                  <option value="all">{isNl ? 'Alle statussen' : 'All statuses'}</option>
                  <option value="todo">{isNl ? 'Nog te doen' : 'To Do'}</option>
                  <option value="in_progress">{isNl ? 'Bezig' : 'In Progress'}</option>
                  <option value="completed">{isNl ? 'Voltooid' : 'Completed'}</option>
                  <option value="on_hold">{isNl ? 'On Hold' : 'On Hold'}</option>
                  <option value="cancelled">{isNl ? 'Vervallen' : 'Cancelled'}</option>
                </select>
              </div>

              {/* Compact Visibility Toggles */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={(e) => setHideCompleted(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                  />
                  <span>{isNl ? 'Voltooid verbergen' : 'Hide done'}</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={hideMilestones}
                    onChange={(e) => setHideMilestones(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                  />
                  <span>{isNl ? 'Mijlpalen verbergen' : 'Hide miles.'}</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDeleteCompleted}
            className="w-full mt-2 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 border border-rose-200 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span>{isNl ? 'Voltooide items opruimen' : 'Clean up completed'}</span>
          </button>
        </div>
      </div>

      {/* Top Project Selector & Header Toolbar - Streamlined & Compact */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 sm:p-3.5 flex flex-col gap-2.5 print:hidden">
        
        {/* ROW 1: Dedicated Primary Project / Exploration Selection Line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Primary Project Selector Dropdown */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-indigo-950 text-white font-extrabold text-xs rounded-xl border border-indigo-800 shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-9"
              >
                <option value="all" className="bg-slate-900 text-white font-bold py-1.5">
                  🌐 {isNl ? 'Alle Projecten & Verkenningen (Totaaloverzicht)' : 'All Projects & Explorations'} ({projects.length})
                </option>
                {filteredProjects.map(proj => {
                  const projActs = activities.filter(a => a.projectId === proj.id);
                  const badge = proj.type === 'exploration' ? '🔍 [VERKENNING]' : '🚀 [PROJECT]';
                  return (
                    <option key={proj.id} value={proj.id} className="bg-white text-slate-900 font-semibold py-1.5">
                      {badge} {proj.title} ({projActs.length} {isNl ? 'taken' : 'tasks'})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-200 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              onClick={openNewProjectModal}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isNl ? 'Nieuw' : 'New'}</span>
            </button>

            {currentProject && selectedProjectId !== 'all' && (
              <>
                <button
                  onClick={() => openEditProjectModal(currentProject)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-slate-200"
                  title={isNl ? 'Project bewerken' : 'Edit project'}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isNl ? 'Bewerken' : 'Edit'}</span>
                </button>

                <button
                  onClick={() => handleDeleteProject(currentProject.id, currentProject.title)}
                  className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-rose-200"
                  title={isNl ? 'Project verwijderen' : 'Delete project'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isNl ? 'Wis' : 'Delete'}</span>
                </button>
              </>
            )}

            <button
              onClick={handleDeleteCompleted}
              className="px-2.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-slate-200"
              title={isNl ? 'Voltooide activiteiten verwijderen' : 'Delete completed tasks'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isNl ? 'Opschonen' : 'Clean'}</span>
            </button>
          </div>
        </div>

        {/* Active Project Banner / Stats Sub-bar */}
        {currentProject && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase border ${
                currentProject.id === 'all' ? 'bg-indigo-100 text-indigo-900 border-indigo-200' :
                currentProject.type === 'exploration' ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                {currentProject.id === 'all' ? (isNl ? 'TOTAAL' : 'ALL') : currentProject.type === 'exploration' ? (isNl ? 'VERKENNING' : 'EXPLORATION') : 'PROJECT'}
              </span>
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{currentProject.title}</span>
              {currentProject.description && (
                <span className="text-slate-500 text-xs hidden md:inline truncate max-w-md">— {currentProject.description}</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-500 font-semibold text-[11px] shrink-0">
              <span>📋 {displayActivities.length} {isNl ? 'activiteiten' : 'activities'}</span>
              <span>✔️ {displayActivities.filter(a => a.status === 'completed').length} {isNl ? 'voltooid' : 'completed'}</span>
              <span>◆ {displayActivities.filter(a => a.isMilestone).length} {isNl ? 'mijlpalen' : 'milestones'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Workarea: Full-width Gantt / Matrix / Timeline View */}
      <div className="w-full flex flex-col gap-6 print:w-full print:border-none print:shadow-none print:p-0">
          {/* Visual Gantt Chart Panel */}
          {currentProject ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none">
              
              {/* Print-only project title header */}
              <div className="hidden print:block p-4 border-b border-slate-200 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {currentProject.type === 'exploration' ? (isNl ? 'VERKENNING' : 'EXPLORATION') : (isNl ? 'PROJECT' : 'PROJECT')}
                    </span>
                    <h1 className="text-xl font-black text-slate-900 mt-1">{currentProject.title}</h1>
                    {currentProject.description && (
                      <p className="text-xs text-slate-600 mt-1 max-w-3xl">{currentProject.description}</p>
                    )}
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-500">
                    <div>{isNl ? 'Afdrukdatum:' : 'Print date:'} {new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{displayActivities.length} {isNl ? 'activiteiten & mijlpalen' : 'activities & milestones'}</div>
                  </div>
                </div>
              </div>

              {/* Tab Selector Header - Compact & Single Row */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3 py-2 gap-2 print:hidden">
                <div className="inline-flex p-1 bg-slate-200/70 rounded-xl gap-1 overflow-x-auto max-w-full">
                  <button
                    onClick={() => setPlannerViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      plannerViewMode === 'table'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title={isNl ? 'Planning Matrix Tabel (ISO-Weken, Maanden & Jaren)' : 'Planning Matrix Table (ISO Weeks, Months & Years)'}
                  >
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isNl ? 'Planning Matrix' : 'Planning Matrix'}</span>
                  </button>

                  <button
                    onClick={() => setPlannerViewMode('gantt')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      plannerViewMode === 'gantt'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title={isNl ? 'Gantt-Chart Tijdlijn (met Afhankelijkheden & Mijlpalen)' : 'Gantt Chart Timeline (with Dependencies & Milestones)'}
                  >
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isNl ? 'Gantt Tijdlijn' : 'Gantt Timeline'}</span>
                  </button>

                  <button
                    onClick={() => setPlannerViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      plannerViewMode === 'list'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title={isNl ? 'Totaallijst met alle Acties' : 'Consolidated Actions List'}
                  >
                    <ListTodo className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isNl ? 'Actielijst' : 'Action List'}</span>
                    <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] rounded-full font-extrabold ml-0.5">
                      {displayActivities.length}
                    </span>
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 font-semibold shrink-0">
                  <span className="truncate max-w-[200px]">{currentProject?.title}</span>
                  <span className="text-slate-300">•</span>
                  <span>{displayActivities.length} {isNl ? 'items' : 'items'}</span>
                </div>
              </div>

              {plannerViewMode === 'table' ? (
                <div className="p-4">
                  <ProjectPlannerMatrixTable
                    projects={projects}
                    activities={activities}
                    selectedProjectId={selectedProjectId}
                    lang={lang}
                    onEditActivity={openEditActivityModal}
                    onDeleteActivity={handleDeleteActivity}
                    onNewActivity={openNewActivityModal}
                    onUpdateActivityStatus={(actId, newStatus) => {
                      setActivities(prev => {
                        const next = prev.map(a => a.id === actId ? { ...a, status: newStatus } : a);
                        const item = next.find(a => a.id === actId);
                        if (item) dbService.saveProjectActivity(item);
                        return next;
                      });
                    }}
                    onReorderActivities={(newActivities) => {
                      setActivities(newActivities);
                      dbService.reorderProjectActivities(newActivities);
                    }}
                  />
                </div>
              ) : plannerViewMode === 'gantt' ? (
                <div className="p-4">
                  <GanttChartView
                    projects={projects}
                    activities={activities}
                    selectedProjectId={selectedProjectId}
                    lang={lang}
                    onSelectProject={(projId) => setSelectedProjectId(projId)}
                    onEditActivity={openEditActivityModal}
                    onDeleteActivity={handleDeleteActivity}
                    onNewActivity={openNewActivityModal}
                    onUpdateActivity={(updatedAct) => {
                      setActivities(prev => {
                        const next = prev.map(a => a.id === updatedAct.id ? updatedAct : a);
                        dbService.saveProjectActivity(updatedAct);
                        return next;
                      });
                    }}
                    onUpdateActivityStatus={(actId, newStatus) => {
                      setActivities(prev => {
                        const next = prev.map(a => a.id === actId ? { ...a, status: newStatus } : a);
                        const item = next.find(a => a.id === actId);
                        if (item) dbService.saveProjectActivity(item);
                        return next;
                      });
                    }}
                    onReorderActivities={(newActivities) => {
                      setActivities(newActivities);
                      dbService.reorderProjectActivities(newActivities);
                    }}
                  />
                </div>
              ) : (
                <div className="p-3 flex flex-col gap-3">
                  {/* Compact Unified Filter & Actions Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                      {/* Search */}
                      <div className="relative min-w-[160px] max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={plannerListSearch}
                          onChange={(e) => setPlannerListSearch(e.target.value)}
                          placeholder={isNl ? 'Zoeken in acties...' : 'Search actions...'}
                          className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:border-indigo-500 focus:ring-1"
                        />
                      </div>

                      {/* Status filter */}
                      <select
                        value={plannerListFilterStatus}
                        onChange={(e) => setPlannerListFilterStatus(e.target.value as any)}
                        className="text-xs px-2 py-1.5 border border-slate-200 bg-white rounded-lg font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">📁 {isNl ? 'Alle statussen' : 'All statuses'}</option>
                        <option value="todo">🔘 {isNl ? 'Nog te doen' : 'To Do'}</option>
                        <option value="in_progress">⚡ {isNl ? 'In uitvoering' : 'In Progress'}</option>
                        <option value="on_hold">⏸ {isNl ? 'On Hold' : 'On Hold'}</option>
                        <option value="cancelled">✕ {isNl ? 'Geannuleerd' : 'Cancelled'}</option>
                        <option value="completed">✓ {isNl ? 'Voltooid' : 'Completed'}</option>
                      </select>

                      {/* Type filter */}
                      <select
                        value={plannerListFilterType}
                        onChange={(e) => setPlannerListFilterType(e.target.value as any)}
                        className="text-xs px-2 py-1.5 border border-slate-200 bg-white rounded-lg font-semibold text-slate-700 outline-none"
                      >
                        <option value="all">🎯 {isNl ? 'Alle types' : 'All types'}</option>
                        <option value="activity">📝 {isNl ? 'Activiteiten' : 'Activities'}</option>
                        <option value="milestone">◆ {isNl ? 'Mijlpalen' : 'Milestones'}</option>
                      </select>

                      {/* Project Scope filter */}
                      <select
                        value={plannerListFilterProject}
                        onChange={(e) => setPlannerListFilterProject(e.target.value as any)}
                        className="text-xs px-2 py-1.5 border border-slate-200 bg-white rounded-lg font-semibold text-slate-700 outline-none"
                      >
                        <option value="current">📂 {isNl ? 'Huidig project' : 'Current project'}</option>
                        <option value="all">🌍 {isNl ? 'Alle projecten' : 'All projects'}</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
                        📋 {totalListActivities.length} {isNl ? 'acties' : 'actions'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openNewActivityModal()}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isNl ? 'Nieuwe activiteit' : 'Add Activity'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Table header list */}
                  <div className="overflow-x-auto border border-slate-150 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-500 font-extrabold text-[10px] uppercase border-b border-slate-200">
                          <th className="p-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (plannerListSortField === 'title') {
                                  setPlannerListSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPlannerListSortField('title');
                                  setPlannerListSortDirection('asc');
                                }
                              }}
                              className="hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isNl ? 'Activiteit / Project' : 'Activity / Project'}
                              {plannerListSortField === 'title' && (plannerListSortDirection === 'asc' ? '▲' : '▼')}
                            </button>
                          </th>
                          <th className="p-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (plannerListSortField === 'status') {
                                  setPlannerListSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPlannerListSortField('status');
                                  setPlannerListSortDirection('asc');
                                }
                              }}
                              className="hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
                            >
                              Status
                              {plannerListSortField === 'status' && (plannerListSortDirection === 'asc' ? '▲' : '▼')}
                            </button>
                          </th>
                          <th className="p-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {isNl ? 'Actiehouder' : 'Action Holder'}
                          </th>
                          <th className="p-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (plannerListSortField === 'startDate') {
                                  setPlannerListSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPlannerListSortField('startDate');
                                  setPlannerListSortDirection('asc');
                                }
                              }}
                              className="hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isNl ? 'Begindatum' : 'Start Date'}
                              {plannerListSortField === 'startDate' && (plannerListSortDirection === 'asc' ? '▲' : '▼')}
                            </button>
                          </th>
                          <th className="p-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (plannerListSortField === 'endDate') {
                                  setPlannerListSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPlannerListSortField('endDate');
                                  setPlannerListSortDirection('asc');
                                }
                              }}
                              className="hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isNl ? 'Einddatum' : 'End Date'}
                              {plannerListSortField === 'endDate' && (plannerListSortDirection === 'asc' ? '▲' : '▼')}
                            </button>
                          </th>
                          <th className="p-2.5 text-right">{isNl ? 'Acties' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {totalListActivities.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              <div className="space-y-2.5 max-w-sm mx-auto">
                                <p className="italic">{isNl ? 'Geen activiteiten gevonden die voldoen aan de filters.' : 'No items match filters.'}</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecoveryInitialTab('recovery');
                                    setShowDataRecoveryModal(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>{isNl ? 'Eerdere data herstellen (Snapshots / Vault)' : 'Restore previous data (Snapshots / Vault)'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          totalListActivities.map(act => {
                            const parentProj = projects.find(p => p.id === act.projectId);
                            const isCompleted = act.status === 'completed';
                            const isOverdue = isActivityOverdue(act);
                            return (
                              <tr key={act.id} className={`transition-colors ${isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/60'}`}>
                                <td className="p-2.5 max-w-[240px]">
                                  <div className="font-extrabold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                    {act.isMilestone && <span className={`${isOverdue ? 'text-rose-600' : 'text-amber-500'} font-extrabold text-xs`}>◆</span>}
                                    {isCompleted && (act.startDate || act.endDate) && (
                                      <span className="text-emerald-500 font-black text-xs shrink-0 animate-pulse-subtle">✓</span>
                                    )}
                                    <span 
                                      onClick={() => openEditActivityModal(act)}
                                      className={`cursor-pointer hover:underline ${isOverdue ? 'text-rose-800 font-black' : isCompleted && (act.startDate || act.endDate) ? 'text-emerald-600 font-black' : 'hover:text-indigo-600'}`}
                                    >
                                      {act.title}
                                    </span>
                                    {isOverdue && (
                                      <span className="text-[8px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-1 py-0.2 rounded shrink-0 inline-flex items-center gap-0.5">
                                        ⚠️ {isNl ? 'Te laat' : 'Overdue'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-bold truncate mt-0.5">
                                    📁 {parentProj?.title || (isNl ? 'Onbekend Project' : 'Unknown Project')}
                                  </div>
                                  {act.description && (
                                    <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 italic">
                                      {act.description}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-center inline-flex items-center gap-1 ${getStatusColor(act.status, isOverdue)}`}>
                                    {isOverdue ? '⚠️ ' : isCompleted ? '✓ ' : ''}{getStatusText(act.status, isOverdue)}
                                  </span>
                                </td>
                                <td className="p-2.5 whitespace-nowrap text-[10px]">
                                  {act.assignee ? (
                                    <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700">
                                      👤 {act.assignee}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 italic font-medium">-</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-mono text-[10px] whitespace-nowrap">
                                  {act.startDate ? (
                                    new Date(act.startDate).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                  ) : (
                                    <span className="text-amber-600 italic font-sans font-bold">{isNl ? 'Niet gepland' : 'Unscheduled'}</span>
                                  )}
                                </td>
                                <td className={`p-2.5 font-mono text-[10px] whitespace-nowrap ${isOverdue ? 'text-rose-700 font-bold' : ''}`}>
                                  {act.endDate ? (
                                    <div className="flex items-center gap-1">
                                      <span>{new Date(act.endDate).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                      {isOverdue && <span className="text-[8.5px] bg-rose-100 text-rose-800 px-1 rounded font-sans">({isNl ? 'Verlopen' : 'Late'})</span>}
                                    </div>
                                  ) : (
                                    <span className="text-amber-600 italic font-sans font-bold">{isNl ? 'Niet gepland' : 'Unscheduled'}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center gap-1 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => openEditActivityModal(act)}
                                      className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
                                      title={isNl ? 'Bewerken' : 'Edit'}
                                    >
                                      {isNl ? 'Bewerk' : 'Edit'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateActivity(act)}
                                      className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                      title={isNl ? 'Kopieer deze activiteit/mijlpaal' : 'Duplicate activity'}
                                    >
                                      <Copy className="h-3 w-3 text-slate-500" />
                                      <span>{isNl ? 'Kopieer' : 'Copy'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openMoveCopyModal(act, 'move')}
                                      className="p-1 px-2 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                      title={isNl ? 'Verplaats of kopieer naar ander project / verkenning' : 'Move or copy to another project / exploration'}
                                    >
                                      <FolderKanban className="h-3 w-3 text-indigo-600" />
                                      <span>{isNl ? 'Project' : 'Project'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteActivity(act.id, act.title)}
                                      className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-bold cursor-pointer"
                                      title={isNl ? 'Verwijderen' : 'Delete'}
                                    >
                                      {isNl ? 'Wis' : 'Delete'}
                                    </button>
                                  </div>
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

            </div>
          ) : null}

          {/* Activity list details with rapid CRUD triggers */}
          {currentProject ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              
              <div className="p-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">
                    {isNl ? 'Lijst met Activiteiten' : 'Activity Details'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isNl 
                      ? 'Klik op een activiteit om deze aan te passen, te verwijderen of afhankelijkheden mee te beheren.'
                      : 'Create or adjust activities below.'}
                  </p>
                </div>
                
                <button
                  onClick={openNewActivityModal}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isNl ? 'Laad Activiteit' : 'Add Activity'}
                </button>
              </div>

              {currentProjectActivities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs space-y-2.5">
                  <p>{isNl ? 'Geen activiteiten gevonden voor dit plan.' : 'No activities recorded for this plan.'}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryInitialTab('recovery');
                      setShowDataRecoveryModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{isNl ? 'Eerdere data herstellen (Snapshots / Vault)' : 'Restore previous data (Snapshots / Vault)'}</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {displayActivities.map(act => {
                    const depsText = act.dependencies
                      .map(id => currentProjectActivities.find(a => a.id === id)?.title)
                      .filter(Boolean)
                      .join(', ');

                    const isSubActivity = act.parentId && currentProjectActivities.some(p => p.id === act.parentId);
                    const isParent = currentProjectActivities.some(c => c.parentId === act.id);
                    const resolved = resolveActivityDates(act, currentProjectActivities);
                    const parentActivity = isSubActivity ? currentProjectActivities.find(p => p.id === act.parentId) : null;
                    const isOverdue = isActivityOverdue(act);

                    return (
                      <div 
                        key={act.id} 
                        className={`p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs ${
                          isParent ? 'bg-indigo-50/5 hover:bg-indigo-50/10' : ''
                        } ${isSubActivity ? 'pl-8 border-l-2 border-slate-100' : ''} ${
                          isOverdue ? 'bg-rose-50/30 border-l-3 border-l-rose-500 hover:bg-rose-50/60' : ''
                        }`}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isSubActivity && (
                              <span className="text-slate-400 font-bold">&#8627;</span>
                            )}
                            <span className={`text-[11px] ${
                              act.status === 'completed'
                                ? 'font-black text-emerald-600'
                                : isOverdue
                                  ? 'font-black text-rose-800'
                                  : isParent 
                                    ? 'font-black text-slate-800' 
                                    : 'font-semibold text-slate-700'
                            }`}>
                              {act.status === 'completed' && '✓ '} {act.title}
                            </span>
                            {isOverdue && (
                              <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black bg-rose-100 border border-rose-200 text-rose-800 flex items-center gap-0.5">
                                ⚠️ {isNl ? 'Overschrijding (te laat)' : 'Overdue'}
                              </span>
                            )}
                            {isParent && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCollapseActivity(act.id);
                                }}
                                className="px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                                title={collapsedActivityIds.includes(act.id) ? (isNl ? 'Subtaken uitklappen' : 'Expand subtasks') : (isNl ? 'Subtaken inklappen' : 'Collapse subtasks')}
                              >
                                {collapsedActivityIds.includes(act.id) ? <ChevronRight className="h-3 w-3 text-indigo-700" /> : <ChevronDown className="h-3 w-3 text-indigo-700" />}
                                <span>📂 {isNl ? 'HOOFDACTIVITEIT' : 'PARENT'}</span>
                                {collapsedActivityIds.includes(act.id) && (
                                  <span className="font-extrabold text-indigo-700">({currentProjectActivities.filter(c => c.parentId === act.id).length} ingeklapt)</span>
                                )}
                              </button>
                            )}
                            {isSubActivity && parentActivity && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-100 border border-slate-200 text-slate-600">
                                ↳ {isNl ? `Sub van: ${parentActivity.title}` : `Sub of: ${parentActivity.title}`}
                              </span>
                            )}
                            {act.isMilestone && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${isOverdue ? 'bg-rose-100 border border-rose-300 text-rose-800' : 'bg-amber-100 border border-amber-200 text-amber-800'} flex items-center gap-0.5`}>
                                🌟 {isNl ? 'MIJLPAAL' : 'MILESTONE'}
                              </span>
                            )}
                            {act.assignee && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-55 border border-indigo-200 text-indigo-800 flex items-center gap-0.5">
                                👤 {act.assignee}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusBgLight(act.status, isOverdue)}`}>
                              {getStatusText(act.status, isOverdue)}
                            </span>
                          </div>

                          {act.description && (
                            <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                              {act.description}
                            </p>
                          )}

                          {act.attachments && act.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1.5 pb-1 select-none">
                              {act.attachments.map(att => (
                                <button
                                  key={att.id}
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
                                  className="inline-flex items-center gap-1 text-[9px] font-bold bg-white border border-slate-200 text-indigo-700 hover:text-indigo-800 hover:bg-slate-50/80 rounded-md px-2 py-0.5 cursor-pointer shadow-2xs transition-all shrink-0"
                                  title={isNl ? 'Klik om te downloaden' : 'Click to download'}
                                >
                                  📎 {att.name} <span className="text-[8px] font-normal text-slate-400">({(att.size / 1024).toFixed(1)} KB)</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-300" />
                              {resolved.startDate || resolved.endDate ? (
                                <>
                                  <span className="font-mono">{resolved.startDate}</span>
                                  {!act.isMilestone && resolved.endDate && (
                                    <>
                                      <span>{isNl ? 'tot' : 'to'}</span>
                                      <span className="font-mono">{resolved.endDate}</span>
                                    </>
                                  )}
                                </>
                              ) : act.status === 'completed' ? (
                                <span className="text-emerald-600 font-bold">✓ {isNl ? 'Afgerond (geen datum)' : 'Completed (no date)'}</span>
                              ) : (
                                <span className="text-amber-600 italic">{isNl ? 'Geen datum' : 'No date'}</span>
                              )}
                              {isParent && (
                                <span className="text-indigo-600 font-bold ml-1">
                                  ({isNl ? 'berekende periode' : 'computed period'})
                                </span>
                              )}
                            </span>

                            {depsText && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                {isNl ? 'Na' : 'After'}: {depsText}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Interactive edit button toolbar - satisfying: "Je moet bij het aanklikken van een taak de taak kunnen aanpassen of verwijderen, of annuleren, of kruisje" */}
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          <button
                            onClick={() => openEditActivityModal(act)}
                            className="px-3 py-1 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-[11px] cursor-pointer flex items-center gap-1 transition-all"
                          >
                            <Edit2 className="h-3 w-3 text-indigo-500" />
                            {isNl ? 'Aanpassen' : 'Adjust'}
                          </button>

                          <button
                            onClick={() => handleDuplicateActivity(act)}
                            className="px-3 py-1 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-[11px] cursor-pointer flex items-center gap-1 transition-all"
                            title={isNl ? 'Kopieer deze activiteit/mijlpaal' : 'Duplicate activity'}
                          >
                            <Copy className="h-3 w-3 text-slate-500" />
                            {isNl ? 'Kopiëren' : 'Copy'}
                          </button>

                          <button
                            onClick={() => openMoveCopyModal(act, 'move')}
                            className="px-2.5 py-1 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[11px] cursor-pointer flex items-center gap-1 transition-all"
                            title={isNl ? 'Verplaats of kopieer naar ander project / verkenning' : 'Move or copy to another project / exploration'}
                          >
                            <FolderKanban className="h-3 w-3 text-indigo-600" />
                            <span>{isNl ? 'Project' : 'Project'}</span>
                          </button>
                          
                          <button
                            onClick={() => handleDeleteActivity(act.id, act.title)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                            title={isNl ? 'Verwijderen' : 'Delete'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          ) : null}

        </div>

      {/* ========================================= */}
      {/* 1. PROJECT / EXPLORATION MODAL */}
      {/* ========================================= */}
      {isProjModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-150 overflow-hidden flex flex-col">
            
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                {editingProject 
                  ? (isNl ? '📝 Project Bewerken' : '📝 Edit Plan') 
                  : (isNl ? '💡 Nieuw Project of Verkenning' : '💡 New Plan')}
              </h3>
              <button 
                onClick={() => setIsProjModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              {/* Type toggle selection label */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
                  {isNl ? 'Type Concept' : 'Concept Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProjType('project')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      projType === 'project'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    🚀 {isNl ? 'Project' : 'Project'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjType('exploration')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      projType === 'exploration'
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    🔍 {isNl ? 'Verkenning' : 'Exploration'}
                  </button>
                </div>
              </div>

              {/* Title input */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Titel' : 'Title'}
                </label>
                <input
                  type="text"
                  placeholder={isNl ? 'Bijv. Zonnepanelen fase 2' : 'e.g. Solar panel phase 2'}
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Description input */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Beschrijving' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder={isNl ? 'Korte toelichting over de doelen...' : 'Brief info about objectives...'}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y min-h-[90px]"
                />
              </div>

            </div>

            {/* Modal actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsProjModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveProject}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow"
              >
                {isNl ? 'Opslaan' : 'Save'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 2. ACTIVITY / MILESTONE MODAL */}
      {/* ========================================= */}
      {isActModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-150 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                {editingActivity 
                  ? (isNl ? '📝 Activiteit Aanpassen' : '📝 Adjust Activity') 
                  : (isNl ? '📅 Nieuwe Activiteit Plannen' : '📅 Plan New Activity')}
              </h3>
              <button 
                onClick={() => setIsActModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              
              {/* Project or Exploration Link (Mandatory) */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                    <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isNl ? 'Gekoppeld aan Project of Verkenning *' : 'Linked to Project or Exploration *'}</span>
                  </label>
                  {editingActivity && actProjectId !== editingActivity.projectId && (
                    <span className="text-[9.5px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {isNl ? 'Wordt verplaatst naar ander project' : 'Will be moved to another project'}
                    </span>
                  )}
                </div>
                <select
                  value={projects.some(p => p.id === actProjectId) ? actProjectId : (projects[0]?.id || '')}
                  onChange={(e) => {
                    const newProjId = e.target.value;
                    setActProjectId(newProjId);
                    if (editingActivity && newProjId !== editingActivity.projectId) {
                      setActParentId('');
                      setActDependencies([]);
                    }
                  }}
                  className="w-full text-xs p-2.5 font-bold border border-slate-300 rounded-lg bg-white text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="" disabled>
                    {isNl ? '-- Selecteer een project of verkenning --' : '-- Select a project or exploration --'}
                  </option>
                  <optgroup label={isNl ? '📁 Projecten' : '📁 Projects'}>
                    {projects.filter(p => p.type === 'project').map(p => (
                      <option key={p.id} value={p.id}>📁 {p.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label={isNl ? '🔭 Verkenningen' : '🔭 Explorations'}>
                    {projects.filter(p => p.type === 'exploration').map(p => (
                      <option key={p.id} value={p.id}>🔭 {p.title}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[10px] text-slate-500">
                  {isNl 
                    ? 'Elke activiteit hoort bij een project of verkenning. Wijzig de selectie om deze taak te verplaatsen.' 
                    : 'Every activity belongs to a project or exploration. Change to move this activity.'}
                </p>
              </div>

              {/* Optional: Template / Autofill from existing activity in this project */}
              {!editingActivity && modalProjectActivities.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsTemplatePickerOpen(!isTemplatePickerOpen)}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5 text-indigo-600" />
                      <span>{isNl ? 'Gegevens overnemen van bestaande activiteit (sjabloon)' : 'Copy data from existing activity (template)'}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isTemplatePickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {modalProjectActivities.length} {isNl ? 'beschikbaar' : 'available'}
                    </span>
                  </div>

                  {isTemplatePickerOpen && (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={modalTemplateSearch}
                          onChange={(e) => setModalTemplateSearch(e.target.value)}
                          placeholder={isNl ? 'Zoek in alle activiteiten van dit project om over te nemen...' : 'Search all activities in project...'}
                          className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-200 bg-white rounded-lg focus:border-indigo-500 focus:ring-1"
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredTemplateActivities.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic py-1 text-center">
                            {isNl ? 'Geen activiteiten gevonden met deze zoekterm.' : 'No activities match search.'}
                          </p>
                        ) : (
                          filteredTemplateActivities.map(tAct => (
                            <button
                              key={tAct.id}
                              type="button"
                              onClick={() => handleApplyActivityTemplate(tAct)}
                              className="w-full text-left p-2 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-between gap-2 cursor-pointer group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 truncate">
                                  {tAct.isMilestone ? '◆ ' : '📝 '}{tAct.title}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  {tAct.assignee && <span>👤 {tAct.assignee}</span>}
                                  {tAct.startDate && <span>📅 {tAct.startDate}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white px-2 py-0.5 rounded transition-colors shrink-0">
                                {isNl ? 'Overnemen' : 'Use'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Type Switcher: milestone or standard activity */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Kenmerk' : 'Feature Type'}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
                    <input
                      type="radio"
                      checked={!actIsMilestone}
                      onChange={() => setActIsMilestone(false)}
                      className="text-indigo-600"
                    />
                    <span>{isNl ? 'Standaard Activiteit' : 'Standard Activity'}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
                    <input
                      type="radio"
                      checked={actIsMilestone}
                      onChange={() => setActIsMilestone(true)}
                      className="text-indigo-600"
                    />
                    <span className="text-amber-600">◆ {isNl ? 'Mijlpaal (eenmalig moment)' : 'Milestone (single date target)'}</span>
                  </label>
                </div>
              </div>

              {/* Title input */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Activiteit Naam' : 'Activity Name'}
                </label>
                <input
                  type="text"
                  placeholder={isNl ? 'Bijv. Enquête uitsturen naar medewerkers' : 'e.g. Survey employees'}
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Description input */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Nadere Toelichting' : 'Details / Description'}
                </label>
                <textarea
                  rows={4}
                  placeholder={isNl ? 'Geef eventuele specificaties mee...' : 'Include specific tools, notes...'}
                  value={actDesc}
                  onChange={(e) => setActDesc(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y min-h-[90px]"
                />
              </div>

              {/* Assignee / Actiehouder input */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Actiehouder' : 'Action Holder / Assignee'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isNl ? 'Bijv. Jan de Vries, Sanne Bakker...' : 'e.g. John Doe, Sarah Miller...'}
                    value={actAssignee}
                    onChange={(e) => setActAssignee(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Grid for start and end date */}
              {(() => {
                const isCurrentlyParent = editingActivity
                  ? activities.some(c => c.parentId === editingActivity.id)
                  : false;

                if (isCurrentlyParent) {
                  return (
                    <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl text-[10.5px] text-indigo-900 leading-normal font-medium flex items-start gap-2.5">
                      <span className="text-sm">💡</span>
                      <span>
                        {isNl 
                          ? 'Deze activiteit is een verzamelbalk (hoofdactiviteit). De begindatum en einddatum worden automatisch berekend op basis van de eerste begindatum en de laatste einddatum van onderliggende activiteiten.' 
                          : 'This activity is a summary parent. Its start and end dates are compiled dynamically from the earliest and latest dates of its underlying sub-activities.'}
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                          {actIsMilestone ? (isNl ? 'Mijlpaal Datum (optioneel)' : 'Milestone Date (optional)') : (isNl ? 'Begindatum (optioneel)' : 'Start Date (optional)')}
                        </label>
                        <div className="relative flex items-center">
                          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            type="date"
                            value={actStart}
                            onChange={(e) => {
                              setActStart(e.target.value);
                              if (actIsMilestone) {
                                setActEnd(e.target.value);
                              }
                            }}
                            className="w-full text-xs pl-10 pr-8 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1"
                          />
                          {actStart && (
                            <button
                              type="button"
                              onClick={() => {
                                setActStart('');
                                if (actIsMilestone) setActEnd('');
                              }}
                              className="absolute right-2 text-slate-400 hover:text-rose-600 p-1 rounded-full cursor-pointer hover:bg-slate-100 transition-colors"
                              title={isNl ? 'Wis begindatum' : 'Clear start date'}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {!actIsMilestone && (
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                            {isNl ? 'Einddatum (optioneel)' : 'End Date (optional)'}
                          </label>
                          <div className="relative flex items-center">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                            <input
                              type="date"
                              value={actEnd}
                              onChange={(e) => setActEnd(e.target.value)}
                              className="w-full text-xs pl-10 pr-8 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1"
                            />
                            {actEnd && (
                              <button
                                type="button"
                                onClick={() => setActEnd('')}
                                className="absolute right-2 text-slate-400 hover:text-rose-600 p-1 rounded-full cursor-pointer hover:bg-slate-100 transition-colors"
                                title={isNl ? 'Wis einddatum' : 'Clear end date'}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick clear dates button & status notice */}
                    {(actStart || actEnd) ? (
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActStart('');
                            setActEnd('');
                          }}
                          className="text-[10.5px] font-bold text-slate-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5 text-rose-500" />
                          <span>{isNl ? 'Datums leegmaken (geen datum bekend)' : 'Clear date fields'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-medium flex items-center gap-1.5">
                        <span>💡</span>
                        <span>{isNl ? 'Geen datum ingesteld. Deze activiteit wordt opgeslagen als ongeplande taak.' : 'No date set. Saved as unscheduled item.'}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Status & Category selection row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    {isNl ? 'Status van Uitvoering' : 'Activity Status'}
                  </label>
                  <select
                    value={actStatus}
                    onChange={(e) => setActStatus(e.target.value as ActivityStatus)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-slate-50/50"
                  >
                    <option value="todo">{isNl ? 'Nog te doen' : 'To Do'}</option>
                    <option value="in_progress">{isNl ? 'Bezig' : 'In Progress'}</option>
                    <option value="completed">{isNl ? 'Voltooid ✓' : 'Completed'}</option>
                    <option value="on_hold">{isNl ? 'On Hold (gepauzeerd) ⏸' : 'On Hold ⏸'}</option>
                    <option value="cancelled">{isNl ? 'Vervallen / Geannuleerd ✕' : 'Cancelled ✕'}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">
                      {isNl ? 'Bovenliggende Activiteit (Hoofdactiviteit / Parent)' : 'Parent Activity'}
                    </label>
                    {actParentId && (
                      <button
                        type="button"
                        onClick={() => setActParentId('')}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                        <span>{isNl ? 'Zelfstandig maken' : 'Make Root'}</span>
                      </button>
                    )}
                  </div>

                  {/* Trigger box */}
                  <button
                    type="button"
                    onClick={() => setIsParentPickerOpen(!isParentPickerOpen)}
                    className={`w-full text-left p-2 border rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      actParentId 
                        ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-bold' 
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate text-xs">
                      {actParentId ? (
                        <>
                          <FolderClosed className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">
                            {modalProjectActivities.find(a => a.id === actParentId)?.title || actParentId}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">
                          {isNl ? 'Geen (Zelfstandige hoofdactiviteit)' : 'None (Root activity)'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-150 shrink-0">
                      {isParentPickerOpen ? (isNl ? 'Sluiten' : 'Close') : (isNl ? 'Kiezen / Wijzigen' : 'Choose')}
                    </span>
                  </button>

                  {/* Dropdown panel for Parent Activity with Search and Filters */}
                  {isParentPickerOpen && (
                    <div className="mt-2 p-2.5 bg-white border border-indigo-150 rounded-xl shadow-md space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500">
                          {isNl ? 'Kies uit alle activiteiten van dit project' : 'Choose from all project activities'}
                        </span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setModalParentFilter('all')}
                            className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                              modalParentFilter === 'all' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {isNl ? 'Alle' : 'All'} ({availableParentActivities.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalParentFilter('root_only')}
                            className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                              modalParentFilter === 'root_only' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {isNl ? 'Alleen hoofdactiviteiten' : 'Root only'} ({availableParentActivities.filter(a => !a.parentId).length})
                          </button>
                        </div>
                      </div>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={modalParentSearch}
                          onChange={(e) => setModalParentSearch(e.target.value)}
                          placeholder={isNl ? 'Zoeken in activiteiten op naam of uitvoerder...' : 'Search activities...'}
                          className="w-full text-xs pl-8 pr-7 py-1.5 border border-slate-200 bg-slate-50/50 rounded-lg focus:border-indigo-500 focus:ring-1"
                        />
                        {modalParentSearch && (
                          <button
                            type="button"
                            onClick={() => setModalParentSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Option: Geen (Root) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActParentId('');
                          setIsParentPickerOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-between cursor-pointer ${
                          !actParentId 
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900' 
                            : 'border-slate-150 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>📂</span>
                          <span>{isNl ? 'Geen (Zelfstandige hoofdactiviteit)' : 'None (Root activity)'}</span>
                        </span>
                        {!actParentId && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                      </button>

                      {/* Filtered list of all activities */}
                      <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredParentActivities.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic py-2 text-center">
                            {isNl ? 'Geen activiteiten gevonden.' : 'No activities found.'}
                          </p>
                        ) : (
                          filteredParentActivities.map(a => {
                            const isSelected = actParentId === a.id;
                            const isSub = !!a.parentId;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  setActParentId(a.id);
                                  setIsParentPickerOpen(false);
                                }}
                                className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer border ${
                                  isSelected 
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' 
                                    : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                  <span className="shrink-0">{a.isMilestone ? '◆' : isSub ? '↳' : '📁'}</span>
                                  <span className="truncate">{a.title}</span>
                                  {isSub && (
                                    <span className="text-[9px] text-slate-400 bg-slate-150 px-1 py-0.2 rounded shrink-0">
                                      {isNl ? 'sub' : 'sub'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400">
                                  {a.startDate && <span>{a.startDate}</span>}
                                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DEPENDENCY SELECTION: Milestones/activities dependencies */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block flex items-center gap-1">
                    <span>{isNl ? 'Afhankelijkheden (Predecessors / Voorgangers)' : 'Dependencies (Predecessors)'}</span>
                    <span className="text-[9px] text-slate-400 lowercase italic normal-case">
                      ({isNl ? 'moet klaar zijn voordat deze start' : 'must finish first'})
                    </span>
                  </label>
                  
                  {/* Scope Selector: Dit project vs Alle projecten */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setModalDepScope('project')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        modalDepScope === 'project' 
                          ? 'bg-white text-indigo-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {isNl ? 'Dit project / verkenning' : 'This project'} ({modalProjectActivities.filter(a => !editingActivity || a.id !== editingActivity.id).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalDepScope('all')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        modalDepScope === 'all' 
                          ? 'bg-white text-indigo-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {isNl ? 'Alle projecten' : 'All projects'} ({activities.filter(a => !editingActivity || a.id !== editingActivity.id).length})
                    </button>
                  </div>
                </div>

                {availableDependencyActivities.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {isNl 
                      ? 'Geen andere activiteiten beschikbaar in dit project om als afhankelijkheid in te stellen.' 
                      : 'No other activities available to set as dependency.'}
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 space-y-2">
                    {/* Search bar & filter tabs */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[150px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={modalDepSearch}
                          onChange={(e) => setModalDepSearch(e.target.value)}
                          placeholder={isNl ? 'Zoek in alle activiteiten op naam of uitvoerder...' : 'Search all activities...'}
                          className="w-full text-xs pl-8 pr-7 py-1.5 border border-slate-200 bg-white rounded-lg focus:border-indigo-500 focus:ring-1"
                        />
                        {modalDepSearch && (
                          <button
                            type="button"
                            onClick={() => setModalDepSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Filter chips */}
                      <div className="flex items-center gap-1 text-[10.5px]">
                        <button
                          type="button"
                          onClick={() => setModalDepFilter('all')}
                          className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                            modalDepFilter === 'all' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isNl ? 'Alle' : 'All'} ({availableDependencyActivities.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalDepFilter('selected')}
                          className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                            modalDepFilter === 'selected' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          ✓ {isNl ? 'Geselecteerd' : 'Selected'} ({actDependencies.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalDepFilter('milestones')}
                          className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                            modalDepFilter === 'milestones' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          ◆ {isNl ? 'Mijlpalen' : 'Milestones'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalDepFilter('tasks')}
                          className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                            modalDepFilter === 'tasks' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          📝 {isNl ? 'Taken' : 'Tasks'}
                        </button>
                      </div>
                    </div>

                    {/* Quick batch select / deselect actions */}
                    <div className="flex items-center justify-between text-[10.5px] px-1 text-slate-500">
                      <span>
                        {filteredDependencyActivities.length} {isNl ? 'activiteiten zichtbaar' : 'activities visible'}
                        {actDependencies.length > 0 && (
                          <span className="font-bold text-indigo-700 ml-1">
                            • {actDependencies.length} {isNl ? 'gekoppeld als voorganger' : 'linked'}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {filteredDependencyActivities.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectAllFilteredDependencies}
                            className="font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            {isNl ? 'Selecteer zichtbare' : 'Select visible'}
                          </button>
                        )}
                        {actDependencies.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearDependencies}
                            className="font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            {isNl ? 'Alles deselecteren' : 'Clear all'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable list of activities */}
                    <div className="border border-slate-200 rounded-xl p-2 bg-white max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                      {filteredDependencyActivities.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic py-3 text-center">
                          {isNl ? 'Geen activiteiten gevonden met de huidige zoek- en filteropties.' : 'No activities match.'}
                        </p>
                      ) : (
                        filteredDependencyActivities.map(a => {
                          const isChecked = actDependencies.includes(a.id);
                          const proj = projects.find(p => p.id === a.projectId);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                                  : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDependency(a.id)}
                                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 truncate text-xs">
                                  <span className="shrink-0">{a.isMilestone ? '◆' : '📝'}</span>
                                  <span className="truncate">{a.title}</span>
                                  {modalDepScope === 'all' && proj && (
                                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                      {proj.type === 'exploration' ? '🔭 ' : '📁 '}{proj.title}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-normal mt-0.5">
                                  {a.startDate && (
                                    <span>📅 {a.startDate}{a.endDate && a.endDate !== a.startDate ? ` → ${a.endDate}` : ''}</span>
                                  )}
                                  {a.assignee && <span>👤 {a.assignee}</span>}
                                  {a.status === 'completed' && <span className="text-emerald-600 font-bold">✓ {isNl ? 'Voltooid' : 'Done'}</span>}
                                  {a.status === 'in_progress' && <span className="text-indigo-600 font-bold">▶ {isNl ? 'Bezig' : 'In progress'}</span>}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ATTACHMENTS (BIJLAGEN) SELECTION */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
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
                              setActAttachments(prev => [...prev, newAttachment]);
                            }
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }
                  }}
                  className="border-2 border-dashed border-slate-250 hover:border-indigo-400 rounded-xl p-4 bg-slate-50/30 flex flex-col items-center justify-center transition-colors cursor-pointer relative"
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
                              setActAttachments(prev => [...prev, newAttachment]);
                            }
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Paperclip className="h-5 w-5 text-indigo-500 mb-1" />
                  <p className="text-[10px] text-slate-500 font-bold">
                    {isNl ? 'Sleep bestanden hierheen of klik om te bladeren' : 'Drag files here or click to browse'}
                  </p>
                  <p className="text-[8px] text-slate-400 font-medium">
                    {isNl ? 'Bestanden worden lokaal opgeslagen' : 'Files are securely saved locally'}
                  </p>
                </div>

                {/* Attachments List */}
                {actAttachments.length > 0 && (
                  <div className="mt-2.5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                    {actAttachments.map(att => (
                      <div 
                        key={att.id} 
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-150 text-[10.5px]"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                          <FileText className="h-3.5 w-3.5 text-indigo-550 shrink-0" />
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
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 shrink-0 font-medium cursor-pointer"
                            title={isNl ? 'Bekijk / Downloaden' : 'View / Download'}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActAttachments(prev => prev.filter(x => x.id !== att.id));
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50/50 shrink-0 font-medium cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal bottom actions bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex flex-wrap items-center justify-end gap-2">
              {editingActivity && (
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteActivity(editingActivity.id, editingActivity.title);
                    setIsActModalOpen(false);
                  }}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold cursor-pointer mr-auto"
                >
                  {isNl ? 'Verwijderen' : 'Delete'}
                </button>
              )}

              {editingActivity && (
                <button
                  type="button"
                  onClick={() => openMoveCopyModal(editingActivity, 'copy')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  title={isNl ? 'Kopieer deze activiteit naar een ander project of verkenning' : 'Copy this activity to another project or exploration'}
                >
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>{isNl ? 'Kopieer naar project...' : 'Copy to project...'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsActModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveActivity(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
                title={isNl ? 'Sla op en open direct een kopie om snel opeenvolgende taken aan te maken' : 'Save and open a copy immediately to create multiple tasks'}
              >
                <Copy className="h-3.5 w-3.5 text-indigo-600" />
                <span>{isNl ? 'Opslaan & Kopieer' : 'Save & Duplicate'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveActivity(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow"
              >
                {isNl ? 'Opslaan' : 'Save'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. MOVE OR COPY ACTIVITY MODAL */}
      {isMoveCopyModalOpen && moveCopyActivity && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-150 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                {moveCopyAction === 'move' ? (
                  <>
                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                    <span>{isNl ? 'Activiteit Verplaatsen naar Project/Verkenning' : 'Move Activity to Project/Exploration'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-emerald-600" />
                    <span>{isNl ? 'Activiteit Kopiëren naar Project/Verkenning' : 'Copy Activity to Project/Exploration'}</span>
                  </>
                )}
              </h3>
              <button 
                onClick={() => setIsMoveCopyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-100/80 rounded-xl text-xs text-slate-700 border border-slate-200">
                <span className="font-bold text-slate-400 block text-[10px] uppercase mb-0.5">{isNl ? 'Geselecteerde Activiteit:' : 'Selected Activity:'}</span>
                <div className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  {moveCopyActivity.isMilestone && <span className="text-amber-500">◆</span>}
                  <span>{moveCopyActivity.title}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {isNl ? 'Huidig project: ' : 'Current project: '}
                  <strong>{projects.find(p => p.id === moveCopyActivity.projectId)?.title || moveCopyActivity.projectId}</strong>
                </div>
              </div>

              {/* Action Toggle: Verplaatsen vs Kopiëren */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Kies actie:' : 'Choose action:'}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMoveCopyAction('move')}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      moveCopyAction === 'move'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{isNl ? 'Verplaatsen' : 'Move'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveCopyAction('copy')}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      moveCopyAction === 'copy'
                        ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{isNl ? 'Kopiëren' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Target Project Dropdown */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {isNl ? 'Doel Project of Verkenning *' : 'Target Project or Exploration *'}
                </label>
                <select
                  value={moveCopyTargetProjectId}
                  onChange={(e) => setMoveCopyTargetProjectId(e.target.value)}
                  className="w-full text-xs p-3 font-bold border border-slate-300 rounded-xl bg-slate-50 focus:border-indigo-500 focus:bg-white"
                >
                  <optgroup label={isNl ? '📁 Projecten' : '📁 Projects'}>
                    {projects.filter(p => p.type === 'project').map(p => (
                      <option key={p.id} value={p.id}>📁 {p.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label={isNl ? '🔭 Verkenningen' : '🔭 Explorations'}>
                    {projects.filter(p => p.type === 'exploration').map(p => (
                      <option key={p.id} value={p.id}>🔭 {p.title}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl text-[11px] text-indigo-900 leading-relaxed font-medium">
                {moveCopyAction === 'move' 
                  ? (isNl 
                      ? 'De activiteit wordt verplaatst naar het geselecteerde project. Eventuele afhankelijkheden uit het vorige project worden losgekoppeld.'
                      : 'The activity will be moved to the selected project. Any previous dependencies will be reset.')
                  : (isNl 
                      ? 'Er wordt een nieuwe kopie aangemaakt in het gekozen project met behoud van de omschrijving, datums en mijlpaalstatus.'
                      : 'A new duplicate will be added into the selected project preserving description, dates, and milestone flag.')}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMoveCopyModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteMoveCopy}
                className={`px-4 py-2 text-white rounded-xl text-xs font-black cursor-pointer shadow transition-all ${
                  moveCopyAction === 'move'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {moveCopyAction === 'move' 
                  ? (isNl ? 'Nu Verplaatsen' : 'Move Now')
                  : (isNl ? 'Nu Kopiëren' : 'Copy Now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXPORT LOADING FEEDBACK MODAL */}
      {exportLoadingMsg && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{exportLoadingMsg}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {isNl ? 'Een moment geduld alstublieft...' : 'Please hold on for a moment...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. DATA IMPORT, EXPORT & RECOVERY MODAL */}
      <DataImportExportModal
        isOpen={showDataRecoveryModal}
        onClose={() => setShowDataRecoveryModal(false)}
        lang={lang}
        initialTab={recoveryInitialTab}
        onImportSuccess={() => {
          setProjects(dbService.getProjects());
          setActivities(dbService.getProjectActivities());
        }}
      />

    </div>
  );
}
