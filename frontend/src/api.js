// Client HTTP minimal. L'URL de base de l'API est configurable via VITE_API_BASE
// (par défaut "/api", redirigé vers le backend local par le proxy Vite).
const BASE = import.meta.env.VITE_API_BASE || '/api';

export const getToken = () => localStorage.getItem('ss_token');
export const setToken = (t) => (t ? localStorage.setItem('ss_token', t) : localStorage.removeItem('ss_token'));

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Impossible de joindre le serveur. Vérifiez que le backend est démarré.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Une erreur est survenue.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  put: (p, b) => request('PUT', p, b || {}),
  del: (p) => request('DELETE', p),
};

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtHour = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
