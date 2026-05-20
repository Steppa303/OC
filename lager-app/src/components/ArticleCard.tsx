import { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { Package } from 'lucide-react';

interface ArticleCardProps {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  itemsPerPackage?: number;
  imageUrl?: string;
  category?: string;
  location?: string;
  onClick: () => void;
  onQuickAdjust: (change: number) => void;
  onLongPress: () => void;
}

export function ArticleCard({
  name,
  quantity,
  unit,
  itemsPerPackage,
  imageUrl,
  category,
  location,
  onClick,
  onQuickAdjust,
  onLongPress,
}: ArticleCardProps) {
  // Calculate total pieces for package-based units
  const totalPieces = (itemsPerPackage && itemsPerPackage > 0) ? quantity * itemsPerPackage : null;
  const isPackageUnit = ['Packung', 'Karton', 'Beutel', 'Set', 'Kiste', 'Palette'].includes(unit || '');
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const controls = useAnimation();

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      onLongPress();
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handlers = useSwipeable({
    onSwipedRight: () => {
      onQuickAdjust(1);
      controls.start({ x: 0 });
    },
    onSwipedLeft: () => {
      onQuickAdjust(-1);
      controls.start({ x: 0 });
    },
    trackMouse: true,
  });

  return (
    <motion.div
      {...handlers}
      animate={controls}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow active:scale-95"
    >
      <div className="flex items-center p-4">
        {/* Image */}
        <div className="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden mr-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {name}
          </h3>
          {(category || location) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {[category, location].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>

        {/* Quantity */}
        <div className="text-right ml-4">
          <div className="text-3xl font-bold text-primary">
            {quantity}
          </div>
          {unit && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {unit}
              {isPackageUnit && itemsPerPackage && (
                <span className="block text-xs text-primary font-medium">
                  × {itemsPerPackage} = {totalPieces} Stk.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Adjust Buttons */}
      <div className="flex border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdjust(-1);
          }}
          className="flex-1 py-3 bg-error/10 hover:bg-error/20 text-error font-medium transition-colors active:bg-error/30"
        >
          − Entnehmen
        </button>
        <div className="w-px bg-gray-200 dark:bg-gray-700" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdjust(1);
          }}
          className="flex-1 py-3 bg-success/10 hover:bg-success/20 text-success font-medium transition-colors active:bg-success/30"
        >
          + Hinzufügen
        </button>
      </div>
    </motion.div>
  );
}
