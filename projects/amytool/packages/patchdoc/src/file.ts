/** .amypatch file export/import (pretty JSON, versioned, migrated). */
import type { z } from 'zod';
import { migrateToCurrent, MigrationError } from './migrate';
import { patchDocSchema, type PatchDoc } from './schema';

export class PatchFileError extends Error {}

export function exportPatchFile(doc: PatchDoc): string {
  return JSON.stringify(doc, null, 2) + '\n';
}

export function importPatchFile(text: string): PatchDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PatchFileError('not a .amypatch file: invalid JSON');
  }
  let migrated: unknown;
  try {
    migrated = migrateToCurrent(raw);
  } catch (err) {
    if (err instanceof MigrationError) throw new PatchFileError(err.message);
    throw err;
  }
  const result = patchDocSchema.safeParse(migrated);
  if (!result.success) {
    throw new PatchFileError(formatZodError(result.error));
  }
  return result.data;
}

function formatZodError(error: z.ZodError): string {
  const issues = error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  const more = error.issues.length > 5 ? ` (+${error.issues.length - 5} more)` : '';
  return `invalid patch file: ${issues}${more}`;
}
