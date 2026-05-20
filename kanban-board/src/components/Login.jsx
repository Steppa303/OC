import { useState } from 'react';
import { motion } from 'framer-motion';
import { login } from '../api';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const data = await login(email, name);
      onLogin(data.member, data.token);
    } catch (err) {
      setError('Login fehlgeschlagen. Überprüfe deine Eingaben.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl shadow-indigo-500/25"
          >
            <span className="text-4xl">📋</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">Kanban Board</h1>
          <p className="text-slate-400">Team-Aufgabenverwaltung</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Dein Name"
                required
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="deine@email.de"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                  Anmelden...
                </span>
              ) : 'Anmelden'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Neuer Benutzer? Wird automatisch registriert.
        </p>
      </motion.div>
    </div>
  );
}
