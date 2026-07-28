import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store.js';

const COLORS = {
  default: { border: 'border-l-primary', bg: '', gradient: 'from-primary to-primary-dark' },
  blue: { border: 'border-l-blue-500', bg: 'bg-blue-500/5', gradient: 'from-blue-400 to-blue-600' },
  green: { border: 'border-l-green-500', bg: 'bg-green-500/5', gradient: 'from-green-400 to-green-600' },
  yellow: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/5', gradient: 'from-yellow-400 to-yellow-600' },
  red: { border: 'border-l-red-500', bg: 'bg-red-500/5', gradient: 'from-red-400 to-red-600' },
  purple: { border: 'border-l-purple-500', bg: 'bg-purple-500/5', gradient: 'from-purple-400 to-purple-600' },
  orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/5', gradient: 'from-orange-400 to-orange-600' },
};

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export default function Card({ item, isSelected, isDragging, isNew, onPointerDown, onResizeStart }) {
  const setContextMenu = useStore(s => s.setContextMenu);
  const editingId = useStore(s => s.editingId);
  const setEditingId = useStore(s => s.setEditingId);
  const updateItem = useStore(s => s.updateItem);
  const pushHistory = useStore(s => s.pushHistory);

  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  const isEditing = editingId === item.id;
  const colorCfg = COLORS[item.color] || COLORS.default;

  // Start editing
  const startEdit = () => {
    setEditTitle(item.title || '');
    setEditContent(item.content || '');
    setEditingId(item.id);
    setTimeout(() => contentRef.current?.focus(), 50);
  };

  // Save edit
  const saveEdit = () => {
    updateItem(item.id, { title: editTitle, content: editContent });
    setEditingId(null);
    pushHistory();
  };

  // Context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      itemId: item.id,
    });
  };

  // Double-click to edit
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    startEdit();
  };

  // Close edit on Escape
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        saveEdit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditing, editTitle, editContent]);

  return (
    <motion.div
      initial={isNew ? { scale: 0.8, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={isNew ? { type: 'spring', stiffness: 400, damping: 25 } : { duration: 0 }}
      className={`
        card-wrapper card-glass rounded-card
        transition-shadow duration-200 ease-out
        border-l-4
        ${colorCfg.bg}
        ${isSelected
          ? 'card-selected'
          : isDragging
            ? 'shadow-card-drag'
            : 'shadow-card hover:shadow-card-hover'
        }
        ${item.pinned ? 'ring-1 ring-primary/30' : ''}
        ${isEditing ? 'z-50' : ''}
        ${isDragging ? 'card-dragging' : ''}
      `}
      style={{
        width: `${item.width || 280}px`,
        height: item.type === 'image' ? 'auto' : `${item.height || 180}px`,
        minHeight: item.type === 'image' ? '120px' : undefined,
        borderLeftColor: item.color === 'default' ? '#2AABEE' :
          item.color === 'blue' ? '#3b82f6' :
          item.color === 'green' ? '#22c55e' :
          item.color === 'yellow' ? '#eab308' :
          item.color === 'red' ? '#ef4444' :
          item.color === 'purple' ? '#a855f7' :
          item.color === 'orange' ? '#f97316' : '#2AABEE',
      }}
      onPointerDown={onPointerDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {/* Pin indicator */}
      <AnimatePresence>
        {item.pinned && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center z-10 shadow-md"
          >
            <span className="material-symbols-outlined text-white text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image type */}
      {item.type === 'image' && item.image_url && (
        <div className="relative">
          <img
            src={item.image_url}
            alt={item.caption || ''}
            className="w-full rounded-t-[13px] object-cover"
            style={{ maxHeight: '400px' }}
            draggable={false}
          />
          {item.caption && (
            <div className="px-3 py-2 text-xs text-text-muted">
              {isEditing ? (
                <input
                  className="card-edit-textarea text-xs"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Bildunterschrift..."
                />
              ) : (
                item.caption
              )}
            </div>
          )}
        </div>
      )}

      {/* Text type */}
      {item.type === 'text' && (
        <div className="p-3.5 flex flex-col h-full overflow-hidden">
          {isEditing ? (
            <>
              <input
                ref={titleRef}
                className="bg-transparent border-none outline-none font-semibold text-sm mb-1.5 text-text placeholder:text-text-muted"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titel..."
              />
              <textarea
                ref={contentRef}
                className="card-edit-textarea text-xs text-text-muted flex-1"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Inhalt... (Markdown: **fett**, *kursiv*, `code`)"
              />
              <div className="flex justify-end mt-2 gap-1">
                <button
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                  onPointerDown={(e) => { e.stopPropagation(); saveEdit(); }}
                >
                  Speichern
                </button>
              </div>
            </>
          ) : (
            <>
              {item.title && (
                <h3 className="font-semibold text-sm mb-1.5 text-text truncate">
                  {item.title}
                </h3>
              )}
              {item.content ? (
                <div
                  className="card-content text-xs text-text-muted flex-1 overflow-hidden leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
                />
              ) : (
                <p className="text-xs text-text-muted/50 italic">Doppelklick zum Bearbeiten</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Resize handle */}
      <div
        className="resize-handle"
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizeStart(e);
        }}
      />
    </motion.div>
  );
}
