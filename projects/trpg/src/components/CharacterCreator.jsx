import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Dices, Check, Shield, Swords } from 'lucide-react';
import useGameStore from '../store';
import { api } from '../lib/api';

function haptic(type = 'medium') {
  try {
    const tg = window.Telegram?.WebApp?.HapticFeedback;
    if (!tg) return;
    if (type === 'success') tg.notificationOccurred('success');
    else if (type === 'error') tg.notificationOccurred('error');
    else tg.impactOccurred(type);
  } catch (e) {
    // ignore haptic errors
  }
}

function rollStats() {
  const stats = {};
  for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => a - b);
    stats[key] = rolls[1] + rolls[2] + rolls[3];
  }
  return stats;
}

const statLabels = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export default function CharacterCreator() {
  const navigate = useNavigate();
  const location = useLocation();
  const worldId = location.state?.worldId || null;
  const worldName = location.state?.worldName || null;
  const setting = useGameStore((s) => s.setting);
  const user = useGameStore((s) => s.user);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const setSaveId = useGameStore((s) => s.setSaveId);
  const setCurrentScene = useGameStore((s) => s.setCurrentScene);
  const setChoices = useGameStore((s) => s.setChoices);
  const setInventory = useGameStore((s) => s.setInventory);
  const setEquipment = useGameStore((s) => s.setEquipment);
  const setWorld = useGameStore((s) => s.setWorld);

  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [stats, setStats] = useState(rollStats());
  const [rolling, setRolling] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const classes = setting?.classes || [];

  // Redirect if no setting selected
  useEffect(() => {
    if (!setting) {
      navigate('/settings', { replace: true });
    }
  }, [setting, navigate]);

  const handleRoll = () => {
    haptic('heavy');
    setRolling(true);
    setTimeout(() => {
      setStats(rollStats());
      setRolling(false);
    }, 600);
  };

  const handleCreate = async () => {
    if (!name.trim() || !selectedClass || creating) return;

    setError('');
    haptic('medium');
    setCreating(true);

    try {
      const hp = selectedClass.base_hp + Math.floor((stats.con - 10) / 2);
      const mana = selectedClass.mana || 0;

      const result = await api.createGame({
        user_id: user?.userId || 'test:0',
        setting: setting?.slug || 'fantasy',
        character: {
          name: name.trim(),
          class_name: selectedClass.name,
          stats,
          hp,
          max_hp: hp,
          mana,
          max_mana: mana,
        },
        world_id: worldId,
      });

      // Set all state BEFORE navigating
      setCharacter({
        name: name.trim(),
        class_name: selectedClass.name,
        level: 1,
        xp: 0,
        hp,
        max_hp: hp,
        mana,
        max_mana: mana,
        stats,
        skills: selectedClass.skills || [],
        gold: 0,
        status: 'alive',
      });
      setSaveId(result.save_id);
      setCurrentScene(result.opening_scene);
      setChoices(result.choices || []);
      setInventory(result.starting_items || []);
      setEquipment({ weapon: null, armor: null, shield: null, acc1: null, acc2: null });

      // Set world state if we have a world
      if (result.world_id) {
        try {
          const worldData = await api.getWorld(result.world_id);
          setWorld(result.world_id, worldData.world_state || {});
        } catch {
          setWorld(result.world_id, {});
        }
      }

      haptic('success');

      // Use React Router navigate — preserves Zustand state
      navigate('/game', { replace: true });
    } catch (e) {
      console.error('Create game failed:', e);
      haptic('error');
      setError('Fehler: ' + (e.message || 'Unbekannt. Bitte erneut versuchen.'));
    } finally {
      setCreating(false);
    }
  };

  if (!setting) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl glass text-text/60 active:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Charakter erstellen</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {/* Name */}
        <div>
          <label className="text-sm text-text/60 mb-2 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Dein Name..."
            maxLength={24}
            className="w-full px-4 py-3 rounded-xl glass bg-card-bg/80 text-text placeholder-text/30 outline-none focus:border-primary/50 border border-transparent transition-colors"
          />
        </div>

        {/* Class Selection */}
        <div>
          <label className="text-sm text-text/60 mb-2 block">Klasse</label>
          {classes.length === 0 ? (
            <p className="text-xs text-text/30">Keine Klassen verfügbar. Geh zurück und wähle ein Setting.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {classes.map((c) => (
                <motion.button
                  key={c.name}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    haptic('light');
                    setSelectedClass(c);
                    setError('');
                  }}
                  className={`p-3 rounded-xl text-left flex gap-3 items-center transition-all min-h-[56px] ${
                    selectedClass?.name === c.name
                      ? 'bg-primary/20 border border-primary/50'
                      : 'glass hover:border-primary/20'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${selectedClass?.name === c.name ? 'bg-primary/30' : 'bg-primary/10'}`}>
                    {['Krieger', 'Söldner', 'Solo', 'Überlebender'].includes(c.name) ? (
                      <Swords size={18} className="text-primary" />
                    ) : (
                      <Shield size={18} className="text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-text/40">{c.desc}</div>
                  </div>
                  {selectedClass?.name === c.name && <Check size={18} className="text-primary" />}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-text/60">Attribute</label>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRoll}
              disabled={rolling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium active:bg-primary/20 min-h-[36px]"
            >
              <motion.div animate={rolling ? { rotate: 360 } : {}} transition={{ duration: 0.5 }}>
                <Dices size={14} />
              </motion.div>
              Neu würfeln
            </motion.button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats).map(([key, val]) => (
              <motion.div
                key={key}
                animate={rolling ? { scale: [1, 0.9, 1.1, 1] } : {}}
                className="glass rounded-xl p-3 text-center"
              >
                <div className="text-xs text-text/40 mb-1">{statLabels[key]}</div>
                <div className="text-xl font-bold text-text">{val}</div>
                <div className="text-xs text-primary/60">
                  {Math.floor((val - 10) / 2) >= 0 ? '+' : ''}
                  {Math.floor((val - 10) / 2)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Preview */}
        {selectedClass && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-4 space-y-2">
            <h3 className="font-semibold text-sm text-primary">Vorschau</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-text/60">
              <div>Name: <span className="text-text">{name || '—'}</span></div>
              <div>Klasse: <span className="text-text">{selectedClass.name}</span></div>
              <div>HP: <span className="text-success">{selectedClass.base_hp + Math.floor((stats.con - 10) / 2)}</span></div>
              {selectedClass.mana > 0 && (
                <div>Mana: <span className="text-primary">{selectedClass.mana}</span></div>
              )}
            </div>
            {selectedClass.skills?.length > 0 && (
              <div className="flex gap-1 flex-wrap pt-1">
                {selectedClass.skills.map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-3 border-danger/40 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}
      </div>

      {/* Create Button */}
      <div className="px-4 py-4">
        {(!name.trim() || !selectedClass) && (
          <p className="text-xs text-danger/80 text-center mb-2">
            {!name.trim() ? '⚠️ Gib deinem Charakter einen Namen' : '⚠️ Wähle eine Klasse'}
          </p>
        )}
        <button
          onClick={handleCreate}
          disabled={!name.trim() || !selectedClass || creating}
          className="w-full py-4 rounded-2xl font-semibold text-white text-lg
            bg-gradient-to-r from-primary to-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-primary/30
            active:shadow-xl
            flex items-center justify-center gap-2
            min-h-[56px]
            cursor-pointer select-none"
        >
          {creating ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Wird erstellt...</span>
            </div>
          ) : (
            <>
              <Swords size={20} />
              Abenteuer beginnen
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
