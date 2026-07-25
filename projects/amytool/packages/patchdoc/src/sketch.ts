/**
 * compileToSketch (docs/03 §4–5) — projects a PatchDoc onto a Python `sketch.py`.
 *
 * The sketch has two halves:
 *  1. Human-editable code: `import amy` + top-level `amy.send(...)` statements that
 *     mirror the compiled wire messages 1:1 (AMY runs top-level statements once at
 *     boot — docs/02 "Sketch model"). Any preserved custom code is appended verbatim.
 *  2. A trailing snapshot block `# amypatch:v1:<hash>:<base64>` carrying the whole
 *     PatchDoc plus a content hash of the code above it (docs/03 §5.3). Re-importing
 *     reads the doc back directly when the hash still matches (Level A); an external
 *     edit changes the hash and forces Level B re-parsing (P2-03).
 *
 * Round-trip guarantee #1 (docs/03 §5): `readEmbeddedPatchDoc(compileToSketch(doc))`
 * returns `doc` unchanged.
 *
 * parseSketch (docs/03 §4) is the inverse. Level A: if a hash-valid snapshot block is
 * present, load the embedded doc directly. Level B: a small tolerant parser statically
 * lifts top-level `amy.send(...)` setup into canonical wire and known `amyboard.*` CV
 * calls into `io` — **no code execution**. Everything it can't model is preserved
 * verbatim in `extras.userLoopCode` and surfaced as a read-only `core.customcode`
 * module on the canvas (docs/03 §5.4). parseSketch never throws.
 */
import {
  decodeMessage,
  encodeMessage,
  formatNumber,
  PARAMS,
  PARAM_BY_NAME,
  WireError,
  type AmyEvent,
  type AmyValue,
} from '@amy/protocol';
import { migrateToCurrent, MigrationError } from './migrate';
import { patchDocSchema, type ModuleInstance, type PatchDoc } from './schema';
import type { AllocationError, ModuleInfoProvider } from './allocate';
import { compileToWire } from './compile';

/** Marker prefix for the trailing snapshot comment. */
const SNAPSHOT_PREFIX = '# amypatch:v1:';
const SNAPSHOT_RE = /^# amypatch:v1:([0-9a-f]+):([A-Za-z0-9+/=]+)\s*$/m;

export interface CompiledSketch {
  source: string;
  errors: AllocationError[];
}

export function compileToSketch(doc: PatchDoc, provider: ModuleInfoProvider): CompiledSketch {
  const { messages, errors } = compileToWire(doc, provider);

  const usesBoard = doc.io.cvIn.length > 0 || doc.io.cvOut.length > 0;
  const lines: string[] = [];
  lines.push(`# AmyPatch Studio sketch — ${doc.meta.name}`);
  lines.push('# Generated from a PatchDoc. The code below is safe to edit; re-importing');
  lines.push('# re-reads it and warns if it no longer matches the snapshot at the bottom.');
  lines.push('');
  lines.push(usesBoard ? 'import amy, amyboard' : 'import amy');
  lines.push('');
  for (const message of messages) {
    lines.push(renderSend(decodeMessage(message)));
  }

  const custom = doc.extras.userLoopCode;
  if (custom !== null && custom.trim().length > 0) {
    lines.push('');
    lines.push('# --- custom code (preserved verbatim) ---');
    lines.push(custom.replace(/\s+$/, ''));
  }

  const body = lines.join('\n').replace(/\s+$/, '');
  const hash = hashCode(body);
  const encoded = toBase64(JSON.stringify(doc));
  const source = `${body}\n\n${SNAPSHOT_PREFIX}${hash}:${encoded}\n`;
  return { source, errors };
}

export interface EmbeddedReadResult {
  doc: PatchDoc;
  /** true when the code above the snapshot still matches the embedded hash. */
  hashValid: boolean;
}

/**
 * Level A read (docs/03 §5): extract the embedded PatchDoc from a sketch and report
 * whether the surrounding code is unmodified. Returns null when no snapshot block is
 * present (foreign code → Level B, handled in P2-03). Throws on a corrupt block.
 */
export function readEmbeddedPatchDoc(source: string): EmbeddedReadResult | null {
  const match = SNAPSHOT_RE.exec(source);
  if (!match) return null;
  const hash = match[1] ?? '';
  const encoded = match[2] ?? '';

  const before = source.slice(0, match.index).replace(/\s+$/, '');
  const hashValid = hashCode(before) === hash;

  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64(encoded));
  } catch {
    throw new SketchError('corrupt amypatch snapshot: payload is not valid JSON');
  }
  let migrated: unknown;
  try {
    migrated = migrateToCurrent(raw);
  } catch (err) {
    if (err instanceof MigrationError) throw new SketchError(err.message);
    throw err;
  }
  const result = patchDocSchema.safeParse(migrated);
  if (!result.success) {
    throw new SketchError(`corrupt amypatch snapshot: ${result.error.issues[0]?.message ?? 'invalid'}`);
  }
  return { doc: result.data, hashValid };
}

export class SketchError extends Error {}

// --- rendering -------------------------------------------------------------

/** Convert a raw AMY wire message into an `amy.send(...)` call (realtime board path). */
export function wireToAmySend(wire: string): string {
  return renderSend(decodeMessage(wire));
}

/** Render one decoded AMY event as an `amy.send(...)` call in canonical param order. */
function renderSend(event: AmyEvent): string {
  const parts: string[] = [];
  for (const def of PARAMS) {
    const value = event[def.name];
    if (value === undefined) continue;
    parts.push(`${def.name}=${renderValue(value)}`);
  }
  return `amy.send(${parts.join(', ')})`;
}

function renderValue(value: AmyValue): string {
  if (typeof value === 'string') return pyString(value);
  if (typeof value === 'number') return formatNumber(value);
  if (Array.isArray(value)) {
    // coefs / breakpoint / list params: AMY takes them as comma-separated strings,
    // empty slots preserved (docs/02 wire ↔ amy.send mapping is 1:1).
    return pyString(value.map((v) => (v === null || v === undefined ? '' : formatNumber(v as number))).join(','));
  }
  // Defensive: dict-form coefs never survive decodeMessage.
  return pyString(String(value));
}

function pyString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// --- parseSketch (Level A / Level B) ---------------------------------------

/** The module id used to hold unmodeled residue on the canvas (docs/03 §5.4). */
export const CUSTOM_CODE_TYPE = 'core.customcode';

export interface ParseResult {
  doc: PatchDoc;
  warnings: string[];
  /** true when the sketch was not fully modeled (residue / raw wire preserved). */
  lossy: boolean;
}

/**
 * Parse a Python sketch back into a PatchDoc. Never throws: unknown constructs
 * degrade to warnings + `extras` (docs/03 §4). Level A short-circuits on a valid
 * embedded snapshot; otherwise Level B statically lifts what it recognizes.
 */
export function parseSketch(src: string): ParseResult {
  const warnings: string[] = [];

  let embedded: EmbeddedReadResult | null = null;
  try {
    embedded = readEmbeddedPatchDoc(src);
  } catch (err) {
    warnings.push(
      err instanceof SketchError
        ? `embedded snapshot ignored (${err.message}); re-parsed from code`
        : 'embedded snapshot ignored; re-parsed from code',
    );
  }

  if (embedded && embedded.hashValid) {
    return { doc: embedded.doc, warnings, lossy: false };
  }
  if (embedded && !embedded.hashValid) {
    warnings.push('sketch code was edited after generation; re-parsed from code (embedded layout ignored)');
  }

  return levelB(stripSnapshot(src), warnings);
}

/** Remove the trailing snapshot comment line(s) so they aren't parsed as code. */
function stripSnapshot(src: string): string {
  return src.replace(/^[ \t]*# amypatch:v1:.*$/gm, '');
}

const IMPORT_AMY_RE = /^import\s+amy(\s*,\s*amyboard)?\s*$/;
const IMPORT_AMYBOARD_RE = /^import\s+amyboard\s*$/;
const SEND_RE = /^amy\.send\((.*)\)\s*$/;
const CV_IN_RE = /amyboard\.cv_in\s*\(\s*(?:channel\s*=\s*)?([01])/g;
const CV_OUT_RE = /amyboard\.(?:set_)?cv_out\s*\(/;
const HEADER_RE = /^# (AmyPatch Studio sketch|Generated from a PatchDoc|re-reads it|--- custom code)/;

function levelB(code: string, warnings: string[]): ParseResult {
  const lines = code.split('\n');
  const consumed = new Array<boolean>(lines.length).fill(false);
  const wire: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed === '') continue;
    // Only top-level (unindented) statements are "setup" we try to lift.
    if (/^\s/.test(line)) continue;

    if (IMPORT_AMY_RE.test(trimmed) || IMPORT_AMYBOARD_RE.test(trimmed)) {
      consumed[i] = true;
      continue;
    }
    const send = SEND_RE.exec(trimmed);
    if (send && balanced(send[1] ?? '')) {
      const message = tryEncodeSend(send[1] ?? '', warnings);
      if (message !== null) {
        wire.push(message);
        consumed[i] = true;
      }
      // On failure the line stays in the residue (preserved verbatim).
    }
  }

  // Known amyboard.* CV calls → io lanes (scanned across the whole sketch).
  const io = { midiChannel: 1, cvIn: [] as { channel: 0 | 1; mode: '1voct' }[], cvOut: [] as never[] };
  const seenCv = new Set<number>();
  for (const m of code.matchAll(CV_IN_RE)) {
    const ch = Number(m[1]) as 0 | 1;
    if (!seenCv.has(ch)) {
      seenCv.add(ch);
      io.cvIn.push({ channel: ch, mode: '1voct' });
    }
  }
  if (io.cvIn.length > 0) {
    warnings.push(`sketch reads CV input (amyboard.cv_in) on channel(s) ${[...seenCv].sort().join(', ')}; polling code preserved as custom code`);
  }
  if (CV_OUT_RE.test(code)) {
    warnings.push('sketch writes CV output (amyboard.cv_out); routing preserved as custom code');
  }

  const residue = cleanResidue(lines.filter((_, i) => !consumed[i]));

  const modules: ModuleInstance[] = [];
  if (residue !== null) {
    modules.push({
      id: 'code1',
      type: CUSTOM_CODE_TYPE,
      label: 'Custom Code',
      pos: { x: 0, y: 0 },
      params: {},
      advanced: false,
      state: { code: residue },
    });
    warnings.push('imported Python that could not be modeled is preserved in a Custom Code module');
  }

  const now = new Date().toISOString();
  const doc = patchDocSchema.parse({
    version: 1,
    meta: {
      id: crypto.randomUUID(),
      name: extractName(lines) ?? 'Imported Sketch',
      tags: [],
      createdAt: now,
      modifiedAt: now,
      origin: 'code-paste',
    },
    modules,
    cables: [],
    io,
    extras: { unmappedWire: wire, userLoopCode: residue },
  });

  const lossy = wire.length > 0 || residue !== null;
  return { doc, warnings, lossy };
}

/** Parse an `amy.send(...)` arg list into a canonical wire message, or null on failure. */
function tryEncodeSend(args: string, warnings: string[]): string | null {
  const event: AmyEvent = {};
  for (const arg of splitArgs(args)) {
    const eq = arg.indexOf('=');
    if (eq < 0) {
      warnings.push(`skipped amy.send: positional argument '${arg.trim()}' is not supported`);
      return null;
    }
    const key = arg.slice(0, eq).trim();
    const rawValue = arg.slice(eq + 1).trim();
    const def = PARAM_BY_NAME.get(key);
    if (!def) {
      warnings.push(`skipped amy.send: unknown AMY param '${key}'`);
      return null;
    }
    const value = coerceValue(def.kind, rawValue);
    if (value === undefined) {
      warnings.push(`skipped amy.send: bad value for '${key}' (${rawValue})`);
      return null;
    }
    event[def.name] = value;
  }
  if (Object.keys(event).length === 0) return null;
  try {
    return encodeMessage(event);
  } catch (err) {
    warnings.push(`skipped amy.send: ${err instanceof WireError ? err.message : 'could not encode'}`);
    return null;
  }
}

/** Coerce a Python literal (number or quoted string) to the value a param kind expects. */
function coerceValue(kind: string, raw: string): AmyValue | undefined {
  const str = unquote(raw);
  if (kind === 'string') {
    return str ?? raw;
  }
  if (kind === 'uint' || kind === 'int' || kind === 'float') {
    const source = str ?? raw;
    const n = Number(source);
    return Number.isFinite(n) ? n : undefined;
  }
  // list / coefs / breakpoint params: AMY passes them as comma-separated strings.
  const source = str ?? raw;
  const parts = source.split(',').map((p) => p.trim());
  const list: (number | null)[] = [];
  for (const part of parts) {
    if (part === '') {
      list.push(null);
      continue;
    }
    const n = Number(part);
    if (!Number.isFinite(n)) return undefined;
    list.push(n);
  }
  return list;
}

/** Return the content of a quoted Python string literal, or null if not quoted. */
function unquote(raw: string): string | null {
  if (raw.length >= 2 && (raw[0] === "'" || raw[0] === '"') && raw[raw.length - 1] === raw[0]) {
    return raw.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  }
  return null;
}

/** Split a call arg list on top-level commas (respecting quotes and nesting). */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let depth = 0;
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      cur += ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      cur += ch;
    } else if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x !== '');
}

/** True when parens/brackets in a fragment are balanced (ignoring quoted text). */
function balanced(s: string): boolean {
  let depth = 0;
  let quote: string | null = null;
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && quote === null;
}

/** Trim generated header/blank lines and return the residual code, or null if empty. */
function cleanResidue(residueLines: string[]): string | null {
  const lines = [...residueLines];
  while (lines.length > 0) {
    const first = (lines[0] ?? '').trim();
    if (first === '' || HEADER_RE.test(first)) lines.shift();
    else break;
  }
  while (lines.length > 0 && (lines[lines.length - 1] ?? '').trim() === '') lines.pop();
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  return text.trim() === '' ? null : text;
}

/** Recover a patch name from a generated `# ... sketch — NAME` header comment. */
function extractName(lines: string[]): string | null {
  for (const line of lines) {
    const m = /^#\s*AmyPatch Studio sketch\s+—\s+(.+?)\s*$/.exec(line);
    if (m) return m[1] ?? null;
    if (line.trim() !== '' && !line.trim().startsWith('#')) break;
  }
  return null;
}

// --- portable base64 (UTF-8 safe) ------------------------------------------

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// --- content hash (non-crypto, deterministic) ------------------------------

/**
 * cyrb53 → 53-bit hash rendered as hex. Not security-sensitive: it only detects
 * whether the human-edited code still matches the embedded snapshot (docs/03 §5.3).
 */
function hashCode(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, '0');
}
