import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

// In produzione (dominio custom come sadicasa.it) usa SEMPRE chiamate relative
// al dominio corrente. Solo in dev locale usa REACT_APP_BACKEND_URL.
const isBrowserOnCustomDomain =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

export const API = isBrowserOnCustomDomain ? "/api" : `${BACKEND_URL}/api`;

const TOKEN_KEY = "ristruttura_token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach Bearer token on every request (fallback if cookies are blocked)
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Auto-refresh su 401 "Token expired" — chiama /auth/refresh (usa cookie httponly) e ripete la richiesta
let _refreshing = null;
async function _doRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const r = await axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
      const newTok = r?.data?.access_token;
      if (newTok) {
        setToken(newTok);
        return newTok;
      }
    } catch { /* refresh fallito */ }
    return null;
  })();
  try {
    return await _refreshing;
  } finally {
    _refreshing = null;
  }
}
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const cfg = err?.config || {};
    const isAuthEp = (cfg.url || "").includes("/auth/login") || (cfg.url || "").includes("/auth/refresh");
    if (status === 401 && !cfg._retried && !isAuthEp) {
      cfg._retried = true;
      const newTok = await _doRefresh();
      if (newTok) {
        cfg.headers = cfg.headers || {};
        cfg.headers.Authorization = `Bearer ${newTok}`;
        return api.request(cfg);
      }
      // Refresh fallito → pulisci token e lascia che l'UI rediriga al login
      setToken(null);
    }
    return Promise.reject(err);
  }
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Qualcosa è andato storto. Riprova.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
