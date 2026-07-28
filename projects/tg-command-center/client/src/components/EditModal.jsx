import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store.js';

export default function EditModal() {
  const editingId = useStore(s => s.editingId);
  const items = useStore(s => s.items);
  const setEditingId = useStore(s => s.setEditingId);
  const updateItem = useStore(s => s.updateItem);
  const pushHistory = useStore(s => s.pushHistory);

  const item = items.find(i => i.id === editingId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [caption, setCaption] = useState('');
  const contentRef = useRef(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setContent(item.content || '');
      setCaption(item.caption || '');
      setDirty(false);
      setTimeout(() => contentRef.current?.focus(), 100);
    }
  }, [item]);

  if (!item) return null;

  const save = () => {
    updateItem(editingId, { title, content, caption });
    setEditingId(null);
    pushHistory();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') save();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
  };

  const markDirty = () => { if (!dirty) setDirty(true); };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(8px)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) save();
      }}
      data-ui
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg mx-4 overflow-hidden"
        style={{
          background: 'rgba(26, 35, 50, 0.97)',
          border: '1px solid rgba(42, 171, 238, 0.15)',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(42, 171, 238, 0.12)' }}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: '#2AABEE', fontVariationSettings: "'FILL' 1" }}
              >
                {item.type === 'image' ? 'image' : 'edit_note'}
              </span>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: '#e4e4e7' }}>
                {item.type === 'image' ? 'Bild bearbeiten' : 'Notiz bearbeiten'}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: '#71717a' }}>
                {dirty ? 'Nicht gespeichert' : 'Ctrl+Enter zum Speichern'}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
            onPointerDown={save}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#71717a' }}>close</span>
          </motion.button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {item.type === 'image' ? (
            <>
              <div className="relative overflow-hidden rounded-xl" style={{ border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full max-h-56 object-cover"
                  style={{ display: 'block' }}
                />
              </div>
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[16px] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#71717a' }}
                >
                  subtitles
                </span>
                <input
                  className="w-full pl-10 pr-4 py-3 text-sm outline-none"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    color: '#e4e4e7',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  value={caption}
                  onChange={(e) => { setCaption(e.target.value); markDirty(); }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(42, 171, 238, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(42, 171, 238, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Bildunterschrift..."
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[16px] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#71717a' }}
                >
                  title
                </span>
                <input
                  className="w-full pl-10 pr-4 py-3 text-sm font-semibold outline-none"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    color: '#e4e4e7',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(42, 171, 238, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(42, 171, 238, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Titel..."
                />
              </div>
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[16px] absolute left-3 top-3.5 pointer-events-none"
                  style={{ color: '#71717a' }}
                >
                  notes
                </span>
                <textarea
                  ref={contentRef}
                  className="w-full pl-10 pr-4 py-3 text-sm outline-none resize-none"
                  rows={7}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    color: '#e4e4e7',
                    lineHeight: '1.7',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  value={content}
                  onChange={(e) => { setContent(e.target.value); markDirty(); }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(42, 171, 238, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(42, 171, 238, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Inhalt... (Markdown: **fett**, *kursiv*, `code`)"
                />
              </div>
              <p className="text-[11px] flex items-center gap-1.5" style={{ color: '#71717a' }}>
                <span className="material-symbols-outlined text-[14px]">info</span>
                Markdown: **fett** · *kursiv* · `code` · # Überschrift
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2.5 px-5 py-4"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 text-sm font-medium"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#a1a1aa',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              // Reset to original values
              setTitle(item.title || '');
              setContent(item.content || '');
              setCaption(item.caption || '');
              setDirty(false);
            }}
          >
            Verwerfen
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 text-sm font-semibold"
            style={{
              background: 'linear-gradient(135deg, #2AABEE, #229ED9)',
              borderRadius: '12px',
              color: '#fff',
              border: 'none',
              boxShadow: '0 4px 16px rgba(42, 171, 238, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            }}
            onPointerDown={save}
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">check</span>
              Speichern
            </span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
