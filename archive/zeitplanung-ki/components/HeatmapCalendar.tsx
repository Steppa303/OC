
import React, { useState } from 'react';
import { DayCapacity, DAILY_CAPACITY_HOURS, Project, ProjectPhase } from '../types';
import { formatDate } from '../utils';
import { Flag, GripVertical, Ghost, Clock, MoreHorizontal, ArrowUpRight, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Palmtree, Car, MapPin, Crosshair, LocateFixed, Loader2, AlignLeft, Sun } from 'lucide-react';
import { GoldenVacationTile } from './GoldenVacationTile';
import { ExternalMeetingTile } from './ExternalMeetingTile';
import { ZoomLevel, ZoomController } from './ZoomController';

interface HeatmapCalendarProps {
  days: DayCapacity[];
  projects: Project[];
  startDate: Date;
  ghostPhases?: ProjectPhase[]; // NEW: Preview Data
  activeGhostIndex?: number | null; // NEW: Highlight specific ghost phase on hover
  onSelectDay: (date: string) => void;
  selectedDate: string | null;
  onMovePhase?: (phaseId: string, newDate: string) => void;
  onMoveDeadline?: (projectId: string, newDate: string) => void; // NEW PROP
  onProposalDrop?: (phaseIndex: number, date: string) => void; // NEW PROP: Drop from Proposal
  onQuickEdit?: (date: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDeletePhase?: (phaseId: string) => void;
  onPrevRange: () => void;
  onNextRange: () => void;
  onSetStartDate: (date: Date) => void;
  isLoading?: boolean;
  zoomLevel?: ZoomLevel; // NEW PROP
  onZoomChange?: (level: ZoomLevel) => void; // NEW PROP for internal control
  highlightedProjectId?: string | null; // NEW: Filter/Highlight logic
  readOnly?: boolean; // NEW: Guest Mode
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ 
  days, 
  projects, 
  startDate,
  ghostPhases = [],
  activeGhostIndex = null,
  onSelectDay, 
  selectedDate, 
  onMovePhase, 
  onMoveDeadline,
  onProposalDrop,
  onQuickEdit, 
  onOpenProject, 
  onDeletePhase, 
  onPrevRange, 
  onNextRange, 
  onSetStartDate,
  isLoading,
  zoomLevel = 'standard',
  onZoomChange,
  highlightedProjectId,
  readOnly = false
}) => {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // --- ORBITAL RING COLOR LOGIC ---
  const getRingColor = (hours: number): string => {
    const usage = hours / DAILY_CAPACITY_HOURS;
    if (hours === 0) return '#334155'; // Slate-700 (Empty/Border)
    if (usage <= 0.25) return '#10b981'; // Emerald (Low)
    if (usage <= 0.75) return '#f59e0b'; // Amber (Medium)
    if (usage <= 1.0) return '#f97316'; // Orange (High)
    return '#ef4444'; // Red (Overload)
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
        weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }),
        day: date.toLocaleDateString('de-DE', { day: 'numeric' }),
        full: date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
        month: date.toLocaleDateString('de-DE', { month: 'long' })
    };
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    onSetStartDate(newDate);
  };

  // Drag Handlers
  const handleDragStartPhase = (e: React.DragEvent, phaseId: string) => {
      if (readOnly) return;
      e.dataTransfer.setData('dragType', 'PHASE');
      e.dataTransfer.setData('id', phaseId);
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation(); 
      setTimeout(() => setIsDragging(true), 10);
  };

  const handleDragStartDeadline = (e: React.DragEvent, projectId: string) => {
      if (readOnly) return;
      e.dataTransfer.setData('dragType', 'DEADLINE');
      e.dataTransfer.setData('id', projectId);
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
      setTimeout(() => setIsDragging(true), 10);
  };

  const handleDragEnd = () => {
      setIsDragging(false);
      setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
      if (readOnly) return;
      e.preventDefault();
      setDragOverDate(dateStr);
  };

  const handleDragLeave = (e: React.DragEvent, dateStr: string) => {
      e.preventDefault();
      setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
      if (readOnly) return;
      e.preventDefault();
      setDragOverDate(null);
      setIsDragging(false);
      
      const dragType = e.dataTransfer.getData('dragType');
      const id = e.dataTransfer.getData('id');
      
      // NEW: Handle drop from Proposal
      if (dragType === 'PROPOSAL_PHASE') {
          const index = parseInt(e.dataTransfer.getData('index'), 10);
          if (onProposalDrop && !isNaN(index)) {
              onProposalDrop(index, dateStr);
          }
          return;
      }
      
      // Fallback for older browsers or simple drags if dragType isn't set
      const legacyPhaseId = e.dataTransfer.getData('phaseId'); 

      if (dragType === 'DEADLINE' && onMoveDeadline) {
          onMoveDeadline(id, dateStr);
      } else if ((dragType === 'PHASE' || legacyPhaseId) && onMovePhase) {
          const phaseId = id || legacyPhaseId;
          onMovePhase(phaseId, dateStr);
      }
  };

  // --- DYNAMIC GRID CLASSES ---
  const gridClasses = {
      macro: 'grid-cols-7 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))]',
      standard: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-7',
      micro: 'grid-cols-1 sm:grid-cols-2 gap-4' // Update: 2 columns for Focus Week
  };

  return (
    <div className="glass-card rounded-2xl p-6 relative transition-all duration-500 ease-in-out">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
                <span className="animate-in fade-in slide-in-from-left duration-300" key={zoomLevel}>
                   {zoomLevel === 'macro' ? 'Strategic View' : zoomLevel === 'micro' ? 'Weekly Agenda' : 'Capacity Heatmap'}
                </span>
            </h2>
            
            <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 border border-slate-700/50 shadow-sm backdrop-blur-sm">
                <button 
                    onClick={onPrevRange}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                    title="Zurück"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="relative group px-1 cursor-pointer">
                    <input 
                        type="date" 
                        value={formatDate(startDate)} 
                        onChange={handleDateChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onClick={(e) => {
                            try {
                                const input = e.currentTarget;
                                // @ts-ignore
                                if (typeof input.showPicker === 'function') {
                                    // @ts-ignore
                                    input.showPicker();
                                }
                            } catch (error) {
                                console.debug("Date picker fallback:", error);
                            }
                        }}
                    />
                    <div className="flex items-center gap-2 px-2 py-0.5 text-xs font-mono text-slate-300 group-hover:text-indigo-300 transition-colors pointer-events-none">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>{startDate.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}</span>
                    </div>
                </div>

                <button 
                    onClick={onNextRange}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                    title="Weiter"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* ZOOM CONTROLLER - Right Aligned */}
        {onZoomChange && (
            <div className="flex items-center animate-in fade-in slide-in-from-right duration-500">
                <ZoomController currentLevel={zoomLevel} onChange={onZoomChange} />
            </div>
        )}
      </div>
      
      <div className={`grid gap-3 relative z-0 transition-all duration-500 ease-in-out ${gridClasses[zoomLevel]}`}>
        {days.map((day) => {
          const isSelected = selectedDate === day.date;
          const isDragOver = dragOverDate === day.date;
          const hasDeadlines = day.deadlines && day.deadlines.length > 0;
          
          // Merge Ghost Phases
          const dailyGhostPhases = ghostPhases.filter(p => p.suggestedDate.startsWith(day.date));
          const hasGhosts = dailyGhostPhases.length > 0;
          const allPhases = [...day.phases, ...dailyGhostPhases];

          // Check if ANY phase in this day is the currently hovered one in the plan proposal
          const isHoveredDay = activeGhostIndex !== null && dailyGhostPhases.some(p => p.id === ghostPhases[activeGhostIndex]?.id);

          const isVacation = day.phases.some(phase => {
             const proj = projects.find(p => p.id === phase.projectId);
             return proj?.isTimeOff;
          });

          // Check if any phase is external (Checking Phase Override -> Project Default)
          const hasExternal = day.phases.some(phase => {
             const proj = projects.find(p => p.id === phase.projectId);
             return phase.isExternal !== undefined ? phase.isExternal : proj?.isExternal;
          });
          
          // --- HIGHLIGHT LOGIC ---
          const isHighlightedProjectInDay = highlightedProjectId 
             ? day.phases.some(p => p.projectId === highlightedProjectId)
             : false;
          
          const isDimmed = highlightedProjectId && !isHighlightedProjectInDay;

          // --- WEEKEND LOGIC ---
          const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
          // A weekend is "quiet" if no hours, no ghosts, no vacation, no deadlines
          const isQuietWeekend = isWeekend && day.totalHoursBooked === 0 && !hasGhosts && !isVacation && !hasDeadlines;

          const dateLabel = getDayLabel(day.date);
          const isEmpty = day.totalHoursBooked === 0 && !hasGhosts;

          // --- ORBITAL RING CALCULATION ---
          const ringColor = getRingColor(day.totalHoursBooked);
          const usagePct = Math.min((day.totalHoursBooked / DAILY_CAPACITY_HOURS) * 100, 100);
          const isOverloaded = day.totalHoursBooked > DAILY_CAPACITY_HOURS;
          
          // Orbital Style
          const orbitalStyle: React.CSSProperties = {
            background: isQuietWeekend || isVacation 
                ? 'transparent' 
                : isEmpty 
                    ? `rgba(51, 65, 85, 0.5)` // Slate border look
                    : `conic-gradient(${ringColor} ${usagePct}%, rgba(30, 41, 59, 0.5) 0)`
          };

          // --- CLUSTER VIEW LOGIC ---
          const useClusterView = allPhases.length > 3 && zoomLevel === 'standard';
          let heroTask: ProjectPhase | null = null;
          let nanoTasks: ProjectPhase[] = [];

          if (useClusterView) {
              const sorted = [...allPhases].sort((a, b) => b.hours - a.hours);
              heroTask = sorted[0];
              nanoTasks = sorted.slice(1);
          }
          
          // --- MACRO VIEW RENDERING (Tiny Squares) ---
          if (zoomLevel === 'macro') {
             return (
               <div
                 key={day.date}
                 onClick={() => onSelectDay(day.date)}
                 className={`
                   relative h-10 w-full rounded-md cursor-pointer transition-all duration-200 border 
                   ${hasGhosts ? 'border-dashed border-indigo-400/50 bg-indigo-500/10' : 'border-slate-800'}
                   ${isVacation ? 'bg-teal-600/40 border-teal-500/50' : ''}
                   ${isSelected ? 'ring-2 ring-white z-10 scale-110' : 'hover:scale-110 hover:z-10'}
                   ${isHoveredDay ? '!bg-cyan-500/40 ring-2 ring-cyan-400 z-20 scale-125' : ''}
                   ${isHighlightedProjectInDay ? '!bg-indigo-500/50 ring-2 ring-indigo-400 z-30 scale-110' : ''}
                   ${isDimmed ? 'opacity-20 blur-[0.5px] scale-90' : ''}
                   ${isQuietWeekend ? 'opacity-30 !bg-slate-950 border-transparent' : ''}
                   ${!isVacation && !isEmpty ? `shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]` : ''}
                 `}
                 style={!isVacation && !isEmpty ? { backgroundColor: `${ringColor}20`, borderColor: `${ringColor}50` } : {}}
                 title={`${dateLabel.full}: ${day.totalHoursBooked}h`}
               >
                  {hasDeadlines && (
                     <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                  {hasExternal && (
                     <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                  )}
                  {hasGhosts && !isVacation && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-30">
                          <Ghost className="w-3 h-3 text-indigo-200" />
                      </div>
                  )}
               </div>
             );
          }

          // --- STANDARD & MICRO VIEW RENDERING ---
          return (
            <div
              key={day.date}
              className={`
                group relative rounded-xl transition-all duration-500 cursor-pointer ease-out flex flex-col p-[2px] 
                ${zoomLevel === 'micro' ? 'min-h-[400px]' : 'h-28'}
                ${isSelected ? 'z-40' : 'z-0 hover:z-[100]'} 
                ${isHoveredDay ? 'scale-110 z-[200] ring-2 ring-cyan-400 ring-offset-4 ring-offset-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.3)]' : ''}
                ${isHighlightedProjectInDay ? 'scale-[1.03] z-[50] shadow-[0_0_20px_rgba(99,102,241,0.3)] ring-2 ring-indigo-400 ring-offset-4 ring-offset-slate-900' : ''}
                ${isDimmed ? 'opacity-30 blur-[1px] scale-95 grayscale hover:grayscale-0 hover:opacity-100 hover:blur-0' : ''}
                ${isQuietWeekend ? 'opacity-60 hover:opacity-100' : ''}
                ${isOverloaded ? 'animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.15)]' : ''}
              `}
              style={orbitalStyle} // APPLY ORBITAL RING HERE
              onClick={() => onSelectDay(day.date)}
              onDoubleClick={() => !readOnly && onQuickEdit && onQuickEdit(day.date)} 
              onDragOver={(e) => handleDragOver(e, day.date)}
              onDragLeave={(e) => handleDragLeave(e, day.date)}
              onDrop={(e) => handleDrop(e, day.date)}
            >
              {/* INNER CARD (Masks the center of conic gradient) 
                  CHANGED: Removed 'overflow-hidden' here to allow expanded view to break out if needed,
                  moved overflow logic to specific content layers.
              */}
              <div className={`
                 w-full h-full rounded-[10px] flex flex-col relative
                 ${isQuietWeekend 
                    ? 'bg-slate-950' 
                    : isVacation 
                        ? 'bg-slate-900' 
                        : 'bg-slate-900/95 backdrop-blur-md'
                 }
              `}>

              {/* --- LAYER 1: SPECIAL CONTENT (Vacation / External) --- */}
              {isVacation ? (
                <div className={`
                    absolute inset-0 flex flex-col justify-center items-center overflow-hidden rounded-[10px] bg-slate-900
                    ${isSelected ? 'ring-inset ring-2 ring-indigo-400' : ''}
                `}>
                    {zoomLevel === 'micro' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-900/20 via-amber-500/10 to-amber-900/20">
                            <div className="flex flex-col items-center gap-2 mb-4">
                                <Sun className="w-10 h-10 text-amber-400 animate-spin-slow" />
                                <div className="text-center">
                                    <div className="text-xl font-black text-amber-100 uppercase tracking-widest">URLAUB</div>
                                    <div className="text-amber-400/60 font-mono text-xs">Abwesenheit</div>
                                </div>
                            </div>
                            <div className="opacity-30">
                                <Palmtree className="w-20 h-20 text-amber-600" />
                            </div>
                        </div>
                    ) : (
                        <div className="transform scale-[0.25] origin-center w-[400%] h-[400%] flex items-center justify-center pointer-events-none">
                            <GoldenVacationTile />
                        </div>
                    )}
                </div>
              ) : hasExternal && zoomLevel !== 'micro' ? (
                <div className={`
                    absolute inset-0 overflow-hidden rounded-[10px]
                    ${isSelected ? 'ring-inset ring-2 ring-indigo-400' : ''}
                `}>
                    <ExternalMeetingTile 
                        weekday={dateLabel.weekday.toUpperCase()}
                        day={dateLabel.day}
                        hours={day.totalHoursBooked}
                        phases={day.phases.map(p => {
                           const proj = projects.find(proj => proj.id === p.projectId);
                           return { title: proj?.title || p.name, color: proj?.color || 'bg-slate-500' };
                        })}
                    />
                </div>
              ) : (
                <div 
                    className={`
                        relative w-full h-full p-2 flex flex-col
                        ${isDragOver ? 'bg-slate-800 ring-2 ring-indigo-500 ring-inset rounded-[10px]' : ''}
                        ${hasGhosts && isEmpty ? 'bg-indigo-500/5' : ''}
                        ${isHoveredDay ? '!bg-cyan-900/20' : ''}
                        ${zoomLevel === 'micro' && hasExternal ? '!bg-slate-900' : ''} 
                        ${isHighlightedProjectInDay ? '!bg-indigo-900/30' : ''}
                        ${isQuietWeekend ? 'opacity-80' : ''}
                    `}
                    style={isQuietWeekend ? {
                        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02) 10px, transparent 10px, transparent 20px)'
                    } : undefined}
                >
                    {/* Header - NOW CLICKABLE & SAFE ZONE (Not triggering zoom) */}
                    <div className={`
                        flex justify-between items-start w-full mb-1.5 relative z-20 transition-colors rounded-lg -mx-1 px-1
                        ${zoomLevel === 'micro' ? 'pb-2 border-b border-white/5' : 'hover:bg-white/5'}
                    `}>
                        <div className="flex items-baseline gap-2 pointer-events-none">
                            {/* In Micro View, show full date info more prominently */}
                            {zoomLevel === 'micro' ? (
                                <>
                                    <span className={`text-3xl font-black font-sans leading-none ${isHoveredDay ? 'text-cyan-50 scale-110' : isQuietWeekend ? 'text-slate-600' : 'text-slate-200'}`}>{dateLabel.day}</span>
                                    <div className="flex flex-col justify-center">
                                        <span className={`text-sm font-bold uppercase leading-none ${isHoveredDay ? 'text-cyan-200' : isQuietWeekend ? 'text-slate-600' : 'text-white'}`}>{dateLabel.weekday}</span>
                                        <span className={`text-[10px] uppercase tracking-widest ${isQuietWeekend ? 'text-slate-700' : 'text-slate-500'}`}>{dateLabel.month}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className={`text-[9px] font-mono opacity-60 uppercase font-bold ${isHoveredDay ? 'text-cyan-200' : isQuietWeekend ? 'text-slate-600' : ''}`}>{dateLabel.weekday}</span>
                                    <span className={`text-base font-bold font-sans leading-none ${isHoveredDay ? 'text-cyan-50 scale-110' : isQuietWeekend ? 'text-slate-600' : 'text-slate-200'}`}>{dateLabel.day}</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 pointer-events-none">
                            {hasExternal && zoomLevel === 'micro' && (
                                <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
                                    <Car className="w-3 h-3" /> Extern
                                </div>
                            )}
                            <div className="flex items-center gap-1">
                                {hasDeadlines && (
                                    <Flag className="w-3.5 h-3.5 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" fill="currentColor" />
                                )}
                                {hasGhosts && (
                                    <Ghost className={`w-3.5 h-3.5 ${isHoveredDay ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'text-indigo-400'} animate-pulse`} />
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Smart Ghosting for Empty Cells */}
                    {isEmpty && !isWeekend && !hasGhosts && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="flex flex-col items-center gap-1 text-indigo-400/50">
                                <Ghost className="w-6 h-6" />
                            </div>
                        </div>
                    )}

                    {/* CONTENT AREA WRAPPER - This is now the Trigger Zone for the Popup */}
                    <div className="group/content relative flex-grow flex flex-col min-h-0">
                        <div className={`flex-grow min-h-0 relative z-10 ${zoomLevel === 'micro' ? 'overflow-y-auto custom-scrollbar pr-1' : 'overflow-hidden flex flex-col'}`}>
                            
                            {/* --- MICRO VIEW: STACKED FULL WIDTH TASKS (Unchanged) --- */}
                            {zoomLevel === 'micro' && (
                                <div className="flex flex-col gap-2 pb-2">
                                    {allPhases.length === 0 ? (
                                        <div className={`flex items-center justify-center h-full min-h-[100px] border border-dashed rounded-lg ${isQuietWeekend ? 'border-slate-800/50' : 'border-white/5'}`}>
                                            <div className={`text-xs italic ${isQuietWeekend ? 'text-slate-700' : 'text-slate-600'}`}>Keine Aufgaben</div>
                                        </div>
                                    ) : (
                                        allPhases.map((phase, i) => {
                                            const project = projects.find(p => p.id === phase.projectId);
                                            const isGhost = phase.isGhost;
                                            const isThisGhostHovered = activeGhostIndex !== null && isGhost && phase.id === ghostPhases[activeGhostIndex]?.id;
                                            const isExternalPhase = phase.isExternal !== undefined ? phase.isExternal : project?.isExternal;
                                            const isTaskHighlighted = highlightedProjectId && phase.projectId === highlightedProjectId;

                                            return (
                                                <div 
                                                    key={phase.id || i}
                                                    className={`
                                                        flex items-center gap-4 p-3 rounded-lg border transition-all duration-200 group/card relative
                                                        ${isGhost 
                                                            ? isThisGhostHovered
                                                                ? 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                                                : 'bg-indigo-500/10 border-indigo-400/40 border-dashed'
                                                            : isTaskHighlighted
                                                                ? 'bg-indigo-600/30 border-indigo-400 shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]'
                                                                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-indigo-500/30'
                                                        }
                                                    `}
                                                    draggable={!isGhost && !readOnly}
                                                    onDragStart={(e) => !isGhost && handleDragStartPhase(e, phase.id)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    {!isGhost && !readOnly && <div className="absolute top-1/2 -translate-y-1/2 left-1 opacity-0 group-hover/card:opacity-100 cursor-grab active:cursor-grabbing text-slate-500"><GripVertical className="w-4 h-4" /></div>}
                                                    <div className={`w-1.5 self-stretch rounded-full ${project?.color || 'bg-slate-500'} shrink-0 ml-1`}></div>
                                                    <div className="flex-grow min-w-0 py-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wide truncate ${isGhost ? 'text-indigo-300' : 'text-slate-500'}`}>
                                                                {project?.title || 'Unbekanntes Projekt'}
                                                            </span>
                                                            {isExternalPhase && (
                                                                <span className="flex items-center gap-1 text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/10">
                                                                    <Car className="w-2.5 h-2.5" /> Extern
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className={`text-base font-medium leading-snug whitespace-normal break-words ${isGhost ? 'text-indigo-100' : 'text-slate-200'}`}>
                                                            {phase.name}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <div className="text-xl font-mono font-bold text-slate-300 opacity-80">
                                                            {phase.hours}<span className="text-sm font-sans font-normal text-slate-500 ml-0.5">h</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* --- STANDARD VIEW: ORBITAL FOCUS LAYOUT --- */}
                            {zoomLevel === 'standard' && (
                                <>
                                    {/* CLUSTER VIEW (>3 Items) */}
                                    {useClusterView && heroTask ? (
                                        <div className="flex flex-col h-full w-full">
                                            {/* HERO TASK (Simplified Project Only) */}
                                            <div className="mb-1 flex-grow"> {/* Let it take space if needed, but pills are bottom aligned */}
                                                <div className="flex items-start gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${projects.find(p => p.id === heroTask?.projectId)?.color || 'bg-slate-500'} shrink-0`}></div>
                                                    <div 
                                                        className="text-[11px] font-bold text-slate-100 leading-tight line-clamp-3 break-words" 
                                                        title={projects.find(p => p.id === heroTask?.projectId)?.title}
                                                    >
                                                        {projects.find(p => p.id === heroTask?.projectId)?.title || 'Unknown Project'}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* NANO PILLS (Grid) - Compact & Pushed Bottom */}
                                            <div className="flex flex-wrap content-end gap-0.5 mt-auto pt-1 border-t border-white/5">
                                                {nanoTasks.slice(0, 8).map((phase, i) => {
                                                    const project = projects.find(p => p.id === phase.projectId);
                                                    const isGhost = phase.isGhost;
                                                    return (
                                                        <div 
                                                            key={i}
                                                            className={`h-1.5 rounded-full flex-grow max-w-[20%] min-w-[12px] ${project?.color || 'bg-slate-600'} ${isGhost ? 'opacity-50 border border-white/20' : ''}`}
                                                            title={`${phase.name} (${phase.hours}h)`}
                                                        ></div>
                                                    );
                                                })}
                                                {nanoTasks.length > 8 && <div className="text-[7px] text-slate-600 font-mono ml-auto">...</div>}
                                            </div>
                                        </div>
                                    ) : (
                                        /* STANDARD LIST VIEW (<= 3 Items) */
                                        <div className="flex flex-col gap-1">
                                            {allPhases.map((phase, i) => {
                                                const project = projects.find(p => p.id === phase.projectId);
                                                const isGhost = phase.isGhost;
                                                const isThisGhostHovered = activeGhostIndex !== null && isGhost && phase.id === ghostPhases[activeGhostIndex]?.id;
                                                const isTaskHighlighted = highlightedProjectId && phase.projectId === highlightedProjectId;
                                                const shouldShowStrip = !isGhost && !isTaskHighlighted && !isQuietWeekend && project;

                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`
                                                            flex items-center gap-2 pl-1.5 pr-1 py-0.5 rounded-r-md transition-all duration-300 border-l-2 relative
                                                            ${isGhost 
                                                                ? isThisGhostHovered
                                                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100' 
                                                                    : 'bg-indigo-500/10 border-indigo-400/50 text-indigo-300/80 animate-pulse'
                                                                : isTaskHighlighted
                                                                    ? 'bg-indigo-600/20 border-indigo-400 text-white'
                                                                    : isQuietWeekend
                                                                        ? 'border-slate-700 text-slate-600'
                                                                        : 'border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                            }
                                                        `}
                                                        // Make the container border transparent if we have a colored strip, to align text correctly
                                                        style={{ borderLeftColor: shouldShowStrip ? 'transparent' : undefined }}
                                                    >
                                                        
                                                        {/* Better Color Strip Implementation: Absolute position on left */}
                                                        {shouldShowStrip && (
                                                            <div 
                                                                className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-l ${project.color}`}
                                                            ></div>
                                                        )}

                                                        <span className="truncate text-[10px] font-medium leading-none w-full">
                                                            {phase.isGhost ? phase.name : (project?.title || 'Unknown')}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* --- LAYER 2: EXPANDED VIEW ON HOVER (Only in Standard Mode) --- */}
                        {/* MOVED INSIDE group/content to trigger only on content hover */}
                        {!isVacation && !isHoveredDay && zoomLevel === 'standard' && (
                            <div className={`
                                absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-80 min-h-[140%] z-[100]
                                rounded-2xl flex flex-col gap-4 p-5
                                opacity-0 scale-90 pointer-events-none invisible
                                transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center group-hover/content:delay-500
                                ${!isDragging ? 'group-hover/content:opacity-100 group-hover/content:scale-100 group-hover/content:pointer-events-auto group-hover/content:visible' : ''}
                                ${hasExternal 
                                    ? 'bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(34,211,238,0.2)] ring-1 ring-cyan-500/20' 
                                    : 'bg-slate-900/95 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 shadow-[0_30px_80px_-10px_rgba(0,0,0,0.9),0_0_40px_-10px_rgba(99,102,241,0.3)]'}
                            `}>
                                
                                {/* TACTICAL BACKGROUND FOR EXTERNAL */}
                                {hasExternal && (
                                    <>
                                    <div className="absolute inset-0 bg-cyan-900/5 bg-[linear-gradient(0deg,transparent_24%,rgba(34,211,238,0.03)_25%,rgba(34,211,238,0.03)_26%,transparent_27%,transparent_74%,rgba(34,211,238,0.03)_75%,rgba(34,211,238,0.03)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(34,211,238,0.03)_25%,rgba(34,211,238,0.03)_26%,transparent_27%,transparent_74%,rgba(34,211,238,0.03)_75%,rgba(34,211,238,0.03)_76%,transparent_77%,transparent)] bg-[length:30px_30px] pointer-events-none rounded-2xl"></div>
                                    <div className="absolute -right-8 -bottom-8 text-cyan-500/10 pointer-events-none">
                                        <Crosshair className="w-40 h-40 animate-spin-slow opacity-20" />
                                    </div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_#22d3ee]"></div>
                                    </>
                                )}

                                {!hasExternal && (
                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                                )}
                                
                                {/* Separator Line */}
                                {!hasExternal && <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>}

                                {/* Header in Expanded View */}
                                <div className={`relative flex justify-between items-start pb-3 border-b ${hasExternal ? 'border-cyan-500/30' : 'border-white/5'}`}>
                                    <div>
                                        <div className={`text-[10px] font-mono uppercase tracking-widest font-bold ${hasExternal ? 'text-cyan-400 flex items-center gap-1' : 'text-indigo-300'}`}>
                                            {hasExternal && <LocateFixed className="w-3 h-3 animate-pulse" />}
                                            {dateLabel.weekday}
                                        </div>
                                        <div className={`text-2xl font-black tracking-tight ${hasExternal ? 'text-white drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'text-white'}`}>
                                            {dateLabel.day}. {new Date(day.date).toLocaleString('default', { month: 'short' })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-2xl font-mono font-bold leading-none ${day.totalHoursBooked > DAILY_CAPACITY_HOURS ? 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]' : hasExternal ? 'text-cyan-200' : 'text-slate-200'}`}>
                                        {day.totalHoursBooked}<span className="text-sm text-slate-500 font-sans font-normal ml-0.5">h</span>
                                        </div>
                                        <div className={`text-[9px] uppercase tracking-wide mt-1 ${hasExternal ? 'text-cyan-500/70' : 'text-slate-500'}`}>Capacity</div>
                                    </div>
                                </div>

                                {/* Deadlines Section (Now Draggable) */}
                                {hasDeadlines && (
                                    <div className="relative space-y-2">
                                    {day.deadlines.map(d => (
                                        <div 
                                            key={d.id} 
                                            className="flex items-center gap-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm cursor-grab active:cursor-grabbing hover:bg-red-500/20 transition-colors"
                                            draggable={!readOnly}
                                            onDragStart={(e) => handleDragStartDeadline(e, d.id)}
                                            onDragEnd={handleDragEnd}
                                            title={readOnly ? "Deadline" : "Deadline verschieben (Drag & Drop)"}
                                        >
                                            <div className="shrink-0 flex items-center">
                                                {!readOnly && <GripVertical className="w-3 h-3 text-red-500/50 mr-1" />}
                                                <Flag className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                                            </div>
                                            <span className="text-xs font-bold text-red-200 whitespace-normal break-words leading-tight select-none">{d.title}</span>
                                        </div>
                                    ))}
                                    </div>
                                )}

                                {/* Full Scrollable List */}
                                <div className="relative flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                    {allPhases.length === 0 ? (
                                        <div className="text-center py-6 text-slate-500 text-xs italic bg-white/5 rounded-xl border border-dashed border-white/10">
                                            <Ghost className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-300" />
                                            Drag tasks here
                                        </div>
                                    ) : (
                                        allPhases.map(phase => {
                                            const project = projects.find(p => p.id === phase.projectId);
                                            const isGhost = phase.isGhost;
                                            const isExternalPhase = phase.isExternal !== undefined ? phase.isExternal : project?.isExternal;
                                            
                                            return (
                                            <div 
                                                key={phase.id}
                                                className={`group/item flex items-center justify-between p-3 rounded-xl border transition-all backdrop-blur-md shadow-sm 
                                                    ${isGhost 
                                                        ? 'bg-indigo-500/10 border-indigo-400/50 border-dashed hover:bg-indigo-500/20' 
                                                        : isExternalPhase 
                                                            ? 'bg-slate-900/80 border-cyan-500/20 hover:bg-cyan-900/20 hover:border-cyan-400/50' 
                                                            : 'bg-slate-800/50 hover:bg-slate-700/60 border-white/5 hover:border-indigo-500/30'
                                                    }
                                                `}
                                            >
                                                {/* LEFT PART: DRAGGABLE (Grip + Text) */}
                                                <div 
                                                    className={`flex items-center gap-3 flex-grow ${isGhost || readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                                                    draggable={!isGhost && !readOnly}
                                                    onDragStart={(e) => !isGhost && handleDragStartPhase(e, phase.id)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    {!isGhost && !readOnly && <GripVertical className={`w-4 h-4 shrink-0 ${isExternalPhase ? 'text-cyan-700 group-hover/item:text-cyan-400' : 'text-slate-600 group-hover/item:text-slate-400'}`} />}
                                                    {isGhost && <Ghost className="w-4 h-4 shrink-0 text-indigo-400 animate-pulse" />}
                                                    
                                                    <div className="flex flex-col min-w-0 pointer-events-none w-full">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <span className={`text-xs font-bold whitespace-normal break-words leading-tight shadow-black drop-shadow-sm ${isGhost ? 'text-indigo-200' : isExternalPhase ? 'text-cyan-50' : 'text-slate-100'}`}>{project?.title || (isGhost ? 'Planned' : 'Unknown')}</span>
                                                            {isExternalPhase && <Car className={`w-3 h-3 ${isExternalPhase ? 'text-white' : 'text-indigo-400'}`} />}
                                                        </div>
                                                        <span className={`text-[10px] whitespace-normal break-words leading-tight ${isGhost ? 'text-indigo-300/80' : isExternalPhase ? 'text-cyan-400/70' : 'text-slate-400'}`}>{phase.name}</span>
                                                        <div className="flex items-center gap-1.5 mt-1.5">
                                                            <div className={`h-1 w-1 rounded-full ${project?.color || 'bg-slate-500'}`}></div>
                                                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                                                            <span className="text-[10px] text-slate-300 font-mono">{phase.hours}h</span>
                                                            {project?.location && (
                                                                <span className={`text-[9px] px-1 rounded ml-auto ${isExternalPhase ? 'text-cyan-200 bg-cyan-500/20 border border-cyan-500/30' : 'text-indigo-300 bg-indigo-500/10'}`}>
                                                                    {project.location}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* RIGHT PART: BUTTONS (Hidden for Ghost) */}
                                                {!isGhost && !readOnly && (
                                                    <div 
                                                        className="flex gap-1 ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 shrink-0 self-start mt-0.5"
                                                    >
                                                        <button
                                                            className={`p-1.5 rounded-lg transition-all cursor-pointer relative z-20 ${isExternalPhase ? 'text-cyan-600 hover:text-white hover:bg-cyan-500/40' : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/20'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onOpenProject) onOpenProject(phase.projectId);
                                                            }}
                                                            title="Projekt öffnen"
                                                            type="button"
                                                        >
                                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all cursor-pointer relative z-20"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                if (onDeletePhase) {
                                                                    onDeletePhase(phase.id);
                                                                }
                                                            }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            title="Eintrag löschen"
                                                            type="button"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })
                                    )}
                                </div>
                                
                                {/* Footer Hint */}
                                {!readOnly && (
                                    <div className={`relative pt-3 text-center border-t ${hasExternal ? 'border-cyan-500/30' : 'border-white/5'}`}>
                                    <span className={`text-[9px] font-mono uppercase tracking-widest flex items-center justify-center gap-2 ${hasExternal ? 'text-cyan-500/60' : 'text-slate-500/70'}`}>
                                        <span className={`w-1 h-1 rounded-full ${hasExternal ? 'bg-cyan-600' : 'bg-slate-600'}`}></span>
                                        {hasExternal ? 'ACCESS MISSION DATA' : 'Double click to Edit'}
                                        <span className={`w-1 h-1 rounded-full ${hasExternal ? 'bg-cyan-600' : 'bg-slate-600'}`}></span>
                                    </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Deadline Bottom Strip (Still useful as global alert) */}
                    {hasDeadlines && (
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_-4px_15px_rgba(239,68,68,0.5)] animate-pulse"></div>
                    )}
                </div>
              )} {/* Correctly closing the ternary branches here */}
              </div> 

            </div>
          );
        })}
      </div>
      
      {/* Legend - Only show on Standard/Micro */}
      {zoomLevel !== 'macro' && (
        <div className="flex items-center gap-6 mt-6 text-[10px] font-mono text-slate-500 justify-end uppercase tracking-wider border-t border-slate-800 pt-4 relative z-0">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Relaxed</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> Balanced</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div> Heavy</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div> Vacation</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div> External</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse"></div> Critical</div>
        </div>
      )}
    </div>
  );
};
