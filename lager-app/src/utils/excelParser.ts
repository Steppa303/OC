import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { ColumnMapping, Item } from '../types';
import { detectColumnType, extractNumber, extractUnit } from './heuristics';

export async function parseExcelFile(file: File): Promise<{
  sheets: string[];
  rawData: any[][];
}> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  
  return {
    sheets: workbook.SheetNames,
    rawData: [], // Will be populated after sheet selection
  };
}

export async function parseSheet(file: File, sheetName: string): Promise<any[][]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  return jsonData;
}

export function analyzeColumns(rawData: any[][]): ColumnMapping[] {
  if (rawData.length === 0) return [];

  const headers = rawData[0] || [];
  const dataRows = rawData.slice(1);

  return headers.map((header, colIndex) => {
    const columnValues = dataRows.map(row => row[colIndex]);
    const { type, confidence } = detectColumnType(String(header || ''), columnValues);

    return {
      columnIndex: colIndex,
      header: String(header || `Spalte ${colIndex + 1}`),
      detectedType: type,
      confidence,
      selectedType: confidence > 0.8 ? type : 'UNKNOWN',
    };
  });
}

export async function extractImagesFromExcel(file: File): Promise<Record<number, string>> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const imageMap: Record<number, string> = {};

    // Extract images from xl/media/ folder
    const mediaFolder = zip.folder('xl/media');
    if (!mediaFolder) return imageMap;

    const imageFiles = Object.keys(mediaFolder.files).filter(name => 
      /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name)
    );

    for (const imagePath of imageFiles) {
      const imageData = await zip.file(imagePath)!.async('base64');
      const ext = imagePath.split('.').pop()?.toLowerCase();
      const base64 = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imageData}`;
      
      // Try to map image to row based on filename patterns
      // This is a simplified approach - real implementation would parse drawing relationships
      const match = imagePath.match(/(\d+)/);
      if (match) {
        const rowNum = parseInt(match[1]) - 1; // Convert to 0-indexed
        imageMap[rowNum] = base64;
      }
    }

    return imageMap;
  } catch (error) {
    console.error('Image extraction failed:', error);
    return {};
  }
}

export function convertToItems(
  rawData: any[][],
  columnMappings: ColumnMapping[],
  imageMap: Record<number, string>
): Item[] {
  const headers = rawData[0];
  const dataRows = rawData.slice(1);
  const items: Item[] = [];

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    
    // Find mapped columns
    const nameCol = columnMappings.find(m => m.selectedType === 'ARTICLE_NAME')?.columnIndex;
    const quantityCol = columnMappings.find(m => m.selectedType === 'QUANTITY')?.columnIndex;
    const unitCol = columnMappings.find(m => m.selectedType === 'UNIT')?.columnIndex;
    const categoryCol = columnMappings.find(m => m.selectedType === 'CATEGORY')?.columnIndex;
    const locationCol = columnMappings.find(m => m.selectedType === 'LOCATION')?.columnIndex;
    const ippCol = columnMappings.find(m => m.selectedType === 'ITEMS_PER_PACKAGE')?.columnIndex;
    const imageCol = columnMappings.find(m => m.selectedType === 'IMAGE_REF')?.columnIndex;

    if (nameCol === undefined || row[nameCol] == null) continue;

    const name = String(row[nameCol]).trim();
    if (!name) continue;

    let quantity = 0;
    if (quantityCol !== undefined && row[quantityCol] != null) {
      quantity = extractNumber(row[quantityCol]);
    }

    let unit = unitCol !== undefined && row[unitCol] ? String(row[unitCol]).trim() : undefined;
    if (!unit && quantityCol !== undefined) {
      unit = extractUnit(row[quantityCol]);
    }

    const category = categoryCol !== undefined && row[categoryCol] ? String(row[categoryCol]).trim() : undefined;
    const location = locationCol !== undefined && row[locationCol] ? String(row[locationCol]).trim() : undefined;
    
    let imageUrl = imageMap[rowIndex];
    if (!imageUrl && imageCol !== undefined && row[imageCol]) {
      const imgValue = String(row[imageCol]).trim();
      if (imgValue.startsWith('http://') || imgValue.startsWith('https://') || imgValue.startsWith('data:')) {
        imageUrl = imgValue;
      }
    }

    // Items per package
    let itemsPerPackage: number | undefined;
    if (ippCol !== undefined && row[ippCol] != null) {
      const ippVal = parseInt(String(row[ippCol]).trim(), 10);
      if (!isNaN(ippVal) && ippVal > 0) {
        itemsPerPackage = ippVal;
      }
    }

    const now = new Date().toISOString();

    items.push({
      id: crypto.randomUUID(),
      name,
      quantity,
      unit,
      itemsPerPackage,
      category,
      location,
      imageUrl,
      createdAt: now,
      updatedAt: now,
    });
  }

  return items;
}

export function exportToExcel(items: Item[]): Blob {
  const data = items.map(item => ({
    'Name': item.name,
    'Menge': item.quantity,
    'Einheit': item.unit || '',
    'Stk. pro Gebinde': item.itemsPerPackage || '',
    'Kategorie': item.category || '',
    'Ort': item.location || '',
    'Letztes Update': new Date(item.updatedAt).toLocaleDateString('de-DE'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lagerbestand');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
