import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface QuickAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  currentQuantity: number;
  unit?: string;
  onAdjust: (change: number) => void;
}

export function QuickAdjustModal({
  isOpen,
  onClose,
  itemName,
  currentQuantity,
  unit,
  onAdjust,
}: QuickAdjustModalProps) {
  const [inputValue, setInputValue] = useState('');

  const handleNumpadClick = (digit: string) => {
    if (inputValue.length < 6) {
      setInputValue(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setInputValue(prev => prev.slice(0, -1));
  };

  const handleAdjust = (direction: 'add' | 'remove') => {
    const amount = parseInt(inputValue) || 1;
    const change = direction === 'add' ? amount : -amount;
    onAdjust(change);
    setInputValue('');
    onClose();
  };

  const displayQuantity = inputValue ? parseInt(inputValue) : 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Bestand anpassen
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Item Info */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">{itemName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aktueller Bestand: {currentQuantity} {unit}
                </p>
              </div>

              {/* Display */}
              <div className="mb-6 text-center">
                <div className="text-5xl font-bold text-primary mb-2">
                  {displayQuantity}
                </div>
                {unit && (
                  <div className="text-gray-500 dark:text-gray-400">{unit}</div>
                )}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumpadClick(String(num))}
                    className="py-4 text-2xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setInputValue('0')}
                  className="py-4 text-2xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={() => handleBackspace()}
                  className="py-4 text-xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
                >
                  ⌫
                </button>
                <button
                  onClick={() => setInputValue(prev => prev + '00')}
                  className="py-4 text-xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
                >
                  00
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAdjust('remove')}
                  className="py-4 bg-error text-white rounded-lg hover:bg-red-600 transition-colors font-semibold text-lg active:scale-95"
                >
                  − Entnehmen
                </button>
                <button
                  onClick={() => handleAdjust('add')}
                  className="py-4 bg-success text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-lg active:scale-95"
                >
                  + Hinzufügen
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
