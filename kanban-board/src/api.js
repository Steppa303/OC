const API_BASE = '/api';

function getHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function login(email, name) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function getTasks(token) {
  const res = await fetch(`${API_BASE}/tasks`, { headers: getHeaders(token) });
  return res.json();
}

export async function createTask(token, data) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTask(token, id, data) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTask(token, id) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  return res.json();
}

export async function getMembers(token) {
  const res = await fetch(`${API_BASE}/members`, { headers: getHeaders(token) });
  return res.json();
}

export async function getTaskComments(token, taskId) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`, { headers: getHeaders(token) });
  return res.json();
}

export async function addComment(token, taskId, content) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function getTaskHistory(token, taskId) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/history`, { headers: getHeaders(token) });
  return res.json();
}
