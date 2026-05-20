
export interface ParsedCalendarEvent {
  summary: string;
  description: string;
  start: string;
  end: string;
  location: string;
}

/**
 * Unfolds lines in ICS format (lines starting with space are continuations of previous line)
 */
const unfoldIcsLines = (text: string): string => {
  return text.replace(/\r\n /g, '').replace(/\n /g, '');
};

/**
 * Extracts a value from a specific field in a VEVENT block
 */
const extractField = (block: string, field: string): string => {
  // Regex looks for FIELD;PARAMS:VALUE or FIELD:VALUE
  const regex = new RegExp(`^${field}(?:;.*?)?:(.*)$`, 'm');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
};

/**
 * Formats ICS date strings (e.g. 20230520T100000Z) to readable ISO-like format
 */
const formatIcsDate = (icsDate: string): string => {
  if (!icsDate) return '';
  // Simple cleanup, keeping it raw enough for AI to understand context
  // 20230520T100000Z -> 2023-05-20 T 10:00:00Z
  const match = icsDate.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) return icsDate;
  
  const [_, y, m, d, h, min, s] = match;
  let str = `${y}-${m}-${d}`;
  if (h) str += ` ${h}:${min}:${s}`;
  return str;
};

export const parseCalendarFile = async (file: File): Promise<string> => {
  try {
    const text = await file.text();
    const unfoldedText = unfoldIcsLines(text);
    
    // Split into Events
    const eventsRaw = unfoldedText.split('BEGIN:VEVENT');
    // Remove header part (before first event)
    eventsRaw.shift();

    if (eventsRaw.length === 0) {
        throw new Error("Keine Termine in der Kalenderdatei gefunden.");
    }

    let output = "[KALENDER IMPORT]\n";

    eventsRaw.forEach((block, index) => {
        // Stop if not a real event block
        if (!block.includes('END:VEVENT')) return;

        const summary = extractField(block, 'SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, '\n');
        const description = extractField(block, 'DESCRIPTION').replace(/\\,/g, ',').replace(/\\n/g, '\n');
        const start = formatIcsDate(extractField(block, 'DTSTART'));
        const end = formatIcsDate(extractField(block, 'DTEND'));
        const location = extractField(block, 'LOCATION').replace(/\\,/g, ',');

        output += `\n--- Termin ${index + 1} ---\n`;
        if (summary) output += `Titel: ${summary}\n`;
        if (start) output += `Start: ${start}\n`;
        if (end) output += `Ende: ${end}\n`;
        if (location) output += `Ort: ${location}\n`;
        if (description) output += `Details: ${description}\n`;
    });

    return output;

  } catch (error) {
    console.error("Calendar Parse Error:", error);
    throw new Error("Konnte Kalenderdatei nicht lesen.");
  }
};
