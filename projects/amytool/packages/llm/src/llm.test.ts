import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  modelForFeature,
  saveSettings,
  type LlmSettings,
} from './settings';
import { fetchModels, formatPrice, OpenRouterError } from './openrouter';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('settings', () => {
  it('round-trips through localStorage', () => {
    const s: LlmSettings = { apiKey: 'sk-x', defaultModel: 'a/b', overrides: { module: 'c/d' } };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('returns defaults when nothing stored or data is corrupt', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem('amypatch:llm', 'not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('resolves the model per feature with override fallback', () => {
    const s: LlmSettings = { apiKey: '', defaultModel: 'default/m', overrides: { patch: 'patch/m' } };
    expect(modelForFeature(s, 'patch')).toBe('patch/m');
    expect(modelForFeature(s, 'module')).toBe('default/m');
  });
});

describe('fetchModels', () => {
  it('parses and sorts the OpenRouter catalog and sends the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'z/model', name: 'Zeta', context_length: 8000, pricing: { prompt: '0.000001', completion: '0.000002' } },
            { id: 'a/model', name: 'Alpha', context_length: 128000, pricing: { prompt: '0', completion: '0' } },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await fetchModels('sk-test');
    expect(models.map((m) => m.name)).toEqual(['Alpha', 'Zeta']);
    expect(models[0]).toMatchObject({ id: 'a/model', contextLength: 128000, promptPrice: 0 });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-test' });
  });

  it('throws a friendly error on non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(fetchModels()).rejects.toBeInstanceOf(OpenRouterError);
  });
});

describe('formatPrice', () => {
  it('formats per-token prices per million tokens', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(0)).toBe('free');
    expect(formatPrice(0.000003)).toBe('$3.00/M');
  });
});
