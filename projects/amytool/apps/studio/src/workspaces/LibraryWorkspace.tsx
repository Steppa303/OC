import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INTERNAL_MODULE_IDS, jackLabel, parseManifest, registry, type ModuleCategory, type ModuleManifest } from '@amy/modules';
import { usePatchStore } from '../patch/patchStore';
import { loadFavorites, saveFavorites } from '../library/favorites';
import { useModuleStore } from '../library/moduleStore';
import { toast } from '../patch/toastStore';
import { NewModulePanel } from '../library/NewModulePanel';
import './library.css';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  source: 'Sources',
  filter: 'Filters',
  envelope: 'Envelopes',
  modulation: 'Modulation',
  mixer: 'Mixers',
  fx: 'Effects',
  io: 'I/O',
  sequencer: 'Sequencers',
  display: 'Displays',
  voice: 'Voices',
};

type Filter = 'all' | 'fav' | ModuleCategory;

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ModuleCategory[];

export function LibraryWorkspace() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [showNew, setShowNew] = useState(false);
  const addModule = usePatchStore((s) => s.addModule);
  const navigate = useNavigate();
  const version = useModuleStore((s) => s.version);
  const initModules = useModuleStore((s) => s.init);
  const addUserModule = useModuleStore((s) => s.add);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initModules();
  }, [initModules]);

  const importFile = async (file: File) => {
    try {
      const manifest = parseManifest(JSON.parse(await file.text()));
      await addUserModule(manifest);
      toast(`Added module “${manifest.name}”`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'could not import module', 'error');
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  };

  const modules = useMemo(() => {
    let list = registry.search(query).filter((m) => !INTERNAL_MODULE_IDS.has(m.id));
    if (filter === 'fav') list = list.filter((m) => favorites.has(m.id));
    else if (filter !== 'all') list = list.filter((m) => m.category === filter);
    // `version` re-reads the registry after a module is generated/imported.
    void version;
    return list;
  }, [query, filter, favorites, version]);

  const insert = (m: ModuleManifest) => {
    addModule(m.id, { x: 0, y: 0 });
    navigate('/patch');
  };

  const availableCategories = CATEGORIES.filter((c) => registry.byCategory(c).length > 0);

  return (
    <div className="library">
      <div className="library-bar">
        <div className="library-bar-top">
          <input
            className="library-search"
            type="search"
            placeholder="Search modules…"
            aria-label="Search modules"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="library-new-btn" data-testid="new-module-open" onClick={() => setShowNew(true)}>
            ＋ New module
          </button>
          <button type="button" className="library-new-btn" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {showNew && <NewModulePanel onClose={() => setShowNew(false)} />}
        <div className="library-filters" role="tablist">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterChip>
          <FilterChip active={filter === 'fav'} onClick={() => setFilter('fav')}>
            ★ Favorites
          </FilterChip>
          {availableCategories.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {CATEGORY_LABELS[c]}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="library-grid" data-testid="library-grid">
        {modules.map((m) => (
          <article
            key={m.id}
            className="module-card"
            data-testid={`card-${m.id}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('application/amy-module', m.id)}
          >
            <header className="module-card-head">
              <span className="module-card-name">{m.name}</span>
              <button
                type="button"
                className={favorites.has(m.id) ? 'module-card-star on' : 'module-card-star'}
                aria-label={favorites.has(m.id) ? 'unfavorite' : 'favorite'}
                onClick={() => toggleFavorite(m.id)}
              >
                {favorites.has(m.id) ? '★' : '☆'}
              </button>
            </header>
            <div className="module-card-preview">
              <span className="module-card-cat">{CATEGORY_LABELS[m.category]}</span>
              <p className="module-card-desc">{m.description}</p>
              {m.params.length > 0 && (
                <div className="module-card-params">
                  {m.params.slice(0, 4).map((p) => (
                    <span key={p.id} className="module-card-param">
                      {p.label}
                    </span>
                  ))}
                </div>
              )}
              {m.jacks.length > 0 && (
                <div className="module-card-jacks">
                  {m.jacks.map((j) => (
                    <span key={j.id} className={`jack-dot jack-dot-${j.kind}`} title={`${jackLabel(j)} (${j.kind} ${j.dir})`} />
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="module-card-add" onClick={() => insert(m)}>
              Add to patch
            </button>
          </article>
        ))}
        {modules.length === 0 && <p className="library-empty">No modules match.</p>}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={active ? 'library-chip active' : 'library-chip'} role="tab" aria-selected={active} onClick={onClick}>
      {children}
    </button>
  );
}
