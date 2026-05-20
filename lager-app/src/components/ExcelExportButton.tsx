import { Download } from 'lucide-react';
import { exportToExcel } from '../utils/excelParser';
import { Item } from '../types';

interface ExcelExportButtonProps {
  items: Item[];
}

export function ExcelExportButton({ items }: ExcelExportButtonProps) {
  const handleExport = () => {
    if (items.length === 0) {
      alert('Keine Artikel zum Exportieren vorhanden');
      return;
    }

    const blob = exportToExcel(items);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    link.download = `Lagerbestand_${date}.xlsx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
    >
      <Download className="w-5 h-5" />
      <span className="hidden sm:inline">Excel Export</span>
      <span className="sm:hidden">Export</span>
    </button>
  );
}
