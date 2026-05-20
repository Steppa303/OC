import { useState } from 'react';
import { motion } from 'framer-motion';
import TaskCard from './TaskCard';

export default function Column({ column, tasks, members, onSelectTask, onUpdateTask }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    if (taskId) {
      onUpdateTask(taskId, { status: column.id });
    }
  };

  return (
    <div
      className={`w-full md:w-64 lg:w-80 flex-shrink-0 flex flex-col rounded-2xl transition-all ${
        dragOver ? 'bg-indigo-500/10 border-2 border-indigo-500/50' : 'bg-slate-900/50 border border-slate-800'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{column.icon}</span>
            <h2 className="font-semibold text-white">{column.title}</h2>
          </div>
          <span className="bg-slate-800 text-slate-400 text-xs font-medium px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${column.color} mt-2`} />
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <TaskCard task={task} members={members} onClick={() => onSelectTask(task)} />
          </motion.div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">
            Keine Aufgaben
          </div>
        )}
      </div>
    </div>
  );
}
