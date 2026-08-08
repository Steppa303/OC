import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronDown } from 'lucide-react';
import useGameStore from '../store';
import DiceRoller from './DiceRoller';
import { api } from '../lib/api';

function haptic(style = 'medium') {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
}

function hapticNotification(type) {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
}

export default function GameView() {
  const currentScene = useGameStore((s) => s.currentScene);
  const choices = useGameStore((s) => s.choices);
  const loading = useGameStore((s) => s.loading);
  const saveId = useGameStore((s) => s.saveId);
  const character = useGameStore((s) => s.character);
  const setLoading = useGameStore((s) => s.setLoading);
  const setCurrentScene = useGameStore((s) => s.setCurrentScene);
  const setChoices = useGameStore((s) => s.setChoices);
  const setDiceResult = useGameStore((s) => s.setDiceResult);
  const startDiceRoll = useGameStore((s) => s.startDiceRoll);
  const updateHP = useGameStore((s) => s.updateHP);
  const updateMana = useGameStore((s) => s.updateMana);
  const updateXP = useGameStore((s) => s.updateXP);
  const updateGold = useGameStore((s) => s.updateGold);
  const addItem = useGameStore((s) => s.addItem);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const addLogEntry = useGameStore((s) => s.addLogEntry);
  const setLevelUp = useGameStore((s) => s.setLevelUp);
  const setWorld = useGameStore((s) => s.setWorld);
  const currentAct = useGameStore((s) => s.currentAct);
  const tension = useGameStore((s) => s.tension);
  const quests = useGameStore((s) => s.quests);
  const arcName = useGameStore((s) => s.arcName);
  const prevLevelRef = useRef(null);
  const [sceneHistory, setSceneHistory] = useState([]);
  const [freetext, setFreetext] = useState('');
  const [showCollapsed, setShowCollapsed] = useState(false);
  const scrollRef = useRef(null);

  const worldId = useGameStore((s) => s.worldId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentScene, sceneHistory]);

  // Load game state (including world) on mount if saveId exists but world not set
  useEffect(() => {
    if (saveId && !worldId) {
      api.getState(saveId).then((state) => {
        if (state.save?.game_state?.world_id) {
          api.getWorld(state.save.game_state.world_id).then((w) => {
            setWorld(w.id, w.world_state || {});
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [saveId, worldId]);

  const handleAction = async (action, isFreetext = false) => {
    if (!saveId || loading) return;

    haptic('medium');
    setLoading(true);

    // Add user action to history
    setSceneHistory((prev) => [...prev, { type: 'action', text: action }]);

    try {
      // Start dice animation
      startDiceRoll();

      const result = await api.sendAction({
        save_id: saveId,
        action,
        is_freetext: isFreetext,
      });

      // Dice roll animation
      if (result.dice_roll) {
        // Small delay for dramatic effect
        await new Promise((r) => setTimeout(r, 400));
        setDiceResult(result.dice_roll);

        // Haptic based on result
        if (result.dice_roll.result === 20) {
          hapticNotification('success');
        } else if (result.dice_roll.result === 1) {
          hapticNotification('error');
        } else if (result.dice_roll.success) {
          haptic('heavy');
        } else {
          haptic('light');
        }

        // Wait for dice animation to finish
        await new Promise((r) => setTimeout(r, 1200));
      }

      // Update scene
      setCurrentScene(result.scene);
      setChoices(result.choices || []);

      // Add scene to history
      setSceneHistory((prev) => [
        ...prev,
        {
          type: 'scene',
          text: result.scene,
          dice: result.dice_roll,
          narrativeStyle: result.narrative_style,
        },
      ]);

      // Apply state changes
      if (result.state_changes) {
        const sc = result.state_changes;
        if (sc.hp) updateHP(sc.hp);
        if (sc.mana) updateMana(sc.mana);
        if (sc.xp) updateXP(sc.xp);
        if (sc.gold) updateGold(sc.gold);
        if (sc.items_added?.length) {
          sc.items_added.forEach((item) => addItem(item));
        }

        // Detect level-up from XP change
        if (sc.xp && character) {
          const oldLevel = character.level;
          const newXp = (character.xp || 0) + sc.xp;
          const newLevel = Math.floor(newXp / 100) + 1;
          if (newLevel > oldLevel) {
            setLevelUp(true);
          }
        }
      }

      // Update world state from action response
      if (result.world_state) {
        const ws = result.world_state;
        setWorld(ws.id || null, ws);
      }

      // Add to game log
      addLogEntry({
        id: Date.now(),
        turn_number: result.turn,
        user_action: action,
        dice_roll: result.dice_roll,
        ai_response: result.scene,
        state_changes: result.state_changes,
      });

      // Fetch updated character state periodically
      if (result.turn % 5 === 0) {
        try {
          const state = await api.getState(saveId);
          if (state.character) {
            const prevLevel = state.character.level;
            setCharacter({
              ...state.character,
              stats: state.character.stats || {},
              skills: state.character.skills || [],
            });
            // Detect level up
            if (prevLevelRef.current !== null && prevLevel > prevLevelRef.current) {
              setLevelUp(true);
            }
            prevLevelRef.current = prevLevel;
          }
        } catch {}
      }
    } catch (err) {
      console.error('Action failed:', err);
      hapticNotification('error');
      setSceneHistory((prev) => [
        ...prev,
        { type: 'error', text: 'Etwas ist schiefgelaufen. Versuch es nochmal.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = (choice) => {
    handleAction(choice, false);
  };

  const handleSend = () => {
    if (!freetext.trim()) return;
    handleAction(freetext.trim(), true);
    setFreetext('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full"
    >
      {/* Story Context Bar */}
      {arcName && (
        <div className="px-4 py-2 flex items-center gap-3 text-xs">
          <span className="text-primary/80 font-medium">📖 Akt {currentAct}/3</span>
          {tension > 0 && (
            <div className="flex items-center gap-1.5 flex-1">
              <div className="flex-1 h-1.5 bg-bg-dark/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                  style={{ width: `${tension}%` }}
                />
              </div>
              <span className="text-text/40 w-6 text-right">{tension}</span>
            </div>
          )}
          {quests.length > 0 && (
            <span className="text-text/50">⚔ {quests.filter(q => q.status === 'aktiv').length} Quests</span>
          )}
        </div>
      )}

      {/* Active Quest Badges */}
      {quests.filter(q => q.status === 'aktiv').length > 0 && (
        <div className="px-4 pb-1 flex gap-1 flex-wrap">
          {quests.filter(q => q.status === 'aktiv').slice(0, 2).map((q, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ⚔ {q.name}
            </span>
          ))}
        </div>
      )}

      {/* Scene Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Initial scene */}
        {currentScene && sceneHistory.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass rounded-2xl p-4"
          >
            <p className="text-sm leading-relaxed text-text/90 whitespace-pre-wrap">{currentScene}</p>
          </motion.div>
        )}

        {/* Scene history */}
        <AnimatePresence>
          {sceneHistory.map((entry, i) => {
            // After 5+ turns, collapse older scenes
            const totalScenes = sceneHistory.filter(e => e.type === 'scene').length;
            const sceneIndex = sceneHistory.slice(0, i + 1).filter(e => e.type === 'scene').length;
            const isOld = totalScenes >= 5 && entry.type === 'scene' && sceneIndex <= totalScenes - 3;

            if (isOld && !showCollapsed) {
              // Show collapsed summary for old scenes (only first collapsed)
              const prevEntry = sceneHistory[i - 1];
              if (prevEntry?.type === 'scene') return null; // skip duplicates
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowCollapsed(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-text/30 hover:text-text/50 transition-colors"
                >
                  <ChevronDown size={14} />
                  {totalScenes - 3} ältere Szenen anzeigen
                </motion.button>
              );
            }

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {entry.type === 'action' && (
                  <div className="flex justify-end mb-2">
                    <div className="bg-primary/20 border border-primary/30 rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
                      <p className="text-sm text-primary">{entry.text}</p>
                    </div>
                  </div>
                )}

                {entry.type === 'scene' && (
                  <div className="glass rounded-2xl p-4 space-y-2">
                    {entry.dice && (
                      <div className="flex items-center gap-2 text-xs text-text/40 mb-1">
                        <span>🎲</span>
                        <span>
                          W20: {entry.dice.result}
                          {entry.dice.bonus ? ` + ${entry.dice.bonus}` : ''} = {entry.dice.total}
                          {entry.dice.dc ? ` (DC ${entry.dice.dc})` : ''}
                        </span>
                        <span className={entry.dice.success ? 'text-success' : 'text-danger'}>
                          {entry.dice.success ? '✅' : '❌'}
                        </span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-text/90 whitespace-pre-wrap">{entry.text}</p>
                  </div>
                )}

                {entry.type === 'error' && (
                  <div className="glass rounded-2xl p-4 border-danger/30">
                    <p className="text-sm text-danger">{entry.text}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-4"
          >
            <div className="glass rounded-2xl px-6 py-3 flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
              />
              <span className="text-sm text-text/60">Der Spielleiter denkt nach...</span>
            </div>
          </motion.div>
        )}

        {/* Dice Roller */}
        <DiceRoller />
      </div>

      {/* Choices */}
      {choices.length > 0 && !loading && (
        <div className="px-4 pb-2 space-y-2">
          <AnimatePresence>
            {choices.map((choice, i) => (
              <motion.button
                key={`${choice}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice(choice)}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl glass text-sm text-left text-text/80
                  hover:border-primary/30 hover:text-text transition-all min-h-[44px] disabled:opacity-40"
              >
                {choice}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Freetext Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Oder schreib selbst..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl glass bg-card-bg/80 text-text text-sm placeholder-text/30 outline-none focus:border-primary/50 border border-transparent transition-colors min-h-[44px] disabled:opacity-40"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!freetext.trim() || loading}
            className="p-3 rounded-xl bg-primary/20 text-primary disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
