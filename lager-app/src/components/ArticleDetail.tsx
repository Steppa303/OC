import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Calendar, MapPin, Tag } from 'lucide-react';
import { Item, StockHistory } from '../types';

interface ArticleDetailProps {
  item: Item;
  history: StockHistory[];
  onBack: () => void;
  onAdjust: (change: number) => void;
}

export function ArticleDetail({ item, history, onBack, onAdjust }: ArticleDetailProps) {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'remove'>('add');

  const handleNumpadClick = (digit: string) => {
    if (adjustValue.length < 6) {
      setAdjustValue(prev => prev + digit);
    }
  };

  const handleConfirm = () => {
    const amount = parseInt(adjustValue) || 1;
    const change = adjustDirection === 'add' ? amount : -amount;
    onAdjust(change);
    setAdjustValue('');
    setShowAdjustModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {item.name}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Image */}
        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-64 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
              <Package className="w-32 h-32 text-gray-400" />
            </div>
          )}
        </div>

        {/* Quantity Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-md text-center">
          <div className="text-7xl font-bold text-primary mb-2">
            {item.quantity}
          </div>
          {item.unit && (
            <div className="text-xl text-gray-500 dark:text-gray-400">
              {item.unit}
              {item.itemsPerPackage && item.itemsPerPackage > 0 && (
                <span className="block text-lg text-primary font-medium mt-1">
                  × {item.itemsPerPackage} = {item.quantity * item.itemsPerPackage} Stk. gesamt
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => {
              setAdjustDirection('remove');
              setShowAdjustModal(true);
            }}
            className="py-4 bg-error text-white rounded-lg hover:bg-red-600 transition-colors font-semibold text-lg active:scale-95"
          >
            − Entnehmen
          </button>
          <button
            onClick={() => {
              setAdjustDirection('add');
              setShowAdjustModal(true);
            }}
            className="py-4 bg-success text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-lg active:scale-95"
          >
            + Hinzufügen
          </button>
        </div>

        {/* Metadata */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Details</h2>
          
          {item.category && (
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">{item.category}</span>
            </div>
          )}
          
          {item.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">{item.location}</span>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              Letztes Update: {new Date(item.updatedAt).toLocaleDateString('de-DE')}
            </span>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Historie</h2>
            <div className="space-y-3">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
                >
                  <div>
                    <span
                      className={`font-semibold ${
                        entry.change > 0 ? 'text-success' : 'text-error'
                      }`}
                    >
                      {entry.change > 0 ? '+' : ''}{entry.change}
                    </span>
                    {entry.reason && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        — {entry.reason}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      {showAdjustModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-white dark:bg-gray-900 w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Bestand {adjustDirection === 'add' ? 'erhöhen' : 'reduzieren'}
            </h3>

            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-primary mb-2">
                {adjustValue || '1'}
              </div>
              {item.unit && <div className="text-gray-500">{item.unit}</div>}
            </div>

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
                onClick={() => setAdjustValue('0')}
                className="py-4 text-2xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => setAdjustValue(prev => prev.slice(0, -1))}
                className="py-4 text-xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
              >
                ⌫
              </button>
              <button
                onClick={() => setAdjustValue(prev => prev + '00')}
                className="py-4 text-xl font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
              >
                00
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="py-4 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirm}
                className={`py-4 text-white rounded-lg font-semibold transition-colors active:scale-95 ${
                  adjustDirection === 'add' ? 'bg-success hover:bg-green-600' : 'bg-error hover:bg-red-600'
                }`}
              >
                Bestätigen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
