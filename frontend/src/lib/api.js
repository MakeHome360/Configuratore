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
