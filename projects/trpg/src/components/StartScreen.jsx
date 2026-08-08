import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, FolderOpen, Play, Clock, Trash2 } from 'lucide-react';
import useGameStore from '../store';
import { api } from '../lib/api';

function haptic(style = 'medium') {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
}

export default function StartScreen() {
  const navigate = useNavigate();
  const user = useGameStore((s) => s.user);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const setSaveId = useGameStore((s) => s.setSaveId);
  const setCurrentScene = useGameStore((s) => s.setCurrentScene);
  const setChoices = useGameStore((s) => s.setChoices);
  const setTurn = useGameStore((s) => s.setTurn);
  const setInventory = useGameStore((s) => s.setInventory);
  const setEquipment = useGameStore((s) => s.setEquipment);
  const setLoading = useGameStore((s) => s.setLoading);

  const [saves, setSaves] = useState([]);
  const [loadingSaves, setLoadingSaves] = useState(true);
  const [showSaves, setShowSaves] = useState(false);

  useEffect(() => {
    if (user?.userId) {
      api
        .getSaves(user.userId)
        .then(setSaves)
        .catch(() => {})
        .finally(() => setLoadingSaves(false));
    } else {
      setLoadingSaves(false);
    }
  }, [user]);

  const handleContinue = async (save) => {
    haptic('medium');
    setLoading(true);
    try {
      const state = await api.getState(save.id);
      if (state.character) {
        setCharacter({
          ...state.character,
          stats: state.character.stats || {},
          skills: state.character.skills || [],
          inventory: state.character.inventory || [],
        });
        setInventory(state.character.inventory || []);
        if (state.character.equipment) {
          setEquipment(state.character.equipment);
        }
      }
      setSaveId(save.id);
      setCurrentScene(state.save.current_scene);
      const gameState = state.save.game_state || {};
      setTurn(gameState.turn || 0);
      // Reconstruct choices from last log entry
      if (state.log?.length > 0) {
        const lastLog = state.log[0];
        // We don't have choices in the log, so we'll show generic ones
        setChoices([
          'Weiter voranschreiten',
          'Vorsichtiger vorgehen',
          'Die Umgebung genauer untersuchen',
          'Einen anderen Weg einschlagen',
        ]);
      } else {
        setChoices([
          'Erkunde die Umgebung',
          'Sprich mit einem Fremden',
          'Suche nach Vorräten',
          'Sieh dich nach Gefahren um',
        ]);
      }
      navigate('/game');
    } catch (err) {
      console.error('Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const lastSave = saves[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center h-full px-6 gap-8"
    >
      {/* Logo & Title */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 120 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="text-6xl mb-4"
        >
          🎲
        </motion.div>
        <h1 className="text-5xl font-extrabold glow-text text-primary tracking-wider">
          TRPG
        </h1>
        <p className="text-text/50 text-sm mt-2 tracking-widest uppercase">
          Text Adventure
        </p>
      </motion.div>

      {/* Action Buttons */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        {/* Weiterspielen — last save */}
        {lastSave && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleContinue(lastSave)}
            className="w-full py-4 rounded-2xl font-semibold text-lg text-white
              bg-gradient-to-r from-success to-emerald-500
              shadow-lg shadow-success/30
              hover:shadow-xl hover:shadow-success/40
              transition-shadow duration-300
              flex items-center justify-center gap-3
              min-h-[56px]"
          >
            <Play size={22} />
            Weiterspielen
          </motion.button>
        )}

        {/* Neues Abenteuer */}
        <button
          onClick={() => navigate('/settings')}
          className="w-full py-4 rounded-2xl font-semibold text-lg text-white
            bg-gradient-to-r from-primary to-blue-500
            shadow-lg shadow-primary/30
            active:shadow-xl active:shadow-primary/40
            transition-shadow duration-300
            flex items-center justify-center gap-3
            min-h-[56px]
            cursor-pointer
            select-none"
        >
          <Swords size={22} />
          Neues Abenteuer
        </button>

        {/* Abenteuer laden — shows save list */}
        {saves.length > 1 && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              haptic('light');
              setShowSaves(!showSaves);
            }}
            className="w-full py-4 rounded-2xl font-semibold text-lg
              glass text-text/80
              hover:text-text hover:border-primary/30
              transition-all duration-300
              flex items-center justify-center gap-3
              min-h-[56px]"
          >
            <FolderOpen size={22} />
            Abenteuer laden
          </motion.button>
        )}
      </div>

      {/* Save List */}
      <AnimatePresence>
        {showSaves && saves.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-xs overflow-hidden"
          >
            <div className="glass rounded-2xl p-3 space-y-2 max-h-60 overflow-y-auto">
              {saves.map((save, i) => (
                <motion.button
                  key={save.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleContinue(save)}
                  className="w-full p-3 rounded-xl bg-bg-dark/40 hover:bg-primary/10 transition-colors text-left flex items-center gap-3 min-h-[52px]"
                >
                  <Clock size={14} className="text-text/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{save.name}</div>
                    <div className="text-[10px] text-text/30 flex gap-2">
                      <span className="capitalize">{save.setting}</span>
                      <span>·</span>
                      <span>{new Date(save.updated_at).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version */}
      <p className="text-text/20 text-xs">v2.0 · Phase 2-3</p>
    </motion.div>
  );
}
