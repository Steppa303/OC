import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package } from 'lucide-react';
import { useAppStore } from '../store/itemStore';

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddArticleModal({ isOpen, onClose, onAdded }: AddArticleModalProps) {
  const { addItem } = useAppStore();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Stk.');
  const [itemsPerPackage, setItemsPerPackage] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Package-based units where itemsPerPackage makes sense
  const packageUnits = ['Packung', 'Karton', 'Beutel', 'Set', 'Kiste', 'Palette'];
  const isPackageUnit = packageUnits.includes(unit);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Artikelname ist erforderlich';
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 0) {
      newErrors.quantity = 'Gültige Menge eingeben';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    
    const now = new Date().toISOString();
    await addItem({
      id: crypto.randomUUID(),
      name: name.trim(),
      quantity: parseInt(quantity, 10),
      unit: unit.trim() || undefined,
      itemsPerPackage: isPackageUnit && itemsPerPackage ? parseInt(itemsPerPackage, 10) : undefined,
      category: category.trim() || undefined,
      location: location.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Reset form
    setName('');
    setQuantity('');
    setUnit('Stk.');
    setItemsPerPackage('');
    setCategory('');
    setLocation('');
    setErrors({});
    setIsSubmitting(false);
    
    onAdded();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-gray-900 rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Neuer Artikel
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Schließen"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="article-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Artikelname *
              </label>
              <input
                id="article-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Kugelschreiber blau"
                className={`w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                  errors.name ? 'border-error' : 'border-gray-300 dark:border-gray-600'
                }`}
                autoFocus
              />
              {errors.name && (
                <p className="mt-1 text-sm text-error">{errors.name}</p>
              )}
            </div>

            {/* Quantity + Unit row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="article-quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Menge *
                </label>
                <input
                  id="article-quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  className={`w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${
                    errors.quantity ? 'border-error' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.quantity && (
                  <p className="mt-1 text-sm text-error">{errors.quantity}</p>
                )}
              </div>
              <div>
                <label htmlFor="article-unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Einheit
                </label>
                <select
                  id="article-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                >
                  <option value="Stk.">Stück</option>
                  <option value="kg">Kilogramm</option>
                  <option value="g">Gramm</option>
                  <option value="l">Liter</option>
                  <option value="ml">Milliliter</option>
                  <option value="m">Meter</option>
                  <option value="cm">Zentimeter</option>
                  <option value="Rolle">Rolle</option>
                  <option value="Packung">Packung</option>
                  <option value="Karton">Karton</option>
                  <option value="Beutel">Beutel</option>
                  <option value="Kiste">Kiste</option>
                  <option value="Palette">Palette</option>
                  <option value="Set">Set</option>
                </select>
              </div>
            </div>

            {/* Items per Package (conditional) */}
            {isPackageUnit && (
              <div>
                <label htmlFor="article-ipp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stückzahl pro {unit.toLowerCase()}
                </label>
                <input
                  id="article-ipp"
                  type="number"
                  value={itemsPerPackage}
                  onChange={(e) => setItemsPerPackage(e.target.value)}
                  placeholder="z.B. 24"
                  min="1"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                />
                {quantity && itemsPerPackage && (
                  <p className="mt-1 text-sm text-primary font-medium">
                    = {parseInt(quantity) * parseInt(itemsPerPackage)} Stück gesamt
                  </p>
                )}
              </div>
            )}

            {/* Category */}
            <div>
              <label htmlFor="article-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kategorie
              </label>
              <input
                id="article-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="z.B. Bürobedarf, Werkzeuge"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              />
            </div>

            {/* Location */}
            <div>
              <label htmlFor="article-location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lagerort
              </label>
              <input
                id="article-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="z.B. Regal A3, Schublade B1"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-base"
            >
              {isSubmitting ? 'Wird hinzugefügt...' : 'Artikel hinzufügen'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
