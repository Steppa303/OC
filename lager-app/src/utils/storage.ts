import { get, set, del } from 'idb-keyval';
import { Item, StockHistory } from '../types';

const ITEMS_KEY = 'lager_items';
const HISTORY_KEY = 'lager_history';

export async function loadItems(): Promise<Item[]> {
  const items = await get(ITEMS_KEY);
  return items || [];
}

export async function saveItems(items: Item[]): Promise<void> {
  await set(ITEMS_KEY, items);
}

export async function addItem(item: Item): Promise<void> {
  const items = await loadItems();
  items.push(item);
  await saveItems(items);
}

export async function updateItem(updatedItem: Item): Promise<void> {
  const items = await loadItems();
  const index = items.findIndex(i => i.id === updatedItem.id);
  if (index !== -1) {
    items[index] = { ...updatedItem, updatedAt: new Date().toISOString() };
    await saveItems(items);
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  const items = await loadItems();
  const filtered = items.filter(i => i.id !== itemId);
  await saveItems(filtered);
}

export async function adjustItemQuantity(itemId: string, change: number, reason?: string): Promise<Item | null> {
  const items = await loadItems();
  const item = items.find(i => i.id === itemId);
  
  if (!item) return null;

  const oldQuantity = item.quantity;
  item.quantity += change;
  item.updatedAt = new Date().toISOString();

  await saveItems(items);

  // Add to history
  const history: StockHistory = {
    id: crypto.randomUUID(),
    itemId: item.id,
    change,
    reason,
    timestamp: new Date().toISOString(),
  };
  await addHistoryEntry(history);

  return item;
}

export async function loadHistory(): Promise<StockHistory[]> {
  const history = await get(HISTORY_KEY);
  return history || [];
}

export async function saveHistory(history: StockHistory[]): Promise<void> {
  await set(HISTORY_KEY, history);
}

export async function addHistoryEntry(entry: StockHistory): Promise<void> {
  const history = await loadHistory();
  history.unshift(entry);
  // Keep only last 100 entries per item
  const itemHistory = history.filter(h => h.itemId === entry.itemId).slice(0, 100);
  const otherHistory = history.filter(h => h.itemId !== entry.itemId);
  await saveHistory([...otherHistory, ...itemHistory]);
}

export async function getItemHistory(itemId: string): Promise<StockHistory[]> {
  const history = await loadHistory();
  return history.filter(h => h.itemId === itemId).slice(0, 5);
}

export async function clearAllData(): Promise<void> {
  await del(ITEMS_KEY);
  await del(HISTORY_KEY);
}
