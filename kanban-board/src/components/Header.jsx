import { Users, Plus, LogOut } from 'lucide-react';
import { useApp } from '../App';

export default function Header({ onCreateTask, onLogout, user }) {
  const { members } = useApp();

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-xl">📋</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Kanban Board</h1>
            <p className="text-xs text-slate-400">Team-Aufgabenverwaltung</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1">
            {members.slice(0, 5).map(m => (
              <div
                key={m.id}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                style={{ backgroundColor: m.avatar_color }}
                title={m.name}
              >
                {m.name.charAt(0)}
              </div>
            ))}
            {members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
                +{members.length - 5}
              </div>
            )}
          </div>

          <button
            onClick={onCreateTask}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Neue Aufgabe</span>
          </button>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Abmelden"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
