import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INTERNAL_MODULE_IDS, listGroups, registry } from '@amy/modules';
import { usePatchStore } from './patchStore';
import { filterCommands, type Command } from './commands';

/**
 * ⌘K command palette (P7-02): add a module/group, run the generate prompt, or
 * jump between workspaces. Opens on ⌘K / Ctrl-K anywhere in the app; arrow keys
 * + Enter to run, Escape to close.
 */
export function CommandPalette({ onGenerate }: { onGenerate: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const addModule = usePatchStore((s) => s.addModule);
  const insertGroup = usePatchStore((s) => s.insertGroup);

  // Global ⌘K / Ctrl-K to toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // focus after the element mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const close = () => setOpen(false);
    const list: Command[] = [
      {
        id: 'generate',
        label: 'Generate patch from prompt…',
        group: 'Actions',
        keywords: 'ai llm ✨ prompt',
        run: () => {
          onGenerate();
          close();
        },
      },
    ];
    for (const to of [
      ['/patch', 'Patch'],
      ['/code', 'Code'],
      ['/library', 'Library'],
      ['/settings', 'Settings'],
    ] as const) {
      list.push({
        id: `go${to[0]}`,
        label: `Go to ${to[1]}`,
        group: 'Workspace',
        keywords: 'switch tab navigate',
        run: () => {
          navigate(to[0]);
          close();
        },
      });
    }
    for (const m of registry.list()) {
      if (INTERNAL_MODULE_IDS.has(m.id)) continue;
      list.push({
        id: `add:${m.id}`,
        label: `Add ${m.name}`,
        group: 'Modules',
        keywords: `${m.category} ${m.id}`,
        run: () => {
          addModule(m.id, { x: 0, y: 0 });
          close();
        },
      });
    }
    for (const g of listGroups()) {
      list.push({
        id: `group:${g.id}`,
        label: `Add group: ${g.name}`,
        group: 'Groups',
        keywords: g.description,
        run: () => {
          insertGroup(g.id, { x: 0, y: 0 });
          close();
        },
      });
    }
    return list;
  }, [addModule, insertGroup, navigate, onGenerate]);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const clampedActive = Math.min(active, Math.max(0, results.length - 1));

  if (!open) return null;

  const run = (cmd: Command | undefined) => cmd?.run();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[clampedActive]);
    }
  };

  return (
    <div className="cmdk-overlay" data-testid="command-palette" onMouseDown={() => setOpen(false)}>
      <div className="cmdk-panel" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          type="text"
          placeholder="Type a command…"
          aria-label="Command palette"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="cmdk-list" role="listbox">
          {results.length === 0 && <li className="cmdk-empty">No commands match</li>}
          {results.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === clampedActive}
                className={`cmdk-item${i === clampedActive ? ' cmdk-item-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
              >
                <span className="cmdk-item-label">{cmd.label}</span>
                <span className="cmdk-item-group">{cmd.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
