import { useState } from 'react';
import type { ModuleManifest } from '@amy/modules';
import { useGenerateModule } from './useGenerateModule';
import { useModuleStore } from './moduleStore';

/** "＋ New module from prompt" flow (P5-06): generate → preview → add/remix/export. */
export function NewModulePanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const gen = useGenerateModule();
  const add = useModuleStore((s) => s.add);
  const [added, setAdded] = useState(false);

  const manifest: ModuleManifest | null = gen.result?.ok ? gen.result.manifest : null;

  const exportJson = () => {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.id.replace(/[^a-z0-9]+/gi, '_')}.module.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="new-module" data-testid="new-module">
      <div className="new-module-head">
        <span>New module from a prompt</span>
        <button type="button" onClick={onClose} aria-label="close new module">
          ✕
        </button>
      </div>

      <div className="new-module-input">
        <input
          type="text"
          aria-label="Module prompt"
          placeholder="Describe a module… e.g. a bit-crusher with a rate knob"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void gen.run(prompt);
          }}
        />
        <button type="button" data-testid="module-generate" disabled={gen.status === 'running' || !prompt.trim()} onClick={() => void gen.run(prompt)}>
          {gen.status === 'running' ? 'Generating…' : '✨ Generate'}
        </button>
      </div>

      {gen.status === 'error' && <div className="new-module-error">{gen.error}</div>}

      {manifest && (
        <div className="new-module-preview" data-testid="module-preview">
          <div className="module-card-head">
            <span className="module-card-name">{manifest.name}</span>
            <span className="module-card-cat">{manifest.category}</span>
          </div>
          <p className="module-card-desc">{manifest.description}</p>
          <div className="module-card-params">
            {manifest.params.map((p) => (
              <span key={p.id} className="module-card-param">
                {p.label}
              </span>
            ))}
          </div>
          {manifest.behavior && <div className="new-module-badge">behavior script</div>}
          <div className="new-module-actions">
            <button
              type="button"
              data-testid="module-add"
              disabled={added}
              onClick={() => {
                void add(manifest).then(() => setAdded(true));
              }}
            >
              {added ? 'Added ✓' : 'Add to library'}
            </button>
            <button type="button" data-testid="module-remix" onClick={() => setPrompt(`${manifest.description} — but `)}>
              Remix
            </button>
            <button type="button" data-testid="module-export" onClick={exportJson}>
              Export JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
