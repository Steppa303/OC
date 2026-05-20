import { ColumnType } from '../types';

const KEYWORDS: Record<ColumnType, string[]> = {
  ARTICLE_NAME: ['artikel', 'name', 'produkt', 'ware', 'bezeichnung', 'titel', 'description', 'artikelname', 'artikel_name'],
  QUANTITY: ['menge', 'anzahl', 'quantity', 'count', 'bestand', 'stk', 'stück', 'anz', 'qty'],
  UNIT: ['einheit', 'unit', 'maß', 'uom', 'maßeinheit'],
  ITEMS_PER_PACKAGE: ['pro gebinde', 'pro packung', 'stk pro', 'inhalt', 'pieces per', 'menge pro', 'gebinde', 'pro karton', 'pro beutel'],
  IMAGE_REF: ['bild', 'image', 'foto', 'url', 'pfad', 'picture', 'img', 'photo'],
  CATEGORY: ['kategorie', 'category', 'cat', 'gruppe', 'typ'],
  LOCATION: ['ort', 'location', 'lager', 'regal', 'platz', 'standort'],
  UNKNOWN: [],
};

export function detectColumnType(header: string, dataValues: any[]): { type: ColumnType; confidence: number } {
  const headerLower = header.toLowerCase().trim();
  
  // Phase 1: Header-Analyse
  let bestMatch: ColumnType = 'UNKNOWN';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(KEYWORDS)) {
    if (type === 'UNKNOWN') continue;
    
    for (const keyword of keywords) {
      if (headerLower.includes(keyword)) {
        const score = keyword.length / headerLower.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = type as ColumnType;
        }
      }
    }
  }

  // Normalize header confidence to 0-1 range
  const headerConfidence = Math.min(bestScore * 2, 1);

  // Phase 2: Datenwert-Analyse
  const validValues = dataValues.filter(v => v !== null && v !== undefined && v !== '');
  if (validValues.length === 0) {
    return { type: bestMatch, confidence: headerConfidence * 0.5 };
  }

  let dataConfidence = 0;

  switch (bestMatch) {
    case 'ARTICLE_NAME':
      const stringCount = validValues.filter(v => typeof v === 'string' && v.length > 3).length;
      const uniqueRatio = new Set(validValues.map(String)).size / validValues.length;
      dataConfidence = (stringCount / validValues.length) * 0.8 + uniqueRatio * 0.2;
      break;

    case 'QUANTITY':
      const numericPattern = /^\d+(\.\d+)?\s*(stk|kg|m|l|liter|stück)?$/i;
      const numericCount = validValues.filter(v => {
        const str = String(v).trim();
        return numericPattern.test(str) || !isNaN(Number(str));
      }).length;
      dataConfidence = numericCount / validValues.length;
      break;

    case 'UNIT':
      const shortStrings = validValues.filter(v => typeof v === 'string' && v.length <= 10).length;
      const recurringValues = new Set(validValues.map(String));
      const recurringRatio = recurringValues.size / validValues.length;
      dataConfidence = (shortStrings / validValues.length) * 0.7 + (1 - recurringRatio) * 0.3;
      break;

    case 'IMAGE_REF':
      const imagePattern = /\.(jpg|jpeg|png|gif|bmp|webp)|^https?:\/\/|^data:image\//i;
      const imageCount = validValues.filter(v => imagePattern.test(String(v))).length;
      dataConfidence = imageCount / validValues.length;
      break;

    case 'ITEMS_PER_PACKAGE':
      const ippNumeric = validValues.filter(v => {
        const n = Number(v);
        return !isNaN(n) && n > 0 && n <= 10000;
      }).length;
      dataConfidence = ippNumeric / validValues.length;
      break;

    case 'CATEGORY':
    case 'LOCATION':
      const textCount = validValues.filter(v => typeof v === 'string').length;
      dataConfidence = textCount / validValues.length;
      break;

    default:
      dataConfidence = 0;
  }

  // Combined confidence
  const combinedConfidence = headerConfidence * 0.6 + dataConfidence * 0.4;

  return {
    type: bestMatch,
    confidence: Math.round(combinedConfidence * 100) / 100,
  };
}

export function extractNumber(value: any): number {
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

export function extractUnit(value: any): string | undefined {
  const str = String(value).trim();
  const match = str.match(/\d+(\.\d+)?\s*([a-zA-ZäöüÄÖÜß]+)$/);
  return match ? match[2] : undefined;
}
