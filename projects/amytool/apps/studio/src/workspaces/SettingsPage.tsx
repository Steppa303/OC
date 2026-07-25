import { useEffect, useMemo, useState } from 'react';
import {
  fetchModels,
  formatPrice,
  loadSettings,
  saveSettings,
  type LlmFeature,
  type LlmSettings,
  type OpenRouterModel,
} from '@amy/llm';
import './settings.css';

const FEATURES: { key: LlmFeature; label: string }[] = [
  { key: 'patch', label: 'Patch generation' },
  { key: 'module', label: 'Module generation' },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<LlmSettings>(() => loadSettings());
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const update = (patch: Partial<LlmSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const refreshModels = useMemo(
    () => async (key: string) => {
      setStatus('loading');
      setError('');
      try {
        setModels(await fetchModels(key || undefined));
        setStatus('idle');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'failed to load models');
      }
    },
    [],
  );

  useEffect(() => {
    void refreshModels(loadSettings().apiKey);
  }, [refreshModels]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [models, query]);

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>OpenRouter API key</h2>
        <p className="settings-hint">
          Stored only in this browser; sent only to openrouter.ai when generating.
        </p>
        <div className="settings-key-row">
          <input
            type={showKey ? 'text' : 'password'}
            className="settings-input"
            placeholder="sk-or-…"
            value={settings.apiKey}
            aria-label="OpenRouter API key"
            onChange={(e) => update({ apiKey: e.target.value })}
          />
          <button type="button" className="settings-btn" onClick={() => setShowKey((s) => !s)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void refreshModels(settings.apiKey)}
          >
            Refresh models
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Model</h2>
        <p className="settings-hint">Default model used for generation.</p>
        <input
          type="search"
          className="settings-input"
          placeholder="Search models…"
          value={query}
          aria-label="Search models"
          onChange={(e) => setQuery(e.target.value)}
        />
        {status === 'loading' && <p className="settings-hint">Loading models…</p>}
        {status === 'error' && <p className="settings-error">{error}</p>}
        <ul className="settings-model-list" role="radiogroup" aria-label="Default model">
          {filtered.slice(0, 100).map((m) => (
            <li key={m.id}>
              <label className={settings.defaultModel === m.id ? 'model-row model-row-active' : 'model-row'}>
                <input
                  type="radio"
                  name="default-model"
                  checked={settings.defaultModel === m.id}
                  onChange={() => update({ defaultModel: m.id })}
                />
                <span className="model-name">{m.name}</span>
                <span className="model-id">{m.id}</span>
                <span className="model-meta">
                  {m.contextLength ? `${Math.round(m.contextLength / 1000)}k ctx` : ''} ·{' '}
                  {formatPrice(m.promptPrice)}
                </span>
              </label>
            </li>
          ))}
          {filtered.length === 0 && status === 'idle' && (
            <li className="settings-hint">No models match.</li>
          )}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Per-feature model</h2>
        <p className="settings-hint">Optionally override the default for specific tasks.</p>
        {FEATURES.map((f) => (
          <div className="settings-override" key={f.key}>
            <label htmlFor={`override-${f.key}`}>{f.label}</label>
            <select
              id={`override-${f.key}`}
              className="settings-input"
              value={settings.overrides[f.key] ?? ''}
              onChange={(e) =>
                update({
                  overrides: { ...settings.overrides, [f.key]: e.target.value || undefined },
                })
              }
            >
              <option value="">Use default</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>
    </div>
  );
}
