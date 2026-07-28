const BASE = '';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const getItems = () => request('/api/items');
export const createItem = (data) => request('/api/items', { method: 'POST', body: JSON.stringify(data) });
export const updateItem = (id, data) => request(`/api/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteItem = (id) => request(`/api/items/${id}`, { method: 'DELETE' });

export async function uploadFile(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
