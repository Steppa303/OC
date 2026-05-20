import { MessageSquare, Clock, AlertCircle } from 'lucide-react';

const PRIORITY_CONFIG = {
  low: { label: 'Niedrig', color: 'bg-slate-500/20 text-slate-400', icon: null },
  medium: { label: 'Mittel', color: 'bg-blue-500/20 text-blue-400', icon: null },
  high: { label: 'Hoch', color: 'bg-amber-500/20 text-amber-400', icon: <AlertCircle className="w-3 h-3" /> },
  urgent: { label: 'Dringend', color: 'bg-red-500/20 text-red-400', icon: <AlertCircle className="w-3 h-3" /> },
};

export default function TaskCard({ task, members, onClick }) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const assignee = members.find(m => m.id === task.assignee_id);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id.toString())}
      onClick={onClick}
      className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-slate-900/50 group"
    >
      {/* Title */}
      <h3 className="font-medium text-white mb-2 group-hover:text-indigo-300 transition-colors line-clamp-2">
        {task.title}
      </h3>

      {/* Description preview */}
      {task.description && (
        <p className="text-sm text-slate-400 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Priority badge */}
          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${priority.color}`}>
            {priority.icon}
            {priority.label}
          </span>

          {/* Comments count */}
          {task.comments_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MessageSquare className="w-3 h-3" />
              {task.comments_count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Due date */}
          {task.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {formatDate(task.due_date)}
            </span>
          )}

          {/* Assignee */}
          {assignee && (
            <span className="text-xs text-slate-300 truncate max-w-[80px]" title={assignee.name}>
              {assignee.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
