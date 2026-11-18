import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try { setUser(await api.get('/me')); } catch { setToken(null); setUser(null); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.token); await refresh();
  };
  const register = async (data) => {
    const r = await api.post('/auth/register', data);
    setToken(r.token); await refresh();
  };
  const logout = () => { setToken(null); setUser(null); };
  const notify = (message, type = 'ok') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, notify }}>
      {children}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </Ctx.Provider>
  );
}
