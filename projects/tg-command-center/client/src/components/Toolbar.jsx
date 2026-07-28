import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store.js';

export default function Toolbar() {
  const addItem = useStore(s => s.addItem);
  const uploadFile = useStore(s => s.uploadFile);
  const snapToGrid = useStore(s => s.snapToGrid);
  const toggleSnap = useStore(s => s.toggleSnap);
  const zoomIn = useStore(s => s.zoomIn);
  const zoomOut = useStore(s => s.zoomOut);
  const zoomReset = useStore(s => s.zoomReset);
  const fitToContent = useStore(s => s.fitToContent);
  const exportJSON = useStore(s => s.exportJSON);
  const selectedIds = useStore(s => s.selectedIds);
  const deleteSelected = useStore(s => s.deleteSelected);
  const duplicateSelected = useStore(s => s.duplicateSelected);
  const scale = useStore(s => s.scale);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const addRef = useRef(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e) => {
      if (addRef.current && !addRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [addMenuOpen]);

  const handleAddText = () => {
    addItem({
      type: 'text',
      title: 'Neue Notiz',
      content: '',
      color: 'default',
      width: 280,
      height: 180,
    });
    setAddMenuOpen(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
    setAddMenuOpen(false);
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <>
      {/* Desktop Toolbar — top left */}
      <div className="absolute top-3 left-3 z-30 hidden md:flex items-center gap-2" data-ui>
        {/* Glassmorphism container */}
        <div className="toolbar-glass flex items-center gap-1.5 px-2 py-1.5">
          {/* Add Button + Dropdown */}
          <div className="relative" ref={addRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="toolbar-btn-add"
              onPointerDown={(e) => { e.stopPropagation(); setAddMenuOpen(!addMenuOpen); }}
              title="Neues Element"
            >
              <motion.span
                className="material-symbols-outlined text-[22px]"
                animate={{ rotate: addMenuOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                add
              </motion.span>
            </motion.button>
            <AnimatePresence>
              {addMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="context-menu absolute top-full left-0 mt-2 bg-bg-secondary/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-xl py-1.5 min-w-[170px]"
                >
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-text hover:bg-bg-tertiary/80 flex items-center gap-2.5 transition-colors"
                    onPointerDown={(e) => { e.stopPropagation(); handleAddText(); }}
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">text_fields</span>
                    Text-Card
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-text hover:bg-bg-tertiary/80 flex items-center gap-2.5 transition-colors"
                    onPointerDown={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <span className="material-symbols-outlined text-[18px] text-green-400">image</span>
                    Bild hochladen
                  </button>
                  <div className="h-px bg-border/60 my-1 mx-2" />
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-text hover:bg-bg-tertiary/80 flex items-center gap-2.5 transition-colors"
                    onPointerDown={(e) => { e.stopPropagation(); exportJSON(); setAddMenuOpen(false); }}
                  >
                    <span className="material-symbols-outlined text-[18px] text-text-muted">download</span>
                    Export JSON
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Separator */}
          {hasSelection && (
            <>
              <div className="toolbar-separator" />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="toolbar-btn"
                onPointerDown={(e) => { e.stopPropagation(); duplicateSelected(); }}
                title="Duplizieren"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="toolbar-btn toolbar-btn-danger"
                onPointerDown={(e) => { e.stopPropagation(); deleteSelected(); }}
                title="Löschen"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </motion.button>
            </>
          )}

          {/* Separator */}
          <div className="toolbar-separator" />

          {/* Snap toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`toolbar-btn ${snapToGrid ? 'toolbar-btn-active' : ''}`}
            onPointerDown={(e) => { e.stopPropagation(); toggleSnap(); }}
            title="Snap to Grid"
          >
            <span className="material-symbols-outlined text-[18px]">grid_on</span>
          </motion.button>
        </div>

        {/* Zoom controls — separate glass container */}
        <div className="toolbar-glass flex items-center gap-0.5 px-1.5 py-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary/80 transition-colors text-text-muted"
            onPointerDown={(e) => { e.stopPropagation(); zoomOut(); }}
            title="Verkleinern"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </motion.button>
          <button
            className="p-1.5 rounded-lg hover:bg-bg-tertiary/80 transition-colors text-text-muted text-[11px] font-mono min-w-[44px] text-center"
            onPointerDown={(e) => { e.stopPropagation(); zoomReset(); }}
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary/80 transition-colors text-text-muted"
            onPointerDown={(e) => { e.stopPropagation(); zoomIn(); }}
            title="Vergrößern"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </motion.button>
          <div className="w-px h-5 bg-border/60 mx-0.5" />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary/80 transition-colors text-text-muted"
            onPointerDown={(e) => { e.stopPropagation(); fitToContent(); }}
            title="An Content anpassen"
          >
            <span className="material-symbols-outlined text-[18px]">fit_screen</span>
          </motion.button>
        </div>
      </div>

      {/* Mobile Toolbar — bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 md:hidden" data-ui>
        <div className="toolbar-glass-mobile flex items-center justify-around px-3 py-2 safe-bottom">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="toolbar-btn-add-mobile"
            onPointerDown={(e) => { e.stopPropagation(); handleAddText(); }}
          >
            <span className="material-symbols-outlined text-[24px]">add</span>
          </motion.button>
          {hasSelection && (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="toolbar-btn-mobile"
                onPointerDown={(e) => { e.stopPropagation(); duplicateSelected(); }}
              >
                <span className="material-symbols-outlined text-[22px]">content_copy</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="toolbar-btn-mobile toolbar-btn-danger-mobile"
                onPointerDown={(e) => { e.stopPropagation(); deleteSelected(); }}
              >
                <span className="material-symbols-outlined text-[22px]">delete</span>
              </motion.button>
            </>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className={`toolbar-btn-mobile ${snapToGrid ? 'toolbar-btn-active-mobile' : ''}`}
            onPointerDown={(e) => { e.stopPropagation(); toggleSnap(); }}
          >
            <span className="material-symbols-outlined text-[22px]">grid_on</span>
          </motion.button>
        </div>
      </div>

      {/* Mobile Zoom FAB */}
      <div className="absolute bottom-20 right-3 z-30 md:hidden flex flex-col gap-2" data-ui>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="toolbar-fab"
          onPointerDown={(e) => { e.stopPropagation(); zoomIn(); }}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="toolbar-fab"
          onPointerDown={(e) => { e.stopPropagation(); zoomOut(); }}
        >
          <span className="material-symbols-outlined text-[20px]">remove</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="toolbar-fab"
          onPointerDown={(e) => { e.stopPropagation(); fitToContent(); }}
        >
          <span className="material-symbols-outlined text-[20px]">fit_screen</span>
        </motion.button>
      </div>
    </>
  );
}
