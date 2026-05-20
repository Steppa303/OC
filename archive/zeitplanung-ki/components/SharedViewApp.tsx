
import React, { useState, useEffect, useMemo } from 'react';
import { getSharedView } from '../services/shareService';
import { SharedView, Project, ProjectPhase, DayCapacity, DAILY_CAPACITY_HOURS } from '../types';
import { db } from '../lib/firebase';
import { HeatmapCalendar } from './HeatmapCalendar';
import { formatDate, addDays, getDaysArray } from '../utils';
import { Loader2, AlertTriangle, Shield, Mic, Sparkles, MessageSquare } from 'lucide-react';
import { TaskRequestModal } from './TaskRequestModal';

// Hardcoded ID of the default admin/first user for legacy data handling
const DEFAULT_ADMIN_ID = 'user_bastian';

interface SharedViewAppProps {
  shareId: string;
}

export const SharedViewApp: React.FC<SharedViewAppProps> = ({ shareId }) => {
  const [viewConfig, setViewConfig] = useState<SharedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [calendarStartDate, setCalendarStartDate] = useState(new Date());
  
  // Phase 3: Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // --- 1. Load Configuration ---
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const view = await getSharedView(shareId);
        if (!view) {
          setError("Dieser Link ist ungültig oder abgelaufen.");
        } else {
          setViewConfig(view);
        }
      } catch (e) {
        setError("Fehler beim Laden des Views.");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [shareId]);

  // --- 2. Load Data (Filtered by Creator) ---
  useEffect(() => {
    if (!viewConfig) return;

    const unsubscribeProjects = db.collection('projects').onSnapshot((snapshot) => {
      const allProjects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
      
      // FILTER 1: Ownership (Creator Only)
      // We show the project if:
      // a) It explicitly belongs to the creator (p.userId === creatorId)
      // b) It has NO userId (Legacy Data) AND the creator is the Default Admin ('user_bastian')
      const userProjects = allProjects.filter(p => {
          const belongsToCreator = p.userId === viewConfig.creatorId;
          const isLegacyDefault = !p.userId && viewConfig.creatorId === DEFAULT_ADMIN_ID;
          return belongsToCreator || isLegacyDefault;
      });

      // FILTER 2: Specific Project Scope (if the link is for a single project)
      const visibleProjects = viewConfig.config.projectId 
        ? userProjects.filter(p => p.id === viewConfig.config.projectId)
        : userProjects;
        
      setProjects(visibleProjects);
    });

    const unsubscribePhases = db.collection('phases').onSnapshot((snapshot) => {
      // We just fetch all phases here and filter them later based on the visible 'projects' list
      // This is necessary because 'projects' state might update asynchronously
      const allPhases = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProjectPhase));
      setPhases(allPhases);
    });

    return () => {
      unsubscribeProjects();
      unsubscribePhases();
    };
  }, [viewConfig]);

  // --- 3. Compute Capacity (Filtered) ---
  const daysToShow = 28; // Standard View
  const calendarDays = useMemo(() => getDaysArray(calendarStartDate, addDays(calendarStartDate, daysToShow - 1)), [calendarStartDate]);

  const dailyCapacityData: DayCapacity[] = useMemo(() => {
    // Create a Set of visible project IDs for O(1) lookup
    const visibleProjectIds = new Set(projects.map(p => p.id));

    return calendarDays.map((dateObj) => {
      const dateStr = formatDate(dateObj);
      
      // FILTER PHASES: Only show phases that belong to a visible project
      const daysPhases = phases.filter(p => {
          const isDateMatch = p.suggestedDate.split('T')[0] === dateStr;
          const isProjectVisible = visibleProjectIds.has(p.projectId);
          return isDateMatch && isProjectVisible;
      });

      const totalHoursBooked = daysPhases.reduce((acc, curr) => acc + curr.hours, 0);
      
      // Deadlines are already filtered because 'projects' state is filtered
      const daysDeadlines = projects.filter(p => p.deadline === dateStr && !p.isTimeOff);

      let status: DayCapacity['status'] = 'free';
      if (totalHoursBooked > DAILY_CAPACITY_HOURS) status = 'overloaded';
      else if (totalHoursBooked > DAILY_CAPACITY_HOURS * 0.75) status = 'busy';
      else if (totalHoursBooked > 0) status = 'optimal';

      return {
        date: dateStr,
        totalHoursBooked,
        phases: daysPhases,
        deadlines: daysDeadlines,
        status
      };
    });
  }, [phases, projects, calendarDays]);

  // --- Render Handlers ---
  const handlePrevRange = () => setCalendarStartDate(d => addDays(d, -daysToShow));
  const handleNextRange = () => setCalendarStartDate(d => addDays(d, daysToShow));
  const handleSetStartDate = (date: Date) => setCalendarStartDate(date);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-900/50 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Zugriff verweigert</h1>
            <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
        <div className="mesh-bg opacity-30 fixed inset-0 z-0 pointer-events-none"></div>
        
        {/* Guest Header */}
        <header className="fixed top-0 w-full z-40 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Shield className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white tracking-tight">Secure View</h1>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                            {viewConfig?.config.projectId ? 'Project Access' : 'Full Calendar Access'}
                        </p>
                    </div>
                </div>
                
                {/* Desktop Header Button (Subtle) */}
                {viewConfig?.config.allowRequests && (
                     <button 
                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-bold border border-slate-700 transition-all"
                        onClick={() => setIsRequestModalOpen(true)}
                     >
                         <MessageSquare className="w-4 h-4" />
                         Anfrage
                     </button>
                )}
            </div>
        </header>

        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24">
            
            {/* Context Info */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {viewConfig?.config.projectId 
                            ? projects[0]?.title || 'Lade Projekt...' 
                            : 'Aktueller Projektplan'}
                    </h2>
                    <p className="text-slate-400 max-w-2xl">
                        {viewConfig?.config.projectId 
                            ? "Hier ist der aktuelle Zeitplan für dieses Projekt. Änderungen sind live sichtbar." 
                            : "Übersicht aller laufenden Projekte und Kapazitäten."}
                    </p>
                </div>
                
                <div className="flex gap-4 text-xs font-mono text-slate-500">
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        LIVE DATA
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                        <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                        READ ONLY
                    </div>
                </div>
            </div>

            {/* The Calendar */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <HeatmapCalendar 
                    days={dailyCapacityData}
                    projects={projects}
                    startDate={calendarStartDate}
                    onSelectDay={() => {}} // No-op for selection in read-only mostly
                    selectedDate={null}
                    onPrevRange={handlePrevRange}
                    onNextRange={handleNextRange}
                    onSetStartDate={handleSetStartDate}
                    readOnly={true} // ENABLE READ ONLY MODE
                    zoomLevel="standard"
                    // Disable handlers that modify data
                    onMovePhase={undefined}
                    onMoveDeadline={undefined}
                    onQuickEdit={undefined}
                    onDeletePhase={undefined}
                />
            </div>

            {/* Simplified Project List / Legend */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => (
                    <div key={p.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                         <div className={`w-3 h-3 rounded-full ${p.color} shadow-[0_0_10px_currentColor]`}></div>
                         <div>
                             <div className="font-bold text-slate-200 text-sm">{p.title}</div>
                             <div className="text-xs text-slate-500">{p.totalHours}h • Deadline: {p.deadline}</div>
                         </div>
                    </div>
                ))}
                {projects.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                        Keine Projekte gefunden für diesen Nutzer.
                    </div>
                )}
            </div>

        </main>

        {/* PROMINENT FLOATING ACTION BUTTON (FAB) */}
        {viewConfig?.config.allowRequests && (
            <div className="fixed bottom-8 right-8 z-50">
                <button 
                    onClick={() => setIsRequestModalOpen(true)}
                    className="group relative flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white pl-6 pr-8 py-4 rounded-full shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] transition-all hover:scale-105 hover:-translate-y-1"
                >
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-20 pointer-events-none"></div>
                    <div className="bg-white/10 p-2 rounded-full border border-white/20">
                        <Mic className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-bold leading-tight">Wunsch äußern</span>
                        <span className="text-[10px] text-indigo-100 font-medium">Aufgabe senden</span>
                    </div>
                    <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-300 animate-pulse" />
                </button>
            </div>
        )}

        {/* Task Request Modal */}
        {viewConfig && (
            <TaskRequestModal 
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                viewConfig={viewConfig}
            />
        )}
    </div>
  );
};
