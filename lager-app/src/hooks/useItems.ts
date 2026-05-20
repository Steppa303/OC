import { useEffect } from 'react';
import { useAppStore } from '../store/itemStore';

export function useItems() {
  const { items, searchQuery, isLoading, loadItemsFromStorage, getFilteredItems } = useAppStore();

  useEffect(() => {
    loadItemsFromStorage();
  }, []);

  return {
    items: getFilteredItems(),
    allItems: items,
    searchQuery,
    isLoading,
    refresh: loadItemsFromStorage,
  };
}
