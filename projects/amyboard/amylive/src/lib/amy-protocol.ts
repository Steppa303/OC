// ─── AMY Wire Protocol Generator & Parser ────────────────────────────
// Translates between JavaScript objects and the human-readable AMY wire
// format used for manual command entry and state dumps.
//
// Reference: https://github.com/bwhitman/amy

import {
  type AmyParams,
  type CtrlCoefValues,
} from '@/types/amy';
import {
  WIRE_CODES,
  CTRL_COEF_ORDER,
  CTRL_COEF_PARAMS,
  SINGLE_CHAR_NUMERIC_PARAMS,
  ENVELOPE_PARAMS,
  TWO_CHAR_PARAMS,
  REVERSE_WIRE_CODES,
} from './amy-constants';

// ─── CtrlCoef String Builder ──────────────────────────────────────────
// Builds a CtrlCoef string of the form:
//   f=const,note,vel,eg0,eg1,mod,bend,ext0,ext1
// with exactly 9 comma-separated slots. Empty slots produce "" between
// commas so positions are preserved.
export function ctrlCoef(values: CtrlCoefValues): string {
  return CTRL_COEF_ORDER.map((slot) => {
    const v = values[slot];
    return v !== undefined ? String(v) : '';
  }).join(',');
}

// ─── CtrlCoef String Parser ───────────────────────────────────────────
// Inverse of ctrlCoef(). Returns a CtrlCoefValues object with only the
// slots that contain a numeric value set.
export function parseCtrlCoef(raw: string): CtrlCoefValues {
  const parts = raw.split(',');
  const result: CtrlCoefValues = {};
  for (let i = 0; i < CTRL_COEF_ORDER.length && i < parts.length; i++) {
    const slot = parts[i].trim();
    if (slot !== '') {
      const num = Number(slot);
      if (!Number.isNaN(num)) {
        result[CTRL_COEF_ORDER[i]] = num;
      }
    }
  }
  return result;
}

// ─── AMY Message Builder ──────────────────────────────────────────────
// Translates an AmyParams object into a complete wire-format string.
// Examples:
//   amyMessage({ osc: 0, wave: 0, freq: 220, amp: 0.5 })
//   → "v0w0f220a0.5"
//
//   amyMessage({ freq: { note: 60, vel: 1 } })
//   → "f,60,1,,,,,,"
export function amyMessage(params: AmyParams): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    const code = WIRE_CODES[key];
    if (!code) continue; // Unknown key – skip silently.

    if (TWO_CHAR_PARAMS.has(key)) {
      parts.push(`${code}${String(value)}`);
      continue;
    }

    if (key === 'voices' && Array.isArray(value)) {
      parts.push(`${code}${value.join(',')}`);
      continue;
    }

    if (CTRL_COEF_PARAMS.has(key) && typeof value === 'object' && !Array.isArray(value)) {
      // CtrlCoef object
      parts.push(`${code}${ctrlCoef(value as CtrlCoefValues)}`);
      continue;
    }

    if (CTRL_COEF_PARAMS.has(key) && typeof value === 'number') {
      // Direct numeric value for a CtrlCoef-capable parameter
      parts.push(`${code}${value}`);
      continue;
    }

    // Everything else: number, string, …
    parts.push(`${code}${String(value)}`);
  }

  return parts.join('');
}

// ─── AMY Wire String (alias) ──────────────────────────────────────────
export const amyWireString = amyMessage;

// ─── Wire Line Parser ─────────────────────────────────────────────────
// Parses a single line of AMY wire text back into a key-value object.
// Returns null if the line is empty or unrecognised.
export function parseWireLine(line: string): Record<string, any> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const result: Record<string, any> = {};
  let pos = 0;
  const len = trimmed.length;

  while (pos < len) {
    // Peek single-char or two-char wire code.
    const singleChar = trimmed[pos];
    const twoChar = pos + 1 < len ? trimmed.slice(pos, pos + 2) : null;

    // Determine which code matched.
    let matchedCode: string | null = null;
    let paramName: string | undefined;

    // Check two-char codes first.
    if (twoChar && REVERSE_WIRE_CODES[twoChar]) {
      matchedCode = twoChar;
      paramName = REVERSE_WIRE_CODES[twoChar];
    } else if (REVERSE_WIRE_CODES[singleChar]) {
      matchedCode = singleChar;
      paramName = REVERSE_WIRE_CODES[singleChar];
    }

    if (!matchedCode || !paramName) {
      // Unknown prefix – skip one character to avoid infinite loop.
      pos++;
      continue;
    }

    pos += matchedCode.length;

    // Extract the value that follows the wire code.
    const valueRaw = extractValue(trimmed, pos);
    if (valueRaw === null) break;

    pos = valueRaw.nextPos;

    // Decode the value based on parameter type.
    if (paramName === 'voices') {
      result[paramName] = valueRaw.text
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
    } else if (CTRL_COEF_PARAMS.has(paramName) && valueRaw.text.includes(',')) {
      // Looks like a CtrlCoef string (multiple comma-separated slots).
      result[paramName] = parseCtrlCoef(valueRaw.text);
    } else if (SINGLE_CHAR_NUMERIC_PARAMS.has(paramName)) {
      result[paramName] = Number(valueRaw.text);
    } else if (ENVELOPE_PARAMS.has(paramName)) {
      // BP0 / BP1 – keep as string.
      result[paramName] = valueRaw.text;
    } else {
      // Try numeric, fall back to string.
      const num = Number(valueRaw.text);
      result[paramName] = Number.isNaN(num) ? valueRaw.text : num;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ─── Value Extraction Helper ──────────────────────────────────────────
// Reads the value portion that follows a wire-code prefix. The value runs
// until the next known wire-code prefix or end-of-string.
interface ValueResult {
  text: string;
  nextPos: number;
}

function extractValue(line: string, startPos: number): ValueResult | null {
  if (startPos >= line.length) return null;

  // Scan ahead until we hit a character that could start a new wire code.
  let end = startPos;
  while (end < line.length) {
    const c = line[end];
    const two = end + 1 < line.length ? line.slice(end, end + 2) : null;

    // If we encounter a known wire code *and* we're not at the start,
    // stop here because it belongs to the next parameter.
    if (end > startPos) {
      if (two && REVERSE_WIRE_CODES[two]) break;
      if (REVERSE_WIRE_CODES[c]) break;
    }

    // CtrlCoef values can contain alphabetic characters (scientific
    // notation like "1e-5") so we don't stop on letters during value
    // parsing – we only stop on unambiguous wire-code starts.
    end++;
  }

  return {
    text: line.slice(startPos, end),
    nextPos: end,
  };
}

// ─── Batch Parse (multiple lines joined by newline) ───────────────────
export function parseWireBlock(block: string): Record<string, any>[] {
  return block
    .split('\n')
    .map((line) => parseWireLine(line))
    .filter((item): item is Record<string, any> => item !== null);
}

// ─── Messages from Array of AmyParams ─────────────────────────────────
export function amyMessages(paramsArray: AmyParams[]): string[] {
  return paramsArray.map((p) => amyMessage(p));
}

// ─── Join multiple wire strings with newline separator ────────────────
export function amyWireBatch(paramsArray: AmyParams[]): string {
  return paramsArray.map((p) => amyMessage(p)).join('\n');
}