import { useState } from 'react';
import Column from './Column';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'from-slate-500 to-slate-600', icon: '📝' },
  { id: 'in_progress', title: 'In Progress', color: 'from-blue-500 to-cyan-500', icon: '🔄' },
  { id: 'review', title: 'Review', color: 'from-amber-500 to-orange-500', icon: '🔍' },
  { id: 'done', title: 'Done', color: 'from-emerald-500 to-green-500', icon: '✅' },
];

export default function Board({ tasks, members, onSelectTask, onUpdateTask }) {
  const [activeCol, setActiveCol] = useState(0);
  
  const getTasksByStatus = (status) => 
    tasks.filter(t => t.status === status).sort((a, b) => a.column_order - b.column_order);

  const nextCol = () => setActiveCol(p => Math.min(p + 1, COLUMNS.length - 1));
  const prevCol = () => setActiveCol(p => Math.max(p - 1, 0));

  return (
    <>
      {/* Desktop: horizontal scroll */}
      <div className="hidden md:flex gap-4 min-w-[1100px] h-full">
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            column={col}
            tasks={getTasksByStatus(col.id)}
            members={members}
            onSelectTask={onSelectTask}
            onUpdateTask={onUpdateTask}
          />
        ))}
      </div>

      {/* Mobile: swipeable tabs */}
      <div className="md:hidden flex flex-col h-full">
        {/* Column tabs */}
        <div className="flex items-center gap-2 mb-4 px-2">
          <button
            onClick={prevCol}
            disabled={activeCol === 0}
            className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {COLUMNS.map((col, i) => {
              const count = getTasksByStatus(col.id).length;
              return (
                <button
                  key={col.id}
                  onClick={() => setActiveCol(i)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    i === activeCol
                      ? 'bg-slate-800 text-white shadow-lg'
                      : 'bg-slate-800/50 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{col.icon}</span>
                  <span>{col.title}</span>
                  <span className="bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={nextCol}
            disabled={activeCol === COLUMNS.length - 1}
            className="p-2 rounded-lg bg-slate-800 text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Active column */}
        <div className="flex-1">
          <Column
            column={COLUMNS[activeCol]}
            tasks={getTasksByStatus(COLUMNS[activeCol].id)}
            members={members}
            onSelectTask={onSelectTask}
            onUpdateTask={onUpdateTask}
          />
        </div>
      </div>
    </>
  );
}
