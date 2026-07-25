/** Client-side patch persistence (docs/03 §6): IndexedDB via idb, plus a
 *  localStorage pointer to the last-opened patch. */
import { openDB, type IDBPDatabase } from 'idb';
import type { PatchDoc } from '@amy/patchdoc';
import { thumbnailData, type ThumbData } from './thumbnail';

const DB_NAME = 'amypatch';
const STORE = 'patches';
const MODULES_STORE = 'modules';
const LAST_OPENED_KEY = 'amypatch:lastOpened';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE); // out-of-line keys (meta.id)
      }
      if (!database.objectStoreNames.contains(MODULES_STORE)) {
        database.createObjectStore(MODULES_STORE); // user module manifests, keyed by id
      }
    },
  });
  return dbPromise;
}

/** Persist a user-generated/imported module manifest (keyed by manifest id). */
export async function saveModule(id: string, manifest: unknown): Promise<void> {
  const database = await db();
  await database.put(MODULES_STORE, manifest, id);
}

export async function listModules(): Promise<unknown[]> {
  const database = await db();
  return database.getAll(MODULES_STORE);
}

export async function deleteModule(id: string): Promise<void> {
  const database = await db();
  await database.delete(MODULES_STORE, id);
}

export interface PatchSummary {
  id: string;
  name: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  thumb: ThumbData;
}

export async function savePatch(doc: PatchDoc): Promise<void> {
  const database = await db();
  await database.put(STORE, doc, doc.meta.id);
  setLastOpened(doc.meta.id);
}

export async function loadPatch(id: string): Promise<PatchDoc | undefined> {
  const database = await db();
  return (await database.get(STORE, id)) as PatchDoc | undefined;
}

export async function deletePatch(id: string): Promise<void> {
  const database = await db();
  await database.delete(STORE, id);
  if (getLastOpened() === id) localStorage.removeItem(LAST_OPENED_KEY);
}

export async function listPatches(): Promise<PatchSummary[]> {
  const database = await db();
  const docs = (await database.getAll(STORE)) as PatchDoc[];
  return docs
    .map((d) => ({
      id: d.meta.id,
      name: d.meta.name,
      tags: d.meta.tags,
      createdAt: d.meta.createdAt,
      modifiedAt: d.meta.modifiedAt,
      thumb: thumbnailData(d),
    }))
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export function getLastOpened(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY);
  } catch {
    return null;
  }
}

const WELCOMED_KEY = 'amypatch:welcomed';
const TOUR_KEY = 'amypatch:tourDone';

/** First-run flag for the starter gallery (P7-01). */
export function getWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) !== null;
  } catch {
    return true; // no storage — never nag
  }
}

export function setWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, '1');
  } catch {
    /* private mode / no storage — ignore */
  }
}

/** First-run flag for the onboarding tour (P7-03). */
export function getTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) !== null;
  } catch {
    return true;
  }
}

export function setTourDone(): void {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* no storage — ignore */
  }
}

export function setLastOpened(id: string): void {
  try {
    localStorage.setItem(LAST_OPENED_KEY, id);
  } catch {
    /* private mode / no storage — ignore */
  }
}
