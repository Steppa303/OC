/**
 * OpenRouter settings (docs/05 §1). Stored in localStorage only — the API key
 * never leaves the client except toward openrouter.ai. Per-feature model
 * overrides let patch-gen and module-gen use different models.
 */
export type LlmFeature = 'patch' | 'module';

export interface LlmSettings {
  apiKey: string;
  defaultModel: string;
  overrides: Partial<Record<LlmFeature, string>>;
}

const STORAGE_KEY = 'amypatch:llm';

export const DEFAULT_SETTINGS: LlmSettings = {
  apiKey: '',
  defaultModel: '',
  overrides: {},
};

export function loadSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      defaultModel: typeof parsed.defaultModel === 'string' ? parsed.defaultModel : '',
      overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: LlmSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* no storage — ignore */
  }
}

/** The model to use for a feature: its override, else the default model. */
export function modelForFeature(settings: LlmSettings, feature: LlmFeature): string {
  return settings.overrides[feature] ?? settings.defaultModel;
}
