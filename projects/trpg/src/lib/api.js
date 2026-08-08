const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getSettings: () => request('/game/settings'),

  createGame: (data) =>
    request('/game/new', { method: 'POST', body: JSON.stringify(data) }),

  sendAction: (data) =>
    request('/game/action', { method: 'POST', body: JSON.stringify(data) }),

  getState: (saveId) => request(`/game/state/${saveId}`),

  getSaves: (userId) => request(`/game/saves/${userId}`),

  saveGame: (data) =>
    request('/game/save', { method: 'POST', body: JSON.stringify(data) }),

  createCharacter: (data) =>
    request('/game/char', { method: 'POST', body: JSON.stringify(data) }),

  getGameLog: (saveId) => request(`/game/log/${saveId}`),

  // World endpoints
  getWorlds: (settingSlug) => request(`/worlds/setting/${settingSlug}`),

  createWorld: (data) =>
    request('/worlds', { method: 'POST', body: JSON.stringify(data) }),

  getWorld: (worldId) => request(`/worlds/${worldId}`),

  getWorldHistory: (worldId) => request(`/worlds/${worldId}/history`),

  getWorldNPCs: (worldId) => request(`/worlds/${worldId}/npcs`),

  getWorldLocations: (worldId) => request(`/worlds/${worldId}/locations`),

  getArcs: (settingSlug) => request(`/worlds/arcs/${settingSlug}`),

  // Story Journal endpoints
  getJournal: (saveId, { limit, offset, prompts } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    if (prompts === false) params.set('prompts', 'false');
    const qs = params.toString();
    return request(`/game/journal/${saveId}${qs ? '?' + qs : ''}`);
  },

  getJournalSummary: (saveId) => request(`/game/journal/${saveId}/summary`),

  getWorldJournal: (worldId, { limit } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    return request(`/game/journal/world/${worldId}${qs ? '?' + qs : ''}`);
  },
};
