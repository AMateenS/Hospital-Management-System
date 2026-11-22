'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, doctor: null, loading: true });

  const refresh = useCallback(async () => {
    try { const { user, doctor } = await api('/auth/me'); setState({ user, doctor, loading: false }); }
    catch { setState({ user: null, doctor: null, loading: false }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { user, doctor } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setState({ user, doctor, loading: false });
    return user;
  };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { setState({ user: null, doctor: null, loading: false }); } };

  return <Ctx.Provider value={{ ...state, login, logout, refresh }}>{children}</Ctx.Provider>;
}
