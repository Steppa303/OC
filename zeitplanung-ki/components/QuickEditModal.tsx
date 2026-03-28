import React, { useState, useEffect } from 'react';
import { ProjectPhase, Project } from '../types';
import { X, Save, Trash2, CalendarOff, Car } from 'lucide-react';

interface QuickEditModalProps {
  date: string;
  phases: ProjectPhase[];
  projects: Project[];
  onSave: (updates: { phaseId: string, hours: number, isExternal?: boolean }[]) => void;
  onClose: () => void;
  onDelete?: (phaseId: string) => void;
  onDeleteProject?: (projectId: string) => void; // New prop for bulk deletion
}

export const QuickEditModal: React.FC<QuickEditModalProps> = ({ date, phases, projects, onSave, onClose, onDelete, onDeleteProject }) => {
  const [editedPhases, setEditedPhases] = useState(phases.map(p => ({ ...p })));

  // Sync edited phases when the phases prop changes (e.g. after deletion)
  useEffect(() => {
    setEditedPhases(phases.map(p => ({ ...p })));
  }, [phases]);

  const handleHoursChange = (id: string, newHours: number) => {
    setEditedPhases(prev => prev.map(p => 
      p.id === id ? { ...p, hours: Math.max(0, newHours) } : p
    ));
  };
  
  const handleExternalToggle = (id: string) => {
      setEditedPhases(prev => prev.map(p => {
          if (p.id === id) {
              // Determine current effective state (Phase override -> Project default)
              const project = projects.find(proj => proj.id === p.projectId);
              const currentEffective = p.isExternal !== undefined ? p.isExternal : !!project?.isExternal;
              
              return { ...p, isExternal: !currentEffective };
          }
          return p;
      }));
  };

  const handleSave = () => {
    const updates = editedPhases
      .filter(p => {
        const original = phases.find(op => op.id === p.id);
        // Check if hours changed OR if isExternal changed
        const hoursChanged = original && original.hours !== p.hours;
        const externalChanged = original && original.isExternal !== p.isExternal;
        return hoursChanged || externalChanged;
      })
      .map(p => ({ phaseId: p.id, hours: p.hours, isExternal: p.isExternal }));
    
    onSave(updates);
  };
  
  const handleDeleteClick = (id: string) => {
      if(onDelete) {
         // Optimistic Update: Immediately remove from UI
         setEditedPhases(prev => prev.filter(p => p.id !== id));
         onDelete(id);
      }
  };

  // Detect if any phase belongs to a TimeOff project
  const timeOffProject = phases.map(p => projects.find(proj => proj.id === p.projectId)).find(p => p?.isTimeOff);

  const formattedDate = new Date(date).toLocaleDateString('de-DE', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
           <div>
             <h3 className="font-bold text-slate-200">Quick Edit</h3>
             <p className="text-xs text-indigo-400 font-mono">{formattedDate}</p>
           </div>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
           {editedPhases.length === 0 ? (
             <div className="text-center text-slate-500 text-sm py-4">Keine Aufgaben an diesem Tag.</div>
           ) : (
             editedPhases.map(phase => {
               const project = projects.find(p => p.id === phase.projectId);
               const isVacationPhase = project?.isTimeOff;
               
               // Determine visual state for External
               const isExternal = phase.isExternal !== undefined ? phase.isExternal : project?.isExternal;

               return (
                 <div key={phase.id} className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${isVacationPhase ? 'bg-teal-900/20 border-teal-500/30' : isExternal ? 'bg-slate-950/50 border-cyan-500/30' : 'bg-slate-950/30 border-slate-800/50'}`}>
                    <div className="flex-grow min-w-0">
                       <div className="flex items-center gap-2">
                           <div className={`text-xs font-medium truncate ${isVacationPhase ? 'text-teal-400' : 'text-indigo-300'}`}>{project?.title}</div>
                           {isExternal && !isVacationPhase && <Car className="w-3 h-3 text-cyan-400" />}
                       </div>
                       <div className="text-sm text-slate-300 truncate font-semibold">{phase.name}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-slate-800">
                            <button 
                                onClick={() => handleHoursChange(phase.id, phase.hours - 0.25)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                                disabled={isVacationPhase} // Lock hours for vacation
                            >
                                -
                            </button>
                            <div className="w-14 text-center font-mono text-sm font-bold text-white">
                                {phase.hours.toFixed(2)}h
                            </div>
                            <button 
                                onClick={() => handleHoursChange(phase.id, phase.hours + 0.25)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                                disabled={isVacationPhase}
                            >
                                +
                            </button>
                         </div>
                         
                         {!isVacationPhase && (
                             <>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleExternalToggle(phase.id);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ml-1 ${isExternal ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30'}`}
                                    title={isExternal ? "Als intern markieren" : "Als Außentermin markieren"}
                                >
                                    <Car className="w-4 h-4" />
                                </button>

                                {onDelete && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(phase.id);
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="w-9 h-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-lg text-red-400 hover:text-red-300 transition-all ml-1"
                                        title="Eintrag entfernen"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                             </>
                         )}
                    </div>
                 </div>
               );
             })
           )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
           
           {/* Left side: Vacation Delete Button */}
           {timeOffProject && onDeleteProject ? (
              <button 
                onClick={() => onDeleteProject(timeOffProject.id)}
                className="px-3 py-2 text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors mr-auto"
                title="Löscht das gesamte Urlaubsprojekt und alle zugehörigen Tage"
              >
                 <CalendarOff className="w-4 h-4" />
                 Gesamten Urlaub stornieren
              </button>
           ) : (
              <div className="mr-auto"></div> // Spacer
           )}

           <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium"
                >
                    Abbrechen
                </button>
                <button 
                    onClick={handleSave}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-900/20"
                >
                    <Save className="w-4 h-4" /> Speichern
                </button>
           </div>
        </div>
      </div>
    </div>
  );
};