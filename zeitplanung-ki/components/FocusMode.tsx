
import React, { useState, useEffect } from 'react';
import { ProjectPhase, Project } from '../types';
import { CheckCircle2, Coffee, Timer, Check, ChevronDown, Zap } from 'lucide-react';
import { GoldenVacationTile } from './GoldenVacationTile';

interface FocusModeProps {
  todaysPhases: ProjectPhase[];
  projects: Project[];
  onTogglePhaseStatus: (phaseId: string) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({ todaysPhases, projects, onTogglePhaseStatus }) => {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const activeTask = selectedPhaseId 
    ? todaysPhases.find(p => p.id === selectedPhaseId) 
    : todaysPhases.find(p => p.status !== 'completed');

  useEffect(() => {
     if (!selectedPhaseId && activeTask) {
         setSelectedPhaseId(activeTask.id);
     }
  }, [activeTask, selectedPhaseId]);

  const displayTask = activeTask || todaysPhases[0];
  const displayProject = projects.find(p => p.id === displayTask?.projectId);

  const renderContent = () => {
      // 1. Vacation Mode
      if (displayProject?.isTimeOff) {
        return (
            <div className="w-full flex justify-center py-6">
                 <div className="transform sm:scale-75 origin-top relative z-10">
                    <GoldenVacationTile />
                 </div>
            </div>
        );
      }

      // 2. All Clear Mode
      if (!activeTask && todaysPhases.length === 0) {
        return (
          <div className="glass-card rounded-2xl p-6 flex items-center justify-between border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden mx-4 sm:mx-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                <Coffee className="w-6 h-6 text-emerald-400" />
                All Clear
              </h2>
              <p className="text-slate-400">Keine weiteren Aufgaben für heute.</p>
            </div>
          </div>
        );
      }

      // 3. Active Task Mode
      if (!displayTask) return null;

      return (
        <div className="glass-card rounded-b-2xl rounded-t-none sm:rounded-2xl p-0 overflow-hidden relative border-indigo-500/30 shadow-[0_0_50px_-10px_rgba(79,70,229,0.2)] group mx-0 sm:mx-0 border-t-0 sm:border-t">
            {/* Animated Background Mesh */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-transparent opacity-60 pointer-events-none"></div>
            
            <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row gap-6">
                <div className="flex-grow flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)] flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Focus Mode
                            </span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2 leading-tight drop-shadow-lg">
                            {displayProject?.title}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mb-6">
                            <span className="flex items-center gap-1.5">
                                <Timer className="w-4 h-4 text-indigo-400" /> 
                                Geplant: <span className="font-mono text-slate-200">{displayTask.hours}h</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-300 font-mono truncate">{displayTask.name}</span>
                        </div>
                    </div>

                    {/* Sub-Task Switcher */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                        {todaysPhases.map(phase => {
                            const isSelected = phase.id === displayTask.id;
                            const isCompleted = phase.status === 'completed';
                            
                            return (
                                <button
                                    key={phase.id}
                                    onClick={() => setSelectedPhaseId(phase.id)}
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
                                        ${isSelected 
                                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                                            : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                                        }
                                        ${isCompleted ? 'opacity-60 line-through decoration-slate-600' : ''}
                                    `}
                                >
                                    {isCompleted && <Check className="w-3 h-3" />}
                                    {phase.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action Area */}
                <div className="flex flex-col sm:items-end justify-center bg-slate-950/20 md:bg-transparent rounded-xl md:rounded-none p-4 md:p-0 border border-white/5 md:border-none">
                    <button
                        onClick={() => onTogglePhaseStatus(displayTask.id)}
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg border ${
                            displayTask.status === 'completed'
                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30 scale-105'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50 group-hover:scale-105'
                        }`}
                        title={displayTask.status === 'completed' ? "Wieder öffnen" : "Abschließen"}
                    >
                        <CheckCircle2 className={`w-8 h-8 transition-transform duration-300 ${displayTask.status === 'completed' ? 'scale-110' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="relative z-30 flex flex-col mb-8 -mt-12 group/drawer">
        
        {/* DRAWER CONTENT (Hidden by default) */}
        <div 
            className={`w-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? 'max-h-[600px] opacity-100 mb-0 shadow-2xl' : 'max-h-0 opacity-0 mb-0'}`}
        >
            <div className="pb-0 pt-0">
                {renderContent()}
            </div>
        </div>

        {/* THE "LASCHE" (Mini Pull Tab) */}
        <div className="flex justify-center relative z-40">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    group/btn flex items-center justify-center
                    w-12 h-6 
                    rounded-b-lg
                    bg-emerald-500 hover:bg-emerald-400
                    shadow-[0_4px_15px_rgba(16,185,129,0.3)]
                    transition-all duration-300
                    cursor-pointer
                    border-t-0
                `}
                title={isOpen ? "Einklappen" : "Focus Mode"}
            >
                <ChevronDown className={`w-4 h-4 text-emerald-950 font-bold transition-transform duration-500 ${isOpen ? 'rotate-180' : 'group-hover/btn:translate-y-0.5'}`} />
            </button>
        </div>
    </div>
  );
};
