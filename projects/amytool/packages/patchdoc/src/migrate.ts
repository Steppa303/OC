/**
 * Version migrations for .amypatch files (docs/03 §6). Each migration lifts a
 * document one version. v1 is current, so the chain is empty — future versions
 * append `2: (docV1) => docV2` etc. and bump PATCHDOC_VERSION.
 */
import { PATCHDOC_VERSION } from './schema';

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** target version -> migration from (target-1). */
const MIGRATIONS: Record<number, Migration> = {};

export class MigrationError extends Error {}

export function migrateToCurrent(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MigrationError('not a patch file: expected a JSON object');
  }
  const doc = raw as Record<string, unknown>;
  const version = doc['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError(
      `not a valid .amypatch file: missing or invalid "version" field (got ${JSON.stringify(version)})`,
    );
  }
  if (version > PATCHDOC_VERSION) {
    throw new MigrationError(
      `this patch was saved by a newer version of AmyPatch Studio (file v${version}, app supports v${PATCHDOC_VERSION}) — please update the app`,
    );
  }
  let current = doc;
  for (let v = version + 1; v <= PATCHDOC_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new MigrationError(`no migration path from v${v - 1} to v${v}`);
    current = { ...step(current), version: v };
  }
  return current;
}
