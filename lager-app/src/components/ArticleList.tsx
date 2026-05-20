import { useState, useEffect } from 'react';
import { ArticleCard } from './ArticleCard';
import { Item } from '../types';

interface ArticleListProps {
  items: Item[];
  onItemClick: (id: string) => void;
  onQuickAdjust: (itemId: string, change: number) => void;
  onLongPress: (itemId: string) => void;
}

const ITEMS_PER_PAGE = 50;

export function ArticleList({ items, onItemClick, onQuickAdjust, onLongPress }: ArticleListProps) {
  const [visibleItems, setVisibleItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Reset pagination when items change
    setVisibleItems(items.slice(0, ITEMS_PER_PAGE));
    setPage(1);
  }, [items]);

  const loadMore = () => {
    const nextPage = page + 1;
    const newItems = items.slice(0, nextPage * ITEMS_PER_PAGE);
    setVisibleItems(newItems);
    setPage(nextPage);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Keine Artikel gefunden. Importiere Excel oder füge manuell hinzu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleItems.map(item => (
        <ArticleCard
          key={item.id}
          id={item.id}
          name={item.name}
          quantity={item.quantity}
          unit={item.unit}
          itemsPerPackage={item.itemsPerPackage}
          imageUrl={item.imageUrl}
          category={item.category}
          location={item.location}
          onClick={() => onItemClick(item.id)}
          onQuickAdjust={(change) => onQuickAdjust(item.id, change)}
          onLongPress={() => onLongPress(item.id)}
        />
      ))}

      {visibleItems.length < items.length && (
        <button
          onClick={loadMore}
          className="w-full py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Mehr laden ({items.length - visibleItems.length} verbleibend)
        </button>
      )}
    </div>
  );
}
