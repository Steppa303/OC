import { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './components/Login';
import Board from './components/Board';
import TaskModal from './components/TaskModal';
import Header from './components/Header';
import { createTask, getTasks, getMembers, getTaskComments, getTaskHistory, addComment, updateTask, deleteTask } from './api';

const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('kanban_user');
    const savedToken = localStorage.getItem('kanban_token');
    if (saved && savedToken) {
      setUser(JSON.parse(saved));
      fetchData(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchData = async (token) => {
    try {
      const [tasksData, membersData] = await Promise.all([
        getTasks(token),
        getMembers(token),
      ]);
      setTasks(tasksData);
      setMembers(membersData);
    } catch (e) {
      console.error('Fetch error:', e);
    }
    setLoading(false);
  };

  const login = async (userData, token) => {
    setUser(userData);
    localStorage.setItem('kanban_user', JSON.stringify(userData));
    localStorage.setItem('kanban_token', token);
    fetchData(token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kanban_user');
    localStorage.removeItem('kanban_token');
    setTasks([]);
    setMembers([]);
  };

  const refreshTasks = async () => {
    const token = localStorage.getItem('kanban_token');
    if (token) {
      const data = await getTasks(token);
      setTasks(data);
    }
  };

  const handleCreateTask = async (taskData) => {
    const token = localStorage.getItem('kanban_token');
    const newTask = await createTask(token, taskData);
    await refreshTasks();
    setShowCreateModal(false);
  };

  const handleUpdateTask = async (taskId, updates) => {
    const token = localStorage.getItem('kanban_token');
    await updateTask(token, taskId, updates);
    await refreshTasks();
    if (selectedTask?.id === taskId) {
      const updated = tasks.find(t => t.id === taskId);
      if (updated) setSelectedTask({ ...updated, ...updates });
    }
  };

  const handleDeleteTask = async (taskId) => {
    const token = localStorage.getItem('kanban_token');
    await deleteTask(token, taskId);
    await refreshTasks();
    setSelectedTask(null);
  };

  const handleSelectTask = async (task) => {
    const token = localStorage.getItem('kanban_token');
    const [comments, history] = await Promise.all([
      getTaskComments(token, task.id),
      getTaskHistory(token, task.id),
    ]);
    setSelectedTask({ ...task, comments, history });
  };

  const handleAddComment = async (taskId, content) => {
    const token = localStorage.getItem('kanban_token');
    const comment = await addComment(token, taskId, content);
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => ({
        ...prev,
        comments: [...(prev.comments || []), comment],
      }));
    }
    await refreshTasks();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <AppContext.Provider value={{ user, members, tasks }}>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header 
          user={user} 
          onLogout={logout} 
          onCreateTask={() => setShowCreateModal(true)} 
        />
        
        <main className="flex-1 overflow-x-auto p-4 md:p-6">
          <Board 
            tasks={tasks}
            members={members}
            onSelectTask={handleSelectTask}
            onUpdateTask={handleUpdateTask}
          />
        </main>

        <AnimatePresence>
          {showCreateModal && (
            <TaskModal
              task={null}
              members={members}
              onClose={() => setShowCreateModal(false)}
              onSave={handleCreateTask}
              onDelete={null}
              onAddComment={null}
              onUpdateTask={null}
            />
          )}
          {selectedTask && (
            <TaskModal
              task={selectedTask}
              members={members}
              onClose={() => setSelectedTask(null)}
              onSave={handleUpdateTask}
              onDelete={handleDeleteTask}
              onAddComment={handleAddComment}
              onUpdateTask={handleUpdateTask}
            />
          )}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}

export default App;
