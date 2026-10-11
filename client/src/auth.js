const API = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';
const KEY = 'scopeshield-token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = t => { try { localStorage.setItem(KEY, t); } catch {} };
export const clearAuth = () => { try { localStorage.removeItem(KEY); } catch {} };
export const authHeaders = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});
async function post(path, body) {
  let res; try { res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new Error('Cannot reach the server. Check that the API is running.'); }
  const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || 'Something went wrong.'); return data;
}
export async function authenticate(mode, form) { const d = await post(mode === 'register' ? '/auth/register' : '/auth/login', form); setToken(d.token); return d.user; }
export async function currentUser() {
  if (!getToken()) return null;
  try { const res = await fetch(`${API}/auth/me`, { headers: authHeaders() }); if (res.status === 401) { clearAuth(); return null; } return res.ok ? res.json() : undefined; } catch { return undefined; }
}
