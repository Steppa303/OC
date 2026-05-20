import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { ArticleList } from './components/ArticleList';
import { ArticleDetail } from './components/ArticleDetail';
import { QuickAdjustModal } from './components/QuickAdjustModal';
import { ExcelImportWizard } from './components/ExcelImportWizard';
import { AddArticleModal } from './components/AddArticleModal';
import { ToastContainer } from './components/Toast';
import { useItems } from './hooks/useItems';
import { useAppStore } from './store/itemStore';
import { Item, StockHistory } from './types';

function App() {
  const { items, isLoading, searchQuery } = useItems();
  const {
    selectedItemId,
    setSearchQuery,
    setSelectedItem,
    getItemById,
    adjustQuantity,
    addItem,
    getItemHistoryData,
  } = useAppStore();

  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showAddArticle, setShowAddArticle] = useState(false);
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);
  const [quickAdjustItemId, setQuickAdjustItemId] = useState<string | null>(null);
  const [itemHistory, setItemHistory] = useState<StockHistory[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const selectedItem = selectedItemId ? getItemById(selectedItemId) : null;

  // Load history when item is selected
  useEffect(() => {
    if (selectedItemId) {
      getItemHistoryData(selectedItemId).then(setItemHistory);
    }
  }, [selectedItemId]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleItemClick = (id: string) => {
    setSelectedItem(id);
  };

  const handleBackToList = () => {
    setSelectedItem(null);
  };

  const handleQuickAdjust = async (itemId: string, change: number) => {
    await adjustQuantity(itemId, change, 'Schnellanpassung');
    addToast(`Bestand um ${change > 0 ? '+' : ''}${change} geändert`, 'success');
  };

  const handleLongPress = (itemId: string) => {
    setQuickAdjustItemId(itemId);
    setShowQuickAdjust(true);
  };

  const handleQuickAdjustConfirm = async (change: number) => {
    if (quickAdjustItemId) {
      await handleQuickAdjust(quickAdjustItemId, change);
      setShowQuickAdjust(false);
      setQuickAdjustItemId(null);
    }
  };

  const handleImportComplete = async (importedItems: Item[]) => {
    for (const item of importedItems) {
      await addItem(item);
    }
    addToast(`${importedItems.length} Artikel erfolgreich importiert`, 'success');
  };

  const handleExport = () => {
    // This will be handled by ExcelExportButton component
  };

  if (selectedItem) {
    return (
      <>
        <ArticleDetail
          item={selectedItem}
          history={itemHistory}
          onBack={handleBackToList}
          onAdjust={async (change) => {
            await handleQuickAdjust(selectedItem.id, change);
            addToast(`Bestand um ${change > 0 ? '+' : ''}${change} geändert`, 'success');
          }}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        onImport={() => setShowImportWizard(true)}
        onExport={handleExport}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Artikel suchen..."
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Lade Artikel...</p>
          </div>
        ) : (
          /* Article List */
          <ArticleList
            items={items}
            onItemClick={handleItemClick}
            onQuickAdjust={handleQuickAdjust}
            onLongPress={handleLongPress}
          />
        )}

        {/* Floating Action Button */}
        <button
          onClick={() => setShowAddArticle(true)}
          className="fixed bottom-6 right-6 p-4 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors active:scale-95"
          aria-label="Neuer Artikel"
        >
          <Plus className="w-6 h-6" />
        </button>
      </main>

      {/* Import Wizard */}
      <ExcelImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Add Article Modal */}
      <AddArticleModal
        isOpen={showAddArticle}
        onClose={() => setShowAddArticle(false)}
        onAdded={() => {
          setShowAddArticle(false);
          addToast('Artikel erfolgreich hinzugefügt', 'success');
        }}
      />

      {/* Quick Adjust Modal */}
      {quickAdjustItemId && (
        <QuickAdjustModal
          isOpen={showQuickAdjust}
          onClose={() => {
            setShowQuickAdjust(false);
            setQuickAdjustItemId(null);
          }}
          itemName={getItemById(quickAdjustItemId)?.name || ''}
          currentQuantity={getItemById(quickAdjustItemId)?.quantity || 0}
          unit={getItemById(quickAdjustItemId)?.unit}
          onAdjust={handleQuickAdjustConfirm}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
