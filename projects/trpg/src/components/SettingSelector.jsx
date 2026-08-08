import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Rocket, Skull, Ghost, Cpu, Sparkles, ArrowLeft, Globe, Plus, MapPin, Users, ChevronRight } from 'lucide-react';
import useGameStore from '../store';
import { api } from '../lib/api';

const settingIcons = {
  fantasy: Wand2,
  scifi: Rocket,
  postapo: Skull,
  horror: Ghost,
  cyberpunk: Cpu,
};

const settingGradients = {
  fantasy: 'from-amber-500/20 to-gold/20',
  scifi: 'from-cyan-500/20 to-blue-500/20',
  postapo: 'from-green-700/20 to-yellow-700/20',
  horror: 'from-red-900/20 to-purple-900/20',
  cyberpunk: 'from-pink-500/20 to-violet-500/20',
};

function haptic(style = 'medium') {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
}

export default function SettingSelector() {
  const navigate = useNavigate();
  const setSetting = useGameStore((s) => s.setSetting);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  // World selection state
  const [selectedSetting, setSelectedSetting] = useState(null);
  const [worlds, setWorlds] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [worldsLoading, setWorldsLoading] = useState(false);
  const [showArcSelect, setShowArcSelect] = useState(false);
  const [creatingWorld, setCreatingWorld] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectSetting = async (s) => {
    haptic('medium');
    setSelectedSetting(s);
    setWorldsLoading(true);

    try {
      const [worldList, arcList] = await Promise.all([
        api.getWorlds(s.slug),
        api.getArcs(s.slug),
      ]);
      setWorlds(worldList);
      setArcs(arcList);
    } catch {
      setWorlds([]);
      setArcs([]);
    } finally {
      setWorldsLoading(false);
    }
  };

  const handleSelectWorld = (world) => {
    haptic('medium');
    setSetting(selectedSetting);
    navigate('/create', { state: { worldId: world.id, worldName: world.name } });
  };

  const handleNewWorld = () => {
    haptic('medium');
    setShowArcSelect(true);
  };

  const handleSelectArc = async (arcId) => {
    haptic('heavy');
    setCreatingWorld(true);

    try {
      const result = await api.createWorld({
        setting_slug: selectedSetting.slug,
        arc_id: arcId,
      });
      setSetting(selectedSetting);
      navigate('/create', { state: { worldId: result.world_id, worldName: result.world_name, isNew: true } });
    } catch (err) {
      console.error('World creation failed:', err);
    } finally {
      setCreatingWorld(false);
    }
  };

  const handleBack = () => {
    if (showArcSelect) {
      setShowArcSelect(false);
    } else if (selectedSetting) {
      setSelectedSetting(null);
    } else {
      navigate('/');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={handleBack}
          className="p-2 rounded-xl glass text-text/60 active:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">
          {showArcSelect ? 'Arc wählen' : selectedSetting ? `${selectedSetting.name} — Welten` : 'Setting wählen'}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Loading */}
        {(loading || worldsLoading) && (
          <div className="flex items-center justify-center h-40">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        )}

        {/* Step 1: Setting Selection */}
        {!selectedSetting && !loading && (
          <div className="grid grid-cols-1 gap-3">
            {settings.map((s, i) => {
              const Icon = settingIcons[s.slug] || Sparkles;
              const grad = settingGradients[s.slug] || 'from-primary/20 to-blue-500/20';
              return (
                <motion.button
                  key={s.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectSetting(s)}
                  className={`glass rounded-2xl p-4 text-left flex gap-4 items-start bg-gradient-to-br ${grad} hover:border-primary/30 transition-colors min-h-[72px]`}
                >
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Icon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text">{s.name}</h3>
                    <p className="text-xs text-text/50 mt-1 line-clamp-2">{s.description}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {s.classes?.slice(0, 3).map((c) => (
                        <span key={c.name} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80">
                          {c.name}
                        </span>
                      ))}
                      {s.classes?.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80">
                          +{s.classes.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Step 2: World Selection */}
        {selectedSetting && !showArcSelect && !worldsLoading && (
          <div className="space-y-3">
            {/* New World Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNewWorld}
              className="w-full glass rounded-2xl p-4 text-left flex gap-4 items-center border-dashed border-primary/30 hover:border-primary/60 transition-colors"
            >
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-primary">Neue Welt erschaffen</h3>
                <p className="text-xs text-text/50 mt-0.5">Eine neue Welt mit Arc-Story erstellen</p>
              </div>
            </motion.button>

            {/* Existing Worlds */}
            {worlds.length > 0 && (
              <>
                <p className="text-xs text-text/40 px-1">Existierende Welten</p>
                {worlds.map((w, i) => (
                  <motion.button
                    key={w.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (i + 1) * 0.08 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectWorld(w)}
                    className="w-full glass rounded-2xl p-4 text-left hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Globe size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text text-sm truncate">{w.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text/50">
                          {w.arc_name && <span>📖 {w.arc_name}</span>}
                          <span>Akt {w.current_act}/3</span>
                          <span>{w.save_count} Spiel{w.save_count !== 1 ? 'e' : ''}</span>
                        </div>
                        {/* Tension bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-bg-dark/80 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                              style={{ width: `${w.tension || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-text/40">{w.tension || 0}%</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-text/30" />
                    </div>
                  </motion.button>
                ))}
              </>
            )}

            {worlds.length === 0 && (
              <div className="text-center py-8 text-text/30">
                <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Noch keine Welten erschaffen</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Arc Selection */}
        {showArcSelect && !worldsLoading && (
          <div className="space-y-3">
            {creatingWorld ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                />
                <p className="text-sm text-text/50">Welt wird erschaffen...</p>
              </div>
            ) : (
              <>
                {/* Random Arc */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectArc(null)}
                  className="w-full glass rounded-2xl p-4 text-left flex gap-4 items-center border-dashed border-primary/30 hover:border-primary/60 transition-colors"
                >
                  <div className="p-2 rounded-xl bg-primary/20 text-primary">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Zufälliger Arc</h3>
                    <p className="text-xs text-text/50 mt-0.5">Der Spielleiter wählt einen passenden Arc</p>
                  </div>
                </motion.button>

                {/* Specific Arcs */}
                {arcs.map((a, i) => (
                  <motion.button
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (i + 1) * 0.08 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectArc(a.id)}
                    className="w-full glass rounded-2xl p-4 text-left hover:border-primary/30 transition-colors"
                  >
                    <h3 className="font-semibold text-text text-sm">{a.name}</h3>
                    <p className="text-xs text-text/50 mt-1 line-clamp-2">{a.premise}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-text/40">
                      <span>🎭 {a.antagonist_type}</span>
                      <span>•</span>
                      <span>{a.acts?.length || 3} Akte</span>
                    </div>
                  </motion.button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
