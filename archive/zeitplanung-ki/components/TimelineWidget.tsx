import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { Flag, ArrowRight, Users, Briefcase, FileText } from 'lucide-react';
import { formatDate } from '../utils';

interface TimelineWidgetProps {
  projects: Project[];
  onOpenProject?: (projectId: string) => void;
}

export const TimelineWidget: React.FC<TimelineWidgetProps> = ({ projects, onOpenProject }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'meetings'>('projects');

  const { regularProjects, meetingProjects } = useMemo(() => {
    const todayStr = formatDate(new Date());
    const meetingKeywords = ['meeting', 'besprechung', 'konferenz', 'call', 'viko', 'telco', 'jour fixe', 'daily', 'weekly'];
    
    // Helper to check if project is a meeting
    const isMeeting = (p: Project) => {
        const titleLower = p.title.toLowerCase();
        return meetingKeywords.some(k => titleLower.includes(k));
    };

    // Filter for future/today deadlines
    const futureProjects = projects.filter(p => p.deadline >= todayStr);

    const regular = futureProjects
        .filter(p => !isMeeting(p))
        .sort((a, b) => a.deadline.localeCompare(b.deadline));

    const meetings = futureProjects
        .filter(p => isMeeting(p))
        .sort((a, b) => a.deadline.localeCompare(b.deadline));

    return {
        regularProjects: regular,
        meetingProjects: meetings
    };
  }, [projects]);

  // Determine what to display based on active tab
  // Slice to top 3 for the widget view
  const displayedList = activeTab === 'projects' ? regularProjects.slice(0, 3) : meetingProjects.slice(0, 3);
  const hasContent = regularProjects.length > 0 || meetingProjects.length > 0;

  if (!hasContent) return null;

  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden transition-all duration-300">
      
      {/* Tabs Header */}
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

      <div className="relative pl-2 min-h-[100px]">
        {displayedList.length === 0 ? (
             <div className="text-slate-500 text-sm text-center py-8 italic border border-dashed border-slate-800/50 rounded-lg">
                {activeTab === 'projects' ? 'Keine kritischen Projekte.' : 'Keine anstehenden Meetings.'}
             </div>
        ) : (
            <>
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500/50 to-transparent"></div>

                <div className="space-y-6">
                {displayedList.map((project) => {
                    const today = new Date();
                    const deadlineDate = new Date(project.deadline);
                    const todayDate = new Date(today.toISOString().split('T')[0]);
                    const diffTime = deadlineDate.getTime() - todayDate.getTime();
                    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    // Mark as urgent red only if it's a project close to deadline. Meetings are just scheduled.
                    const isUrgent = daysLeft <= 3 && activeTab === 'projects'; 

                    return (
                    <div 
                        key={project.id} 
                        className="relative flex items-start gap-4 group cursor-pointer animate-in slide-in-from-right duration-300"
                        onClick={() => onOpenProject && onOpenProject(project.id)}
                    >
                        {/* Node */}
                        <div className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 bg-slate-900 ${isUrgent ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-indigo-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`}></div>
                        </div>

                        {/* Content */}
                        <div className="flex-grow p-3 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition-all group-hover:shadow-lg group-hover:shadow-indigo-500/10">
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-slate-200 text-sm leading-snug break-words whitespace-normal">{project.title}</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${isUrgent ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-slate-400 border-slate-700 bg-slate-800'}`}>
                                {daysLeft === 0 ? 'Heute' : `${daysLeft}d left`}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <span>{new Date(project.deadline).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'})}</span>
                            <ArrowRight className="w-3 h-3 opacity-50" />
                            <div className={`w-2 h-2 rounded-full ${project.color}`}></div>
                            {project.description && <FileText className="w-3 h-3 text-slate-600 ml-1" />}
                        </div>
                        </div>
                    </div>
                    );
                })}
                </div>
            </>
        )}
      </div>
    </div>
  );
};