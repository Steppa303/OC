import React, { useState, useMemo } from 'react';
import { Project, ProjectPhase } from '../types';
import { Clock, Calendar, PieChart, Trash2, Edit2, Paperclip, Users, Briefcase, FileText, Car } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  phases: ProjectPhase[];
  onDelete: (id: string) => void;
  onEdit: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, phases, onDelete, onEdit }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'meetings'>('projects');

  const getProjectProgress = (projectId: string) => {
    const projectPhases = phases.filter(p => p.projectId === projectId);
    if (projectPhases.length === 0) return 0;
    const completed = projectPhases.filter(p => p.status === 'completed').length;
    return Math.round((completed / projectPhases.length) * 100);
  };

  // Filter Logic
  const { regularProjects, meetingProjects } = useMemo(() => {
    const meetingKeywords = ['meeting', 'besprechung', 'konferenz', 'call', 'viko', 'telco', 'jour fixe', 'daily', 'weekly'];
    
    const isMeeting = (p: Project) => {
        const titleLower = p.title.toLowerCase();
        return meetingKeywords.some(k => titleLower.includes(k));
    };

    return {
        regularProjects: projects.filter(p => !isMeeting(p)),
        meetingProjects: projects.filter(p => isMeeting(p))
    };
  }, [projects]);

  const displayedList = activeTab === 'projects' ? regularProjects : meetingProjects;

  return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl shadow-black/20 border border-slate-800 p-6">
      
      {/* Header / Tabs */}
      <div className="flex items-center gap-6 mb-6 border-b border-slate-800/50 pb-1">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold transition-all relative ${
                activeTab === 'projects' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
             <Briefcase className="w-4 h-4" />
             Projekte
             <span className="ml-1 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-400">{regularProjects.length}</span>
             {activeTab === 'projects' && (
                 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"></div>
             )}
          </button>

          <button
            onClick={() => setActiveTab('meetings')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold transition-all relative ${
                activeTab === 'meetings' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
             <Users className="w-4 h-4" />
             Meetings
             <span className="ml-1 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-400">{meetingProjects.length}</span>
             {activeTab === 'meetings' && (
                 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"></div>
             )}
          </button>
      </div>
      
      <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
        {displayedList.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8 border border-dashed border-slate-800 rounded-xl">
             {activeTab === 'projects' ? 'Keine aktiven Projekte.' : 'Keine Meetings geplant.'}
             {activeTab === 'projects' && <div className="text-xs mt-1 text-slate-600">Füge eines über das Textfeld hinzu!</div>}
          </div>
        ) : (
          displayedList.map((project) => {
             const progress = getProjectProgress(project.id);
             
             return (
              <div 
                key={project.id} 
                className="group flex items-center p-3 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700 transition-all duration-300 relative gap-3"
                onClick={() => onEdit(project)}
              >
                
                {/* Ring Chart - Compact */}
                <div className="relative w-10 h-10 flex-shrink-0">
                     {/* Outer Ring (Gradient) */}
                     <div 
                       className="absolute inset-0 rounded-full opacity-90 transition-all duration-1000 ease-out"
                       style={{ 
                           background: `conic-gradient(currentColor ${progress}%, rgba(30,41,59,0.5) 0)` 
                       }} 
                     >
                        <div className={`w-full h-full rounded-full ${project.color} opacity-0`}></div>
                     </div>
                     
                     {/* Inner Circle (Hole) */}
                     <div className="absolute inset-1 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">
                         <span className="text-[9px] font-bold text-white">{progress}%</span>
                     </div>
                </div>

                {/* Content - Compact Stack */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-200 truncate text-sm">{project.title}</h3>
                        {/* Status Icons */}
                        {project.isExternal && (
                            <span title={`Außentermin: ${project.location || 'Extern'}`} className="flex items-center">
                                <Car className="w-3 h-3 text-indigo-400" />
                            </span>
                        )}
                        {project.description && (
                            <span title="Beschreibung vorhanden" className="flex items-center">
                                <FileText className="w-3 h-3 text-slate-500" />
                            </span>
                        )}
                        {project.attachments && project.attachments.length > 0 && (
                           <Paperclip className="w-3 h-3 text-slate-500" />
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-600" />
                            {project.totalHours}h
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            {new Date(project.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </div>
                    </div>
                </div>

                {/* Actions - Inline & Icon Only */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pl-2 border-l border-slate-800/50">
                   <button 
                     type="button"
                     onClick={(e) => {
                       e.stopPropagation();
                       onEdit(project);
                     }}
                     className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                     title="Bearbeiten"
                   >
                     <Edit2 className="w-4 h-4" />
                   </button>
                   <button 
                     type="button"
                     onClick={(e) => {
                       e.stopPropagation();
                       onDelete(project.id);
                     }}
                     className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                     title="Löschen"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};