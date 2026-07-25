/**
 * App-level patch persistence (docs/03 §6). Restores the last-opened patch once
 * per page load, then autosaves the current doc on *any* route — so edits made in
 * the code workspace persist and survive tab switches, not just canvas edits.
 * (Previously this lived in PatchBar and re-restored on every /patch mount, which
 * clobbered in-memory edits made elsewhere.)
 */
import { useEffect, useState } from 'react';
import { usePatchStore } from './patchStore';
import { getLastOpened, loadPatch, savePatch } from './storage';

// Module-scoped so restore fires once per page load, not once per mount. No
// per-effect cancellation: loadDoc is a store action (not component state), so
// applying it is safe even across React StrictMode's mount/unmount/remount.
let restoreStarted = false;

export function usePatchPersistence(): void {
  const doc = usePatchStore((s) => s.doc);
  const loadDoc = usePatchStore((s) => s.loadDoc);
  const [ready, setReady] = useState(restoreStarted);

  // Restore the last-opened patch once, then allow autosave.
  useEffect(() => {
    if (restoreStarted) {
      setReady(true);
      return;
    }
    restoreStarted = true;
    void (async () => {
      const last = getLastOpened();
      if (last) {
        const d = await loadPatch(last);
        if (d) loadDoc(d);
      }
      setReady(true);
    })();
  }, [loadDoc]);

  // Debounced autosave on any doc change.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void savePatch(doc), 500);
    return () => clearTimeout(t);
  }, [doc, ready]);
}
