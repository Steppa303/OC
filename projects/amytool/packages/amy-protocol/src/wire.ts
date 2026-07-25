/**
 * AMY wire message codec. A wire message is `<code><value>` fields concatenated,
 * terminated with `Z`, e.g. `v0n50l1K130r0Z` (README §Controlling AMY in code).
 *
 * Field order within a message is irrelevant to AMY (all fields fill one amy_event),
 * so this codec defines a canonical order (PARAMS table order) to keep compiled
 * output deterministic and golden-testable.
 *
 * String-valued params (`zP`, `zD`, `zA`, `u`, …) are "rest of message": AMY strips
 * only the trailing `Z`. The encoder therefore allows at most one string param per
 * message and always places it last.
 */
import type { ParamDef } from './params';
import { PARAMS, PARAM_BY_NAME } from './params';
import { COEF_ORDER } from './constants';

/** ControlCoefficients: positional (null = leave unchanged) or named slots. */
export type CoefValue = number | readonly (number | null)[] | Partial<Record<(typeof COEF_ORDER)[number], number>>;

export type AmyValue = number | string | readonly (number | null)[] | CoefValue;

/** One AMY event as a kwargs object, keys from the PARAMS table. */
export type AmyEvent = Record<string, AmyValue>;

export class WireError extends Error {}

function coefsToList(value: CoefValue): readonly (number | null)[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value;
  const dict = value as Partial<Record<(typeof COEF_ORDER)[number], number>>;
  const list: (number | null)[] = COEF_ORDER.map((k) => dict[k] ?? null);
  while (list.length > 0 && list[list.length - 1] === null) list.pop();
  return list;
}

/** Format a number the way AMY wire values are serialized (no exponent). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new WireError(`non-finite number ${n}`);
  // Avoid exponent notation for the ranges AMY uses.
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  let s = n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

function encodeValue(def: ParamDef, value: AmyValue): string {
  switch (def.kind) {
    case 'uint':
    case 'int':
    case 'float': {
      if (typeof value !== 'number') throw new WireError(`${def.name}: expected number`);
      if ((def.kind === 'uint' || def.kind === 'int') && !Number.isInteger(value))
        throw new WireError(`${def.name}: expected integer, got ${value}`);
      if (def.kind === 'uint' && value < 0) throw new WireError(`${def.name}: expected >= 0`);
      return formatNumber(value);
    }
    case 'intlist':
    case 'floatlist':
    case 'bplist': {
      const list = typeof value === 'number' ? [value] : value;
      if (typeof list === 'string' || !Array.isArray(list))
        throw new WireError(`${def.name}: expected number[]`);
      return list.map((v) => (v === null || v === undefined ? '' : formatNumber(v))).join(',');
    }
    case 'coefs': {
      if (typeof value === 'string') throw new WireError(`${def.name}: expected coefs`);
      return coefsToList(value as CoefValue)
        .map((v) => (v === null ? '' : formatNumber(v)))
        .join(',');
    }
    case 'string': {
      if (typeof value !== 'string') throw new WireError(`${def.name}: expected string`);
      if (value.endsWith('Z'))
        throw new WireError(`${def.name}: string values ending in 'Z' are not addressable in the wire format`);
      return value;
    }
  }
}

/** Encode an event to a wire message in canonical (PARAMS table) order. */
export function encodeMessage(event: AmyEvent): string {
  let out = '';
  let stringField: string | null = null;
  for (const def of PARAMS) {
    const value = event[def.name];
    if (value === undefined) continue;
    const encoded = encodeValue(def, value);
    if (def.kind === 'string') {
      if (stringField !== null)
        throw new WireError(`only one string param per message (${stringField} + ${def.name})`);
      stringField = def.name;
      out += def.wire + encoded; // rest-of-message: must stay last
    } else {
      if (stringField !== null) throw new WireError(`string param ${stringField} must be last`);
      out += def.wire + encoded;
    }
  }
  for (const key of Object.keys(event)) {
    if (!PARAM_BY_NAME.has(key)) throw new WireError(`unknown AMY param '${key}'`);
  }
  if (out === '') throw new WireError('empty event');
  return out + 'Z';
}

const NUMERIC_VALUE = /^[-0-9.,eE+]*/;

function parseNumber(text: string, def: ParamDef): number {
  const n = Number(text);
  if (!Number.isFinite(n)) throw new WireError(`${def.name}: invalid number '${text}'`);
  return n;
}

function parseList(text: string, def: ParamDef): (number | null)[] {
  return text.split(',').map((part) => (part === '' ? null : parseNumber(part, def)));
}

/** Decode one wire message (with or without trailing Z) into an event object. */
export function decodeMessage(message: string): AmyEvent {
  let body = message.trim();
  if (body.endsWith('Z')) body = body.slice(0, -1);
  const event: AmyEvent = {};
  let i = 0;
  while (i < body.length) {
    // Two-letter codes (z*, i*) take precedence over single letters.
    const two = body.slice(i, i + 2);
    const one = body[i] ?? '';
    const def = PARAM_BY_WIRE_2.get(two) ?? PARAM_BY_WIRE_1.get(one);
    if (!def) throw new WireError(`unknown wire code at '${body.slice(i, i + 8)}'`);
    i += def.wire.length;
    if (def.kind === 'string') {
      // Rest of message belongs to this param.
      event[def.name] = body.slice(i);
      i = body.length;
      continue;
    }
    const match = NUMERIC_VALUE.exec(body.slice(i));
    const raw = match ? match[0] : '';
    i += raw.length;
    switch (def.kind) {
      case 'uint':
      case 'int':
      case 'float':
        event[def.name] = parseNumber(raw, def);
        break;
      case 'intlist':
      case 'floatlist':
      case 'bplist':
      case 'coefs': {
        const list = parseList(raw, def);
        event[def.name] = list;
        break;
      }
    }
  }
  return event;
}

const PARAM_BY_WIRE_1 = new Map(PARAMS.filter((p) => p.wire.length === 1).map((p) => [p.wire, p]));
const PARAM_BY_WIRE_2 = new Map(PARAMS.filter((p) => p.wire.length === 2).map((p) => [p.wire, p]));

/** Split a state dump (e.g. from `zD`) into individual wire messages. */
export function splitWireDump(dump: string): string[] {
  return dump
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
