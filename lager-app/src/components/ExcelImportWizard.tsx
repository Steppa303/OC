import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { parseExcelFile, parseSheet, analyzeColumns, extractImagesFromExcel, convertToItems } from '../utils/excelParser';
import { ColumnMapping, Item, ImportState } from '../types';
import { useAppStore } from '../store/itemStore';

interface ExcelImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (items: Item[]) => void;
}

const COLUMN_TYPES = [
  { value: 'UNKNOWN', label: '— Nicht zuordnen —' },
  { value: 'ARTICLE_NAME', label: 'Artikelname' },
  { value: 'QUANTITY', label: 'Menge' },
  { value: 'UNIT', label: 'Einheit' },
  { value: 'ITEMS_PER_PACKAGE', label: 'Stk. pro Gebinde' },
  { value: 'CATEGORY', label: 'Kategorie' },
  { value: 'LOCATION', label: 'Ort' },
  { value: 'IMAGE_REF', label: 'Bild-Referenz' },
] as const;

export function ExcelImportWizard({ isOpen, onClose, onImportComplete }: ExcelImportWizardProps) {
  const { importState, setImportState, resetImportState } = useAppStore();
  const [error, setError] = useState<string | null>(null);

  // Step 1: File Upload
  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      
      const { sheets } = await parseExcelFile(file);
      
      if (sheets.length === 1) {
        // Auto-select single sheet - do everything in one go to avoid stale state
        const rawData = await parseSheet(file, sheets[0]);
        const columnMappings = analyzeColumns(rawData);
        setImportState({ 
          file, 
          sheets, 
          selectedSheet: sheets[0], 
          rawData, 
          columnMappings,
          step: 2 
        });
      } else {
        setImportState({ file, sheets, step: 1 });
      }
    } catch (err) {
      setError('Fehler beim Lesen der Excel-Datei');
      console.error(err);
    }
  };

  // Step 2: Sheet Selection
  const handleSheetSelect = async (sheetName: string) => {
    try {
      setError(null);
      
      if (!importState.file) return;
      
      const rawData = await parseSheet(importState.file, sheetName);
      const columnMappings = analyzeColumns(rawData);
      setImportState({ 
        selectedSheet: sheetName, 
        rawData, 
        columnMappings,
        step: 2 
      });
    } catch (err) {
      setError('Fehler beim Parsen des Sheets');
      console.error(err);
    }
  };

  // Step 3: Column Mapping
  const handleColumnMappingChange = (columnIndex: number, newType: string) => {
    const updatedMappings = importState.columnMappings.map(mapping =>
      mapping.columnIndex === columnIndex
        ? { ...mapping, selectedType: newType as any }
        : mapping
    );
    setImportState({ columnMappings: updatedMappings });
  };

  // Step 4: Preview & Import
  const handleImport = async () => {
    try {
      setError(null);
      setImportState({ isImporting: true, progress: 0 });
      
      if (!importState.file || !importState.rawData.length) return;
      
      // Extract images
      const imageMap = await extractImagesFromExcel(importState.file);
      
      // Convert to items
      const items = convertToItems(
        importState.rawData,
        importState.columnMappings,
        imageMap
      );
      
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setImportState({ progress: i });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      setImportState({ isImporting: false });
      onImportComplete(items);
      resetImportState();
      onClose();
    } catch (err) {
      setError('Fehler beim Importieren der Daten');
      setImportState({ isImporting: false });
      console.error(err);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-success';
    if (confidence > 0.5) return 'text-yellow-500';
    return 'text-error';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence > 0.8) return 'Hoch';
    if (confidence > 0.5) return 'Mittel';
    return 'Niedrig';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Excel-Import
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {['Datei hochladen', 'Sheet auswählen', 'Spalten zuordnen', 'Import bestätigen'].map((label, index) => (
                <div key={label} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      importState.step > index
                        ? 'bg-success text-white'
                        : importState.step === index
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {importState.step > index ? <Check className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className="ml-2 text-sm hidden sm:inline">{label}</span>
                  {index < 3 && (
                    <div
                      className={`w-8 sm:w-16 h-0.5 mx-2 ${
                        importState.step > index ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-error/10 border border-error rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                <p className="text-error">{error}</p>
              </div>
            )}

            {/* Step 1: File Upload */}
            {importState.step === 0 && (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Excel-Datei hochladen
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    .xlsx oder .xls Dateien unterstützt
                  </p>
                </label>
              </div>
            )}

            {/* Step 2: Sheet Selection */}
            {importState.step === 1 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sheet auswählen
                </h3>
                {importState.sheets.map(sheet => (
                  <button
                    key={sheet}
                    onClick={() => handleSheetSelect(sheet)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors"
                  >
                    <FileSpreadsheet className="w-6 h-6 text-primary" />
                    <span className="font-medium">{sheet}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Column Mapping */}
            {importState.step === 2 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Spalten zuordnen
                </h3>
                <div className="space-y-3">
                  {importState.columnMappings.map(mapping => (
                    <div
                      key={mapping.columnIndex}
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {mapping.header}
                        </span>
                        <span className={`text-sm ${getConfidenceColor(mapping.confidence)}`}>
                          {getConfidenceText(mapping.confidence)} ({Math.round(mapping.confidence * 100)}%)
                        </span>
                      </div>
                      <select
                        value={mapping.selectedType}
                        onChange={(e) => handleColumnMappingChange(mapping.columnIndex, e.target.value)}
                        className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary"
                      >
                        {COLUMN_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setImportState({ step: 3 })}
                  className="mt-6 w-full py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Weiter zur Vorschau
                </button>
              </div>
            )}

            {/* Step 4: Preview & Import */}
            {importState.step === 3 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Vorschau (erste 10 Zeilen)
                </h3>
                
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        {importState.columnMappings.map(mapping => (
                          <th key={mapping.columnIndex} className="text-left py-2 px-3 font-semibold">
                            {mapping.header}
                            <span className="block text-xs text-gray-500 font-normal">
                              {COLUMN_TYPES.find(t => t.value === mapping.selectedType)?.label}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importState.rawData.slice(1, 11).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-100 dark:border-gray-800">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="py-2 px-3">
                              {String(cell ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importState.isImporting ? (
                  <div className="space-y-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${importState.progress}%` }}
                      />
                    </div>
                    <p className="text-center text-gray-500 dark:text-gray-400">
                      Importiere... {importState.progress}%
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setImportState({ step: 2 })}
                      className="py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={handleImport}
                      className="py-3 bg-success text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Import starten
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
