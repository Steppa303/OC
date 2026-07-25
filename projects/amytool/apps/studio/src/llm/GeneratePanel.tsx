import { useState } from 'react';
import { setVerdict } from './feedback';
import { useGenerate } from './useGenerate';
import './generate.css';

/**
 * Prompt box + live generation trace + result notes with 👍/👎 (P2-06). Shared by
 * the code workspace and the canvas "✨" affordance. An accepted patch is loaded
 * into the store, so both the canvas and the code projection update.
 */
export function GeneratePanel({ onDone }: { onDone?: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const gen = useGenerate();

  const submit = () => {
    setVoted(null);
    void gen.run(prompt).then(() => {
      if (onDone) onDone();
    });
  };

  const vote = (v: 'up' | 'down') => {
    if (gen.feedbackId) setVerdict(gen.feedbackId, v);
    setVoted(v);
  };

  return (
    <div className="generate-panel" data-testid="generate-panel">
      <div className="generate-input">
        <input
          className="generate-prompt"
          type="text"
          placeholder="Describe a patch… e.g. a warm juno pad with reverb"
          aria-label="Patch prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button
          type="button"
          className="generate-btn"
          data-testid="generate-submit"
          onClick={submit}
          disabled={gen.status === 'running' || prompt.trim() === ''}
        >
          {gen.status === 'running' ? 'Generating…' : '✨ Generate'}
        </button>
      </div>

      {gen.trace.length > 0 && (
        <ol className="generate-trace" data-testid="generate-trace">
          {gen.trace.map((t, i) => (
            <li key={i} className={t.ok ? 'trace-ok' : 'trace-fail'}>
              <span className="trace-stage">
                #{t.attempt} {t.stage}
              </span>
              <span className="trace-mark">{t.ok ? '✓' : '✕'}</span>
              {t.detail && <span className="trace-detail">{t.detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {gen.status === 'error' && (
        <div className="generate-error" data-testid="generate-error">
          {gen.error}
        </div>
      )}

      {gen.result?.ok && (
        <div className="generate-result" data-testid="generate-notes">
          <p className="generate-notes">{gen.result.notes}</p>
          <div className="generate-vote">
            <span>Was this what you wanted?</span>
            <button
              type="button"
              aria-label="thumbs up"
              className={voted === 'up' ? 'voted' : ''}
              onClick={() => vote('up')}
            >
              👍
            </button>
            <button
              type="button"
              aria-label="thumbs down"
              className={voted === 'down' ? 'voted' : ''}
              onClick={() => vote('down')}
            >
              👎
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
