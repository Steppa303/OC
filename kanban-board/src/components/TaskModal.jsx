import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Send, Calendar, User, AlertCircle } from 'lucide-react';
import { useApp } from '../App';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niedrig', color: 'text-slate-400' },
  { value: 'medium', label: 'Mittel', color: 'text-blue-400' },
  { value: 'high', label: 'Hoch', color: 'text-amber-400' },
  { value: 'urgent', label: 'Dringend', color: 'text-red-400' },
];

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', icon: '📝' },
  { value: 'in_progress', label: 'In Progress', icon: '🔄' },
  { value: 'review', label: 'Review', icon: '🔍' },
  { value: 'done', label: 'Done', icon: '✅' },
];

export default function TaskModal({ task, members, onClose, onSave, onDelete, onAddComment, onUpdateTask }) {
  const { user } = useApp();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '');
  const [dueDate, setDueDate] = useState(task?.due_date?.split('T')[0] || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const isCreate = !task?.id;

  const handleSave = async () => {
    if (!title.trim()) return;
    const data = { title, description, priority, assignee_id: assigneeId || null, due_date: dueDate || null, status };
    if (isCreate) {
      onSave(data);
    } else {
      await onSave(task.id, data);
      onClose();
    }
  };

  const handleDelete = () => {
    if (confirm('Aufgabe wirklich löschen?')) {
      onDelete(task.id);
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    onAddComment(task.id, comment);
    setComment('');
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (!isCreate) {
      onUpdateTask(task.id, { status: newStatus });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-800 rounded-none md:rounded-2xl w-full max-w-2xl h-[100dvh] md:h-auto md:max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            {isCreate ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}
          </h2>
          <div className="flex items-center gap-2">
            {!isCreate && onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Aufgabe beschreiben..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="Details zur Aufgabe..."
            />
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priorität</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Zugewiesen an</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Nicht zugewiesen</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Fällig bis</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs for existing tasks */}
          {!isCreate && task && (
            <div className="border-t border-slate-800 pt-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'details' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'comments' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Kommentare ({task.comments?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Verlauf ({task.history?.length || 0})
                </button>
              </div>

              {activeTab === 'comments' && (
                <div className="space-y-3">
                  {task.comments?.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: c.avatar_color }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{c.name}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(c.created_at).toLocaleString('de-DE')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {onAddComment && (
                    <div className="flex gap-2 mt-4">
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Kommentar schreiben..."
                      />
                      <button
                        onClick={handleAddComment}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-2">
                  {task.history?.map(h => (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: h.avatar_color }}
                      >
                        {h.name.charAt(0)}
                      </div>
                      <div>
                        <span className="text-white font-medium">{h.name}</span>
                        <span className="text-slate-400"> änderte Status von </span>
                        <span className="text-amber-400">{h.from_status || '—'}</span>
                        <span className="text-slate-400"> nach </span>
                        <span className="text-emerald-400">{h.to_status}</span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {new Date(h.created_at).toLocaleString('de-DE')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!task.history || task.history.length === 0) && (
                    <p className="text-slate-500 text-sm">Noch keine Statusänderungen</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreate ? 'Erstellen' : 'Speichern'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
