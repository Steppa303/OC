import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Backpack, User, Settings, Sword, ScrollText, Globe } from 'lucide-react';
import useGameStore from '../store';
import InventoryPanel from './InventoryPanel';
import CharacterSheet from './CharacterSheet';
import GameLog from './GameLog';
import WorldHistory from './WorldHistory';
import LevelUpOverlay from './LevelUpOverlay';

function StatBar({ label, current, max, color }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text/60 w-8">{label}</span>
      <div className="flex-1 h-2 bg-bg-dark/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bar-transition ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-text/80 font-mono text-[11px] w-12 text-right">
        {current}/{max}
      </span>
    </div>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const character = useGameStore((s) => s.character);
  const saveId = useGameStore((s) => s.saveId);
  const toggleInventory = useGameStore((s) => s.toggleInventory);
  const toggleCharSheet = useGameStore((s) => s.toggleCharSheet);
  const toggleLog = useGameStore((s) => s.toggleLog);
  const showInventory = useGameStore((s) => s.showInventory);
  const showCharSheet = useGameStore((s) => s.showCharSheet);
  const showLog = useGameStore((s) => s.showLog);
  const worldId = useGameStore((s) => s.worldId);
  const showWorld = useGameStore((s) => s.showWorld);
  const toggleWorld = useGameStore((s) => s.toggleWorld);

  const inGame = location.pathname === '/game' && character;
  const isStart = location.pathname === '/';

  return (
    <div className="flex flex-col h-full bg-bg-dark overflow-hidden">
      {/* Header with HP/Mana bars — only visible during game */}
      {inGame && (
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass px-4 py-2 flex flex-col gap-1 z-40"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sword size={14} className="text-primary" />
              <span className="text-sm font-semibold">{character.name}</span>
              <span className="text-xs text-text/40">Lv{character.level}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-text/60">
              <span>⭐ {character.xp} XP</span>
              <span>💰 {character.gold}g</span>
            </div>
          </div>
          <StatBar
            label="HP"
            current={character.hp}
            max={character.max_hp}
            color="bg-gradient-to-r from-danger to-red-400"
          />
          {character.max_mana > 0 && (
            <StatBar
              label="MP"
              current={character.mana}
              max={character.max_mana}
              color="bg-gradient-to-r from-primary to-blue-400"
            />
          )}
        </motion.header>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Navigation — only visible during game */}
      {inGame && (
        <motion.nav
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass flex items-center justify-around py-2 z-40"
        >
          <button
            onClick={toggleInventory}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center ${
              showInventory ? 'text-primary bg-primary/10' : 'text-text/60 active:text-primary'
            }`}
          >
            <Backpack size={20} />
            <span className="text-[10px]">Inventar</span>
          </button>
          <button
            onClick={() => navigate('/game')}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors text-text/60 active:text-primary min-w-[44px] min-h-[44px] justify-center"
          >
            <Sword size={20} />
            <span className="text-[10px]">Spiel</span>
          </button>
          <button
            onClick={toggleCharSheet}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center ${
              showCharSheet ? 'text-primary bg-primary/10' : 'text-text/60 active:text-primary'
            }`}
          >
            <User size={20} />
            <span className="text-[10px]">Charakter</span>
          </button>
          <button
            onClick={toggleLog}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center ${
              showLog ? 'text-primary bg-primary/10' : 'text-text/60 active:text-primary'
            }`}
          >
            <ScrollText size={20} />
            <span className="text-[10px]">Log</span>
          </button>
          {worldId && (
            <button
              onClick={toggleWorld}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center ${
                showWorld ? 'text-primary bg-primary/10' : 'text-text/60 active:text-primary'
              }`}
            >
              <Globe size={20} />
              <span className="text-[10px]">Welt</span>
            </button>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors text-text/60 active:text-primary min-w-[44px] min-h-[44px] justify-center"
          >
            <Settings size={20} />
            <span className="text-[10px]">Einstellungen</span>
          </button>
        </motion.nav>
      )}

      {/* Slide-over panels */}
      <AnimatePresence>
        {showInventory && inGame && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex"
            onClick={(e) => e.target === e.currentTarget && toggleInventory()}
          >
            <div className="ml-auto w-full max-w-sm h-full bg-card-bg border-l border-primary/20 overflow-y-auto">
              <InventoryPanel embedded />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCharSheet && inGame && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex"
            onClick={(e) => e.target === e.currentTarget && toggleCharSheet()}
          >
            <div className="mr-auto w-full max-w-sm h-full bg-card-bg border-r border-primary/20 overflow-y-auto">
              <CharacterSheet embedded />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLog && inGame && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex"
            onClick={(e) => e.target === e.currentTarget && toggleLog()}
          >
            <div className="ml-auto w-full max-w-sm h-full bg-card-bg border-l border-primary/20 overflow-y-auto">
              <GameLog embedded />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWorld && inGame && worldId && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex"
            onClick={(e) => e.target === e.currentTarget && toggleWorld()}
          >
            <div className="ml-auto w-full max-w-sm h-full bg-card-bg border-l border-primary/20 overflow-y-auto">
              <WorldHistory worldId={worldId} embedded />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up Overlay */}
      <LevelUpOverlay />
    </div>
  );
}
