/**
 * Static safety checks for generated `loopCode` (docs/05 §4). No execution: the
 * code is scanned after stripping comments and string literals, so keywords that
 * only appear inside strings don't trip the gate. Enforces an import whitelist and
 * forbids the file/network/exec/introspection escape hatches.
 *
 * This is the *static* gate that runs before loopCode lands in a patch. Actual
 * sandboxed execution (CPU budget, event validation) is the Phase-5/6 worker host
 * (P5-05 / P6-02); a full tree-sitter/pyodide AST is deferred with it — a tolerant
 * tokenizer is enough to reject the fixtures a cheap model produces.
 */
export const ALLOWED_IMPORTS = ['amy', 'amyboard', 'math', 'random', 'time'] as const;

/** Names that enable file/network/exec/introspection — forbidden anywhere. */
export const FORBIDDEN_NAMES = [
  'eval',
  'exec',
  'compile',
  'open',
  'input',
  '__import__',
  '__builtins__',
  '__globals__',
  '__subclasses__',
  '__bases__',
  '__class__',
  'globals',
  'locals',
  'vars',
  'getattr',
  'setattr',
  'delattr',
  'breakpoint',
] as const;

export interface PythonCheckResult {
  ok: boolean;
  errors: string[];
}

/** Remove `#` comments and string literals (triple- and single-quoted). */
export function stripStringsAndComments(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i] ?? '';
    const two = code.slice(i, i + 3);
    if (ch === '#') {
      while (i < n && code[i] !== '\n') i++;
      continue;
    }
    if (two === '"""' || two === "'''") {
      const quote = two;
      i += 3;
      while (i < n && code.slice(i, i + 3) !== quote) {
        if (code[i] === '\n') out += '\n'; // keep line numbers roughly aligned
        i++;
      }
      i += 3;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < n && code[i] !== ch) {
        if (code[i] === '\\') i++; // skip escape
        i++;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const allowed = new Set<string>(ALLOWED_IMPORTS);

export function checkPython(code: string): PythonCheckResult {
  const errors: string[] = [];
  const src = stripStringsAndComments(code);
  const allowList = ALLOWED_IMPORTS.join(', ');

  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim();

    const imp = /^import\s+(.+)$/.exec(line);
    if (imp) {
      for (const part of (imp[1] ?? '').split(',')) {
        const aliasBase = part.trim().split(/\s+as\s+/)[0] ?? '';
        const mod = (aliasBase.split('.')[0] ?? '').trim();
        if (mod && !allowed.has(mod)) errors.push(`import '${mod}' is not allowed (allowed: ${allowList})`);
      }
      continue;
    }
    const from = /^from\s+([.\w]+)\s+import\s+/.exec(line);
    if (from) {
      const full = from[1] ?? '';
      const mod = full.split('.')[0] ?? '';
      if (!allowed.has(mod)) errors.push(`import from '${full}' is not allowed (allowed: ${allowList})`);
    }
  }

  for (const name of FORBIDDEN_NAMES) {
    // Word-boundary match; `_` is a word char so dunder names bound correctly.
    if (new RegExp(`(^|[^\\w.])${name}\\b`).test(src) || new RegExp(`\\.${name}\\b`).test(src)) {
      errors.push(`use of '${name}' is not allowed in loopCode`);
    }
  }

  return { ok: errors.length === 0, errors };
}
