import { useRef, useState, useCallback, useEffect } from 'react';
import { useStore } from '../store.js';
import Card from './Card.jsx';

export default function InfiniteCanvas() {
  const items = useStore(s => s.items);
  const offset = useStore(s => s.offset);
  const scale = useStore(s => s.scale);
  const selectedIds = useStore(s => s.selectedIds);
  const snapToGrid = useStore(s => s.snapToGrid);
  const editingId = useStore(s => s.editingId);
  const setOffset = useStore(s => s.setOffset);
  const setScale = useStore(s => s.setScale);
  const setSelected = useStore(s => s.setSelected);
  const selectInRect = useStore(s => s.selectInRect);
  const setContextMenu = useStore(s => s.setContextMenu);
  const deleteSelected = useStore(s => s.deleteSelected);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const uploadFile = useStore(s => s.uploadFile);
  const addItem = useStore(s => s.addItem);
  const updateItem = useStore(s => s.updateItem);
  const pushHistory = useStore(s => s.pushHistory);

  const containerRef = useRef(null);
  const canvasContentRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const panStart = useRef(null);
  const [dragCard, setDragCard] = useState(null);
  const dragCardStart = useRef(null);
  const dragCardEl = useRef(null); // direct DOM ref for dragged card
  const dragActivated = useRef(false); // whether drag threshold was exceeded
  const DRAG_THRESHOLD = 5; // px before drag actually starts
  const [rubberband, setRubberband] = useState(null);
  const rubberbandStart = useRef(null);
  const [resizeCard, setResizeCard] = useState(null);
  const resizeStart = useRef(null);
  const rafId = useRef(null);
  const pendingDragPos = useRef(null);
  const [newCardId, setNewCardId] = useState(null);

  // Touch state
  const touchState = useRef({ lastDist: 0, lastCenter: null, touching: false });

  const SNAP = 24;
  const snap = (v) => snapToGrid ? Math.round(v / SNAP) * SNAP : v;

  // --- PAN ---
  const startPan = (clientX, clientY) => {
    setIsPanning(true);
    panStart.current = { x: clientX - offset.x, y: clientY - offset.y };
  };

  const handleCanvasPointerDown = (e) => {
    if (e.target.closest('[data-card]') || e.target.closest('[data-ui]')) return;
    if (e.button === 2) return;

    if (spaceDown) {
      startPan(e.clientX, e.clientY);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    rubberbandStart.current = {
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
      ox: offset.x,
      oy: offset.y,
    };
    setRubberband({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 });
    setSelected(null);
    setContextMenu(null);
  };

  const handlePointerMove = useCallback((e) => {
    // Panning
    if (isPanning && panStart.current) {
      setOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
      return;
    }

    // Dragging card — DOM-direct, no store update, no re-render
    if (dragCard && dragCardStart.current && dragCardEl.current) {
      const rawDx = e.clientX - dragCardStart.current.cx;
      const rawDy = e.clientY - dragCardStart.current.cy;
      // Don't activate drag until threshold is exceeded — prevents accidental micro-drags on click
      if (!dragActivated.current) {
        if (Math.abs(rawDx) < DRAG_THRESHOLD && Math.abs(rawDy) < DRAG_THRESHOLD) return;
        dragActivated.current = true;
      }
      const dx = rawDx / scale;
      const dy = rawDy / scale;
      const newX = snap(dragCardStart.current.ox + dx);
      const newY = snap(dragCardStart.current.oy + dy);
      // Apply transform directly to the DOM element — bypasses React entirely
      dragCardEl.current.style.transform = `translate(${newX}px, ${newY}px)`;
      dragCardEl.current.style.zIndex = '9999';
      // Store pending position for final update on pointerUp
      pendingDragPos.current = { x: newX, y: newY };
      return;
    }

    // Resizing card — store update (resize is infrequent, no flicker)
    if (resizeCard && resizeStart.current) {
      const dx = (e.clientX - resizeStart.current.cx) / scale;
      const dy = (e.clientY - resizeStart.current.cy) / scale;
      const newW = Math.max(120, snap(resizeStart.current.ow + dx));
      const newH = Math.max(80, snap(resizeStart.current.oh + dy));
      useStore.setState(s => ({
        items: s.items.map(i =>
          i.id === resizeCard ? { ...i, width: newW, height: newH } : i
        ),
      }));
      return;
    }

    // Rubberband
    if (rubberband && rubberbandStart.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sx = rubberbandStart.current.sx;
      const sy = rubberbandStart.current.sy;
      setRubberband({
        x: Math.min(sx, cx),
        y: Math.min(sy, cy),
        w: Math.abs(cx - sx),
        h: Math.abs(cy - sy),
      });
    }
  }, [isPanning, dragCard, resizeCard, rubberband, scale, snapToGrid, offset, setOffset]);

  const handlePointerUp = useCallback(() => {
    // Finalize drag — single store update
    if (dragCard) {
      const finalPos = pendingDragPos.current;
      if (finalPos) {
        const rx = Math.round(finalPos.x);
        const ry = Math.round(finalPos.y);
        // Update store FIRST, then clear DOM style — prevents position flash
        useStore.setState(s => ({
          items: s.items.map(i =>
            i.id === dragCard ? { ...i, x: rx, y: ry } : i
          ),
        }));
        updateItem(dragCard, { x: rx, y: ry });
      }
      // Reset DOM styles AFTER store update
      if (dragCardEl.current) {
        // Apply final position via React-compatible style before clearing direct DOM manipulation
        if (finalPos) {
          dragCardEl.current.style.transform = `translate(${Math.round(finalPos.x)}px, ${Math.round(finalPos.y)}px)`;
        }
        // Defer cleanup to next frame so React has time to re-render with new position
        const el = dragCardEl.current;
        requestAnimationFrame(() => {
          el.style.transform = '';
          el.style.zIndex = '';
          el.classList.remove('card-dragging');
        });
        dragCardEl.current = null;
      }
      setDragCard(null);
      dragCardStart.current = null;
      dragActivated.current = false;
      pendingDragPos.current = null;
      pushHistory();
    }

    // Finalize resize — sync to server
    if (resizeCard) {
      const item = items.find(i => i.id === resizeCard);
      if (item) {
        updateItem(resizeCard, { width: Math.round(item.width), height: Math.round(item.height) });
      }
      setResizeCard(null);
      resizeStart.current = null;
      pushHistory();
    }

    if (rubberband && rubberbandStart.current) {
      if (rubberband.w > 5 || rubberband.h > 5) {
        selectInRect(rubberband);
      }
      setRubberband(null);
      rubberbandStart.current = null;
    }

    setIsPanning(false);
    panStart.current = null;
  }, [dragCard, resizeCard, rubberband, updateItem, pushHistory, selectInRect]);

  // --- ZOOM (wheel) ---
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.min(Math.max(0.15, scale * delta), 4);
    const ratio = newScale / scale;
    setOffset({
      x: mx - (mx - offset.x) * ratio,
      y: my - (my - offset.y) * ratio,
    });
    setScale(newScale);
  }, [scale, offset, setScale, setOffset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // --- TOUCH: Pinch-to-zoom + single-finger pan ---
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.current.lastDist = Math.hypot(dx, dy);
      touchState.current.lastCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && !e.target.closest('[data-card]')) {
      startPan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [offset]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      if (touchState.current.lastDist) {
        const ratio = dist / touchState.current.lastDist;
        const newScale = Math.min(Math.max(0.15, scale * ratio), 4);
        const scaleRatio = newScale / scale;
        setOffset({
          x: center.x - (center.x - offset.x) * scaleRatio + (center.x - (touchState.current.lastCenter?.x || center.x)),
          y: center.y - (center.y - offset.y) * scaleRatio + (center.y - (touchState.current.lastCenter?.y || center.y)),
        });
        setScale(newScale);
      }
      touchState.current.lastDist = dist;
      touchState.current.lastCenter = center;
    }
  }, [scale, offset, setScale, setOffset]);

  const handleTouchEnd = useCallback(() => {
    touchState.current.lastDist = 0;
    touchState.current.lastCenter = null;
    setIsPanning(false);
    panStart.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // --- KEYBOARD ---
  useEffect(() => {
    const handler = (e) => {
      if (editingId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useStore.getState().selectAll();
      }
      if (e.key === ' ') {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const upHandler = (e) => {
      if (e.key === ' ') setSpaceDown(false);
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [editingId, selectedIds, deleteSelected, undo, redo]);

  // --- CARD DRAG ---
  const handleCardPointerDown = (id, e) => {
    if (e.button === 2) return;
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Grab the DOM element for direct manipulation during drag
    const el = canvasContentRef.current?.querySelector(`[data-card-id="${id}"]`);
    if (el) {
      el.classList.add('card-dragging');
      dragCardEl.current = el;
    }

    setDragCard(id);
    setSelected(id);
    dragActivated.current = false;
    dragCardStart.current = {
      cx: e.clientX,
      cy: e.clientY,
      ox: item.x || 0,
      oy: item.y || 0,
    };
  };

  // --- CARD RESIZE ---
  const handleResizeStart = (id, e) => {
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (!item) return;
    setResizeCard(id);
    resizeStart.current = {
      cx: e.clientX,
      cy: e.clientY,
      ow: item.width || 280,
      oh: item.height || 180,
    };
  };

  // --- CONTEXT MENU ---
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (e.target.closest('[data-card]')) return;
    setContextMenu(null);
  };

  // --- DROP (file upload) ---
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Sort: pinned on top
  const sorted = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  // Track newly created card for animation
  const handleAddItem = useCallback(async (itemData) => {
    const created = await addItem(itemData);
    if (created) {
      setNewCardId(created.id);
      setTimeout(() => setNewCardId(null), 600);
    }
  }, [addItem]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        cursor: isPanning || spaceDown ? 'grabbing' : rubberband ? 'crosshair' : 'default',
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={handleContextMenu}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Dot Grid Background */}
      <div
        className="absolute inset-0 canvas-grid pointer-events-none transition-opacity duration-300"
        style={{
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          opacity: Math.min(0.4 + scale * 0.3, 0.7),
        }}
      />

      {/* Canvas Content (pannable + zoomable) */}
      <div
        ref={canvasContentRef}
        className="absolute will-change-transform"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {sorted.map((item, idx) => {
          const isDragging = dragCard === item.id;
          const isNew = newCardId === item.id;
          return (
            <div
              key={item.id}
              data-card
              data-card-id={item.id}
              className="absolute"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${item.x || 0}px, ${item.y || 0}px)`,
                zIndex: isDragging ? 9999 : item.pinned ? 100 + idx : 10 + idx,
                width: `${item.width || 280}px`,
                willChange: isDragging ? 'transform' : 'auto',
              }}
            >
              <Card
                item={item}
                isSelected={selectedIds.has(item.id)}
                isDragging={isDragging}
                isNew={isNew}
                onPointerDown={(e) => handleCardPointerDown(item.id, e)}
                onResizeStart={(e) => handleResizeStart(item.id, e)}
              />
            </div>
          );
        })}
      </div>

      {/* Rubberband Selection */}
      {rubberband && rubberband.w > 2 && rubberband.h > 2 && (
        <div
          className="rubberband absolute rounded-sm"
          style={{
            left: rubberband.x,
            top: rubberband.y,
            width: rubberband.w,
            height: rubberband.h,
          }}
        />
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center px-6 empty-state-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 empty-state-icon">
              <span className="material-symbols-outlined text-primary text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                dashboard
              </span>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">Canvas ist leer</h2>
            <p className="text-sm text-text-muted max-w-xs leading-relaxed">
              Rechtsklick auf den Canvas oder nutze die Toolbar oben, um Text oder Bilder hinzuzufügen.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-muted/60">
              <span className="material-symbols-outlined text-[16px]">touch_app</span>
              <span>Rechtsklick / Toolbar → Neues Element</span>
            </div>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 text-[11px] text-text-muted font-mono pointer-events-none transition-all duration-200" data-ui>
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
