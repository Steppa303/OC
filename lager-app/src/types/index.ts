export interface Item {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  itemsPerPackage?: number;
  category?: string;
  location?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockHistory {
  id: string;
  itemId: string;
  change: number;
  reason?: string;
  timestamp: string;
}

export type ColumnType = 'ARTICLE_NAME' | 'QUANTITY' | 'UNIT' | 'ITEMS_PER_PACKAGE' | 'IMAGE_REF' | 'CATEGORY' | 'LOCATION' | 'UNKNOWN';

export interface ColumnMapping {
  columnIndex: number;
  header: string;
  detectedType: ColumnType;
  confidence: number;
  selectedType: ColumnType;
}

export interface ImportState {
  step: number;
  file: File | null;
  sheets: string[];
  selectedSheet: string;
  rawData: any[][];
  columnMappings: ColumnMapping[];
  previewRows: any[][];
  isImporting: boolean;
  progress: number;
}
