import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ScrollText, Dice5, CheckCircle2, XCircle } from 'lucide-react';
import useGameStore from '../store';
import { api } from '../lib/api';

function truncate(text, max = 120) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export default function GameLog({ embedded = false }) {
  const gameLog = useGameStore((s) => s.gameLog);
  const setGameLog = useGameStore((s) => s.setGameLog);
  const toggleLog = useGameStore((s) => s.toggleLog);
  const saveId = useGameStore((s) => s.saveId);

  useEffect(() => {
    if (!saveId) return;
    api
      .getGameLog(saveId)
      .then((data) => setGameLog(data))
      .catch(() => {});
  }, [saveId, setGameLog]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <ScrollText size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Spiel-Log</h2>
        </div>
        {embedded && (
          <button
            onClick={toggleLog}
            className="p-2 rounded-lg text-text/40 hover:text-text min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {gameLog.length === 0 ? (
          <div className="text-center py-12 text-text/20 text-sm">
            <ScrollText size={32} className="mx-auto mb-2 opacity-40" />
            Noch keine Einträge.
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-primary/10" />

            <div className="space-y-3">
              {[...gameLog].reverse().map((entry, i) => {
                const dice = entry.dice_roll;
                const isSuccess = dice?.success;
                const changes = entry.state_changes;

                return (
                  <motion.div
                    key={entry.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="relative pl-10"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 ${
                        isSuccess
                          ? 'bg-success/40 border-success'
                          : isSuccess === false
                          ? 'bg-danger/40 border-danger'
                          : 'bg-text/20 border-text/30'
                      }`}
                    />

                    <div className="glass rounded-xl p-3 space-y-1.5">
                      {/* Turn number + Action */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-primary/60 font-mono">
                            Turn {entry.turn_number}
                          </span>
                          <p className="text-sm font-medium text-text/90 truncate">
                            {entry.user_action}
                          </p>
                        </div>
                        {dice && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Dice5 size={12} className="text-text/30" />
                            <span className="text-xs font-mono text-text/60">
                              {dice.result}
                              {dice.bonus ? `+${dice.bonus}` : ''}
                            </span>
                            {isSuccess ? (
                              <CheckCircle2 size={14} className="text-success" />
                            ) : (
                              <XCircle size={14} className="text-danger" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Scene summary */}
                      <p className="text-[11px] text-text/50 leading-relaxed">
                        {truncate(entry.ai_response)}
                      </p>

                      {/* State changes */}
                      {changes && (changes.xp || changes.hp || changes.gold) && (
                        <div className="flex items-center gap-3 text-[10px] text-text/30 pt-1">
                          {changes.xp > 0 && (
                            <span className="text-gold">+{changes.xp} XP</span>
                          )}
                          {changes.hp > 0 && (
                            <span className="text-success">+{changes.hp} HP</span>
                          )}
                          {changes.hp < 0 && (
                            <span className="text-danger">{changes.hp} HP</span>
                          )}
                          {changes.gold > 0 && (
                            <span className="text-gold">+{changes.gold} Gold</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
