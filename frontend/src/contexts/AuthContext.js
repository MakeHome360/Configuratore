import React, { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiErrorDetail, setToken, getToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const hasToken = !!getToken();
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        // If token exists but rejected, clear it
        if (hasToken) setToken(null);
        setUser(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.access_token) setToken(data.access_token);
      setUser({ id: data.id, email: data.email, name: data.name, role: data.role, must_change_password: !!data.must_change_password, expires_at: data.expires_at, venditore_level: data.venditore_level });
      return { ok: true, must_change_password: !!data.must_change_password };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const loginCliente = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login-cliente", { email, password });
      if (data.access_token) setToken(data.access_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const setUserAndToken = ({ token, user: u }) => {
    if (token) setToken(token);
    if (u) setUser(u);
  };

  const register = async ({ name, email, password, requested_role, phone, message }) => {
    try {
      const { data } = await api.post("/auth/register", { name, email, password, requested_role, phone, message });
      // Nessun auto-login: l'utente è in stato pending
      return { ok: true, status: data.status, message: data.message };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const changePassword = async ({ current_password, new_password }) => {
    try {
      await api.post("/auth/change-password", { current_password, new_password });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setToken(null);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginCliente, register, changePassword, logout, setUserAndToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
