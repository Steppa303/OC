import { useMemo, useState } from 'react';
import { INTERNAL_MODULE_IDS, listGroups, registry, type ModuleCategory } from '@amy/modules';

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

/** Add-module palette, grouped by category with search (docs/07 P1-02). */
export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const matches = new Set(registry.search(query).map((m) => m.id));
    return registry
      .grouped()
      .map((g) => ({
        ...g,
        modules: g.modules.filter((m) => matches.has(m.id) && !INTERNAL_MODULE_IDS.has(m.id)),
      }))
      .filter((g) => g.modules.length > 0);
  }, [query]);

  const groupModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listGroups().filter((g) => !q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [query]);

  return (
    <aside className="patch-palette" aria-label="Module palette">
      <input
        className="patch-palette-search"
        type="search"
        placeholder="Search modules…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search modules"
      />
      <div className="patch-palette-list">
        {groups.map((g) => (
          <section key={g.category} className="patch-palette-group">
            <h3 className="patch-palette-heading">{CATEGORY_LABELS[g.category]}</h3>
            {g.modules.map((m) => (
              <button
                key={m.id}
                type="button"
                className="patch-palette-item"
                title={m.description}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/amy-module', m.id)}
                onClick={() => onAdd(m.id)}
              >
                {m.name}
              </button>
            ))}
          </section>
        ))}
        {groupModules.length > 0 && (
          <section className="patch-palette-group">
            <h3 className="patch-palette-heading">Groups</h3>
            {groupModules.map((g) => (
              <button
                key={g.id}
                type="button"
                className="patch-palette-item"
                title={g.description}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/amy-module', g.id)}
                onClick={() => onAdd(g.id)}
              >
                {g.name}
              </button>
            ))}
          </section>
        )}
        {groups.length === 0 && groupModules.length === 0 && <p className="patch-palette-empty">No modules match.</p>}
      </div>
    </aside>
  );
}
