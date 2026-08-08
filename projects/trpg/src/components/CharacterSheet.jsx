import { motion } from 'framer-motion';
import { X, Heart, Zap, Star, Shield, Sword } from 'lucide-react';
import useGameStore from '../store';

const statLabels = { str: 'Stärke', dex: 'Geschick', con: 'Konstitution', int: 'Intelligenz', wis: 'Weisheit', cha: 'Charisma' };

export default function CharacterSheet({ embedded = false }) {
  const character = useGameStore((s) => s.character);
  const toggleCharSheet = useGameStore((s) => s.toggleCharSheet);

  if (!character) return <div className="p-4 text-text/40 text-sm">Kein Charakter geladen.</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-primary/10">
        <h2 className="text-lg font-bold">{character.name}</h2>
        {embedded && (
          <button onClick={toggleCharSheet} className="p-2 rounded-lg text-text/40 hover:text-text min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Info Card */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              <span className="text-sm font-semibold">{character.class_name}</span>
            </div>
            <span className="text-xs text-text/40">Level {character.level}</span>
          </div>

          {/* XP Bar */}
          <div>
            <div className="flex justify-between text-xs text-text/40 mb-1">
              <span>XP</span>
              <span>{character.xp}</span>
            </div>
            <div className="h-1.5 bg-bg-dark/80 rounded-full overflow-hidden">
              <div className="h-full bg-gold/60 rounded-full bar-transition" style={{ width: `${Math.min((character.xp % 100), 100)}%` }} />
            </div>
          </div>

          {/* HP / Mana */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-danger" />
              <div className="flex-1">
                <div className="h-2 bg-bg-dark/80 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-danger to-red-400 rounded-full bar-transition" style={{ width: `${(character.hp / character.max_hp) * 100}%` }} />
                </div>
                <div className="text-xs text-text/40 mt-1">{character.hp}/{character.max_hp}</div>
              </div>
            </div>
            {character.max_mana > 0 && (
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-primary" />
                <div className="flex-1">
                  <div className="h-2 bg-bg-dark/80 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full bar-transition" style={{ width: `${(character.mana / character.max_mana) * 100}%` }} />
                  </div>
                  <div className="text-xs text-text/40 mt-1">{character.mana}/{character.max_mana}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-text/60">
            <span>💰 {character.gold} Gold</span>
            <span className={character.status === 'alive' ? 'text-success' : 'text-danger'}>
              {character.status === 'alive' ? '✅ Lebendig' : '💀 Tot'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 text-text/60">Attribute</h3>
          <div className="grid grid-cols-3 gap-2">
            {character.stats && Object.entries(character.stats).map(([key, val]) => (
              <div key={key} className="text-center p-2 rounded-xl bg-bg-dark/40">
                <div className="text-xs text-text/40">{statLabels[key]}</div>
                <div className="text-lg font-bold">{val}</div>
                <div className="text-xs text-primary/60">
                  {Math.floor((val - 10) / 2) >= 0 ? '+' : ''}{Math.floor((val - 10) / 2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        {character.skills?.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold mb-3 text-text/60">Fähigkeiten</h3>
            <div className="flex flex-wrap gap-2">
              {character.skills.map((s) => (
                <span key={s} className="text-xs px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
