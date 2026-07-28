import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store.js';

const COLORS = [
  { key: 'default', label: 'Standard', dot: 'bg-primary' },
  { key: 'blue', label: 'Blau', dot: 'bg-blue-500' },
  { key: 'green', label: 'Grün', dot: 'bg-green-500' },
  { key: 'yellow', label: 'Gelb', dot: 'bg-yellow-500' },
  { key: 'red', label: 'Rot', dot: 'bg-red-500' },
  { key: 'purple', label: 'Lila', dot: 'bg-purple-500' },
  { key: 'orange', label: 'Orange', dot: 'bg-orange-500' },
];

export default function ContextMenu() {
  const contextMenu = useStore(s => s.contextMenu);
  const setContextMenu = useStore(s => s.setContextMenu);
  const items = useStore(s => s.items);
  const togglePin = useStore(s => s.togglePin);
  const changeColor = useStore(s => s.changeColor);
  const removeItem = useStore(s => s.removeItem);
  const duplicateSelected = useStore(s => s.duplicateSelected);
  const setSelected = useStore(s => s.setSelected);
  const setEditingId = useStore(s => s.setEditingId);
  const ref = useRef(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [contextMenu, setContextMenu]);

  const item = contextMenu ? items.find(i => i.id === contextMenu.itemId) : null;

  const menuStyle = contextMenu ? {
    left: Math.min(contextMenu.x, window.innerWidth - 220),
    top: Math.min(contextMenu.y, window.innerHeight - 340),
  } : {};

  return (
    <AnimatePresence>
      {contextMenu && item && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.92, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -4 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="context-menu fixed z-50 bg-bg-secondary/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-xl py-1.5 min-w-[200px]"
          style={menuStyle}
          data-ui
        >
          {/* Pin/Unpin */}
          <button
            className="context-item group"
            onPointerDown={(e) => {
              e.stopPropagation();
              togglePin(item.id);
              setContextMenu(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-primary group-hover:scale-110 transition-transform" style={{ fontVariationSettings: item.pinned ? "'FILL' 1" : '' }}>
              push_pin
            </span>
            {item.pinned ? 'Unpin' : 'Pin'}
          </button>

          {/* Edit */}
          <button
            className="context-item group"
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelected(item.id);
              setEditingId(item.id);
              setContextMenu(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-text transition-colors">edit</span>
            Bearbeiten
          </button>

          {/* Duplicate */}
          <button
            className="context-item group"
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelected(item.id);
              duplicateSelected();
              setContextMenu(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-text transition-colors">content_copy</span>
            Duplizieren
          </button>

          {/* Color submenu */}
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-medium">Farbe</div>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <motion.button
                  key={c.key}
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-5 h-5 rounded-full ${c.dot} transition-shadow ${item.color === c.key ? 'ring-2 ring-white/40 shadow-lg' : 'hover:shadow-md'}`}
                  title={c.label}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    changeColor(item.id, c.key);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="h-px bg-border/60 my-1 mx-2" />

          {/* Delete */}
          <button
            className="context-item text-danger group hover:bg-danger/10"
            onPointerDown={(e) => {
              e.stopPropagation();
              removeItem(item.id);
              setContextMenu(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">delete</span>
            Löschen
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
