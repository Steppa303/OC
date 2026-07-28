import { create } from 'zustand';
import * as api from './api.js';

const COLORS = ['default', 'blue', 'green', 'yellow', 'red', 'purple', 'orange'];

export const useStore = create((set, get) => ({
  // Canvas items
  items: [],
  selectedIds: new Set(),
  loading: true,

  // Canvas transform
  offset: { x: 0, y: 0 },
  scale: 1,

  // UI state
  contextMenu: null,
  editingId: null,
  snapToGrid: false,
  tool: 'select', // 'select' | 'text' | 'image'

  // Undo/Redo
  history: [],
  historyIndex: -1,

  // --- Init ---
  init: async () => {
    try {
      const items = await api.getItems();
      set({ items, loading: false });
      // Initialize Telegram WebApp
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0c141c');
        tg.setBackgroundColor('#0c141c');
      }
    } catch (e) {
      console.error('Init error:', e);
      set({ loading: false });
    }
  },

  // --- Items CRUD ---
  loadItems: async () => {
    try {
      const items = await api.getItems();
      set({ items });
    } catch (e) {
      console.error('Load error:', e);
    }
  },

  addItem: async (itemData) => {
    const { offset, scale } = get();
    // Place in visible center area
    const x = Math.round((-offset.x + window.innerWidth / 2) / scale - 140 + (Math.random() - 0.5) * 100);
    const y = Math.round((-offset.y + window.innerHeight / 2) / scale - 90 + (Math.random() - 0.5) * 80);
    try {
      const created = await api.createItem({ ...itemData, x, y });
      set(s => {
        const newItems = [created, ...s.items];
        return { items: newItems, selectedIds: new Set([created.id]) };
      });
      get().pushHistory();
      get().haptic('light');
      return created;
    } catch (e) {
      console.error('Add error:', e);
    }
  },

  updateItem: async (id, data) => {
    try {
      const updated = await api.updateItem(id, data);
      set(s => ({ items: s.items.map(i => i.id === id ? updated : i) }));
      return updated;
    } catch (e) {
      console.error('Update error:', e);
    }
  },

  removeItem: async (id) => {
    try {
      await api.deleteItem(id);
      set(s => {
        const newIds = new Set(s.selectedIds);
        newIds.delete(id);
        return { items: s.items.filter(i => i.id !== id), selectedIds: newIds };
      });
      get().pushHistory();
      get().haptic('medium');
    } catch (e) {
      console.error('Delete error:', e);
    }
  },

  deleteSelected: async () => {
    const { selectedIds, items } = get();
    if (selectedIds.size === 0) return;
    const toDelete = items.filter(i => selectedIds.has(i.id));
    for (const item of toDelete) {
      try {
        await api.deleteItem(item.id);
      } catch (e) {
        console.error('Delete error:', e);
      }
    }
    set(s => ({
      items: s.items.filter(i => !selectedIds.has(i.id)),
      selectedIds: new Set(),
    }));
    get().pushHistory();
    get().haptic('heavy');
  },

  duplicateSelected: async () => {
    const { selectedIds, items } = get();
    if (selectedIds.size === 0) return;
    const selected = items.filter(i => selectedIds.has(i.id));
    const newIds = new Set();
    for (const item of selected) {
      try {
        const created = await api.createItem({
          type: item.type,
          x: item.x + 30,
          y: item.y + 30,
          width: item.width,
          height: item.height,
          title: item.title,
          content: item.content,
          color: item.color,
          image_url: item.image_url,
          caption: item.caption,
          pinned: item.pinned,
        });
        set(s => ({ items: [created, ...s.items] }));
        newIds.add(created.id);
      } catch (e) {
        console.error('Dup error:', e);
      }
    }
    set({ selectedIds: newIds });
    get().pushHistory();
    get().haptic('light');
  },

  togglePin: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    try {
      const updated = await api.updateItem(id, { pinned: !item.pinned });
      set(s => ({ items: s.items.map(i => i.id === id ? updated : i) }));
      get().haptic('light');
    } catch (e) {
      console.error('Pin error:', e);
    }
  },

  changeColor: async (id, color) => {
    try {
      const updated = await api.updateItem(id, { color });
      set(s => ({ items: s.items.map(i => i.id === id ? updated : i) }));
    } catch (e) {
      console.error('Color error:', e);
    }
  },

  uploadFile: async (file) => {
    try {
      const result = await api.uploadFile(file);
      if (result.item) {
        set(s => ({
          items: [result.item, ...s.items],
          selectedIds: new Set([result.item.id]),
        }));
        get().pushHistory();
      }
      get().haptic('light');
      return result;
    } catch (e) {
      console.error('Upload error:', e);
    }
  },

  // --- Selection ---
  setSelected: (id) => {
    if (id === null) {
      set({ selectedIds: new Set() });
    } else {
      set({ selectedIds: new Set([id]) });
    }
  },

  toggleSelect: (id) => {
    set(s => {
      const newIds = new Set(s.selectedIds);
      if (newIds.has(id)) newIds.delete(id);
      else newIds.add(id);
      return { selectedIds: newIds };
    });
  },

  selectAll: () => {
    set(s => ({ selectedIds: new Set(s.items.map(i => i.id)) }));
  },

  selectInRect: (rect) => {
    const { items, offset, scale } = get();
    const selected = new Set();
    for (const item of items) {
      const ix = item.x * scale + offset.x;
      const iy = item.y * scale + offset.y;
      const iw = (item.width || 280) * scale;
      const ih = (item.height || 180) * scale;
      if (ix < rect.x + rect.w && ix + iw > rect.x && iy < rect.y + rect.h && iy + ih > rect.y) {
        selected.add(item.id);
      }
    }
    set({ selectedIds: selected });
  },

  // --- Canvas Transform ---
  setOffset: (offset) => set({ offset }),
  setScale: (scale) => set({ scale: Math.min(Math.max(0.15, scale), 4) }),

  zoomIn: () => set(s => ({ scale: Math.min(s.scale * 1.25, 4) })),
  zoomOut: () => set(s => ({ scale: Math.max(s.scale / 1.25, 0.15) })),
  zoomReset: () => set({ scale: 1, offset: { x: 0, y: 0 } }),

  fitToContent: () => {
    const { items } = get();
    if (items.length === 0) return;
    const PAD = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of items) {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + (item.width || 280));
      maxY = Math.max(maxY, item.y + (item.height || 180));
    }
    const contentW = maxX - minX + PAD * 2;
    const contentH = maxY - minY + PAD * 2;
    const scale = Math.min(window.innerWidth / contentW, window.innerHeight / contentH, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    set({
      scale,
      offset: {
        x: window.innerWidth / 2 - cx * scale,
        y: window.innerHeight / 2 - cy * scale,
      },
    });
  },

  // --- UI ---
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setEditingId: (id) => set({ editingId: id }),
  setTool: (tool) => set({ tool }),
  toggleSnap: () => set(s => ({ snapToGrid: !s.snapToGrid })),

  // --- Undo/Redo ---
  pushHistory: () => {
    const { items, history, historyIndex } = get();
    const snapshot = JSON.stringify(items);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const prev = JSON.parse(history[historyIndex - 1]);
    set({ items: prev, historyIndex: historyIndex - 1 });
    // Sync to server
    for (const item of prev) {
      api.updateItem(item.id, item).catch(() => {});
    }
    get().haptic('light');
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const next = JSON.parse(history[historyIndex + 1]);
    set({ items: next, historyIndex: historyIndex + 1 });
    for (const item of next) {
      api.updateItem(item.id, item).catch(() => {});
    }
    get().haptic('light');
  },

  // --- Haptic ---
  haptic: (style = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    } catch {}
  },

  // --- Export/Import ---
  exportJSON: () => {
    const { items } = get();
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));
