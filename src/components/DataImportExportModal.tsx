import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  X, 
  Users, 
  Calendar, 
  ListTodo, 
  FolderKanban, 
  Headphones, 
  Mail, 
  Settings, 
  ArrowRight,
  Check,
  Info,
  RotateCcw,
  History,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { dbService, BackupDataPayload, ImportOptions, RecoverySnapshot } from '../services/db';

interface DataImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'nl' | 'en';
  onImportSuccess?: () => void;
  initialTab?: 'export' | 'import' | 'recovery';
}

export const DataImportExportModal: React.FC<DataImportExportModalProps> = ({
  isOpen,
  onClose,
  lang = 'nl',
  onImportSuccess,
  initialTab = 'export'
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'recovery'>(initialTab);
  
  // --- EXPORT STATE ---
  const [exportModules, setExportModules] = useState<{ [key: string]: boolean }>({
    polls: true,
    contacts: true,
    tasks: true,
    yearEvents: true,
    projects: true,
    emailTemplates: true,
    settings: true
  });
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // --- IMPORT STATE ---
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedPayload, setParsedPayload] = useState<BackupDataPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importModules, setImportModules] = useState<{ [key: string]: boolean }>({
    polls: true,
    contacts: true,
    tasks: true,
    yearEvents: true,
    projects: true,
    emailTemplates: true,
    settings: true
  });
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importSuccessResult, setImportSuccessResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- RECOVERY STATE ---
  const [recoverySnapshots, setRecoverySnapshots] = useState<RecoverySnapshot[]>([]);
  const [recoveryMode, setRecoveryMode] = useState<'merge' | 'overwrite'>('merge');
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string | null>(null);

  // Load snapshots when modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      setRecoverySnapshots(dbService.scanForRecoverableData());
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  const refreshSnapshots = () => {
    setRecoverySnapshots(dbService.scanForRecoverableData());
  };

  const handleRestoreSnapshot = (snapshot: RecoverySnapshot) => {
    try {
      const res = dbService.restoreSnapshot(snapshot, { mode: recoveryMode });
      setRecoverySuccessMsg(
        lang === 'nl'
          ? `Data succesvol hersteld! ${res.restoredActivities} activiteiten, ${res.restoredProjects} projecten en ${res.restoredTasks} taken zijn hersteld.`
          : `Data recovered successfully! Restored ${res.restoredActivities} activities, ${res.restoredProjects} projects, and ${res.restoredTasks} tasks.`
      );
      if (onImportSuccess) {
        onImportSuccess();
      }
      refreshSnapshots();
    } catch (err: any) {
      alert((lang === 'nl' ? 'Herstel mislukt: ' : 'Recovery failed: ') + (err?.message || err));
    }
  };

  const handleAutoRecover = () => {
    const success = dbService.autoRecoverIfEmpty();
    if (success) {
      setRecoverySuccessMsg(
        lang === 'nl' 
          ? 'Automatisch herstel geslaagd! Eerder opgeslagen taken en activiteiten zijn teruggeplaatst.' 
          : 'Auto-recovery successful! Previously saved activities and tasks have been restored.'
      );
      if (onImportSuccess) {
        onImportSuccess();
      }
      refreshSnapshots();
    } else {
      alert(lang === 'nl' ? 'Geen verloren of lege gegevens gedetecteerd die automatisch hersteld moeten worden. Kies hieronder een specifieke snapshot.' : 'No empty data detected for auto-recovery. Please select a snapshot below.');
    }
  };

  const handleDownloadSnapshot = (snap: RecoverySnapshot) => {
    const fullPayload: BackupDataPayload = {
      version: 2,
      exportedAt: snap.timestamp,
      appName: 'ActivityPlanner - Snapshot Recovery',
      sourceOrigin: window.location.origin,
      data: snap.data
    };
    const blob = new Blob([JSON.stringify(fullPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recovery-snapshot-${snap.timestamp.replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Calculate live counts for export
  const currentData = dbService.exportAllData().data;
  const counts = {
    polls: (currentData.polls?.length || 0),
    invitees: (currentData.invitees?.length || 0),
    contacts: (currentData.contacts?.length || 0),
    tasks: (currentData.tasks?.length || 0),
    yearEvents: (currentData.yearEvents?.length || 0),
    projects: (currentData.projects?.length || 0),
    tickets: (currentData.tickets?.length || 0),
    emailTemplates: (currentData.emailTemplates?.length || 0),
  };

  const handleToggleExportModule = (key: string) => {
    setExportModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAllExport = (value: boolean) => {
    const updated: { [key: string]: boolean } = {};
    Object.keys(exportModules).forEach(k => { updated[k] = value; });
    setExportModules(updated);
  };

  const handleRunExport = () => {
    const fullBackup = dbService.exportAllData();
    const selectedKeys = Object.keys(exportModules).filter(k => exportModules[k]);

    if (selectedKeys.length === 0) {
      alert(lang === 'nl' ? 'Selecteer ten minste één onderdeel om te exporteren.' : 'Select at least one category to export.');
      return;
    }

    // Filter payload data to selected modules
    const filteredData: BackupDataPayload['data'] = {};
    if (exportModules.polls) {
      filteredData.polls = fullBackup.data.polls;
      filteredData.invitees = fullBackup.data.invitees;
    }
    if (exportModules.contacts) filteredData.contacts = fullBackup.data.contacts;
    if (exportModules.tasks) {
      filteredData.tasks = fullBackup.data.tasks;
      filteredData.taskStatuses = fullBackup.data.taskStatuses;
      filteredData.taskCategories = fullBackup.data.taskCategories;
    }
    if (exportModules.yearEvents) {
      filteredData.yearEvents = fullBackup.data.yearEvents;
      filteredData.calendarCategories = fullBackup.data.calendarCategories;
    }
    if (exportModules.projects) {
      filteredData.projects = fullBackup.data.projects;
      filteredData.projectActivities = fullBackup.data.projectActivities;
    }
    if (exportModules.emailTemplates) {
      filteredData.emailTemplates = fullBackup.data.emailTemplates;
      filteredData.emailLogs = fullBackup.data.emailLogs;
    }
    if (exportModules.settings) {
      filteredData.customProductionUrl = fullBackup.data.customProductionUrl;
    }

    const payload: BackupDataPayload = {
      ...fullBackup,
      data: filteredData
    };

    // Trigger JSON file download
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `activityplanner_backup_${dateStr}.json`;
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportSuccessMsg(
      lang === 'nl'
        ? `Bestand "${fileName}" succesvol gedownload!`
        : `File "${fileName}" successfully downloaded!`
    );
    setTimeout(() => setExportSuccessMsg(null), 5000);
  };

  // --- IMPORT FILE HANDLING ---
  const handleFileSelect = (file: File) => {
    setImportedFile(file);
    setParseError(null);
    setParsedPayload(null);
    setImportSuccessResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text) as BackupDataPayload;
        
        if (!json || typeof json !== 'object' || !json.data) {
          throw new Error(lang === 'nl' ? 'Ongeldig backup bestand: mist "data" property.' : 'Invalid backup file: missing "data" property.');
        }

        setParsedPayload(json);

        // Pre-select available import modules
        const available: { [key: string]: boolean } = {
          polls: !!(json.data.polls && json.data.polls.length > 0),
          contacts: !!(json.data.contacts && json.data.contacts.length > 0),
          tasks: !!(json.data.tasks && json.data.tasks.length > 0),
          yearEvents: !!(json.data.yearEvents && json.data.yearEvents.length > 0),
          projects: !!(json.data.projects && json.data.projects.length > 0),
          emailTemplates: !!(json.data.emailTemplates && json.data.emailTemplates.length > 0),
          settings: !!json.data.customProductionUrl
        };
        setImportModules(available);
      } catch (err: any) {
        setParseError(err.message || (lang === 'nl' ? 'Fout bij lezen van JSON-bestand.' : 'Error reading JSON file.'));
      }
    };
    reader.readAsText(file);
  };

  const handleRunImport = () => {
    if (!parsedPayload) return;

    const selectedKeys = Object.keys(importModules).filter(k => importModules[k]);
    if (selectedKeys.length === 0) {
      alert(lang === 'nl' ? 'Selecteer ten minste één onderdeel om te importeren.' : 'Select at least one category to import.');
      return;
    }

    const options: ImportOptions = {
      mode: importMode,
      selectedModules: selectedKeys
    };

    const countSummary = dbService.importData(parsedPayload, options);

    setImportSuccessResult(
      lang === 'nl'
        ? `Data succesvol geïmporteerd! ${countSummary.join(', ')}.`
        : `Data imported successfully! ${countSummary.join(', ')}.`
    );

    if (onImportSuccess) {
      onImportSuccess();
    }
  };

  const handleLoadRdngDirect = () => {
    try {
      const countSummary = dbService.loadRegionalProjectsDataset('merge');
      setImportSuccessResult(
        lang === 'nl'
          ? `Regionale projecten (RDNG 3.0, Regionaal Knooppunt 2.0 & Vervanging PKI overheid certificaten) succesvol ingeladen en gesynchroniseerd met uw account! ${countSummary.join(', ')}.`
          : `Regional projects (RDNG 3.0, Regionaal Knooppunt 2.0 & PKI certificates) successfully loaded and synced to your account! ${countSummary.join(', ')}.`
      );
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      setParseError(err?.message || (lang === 'nl' ? 'Fout bij inladen van regionale projecten dataset.' : 'Error loading regional projects dataset.'));
    }
  };

  const handleLoadTwoWeeksAgoData = () => {
    try {
      const countSummary = dbService.loadTwoWeeksAgoDataset('merge');
      setImportSuccessResult(
        lang === 'nl'
          ? `Historische data van 2 weken geleden succesvol hersteld en gesynchroniseerd! Inclusief alle projecten, verkenningen, subtaken en weekplanner-taken (${countSummary.join(', ')}).`
          : `Historical data from 2 weeks ago successfully restored and synced! (${countSummary.join(', ')}).`
      );
      if (onImportSuccess) {
        onImportSuccess();
      }
      refreshSnapshots();
    } catch (err: any) {
      setParseError(err?.message || (lang === 'nl' ? 'Fout bij herstellen van data van 2 weken geleden.' : 'Error recovering data from 2 weeks ago.'));
    }
  };

  const handleDownloadRdngFile = () => {
    try {
      const payload = dbService.getRegionalProjectsPayload();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Regionale-Projecten-RDNG-RK2-PKI-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xl">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {lang === 'nl' ? 'Data Backup, Import & Export' : 'Data Backup, Import & Export'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'nl' ? 'Zet eenvoudig al je gegevens over tussen omgevingen & domeinen' : 'Easily transfer your data between environments & domains'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-indigo-600 border-slate-200 border-b-white -mb-px shadow-sm'
                : 'bg-slate-100/70 text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>{lang === 'nl' ? '1. Exporteer Data (Backup Maken)' : '1. Export Data (Create Backup)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-indigo-600 border-slate-200 border-b-white -mb-px shadow-sm'
                : 'bg-slate-100/70 text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>{lang === 'nl' ? '2. Importeer Data (Overzetten)' : '2. Import Data (Restore)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('recovery')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all cursor-pointer ${
              activeTab === 'recovery'
                ? 'bg-white text-amber-700 border-slate-200 border-b-white -mb-px shadow-sm'
                : 'bg-slate-100/70 text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <RotateCcw className="h-4 w-4 text-amber-600" />
            <span>{lang === 'nl' ? '3. Data Herstel (Snapshots)' : '3. Data Recovery (Snapshots)'}</span>
            {recoverySnapshots.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-amber-300">
                {recoverySnapshots.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-900 leading-relaxed">
                  {lang === 'nl'
                    ? 'Gebruik deze functie om al je ingevoerde datumprikkers, contacten, taken en instellingen van deze pagina te downloaden. Je kunt het gedownloade JSON-bestand vervolgens op activityplanner.ai.studio (of een ander adres) weer importeren!'
                    : 'Use this feature to download all your polls, contacts, tasks, and settings from this site into a single JSON file. You can then import this backup file on any other domain!'}
                </p>
              </div>

              {exportSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{exportSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {lang === 'nl' ? 'Kies te exporteren onderdelen:' : 'Select components to export:'}
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => handleSelectAllExport(true)}
                      className="text-[11px] text-indigo-600 hover:underline font-bold"
                    >
                      {lang === 'nl' ? 'Alles selecteren' : 'Select all'}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button 
                      type="button" 
                      onClick={() => handleSelectAllExport(false)}
                      className="text-[11px] text-slate-500 hover:underline font-medium"
                    >
                      {lang === 'nl' ? 'Niets' : 'Deselect all'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.polls ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'Datumprikkers & Stemmen' : 'Polls & Votes'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700 font-mono font-bold">{counts.polls}</span>
                      <input type="checkbox" checked={!!exportModules.polls} onChange={() => handleToggleExportModule('polls')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.contacts ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'Contactpersonen' : 'Contacts'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700 font-mono font-bold">{counts.contacts}</span>
                      <input type="checkbox" checked={!!exportModules.contacts} onChange={() => handleToggleExportModule('contacts')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.tasks ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <ListTodo className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'Taken & Activiteiten' : 'Tasks & Activities'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700 font-mono font-bold">{counts.tasks}</span>
                      <input type="checkbox" checked={!!exportModules.tasks} onChange={() => handleToggleExportModule('tasks')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.yearEvents ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'Jaarkalender Events' : 'Year Events'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700 font-mono font-bold">{counts.yearEvents}</span>
                      <input type="checkbox" checked={!!exportModules.yearEvents} onChange={() => handleToggleExportModule('yearEvents')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.projects ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <FolderKanban className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'Gantt Projecten & Plannen' : 'Gantt Projects'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700 font-mono font-bold">{counts.projects}</span>
                      <input type="checkbox" checked={!!exportModules.projects} onChange={() => handleToggleExportModule('projects')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.emailTemplates ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <Mail className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'E-mail Sjablonen' : 'Email Templates'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700 font-mono font-bold">{counts.emailTemplates}</span>
                      <input type="checkbox" checked={!!exportModules.emailTemplates} onChange={() => handleToggleExportModule('emailTemplates')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${exportModules.settings ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2.5 text-xs">
                      <Settings className="h-4 w-4 text-indigo-600" />
                      <span>{lang === 'nl' ? 'Applicatie Instellingen' : 'App Settings'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={!!exportModules.settings} onChange={() => handleToggleExportModule('settings')} className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleRunExport}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>{lang === 'nl' ? ' Exporteer naar JSON Backup ' : ' Download JSON Backup '}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-5">

              {/* Regional Projects Special Dataset Banner */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 border-2 border-amber-300/80 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black uppercase tracking-wide">
                        {lang === 'nl' ? 'Aanbevolen voor u' : 'Recommended'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>{lang === 'nl' ? 'Regionale IT Projecten (RDNG 3.0, Regionaal Knooppunt 2.0 & PKI overheid)' : 'Regional IT Projects (RDNG 3.0, Regional Hub 2.0 & PKI certificates)'}</span>
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {lang === 'nl'
                        ? 'Herstel direct de data voor alle regionale projecten: RDNG 3.0 (Regionaal Digitaal Netwerk Gemeenten), Regionaal Knooppunt 2.0 en Vervanging PKI overheid certificaten, inclusief alle Gantt-fasen, mijlpalen, netwerktaken en servicedesk tickets.'
                        : 'Restore all regional projects: RDNG 3.0, Regional Hub 2.0, and PKI government certificates replacement, including all Gantt phases, milestones, network tasks, and tickets.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleLoadRdngDirect}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    <span>{lang === 'nl' ? 'Direct Regionale Projecten Inladen & Synchroniseren' : 'Load Regional Projects & Sync'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadTwoWeeksAgoData}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4 text-white" />
                    <span>{lang === 'nl' ? 'Herstel Data van 2 Weken Geleden (Taken & Verkenningen)' : 'Restore Data from 2 Weeks Ago'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadRdngFile}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-slate-600" />
                    <span>{lang === 'nl' ? 'Download .json Backup Bestand' : 'Download .json Backup File'}</span>
                  </button>
                </div>
              </div>
              
              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10.5px] text-slate-400 uppercase tracking-wider font-bold">
                  {lang === 'nl' ? 'Of upload een eigen .json bestand' : 'Or upload custom .json backup'}
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* File Drop Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".json" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <FileJson className="h-6 w-6" />
                </div>
                <h3 className="text-xs font-bold text-slate-800">
                  {importedFile ? importedFile.name : (lang === 'nl' ? 'Klik om JSON-backup te selecteren of te slepen' : 'Click to select or drag a JSON backup file')}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {importedFile 
                    ? `${(importedFile.size / 1024).toFixed(1)} KB` 
                    : (lang === 'nl' ? 'Selecteer het eerder gedownloade .json bestand van je eerdere omgeving' : 'Select a previously downloaded .json file')}
                </p>
              </div>

              {/* Error Box */}
              {parseError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs font-medium">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Success Result Banner */}
              {importSuccessResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>{lang === 'nl' ? 'Data succesvol geïmporteerd en toegepast!' : 'Data successfully imported!'}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 pl-7">{importSuccessResult}</p>
                </div>
              )}

              {/* File Preview Card */}
              {parsedPayload && !importSuccessResult && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {parsedPayload.appName || 'Activity Planner'}
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {lang === 'nl' ? 'Gevonden data in bestand:' : 'Data found in backup file:'}
                      </p>
                    </div>
                    {parsedPayload.exportedAt && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(parsedPayload.exportedAt).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US')}
                      </span>
                    )}
                  </div>

                  {/* Modules selection checkboxes */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      {lang === 'nl' ? 'Kies welke onderdelen je wilt importeren:' : 'Select components to import:'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsedPayload.data.polls && parsedPayload.data.polls.length > 0 && (
                        <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-semibold text-slate-800">📊 Datumprikkers ({parsedPayload.data.polls.length})</span>
                          <input type="checkbox" checked={!!importModules.polls} onChange={() => setImportModules(p => ({ ...p, polls: !p.polls }))} className="rounded text-indigo-600" />
                        </label>
                      )}

                      {parsedPayload.data.contacts && parsedPayload.data.contacts.length > 0 && (
                        <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-semibold text-slate-800">👥 Contacten ({parsedPayload.data.contacts.length})</span>
                          <input type="checkbox" checked={!!importModules.contacts} onChange={() => setImportModules(p => ({ ...p, contacts: !p.contacts }))} className="rounded text-indigo-600" />
                        </label>
                      )}

                      {parsedPayload.data.tasks && parsedPayload.data.tasks.length > 0 && (
                        <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-semibold text-slate-800">📋 Taken ({parsedPayload.data.tasks.length})</span>
                          <input type="checkbox" checked={!!importModules.tasks} onChange={() => setImportModules(p => ({ ...p, tasks: !p.tasks }))} className="rounded text-indigo-600" />
                        </label>
                      )}

                      {parsedPayload.data.yearEvents && parsedPayload.data.yearEvents.length > 0 && (
                        <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-semibold text-slate-800">🗓️ Jaarkalender ({parsedPayload.data.yearEvents.length})</span>
                          <input type="checkbox" checked={!!importModules.yearEvents} onChange={() => setImportModules(p => ({ ...p, yearEvents: !p.yearEvents }))} className="rounded text-indigo-600" />
                        </label>
                      )}

                      {parsedPayload.data.projects && parsedPayload.data.projects.length > 0 && (
                        <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-semibold text-slate-800">📂 Projecten ({parsedPayload.data.projects.length})</span>
                          <input type="checkbox" checked={!!importModules.projects} onChange={() => setImportModules(p => ({ ...p, projects: !p.projects }))} className="rounded text-indigo-600" />
                        </label>
                      )}

                      {parsedPayload.data.emailTemplates && parsedPayload.data.emailTemplates.length > 0 && (
                        <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-semibold text-slate-800">✉️ Templates ({parsedPayload.data.emailTemplates.length})</span>
                          <input type="checkbox" checked={!!importModules.emailTemplates} onChange={() => setImportModules(p => ({ ...p, emailTemplates: !p.emailTemplates }))} className="rounded text-indigo-600" />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Import Strategy Radio */}
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <label className="text-xs font-bold text-slate-700 block">
                      {lang === 'nl' ? 'Import Strategie:' : 'Import Strategy:'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${importMode === 'merge' ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="mt-0.5 text-emerald-600 focus:ring-emerald-500" />
                        <div>
                          <span className="text-xs font-bold block">{lang === 'nl' ? '🔀 Samenvoegen (Aanbevolen)' : '🔀 Merge (Recommended)'}</span>
                          <span className="text-[10px] text-slate-500 block leading-snug mt-0.5">
                            {lang === 'nl' ? 'Voegt data samen. Niks wordt zomaar overgeschreven of gewist.' : 'Adds missing items and updates existing ones without deleting anything.'}
                          </span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${importMode === 'overwrite' ? 'bg-amber-50/60 border-amber-300 text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <input type="radio" name="importMode" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="mt-0.5 text-amber-600 focus:ring-amber-500" />
                        <div>
                          <span className="text-xs font-bold block">{lang === 'nl' ? '⚠️ Overschrijven' : '⚠️ Overwrite'}</span>
                          <span className="text-[10px] text-slate-500 block leading-snug mt-0.5">
                            {lang === 'nl' ? 'Vervangt de geselecteerde categorieën volledig door deze backup.' : 'Replaces current data in selected modules with backup data.'}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleRunImport}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                      <span>{lang === 'nl' ? 'Start Data Import' : 'Start Data Import'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DATA RECOVERY & SNAPSHOTS */}
          {activeTab === 'recovery' && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3">
                <RotateCcw className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-950 leading-relaxed">
                  <p className="font-bold">
                    {lang === 'nl' ? 'Ben je eerder ingevoerde data kwijtgeraakt na inloggen met Google?' : 'Lost previously saved data after signing in with Google?'}
                  </p>
                  <p className="text-amber-900">
                    {lang === 'nl'
                      ? 'Geen zorgen: je data wordt automatisch bewaard in browsercache en herstel-snapshots. Hieronder kun je met één klik je taken, activiteiten en projecten herstellen en direct synchroniseren met je Google-account.'
                      : 'No worries: your data is preserved in browser safety snapshots. You can restore your activities, projects, and tasks with 1 click below.'}
                  </p>
                </div>
              </div>

              {recoverySuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{recoverySuccessMsg}</span>
                </div>
              )}

              {/* Quick Actions Card */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>{lang === 'nl' ? 'Snel Automatisch Herstel' : 'Quick Auto-Recovery'}</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'nl' ? 'Scant direct de meest recente actieve planner status en herstelt deze.' : 'Scans for your latest known planner state and restores it.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoRecover}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{lang === 'nl' ? 'Herstel Laatste Status' : 'Restore Latest State'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadTwoWeeksAgoData}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{lang === 'nl' ? '2 Weken Geleden Terugzetten' : 'Restore 2 Weeks Ago'}</span>
                  </button>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {lang === 'nl' ? 'Herstelmethode bij terugzetten:' : 'Recovery mode:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${recoveryMode === 'merge' ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <input type="radio" name="recoveryMode" checked={recoveryMode === 'merge'} onChange={() => setRecoveryMode('merge')} className="mt-0.5 text-emerald-600 focus:ring-emerald-500" />
                    <div>
                      <span className="text-xs font-bold block">{lang === 'nl' ? '🔀 Samenvoegen (Aanbevolen)' : '🔀 Merge (Recommended)'}</span>
                      <span className="text-[10px] text-slate-500 block leading-snug mt-0.5">
                        {lang === 'nl' ? 'Behoudt huidige items en voegt herstelde activiteiten en taken toe.' : 'Keeps existing items and adds recovered activities and tasks.'}
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${recoveryMode === 'overwrite' ? 'bg-amber-50/60 border-amber-300 text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <input type="radio" name="recoveryMode" checked={recoveryMode === 'overwrite'} onChange={() => setRecoveryMode('overwrite')} className="mt-0.5 text-amber-600 focus:ring-amber-500" />
                    <div>
                      <span className="text-xs font-bold block">{lang === 'nl' ? '⚠️ Volledig Overschrijven' : '⚠️ Overwrite Everything'}</span>
                      <span className="text-[10px] text-slate-500 block leading-snug mt-0.5">
                        {lang === 'nl' ? 'Vervangt de huidige lege of actieve lijst precies door deze snapshot.' : 'Replaces current planner state entirely with this snapshot.'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Detected Snapshots List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-4 w-4 text-slate-500" />
                    <span>{lang === 'nl' ? `Beschikbare Snapshots (${recoverySnapshots.length})` : `Available Snapshots (${recoverySnapshots.length})`}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={refreshSnapshots}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{lang === 'nl' ? 'Opnieuw scannen' : 'Rescan'}</span>
                  </button>
                </div>

                {recoverySnapshots.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2 bg-slate-50">
                    <Database className="h-8 w-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">
                      {lang === 'nl' ? 'Geen automatische kluis-snapshots gevonden in deze browsercache.' : 'No snapshots found in this browser cache.'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      {lang === 'nl'
                        ? 'Heb je eerder een exportbestand (.json) gedownload? Gebruik dan tabblad "2. Importeer Data" om het bestand direct te laden.'
                        : 'If you downloaded a backup .json earlier, use tab "2. Import Data" to restore it.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recoverySnapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-4 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl transition-all shadow-xs space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-900">
                                {snap.reason}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">
                                📅 {new Date(snap.timestamp).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US')}
                              </span>
                              {snap.userEmail && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  👤 {snap.userEmail}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                              <span className="font-bold text-slate-700">
                                📁 {snap.counts.projects} {lang === 'nl' ? 'projecten' : 'projects'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                                ⚡ {snap.counts.projectActivities} {lang === 'nl' ? 'activiteiten' : 'activities'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-slate-700">
                                ✓ {snap.counts.tasks} {lang === 'nl' ? 'taken' : 'tasks'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDownloadSnapshot(snap)}
                              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title={lang === 'nl' ? 'Download snapshot als JSON backup' : 'Download snapshot as JSON'}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreSnapshot(snap)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>{lang === 'nl' ? 'Herstel Dit' : 'Restore This'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Preview of activity titles */}
                        {snap.sampleTitles.activities.length > 0 && (
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[10.5px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-500 shrink-0">{lang === 'nl' ? 'Voorbeeld activiteiten:' : 'Sample activities:'}</span>
                            {snap.sampleTitles.activities.map((title, i) => (
                              <span key={i} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-medium">
                                {title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            {lang === 'nl' ? 'Tip: Bewaar je backup .json bestand op een veilige plek.' : 'Tip: Keep your backup .json file in a safe place.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            {lang === 'nl' ? 'Sluiten' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
