const TOKEN_KEY = 'arena_fps_token';
const USER_KEY = 'arena_fps_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
  return data;
}

export async function login(username, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  saveSession(data.token, data.user);
  return data.user;
}

export async function register(username, email, password) {
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password })
  });
  saveSession(data.token, data.user);
  return data.user;
}

export async function fetchMe() {
  const data = await api('/api/auth/me');
  saveSession(getToken(), data.user);
  return data.user;
}

export async function fetchLeaderboard() {
  const data = await api('/api/leaderboard');
  return data.leaderboard;
}
