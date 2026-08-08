import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import useGameStore from '../store';

export default function LevelUpOverlay() {
  const levelUp = useGameStore((s) => s.levelUp);
  const setLevelUp = useGameStore((s) => s.setLevelUp);
  const character = useGameStore((s) => s.character);

  useEffect(() => {
    if (!levelUp) return;
    const timer = setTimeout(() => setLevelUp(false), 3500);
    return () => clearTimeout(timer);
  }, [levelUp, setLevelUp]);

  return (
    <AnimatePresence>
      {levelUp && character && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setLevelUp(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
        >
          {/* Glow background */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 0.4, 0.15] }}
            transition={{ duration: 1, times: [0, 0.4, 1] }}
            className="absolute w-64 h-64 rounded-full bg-gold blur-3xl"
          />

          <motion.div
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
            className="relative z-10 text-center space-y-6"
          >
            {/* Stars */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-2"
            >
              <Sparkles size={24} className="text-gold" />
              <Sparkles size={32} className="text-gold" />
              <Sparkles size={24} className="text-gold" />
            </motion.div>

            {/* Main text */}
            <motion.h1
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 8, stiffness: 150, delay: 0.2 }}
              className="text-5xl font-extrabold tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 40px rgba(245, 158, 11, 0.5)',
                filter: 'drop-shadow(0 0 20px rgba(245, 158, 11, 0.4))',
              }}
            >
              LEVEL UP!
            </motion.h1>

            {/* Level info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-2xl p-4 inline-block space-y-2"
            >
              <p className="text-lg font-semibold text-gold">
                Level {character.level}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-text/70">
                <div className="flex justify-between">
                  <span className="text-text/40">HP</span>
                  <span className="text-success">{character.max_hp}</span>
                </div>
                {character.max_mana > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text/40">Mana</span>
                    <span className="text-primary">{character.max_mana}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text/40">XP</span>
                  <span className="text-gold">{character.xp}</span>
                </div>
              </div>
            </motion.div>

            {/* Tap hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 1 }}
              className="text-xs text-text/30"
            >
              Tippen zum Schließen
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
