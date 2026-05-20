import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

// Create test data
const testData = [
  ['Artikelname', 'Menge', 'Einheit', 'Kategorie', 'Ort'],
  ['Kugelschreiber blau', 150, 'Stk.', 'Büromaterial', 'Regal A1'],
  ['Notizbuch A4', 75, 'Stk.', 'Büromaterial', 'Regal A2'],
  ['Druckerpatrone Schwarz', 30, 'Stk.', 'Elektronik', 'Regal B1'],
  ['Kopierpapier 80g', 500, 'Blatt', 'Büromaterial', 'Regal C1'],
  ['USB-Kabel Type-C', 45, 'Stk.', 'Elektronik', 'Regal B2'],
  ['Kaffeebohnen 1kg', 20, 'Pkg.', 'Küche', 'Kühlschrank'],
  ['Zucker', 15, 'kg', 'Küche', 'Schrank 1'],
  ['Milch 1L', 24, 'Flaschen', 'Küche', 'Kühlschrank'],
  ['Teebeutel', 100, 'Stk.', 'Küche', 'Schrank 2'],
  ['Handtücher', 40, 'Stk.', 'Hygiene', 'Schrank 3'],
  ['Seife', 60, 'Stk.', 'Hygiene', 'Schrank 4'],
  ['Desinfektionsmittel', 35, 'Flaschen', 'Hygiene', 'Schrank 5'],
  ['Schrauben M5', 500, 'Stk.', 'Werkstatt', 'Kiste 1'],
  ['Muttern M5', 500, 'Stk.', 'Werkstatt', 'Kiste 2'],
  ['Holzschrauben 40mm', 200, 'Stk.', 'Werkstatt', 'Kiste 3'],
];

const worksheet = XLSX.utils.aoa_to_sheet(testData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Lagerbestand');

writeFileSync('test-data.xlsx', XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }));
console.log('Test Excel file created: test-data.xlsx');
