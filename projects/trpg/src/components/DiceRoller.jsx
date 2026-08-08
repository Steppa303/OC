import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store';
import { useEffect, useState } from 'react';

const resultColor = (val) => {
  if (val === 20) return 'text-gold';
  if (val >= 15) return 'text-success';
  if (val >= 10) return 'text-yellow-400';
  if (val >= 2) return 'text-danger';
  return 'text-red-900';
};

const resultBg = (val) => {
  if (val === 20) return 'from-gold/30 to-amber-500/20';
  if (val >= 15) return 'from-success/20 to-green-400/20';
  if (val >= 10) return 'from-yellow-500/20 to-yellow-400/20';
  if (val >= 2) return 'from-danger/20 to-red-400/20';
  return 'from-red-900/30 to-red-700/20';
};

const resultGlow = (val) => {
  if (val === 20) return '0 0 30px rgba(245, 158, 11, 0.5)';
  if (val >= 15) return '0 0 20px rgba(34, 197, 94, 0.3)';
  if (val >= 10) return '0 0 15px rgba(234, 179, 8, 0.2)';
  if (val >= 2) return '0 0 15px rgba(239, 68, 68, 0.3)';
  return '0 0 25px rgba(127, 29, 29, 0.5)';
};

const resultLabel = (val) => {
  if (val === 20) return 'KRITISCHER ERFOLG!';
  if (val >= 15) return 'Erfolg!';
  if (val >= 10) return 'Teilerfolg';
  if (val >= 2) return 'Misserfolg';
  return 'PATZER!';
};

const resultEmoji = (val) => {
  if (val === 20) return '🌟';
  if (val >= 15) return '✅';
  if (val >= 10) return '⚡';
  if (val >= 2) return '❌';
  return '💀';
};

export default function DiceRoller() {
  const diceResult = useGameStore((s) => s.diceResult);
  const diceRolling = useGameStore((s) => s.diceRolling);
  const [phase, setPhase] = useState('idle'); // idle, shake, spin, bounce, reveal
  const [flickerNum, setFlickerNum] = useState(0);

  useEffect(() => {
    if (diceRolling) {
      setPhase('shake');

      // Shake → Spin
      const t1 = setTimeout(() => setPhase('spin'), 300);
      // Spin → Bounce (when result arrives)
      return () => clearTimeout(t1);
    }
  }, [diceRolling]);

  useEffect(() => {
    if (diceResult && phase === 'spin') {
      // Spin → Bounce → Reveal
      const t1 = setTimeout(() => setPhase('bounce'), 200);
      const t2 = setTimeout(() => setPhase('reveal'), 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [diceResult, phase]);

  // Flickering number effect during spin
  useEffect(() => {
    if (phase === 'spin') {
      const interval = setInterval(() => {
        setFlickerNum(Math.floor(Math.random() * 20) + 1);
      }, 60);
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Reset after reveal
  useEffect(() => {
    if (phase === 'reveal') {
      const t = setTimeout(() => setPhase('idle'), 3000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'idle' && !diceResult) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="flex justify-center py-4"
      >
        <motion.div
          className={`glass rounded-2xl p-6 text-center bg-gradient-to-br ${
            diceResult ? resultBg(diceResult.total) : 'from-primary/20 to-blue-500/20'
          }`}
          style={{
            boxShadow: diceResult && phase === 'reveal' ? resultGlow(diceResult.total) : 'none',
          }}
          animate={
            phase === 'shake'
              ? {
                  x: [0, -8, 8, -6, 6, -3, 3, 0],
                  rotate: [0, -2, 2, -1, 1, 0],
                }
              : phase === 'bounce'
              ? { y: [0, -20, 0, -8, 0] }
              : {}
          }
          transition={
            phase === 'shake'
              ? { duration: 0.3, ease: 'easeInOut' }
              : phase === 'bounce'
              ? { duration: 0.4, ease: 'easeOut' }
              : {}
          }
        >
          {/* Dice Icon */}
          <motion.div
            animate={
              phase === 'shake'
                ? { rotate: [0, -15, 15, -10, 10, 0] }
                : phase === 'spin'
                ? { rotateY: [0, 360], scale: [1, 0.8, 1.2, 1] }
                : phase === 'bounce'
                ? { scale: [1.2, 1] }
                : {}
            }
            transition={
              phase === 'shake'
                ? { duration: 0.3, repeat: 0 }
                : phase === 'spin'
                ? { duration: 0.6, repeat: Infinity, ease: 'linear' }
                : phase === 'bounce'
                ? { duration: 0.3, ease: 'easeOut' }
                : {}
            }
            className="text-5xl mb-3 select-none"
            style={{ perspective: '200px' }}
          >
            🎲
          </motion.div>

          {/* Rolling text */}
          {phase === 'shake' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="text-sm text-text/60 font-medium"
            >
              Würfel rollt...
            </motion.p>
          )}

          {/* Flickering number during spin */}
          {phase === 'spin' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-3xl font-extrabold text-primary/60 tabular-nums"
            >
              {flickerNum}
            </motion.div>
          )}

          {/* Result */}
          {diceResult && (phase === 'bounce' || phase === 'reveal') && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                phase === 'reveal'
                  ? { type: 'spring', stiffness: 300, damping: 15 }
                  : { duration: 0.2 }
              }
            >
              {/* Emoji */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
                className="text-2xl mb-1"
              >
                {resultEmoji(diceResult.total)}
              </motion.div>

              {/* Total */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className={`text-5xl font-extrabold ${resultColor(diceResult.total)} tabular-nums`}
              >
                {diceResult.total}
              </motion.div>

              {/* Breakdown */}
              <div className="text-xs text-text/40 mt-2 space-y-0.5">
                <div>
                  W20: <span className="text-text/70">{diceResult.result}</span>
                  {diceResult.bonus ? (
                    <>
                      {' + '}
                      <span className="text-primary">{diceResult.bonus}</span>
                    </>
                  ) : null}
                  {diceResult.dc ? (
                    <>
                      {' vs DC '}
                      <span className="text-text/70">{diceResult.dc}</span>
                    </>
                  ) : null}
                </div>
                {diceResult.skill && (
                  <div className="text-text/30">Skill: {diceResult.skill}</div>
                )}
              </div>

              {/* Label */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`text-sm font-bold mt-3 ${resultColor(diceResult.total)}`}
              >
                {resultLabel(diceResult.total)}
              </motion.div>

              {/* DC Comparison */}
              {diceResult.dc && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-xs text-text/30 mt-1"
                >
                  {diceResult.total} {diceResult.success ? '≥' : '<'} {diceResult.dc}
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
