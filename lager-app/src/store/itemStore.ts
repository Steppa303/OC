import { create } from 'zustand';
import { Item, StockHistory, ImportState } from '../types';
import { loadItems, saveItems, adjustItemQuantity, addItem as storageAddItem, updateItem as storageUpdateItem, deleteItem as storageDeleteItem, getItemHistory } from '../utils/storage';

interface AppState {
  items: Item[];
  selectedItemId: string | null;
  searchQuery: string;
  theme: 'light' | 'dark';
  importState: ImportState;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadItemsFromStorage: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedItem: (id: string | null) => void;
  toggleTheme: () => void;
  addItem: (item: Item) => Promise<void>;
  updateItem: (item: Item) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  adjustQuantity: (itemId: string, change: number, reason?: string) => Promise<void>;
  setImportState: (state: Partial<ImportState>) => void;
  resetImportState: () => void;
  getFilteredItems: () => Item[];
  getItemById: (id: string) => Item | undefined;
  getItemHistoryData: (itemId: string) => Promise<StockHistory[]>;
}

const defaultImportState: ImportState = {
  step: 0,
  file: null,
  sheets: [],
  selectedSheet: '',
  rawData: [],
  columnMappings: [],
  previewRows: [],
  isImporting: false,
  progress: 0,
};

export const useAppStore = create<AppState>((set, get) => ({
  items: [],
  selectedItemId: null,
  searchQuery: '',
  theme: 'light',
  importState: defaultImportState,
  isLoading: false,
  error: null,

  loadItemsFromStorage: async () => {
    set({ isLoading: true });
    try {
      const items = await loadItems();
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: 'Fehler beim Laden der Daten', isLoading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedItem: (id) => set({ selectedItemId: id }),

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  addItem: async (item) => {
    try {
      await storageAddItem(item);
      set((state) => ({ items: [...state.items, item] }));
    } catch (error) {
      set({ error: 'Fehler beim Hinzufügen des Artikels' });
    }
  },

  updateItem: async (item) => {
    try {
      await storageUpdateItem(item);
      set((state) => ({
        items: state.items.map(i => i.id === item.id ? item : i),
      }));
    } catch (error) {
      set({ error: 'Fehler beim Aktualisieren des Artikels' });
    }
  },

  deleteItem: async (id) => {
    try {
      await storageDeleteItem(id);
      set((state) => ({ items: state.items.filter(i => i.id !== id) }));
    } catch (error) {
      set({ error: 'Fehler beim Löschen des Artikels' });
    }
  },

  adjustQuantity: async (itemId, change, reason) => {
    try {
      const updatedItem = await adjustItemQuantity(itemId, change, reason);
      if (updatedItem) {
        set((state) => ({
          items: state.items.map(i => i.id === itemId ? updatedItem : i),
        }));
      }
    } catch (error) {
      set({ error: 'Fehler bei der Bestandsanpassung' });
    }
  },

  setImportState: (partialState) => 
    set((state) => ({
      importState: { ...state.importState, ...partialState },
    })),

  resetImportState: () => set({ importState: defaultImportState }),

  getFilteredItems: () => {
    const { items, searchQuery } = get();
    if (!searchQuery) return items;
    
    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.location?.toLowerCase().includes(query)
    );
  },

  getItemById: (id) => {
    return get().items.find(i => i.id === id);
  },

  getItemHistoryData: async (itemId) => {
    return await getItemHistory(itemId);
  },
}));
