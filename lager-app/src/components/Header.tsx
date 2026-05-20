import { Package } from 'lucide-react';
import { DarkModeToggle } from './DarkModeToggle';

interface HeaderProps {
  onImport?: () => void;
  onExport?: () => void;
}

export function Header({ onImport, onExport }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
              Lagerbestandsverwaltung
            </h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onImport && (
              <button
                onClick={onImport}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <span className="hidden sm:inline">Excel Import</span>
                <span className="sm:hidden">Import</span>
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <span className="hidden sm:inline">Excel Export</span>
                <span className="sm:hidden">Export</span>
              </button>
            )}
            <DarkModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
