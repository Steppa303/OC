import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportPatchFile, importPatchFile, type PatchDoc } from '@amy/patchdoc';
import { usePatchStore } from './patchStore';
import { deletePatch, listPatches, loadPatch, type PatchSummary } from './storage';
import { allTags, browsePatches, DEFAULT_BROWSE, normalizeTag, type PatchSort } from './browse';
import { PatchThumb } from './PatchThumb';
import { useToastStore } from './toastStore';

/** Patch name, tags, saved-patch browser (search/tags/sort/thumbnails, P7-01)
 *  and file import/export. Restore + autosave live app-wide in
 *  usePatchPersistence (docs/03 §6). */
export function PatchBar() {
  const doc = usePatchStore((s) => s.doc);
  const loadDoc = usePatchStore((s) => s.loadDoc);
  const setName = usePatchStore((s) => s.setName);
  const setTags = usePatchStore((s) => s.setTags);
  const newPatch = usePatchStore((s) => s.newPatch);
  const pushToast = useToastStore((s) => s.push);

  const [patches, setPatches] = useState<PatchSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState(DEFAULT_BROWSE.query);
  const [tag, setTag] = useState<string | null>(DEFAULT_BROWSE.tag);
  const [sort, setSort] = useState<PatchSort>(DEFAULT_BROWSE.sort);
  const [tagDraft, setTagDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    void listPatches().then(setPatches);
  }, []);

  // Keep the saved-patch list fresh while this bar is mounted.
  useEffect(() => {
    refresh();
  }, [refresh, doc.meta.modifiedAt]);

  const tags = useMemo(() => allTags(patches), [patches]);
  const shown = useMemo(() => browsePatches(patches, { query, tag, sort }), [patches, query, tag, sort]);

  const openPatch = useCallback(
    async (id: string) => {
      const d = await loadPatch(id);
      if (d) loadDoc(d);
      setMenuOpen(false);
    },
    [loadDoc],
  );

  const duplicate = useCallback(() => {
    const copy = JSON.parse(JSON.stringify(doc)) as PatchDoc;
    copy.meta.id = crypto.randomUUID();
    copy.meta.name = `${doc.meta.name} copy`;
    copy.meta.createdAt = new Date().toISOString();
    loadDoc(copy);
  }, [doc, loadDoc]);

  const remove = useCallback(async () => {
    await deletePatch(doc.meta.id);
    newPatch();
    refresh();
  }, [doc.meta.id, newPatch, refresh]);

  const exportFile = useCallback(() => {
    const blob = new Blob([exportPatchFile(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.meta.name.replace(/[^a-z0-9]+/gi, '_') || 'patch'}.amypatch`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);

  const importFile = useCallback(
    async (file: File) => {
      try {
        loadDoc(importPatchFile(await file.text()));
        pushToast(`Imported ${file.name}`, 'info');
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'could not import patch', 'error');
      }
    },
    [loadDoc, pushToast],
  );

  const addTag = useCallback(() => {
    const next = normalizeTag(tagDraft);
    setTagDraft('');
    if (next !== '' && !doc.meta.tags.includes(next)) setTags([...doc.meta.tags, next]);
  }, [tagDraft, doc.meta.tags, setTags]);

  return (
    <div className="patch-bar">
      <input
        className="patch-name"
        value={doc.meta.name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Patch name"
      />
      <div className="patch-tags" data-testid="patch-tags">
        {doc.meta.tags.map((t) => (
          <span key={t} className="patch-tag-chip">
            {t}
            <button
              type="button"
              className="patch-tag-remove"
              aria-label={`Remove tag ${t}`}
              onClick={() => setTags(doc.meta.tags.filter((x) => x !== t))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="patch-tag-input"
          value={tagDraft}
          placeholder="+ tag"
          aria-label="Add tag"
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTag();
          }}
          onBlur={addTag}
        />
      </div>
      <div className="patch-menu-wrap">
        <button
          type="button"
          className="patch-bar-btn"
          onClick={() => {
            // Re-read on open: the debounced autosave may have landed since the
            // last doc change (P7-01).
            if (!menuOpen) refresh();
            setMenuOpen((o) => !o);
          }}
        >
          Patches ▾
        </button>
        {menuOpen && (
          <div className="patch-menu" data-testid="patch-browser">
            <div className="patch-menu-controls">
              <input
                className="patch-menu-search"
                type="search"
                placeholder="Search patches…"
                aria-label="Search patches"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="patch-menu-sort"
                aria-label="Sort patches"
                value={sort}
                onChange={(e) => setSort(e.target.value as PatchSort)}
              >
                <option value="modified">Recent</option>
                <option value="name">Name</option>
                <option value="created">Created</option>
              </select>
            </div>
            {tags.length > 0 && (
              <div className="patch-menu-tags">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`patch-menu-tag${tag === t ? ' patch-menu-tag-active' : ''}`}
                    aria-pressed={tag === t}
                    onClick={() => setTag(tag === t ? null : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <ul className="patch-menu-list">
              {shown.length === 0 && <li className="patch-menu-empty">No patches match</li>}
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className="patch-menu-entry" onClick={() => void openPatch(p.id)}>
                    <PatchThumb data={p.thumb} />
                    <span className="patch-menu-meta">
                      <span className="patch-menu-name">{p.name}</span>
                      <span className="patch-menu-sub">
                        {new Date(p.modifiedAt).toLocaleDateString()}
                        {p.tags.length > 0 ? ` · ${p.tags.join(', ')}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button type="button" className="patch-bar-btn" onClick={newPatch}>
        New
      </button>
      <button type="button" className="patch-bar-btn" onClick={duplicate}>
        Duplicate
      </button>
      <button type="button" className="patch-bar-btn" onClick={() => void remove()}>
        Delete
      </button>
      <button type="button" className="patch-bar-btn" onClick={exportFile}>
        Export
      </button>
      <button type="button" className="patch-bar-btn" onClick={() => fileInput.current?.click()}>
        Import
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".amypatch,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
