import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  LayoutDashboard, FilePlus2, Files, Briefcase, Users2, Building2,
  Settings, Package, Sparkles, UserCircle2, LogOut, Store,
  ClipboardList, BarChart3, Mail, Layers, Hammer, Target, Pencil, Receipt,
  ChevronLeft, ChevronRight, Menu
} from "lucide-react";

const NAV = [
  { section: "Principale", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","venditore","user"] },
    { to: "/nuovopreventivo", label: "Nuovo Preventivo", icon: FilePlus2, roles: ["admin","venditore","user"] },
    { to: "/preventivi", label: "Preventivi", icon: Files, roles: ["admin","venditore","user"] },
    { to: "/commesse", label: "Commesse", icon: Briefcase, roles: ["admin","venditore","user","subappaltatore"] },
    { to: "/crm", label: "CRM Lead", icon: Target, roles: ["admin","venditore"] },
    { to: "/configuratoreesigenze", label: "Configuratore Esigenze", icon: Sparkles, roles: ["admin","venditore","user"] },
  ]},
  { section: "Progettazione", items: [
    { to: "/progetti", label: "Progetti CAD", icon: Pencil, roles: ["admin","venditore","user"] },
    { to: "/materials", label: "Materiali", icon: Package, roles: ["admin","venditore","user"] },
  ]},
  { section: "Analisi", items: [
    { to: "/centrocosto", label: "Centro di Costo", icon: BarChart3, roles: ["admin"] },
    { to: "/adminreportbudget", label: "Report Budget", icon: Receipt, roles: ["admin"] },
  ]},
  { section: "Amministrazione", items: [
    { to: "/adminpacchetti", label: "Pacchetti & Voci", icon: Layers, roles: ["admin"] },
    { to: "/adminoptional", label: "Optional", icon: Sparkles, roles: ["admin"] },
    { to: "/adminvocibackoffice", label: "Voci Backoffice", icon: ClipboardList, roles: ["admin"] },
    { to: "/adminfasicommessa", label: "Fasi Commessa", icon: Hammer, roles: ["admin"] },
    { to: "/adminvenditori", label: "Venditori", icon: Users2, roles: ["admin"] },
    { to: "/adminsubappaltatori", label: "Subappaltatori", icon: Users2, roles: ["admin"] },
    { to: "/adminnegozi", label: "Negozi", icon: Store, roles: ["admin"] },
    { to: "/admintemplateemail", label: "Template Email", icon: Mail, roles: ["admin"] },
    { to: "/adminutenti", label: "Utenti & Ruoli", icon: UserCircle2, roles: ["admin"] },
    { to: "/admindatiazienda", label: "Dati Azienda", icon: Building2, roles: ["admin"] },
    { to: "/adminimpostazioni", label: "Impostazioni", icon: Settings, roles: ["admin"] },
  ]},
];

const COLOR_MAP = {
  teal:    { bg: "#0F766E", hover: "#115E59", accent: "#14B8A6", soft: "#F0FDFA" },
  blue:    { bg: "#1D4ED8", hover: "#1E40AF", accent: "#3B82F6", soft: "#EFF6FF" },
  emerald: { bg: "#047857", hover: "#065F46", accent: "#10B981", soft: "#ECFDF5" },
  violet:  { bg: "#6D28D9", hover: "#5B21B6", accent: "#8B5CF6", soft: "#F5F3FF" },
  amber:   { bg: "#B45309", hover: "#92400E", accent: "#F59E0B", soft: "#FFFBEB" },
  rose:    { bg: "#BE185D", hover: "#9F1239", accent: "#F43F5E", soft: "#FFF1F2" },
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const [azienda, setAzienda] = useState({ nome: "Inside Home", colore_primario: "teal", logo: null });
  const nav = useNavigate();
  const location = useLocation();
  const isEditorRoute = location.pathname.startsWith("/editor/");
  // Sidebar a scomparsa: auto-chiusa nelle pagine editor (più spazio per CAD), apribile manualmente.
  const [sidebarOpen, setSidebarOpen] = useState(!isEditorRoute);
  useEffect(() => { setSidebarOpen(!isEditorRoute); }, [isEditorRoute]);

  useEffect(() => {
    api.get("/dati-azienda").then(r => r.data && setAzienda(r.data)).catch(() => {});
  }, []);

  const colors = COLOR_MAP[azienda.colore_primario] || COLOR_MAP.teal;
  const role = user?.role || "user";

  // apply css vars
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", colors.bg);
    root.style.setProperty("--brand-hover", colors.hover);
    root.style.setProperty("--brand-accent", colors.accent);
    root.style.setProperty("--brand-soft", colors.soft);
  }, [colors]);

  return (
    <div className="flex min-h-screen bg-zinc-50 relative">
      {/* Pulsante apertura sidebar quando chiusa */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-50 h-9 w-9 rounded-md text-white flex items-center justify-center shadow-lg hover:opacity-90"
          style={{ background: colors.bg }}
          title="Apri menù"
          data-testid="sidebar-toggle-open"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* SIDEBAR (collassabile) */}
      <aside
        className={`shrink-0 text-white flex flex-col sticky top-0 h-screen transition-all duration-200 overflow-hidden ${sidebarOpen ? "w-64" : "w-0"}`}
        style={{ background: colors.bg }}
        data-testid="app-sidebar"
      >
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            {azienda.logo ? (
              <img src={azienda.logo} alt="logo" className="h-8" />
            ) : (
              <div className="h-9 w-9 rounded bg-white/10 flex items-center justify-center font-bold text-lg">
                {(azienda.nome || "I")[0]}
              </div>
            )}
            <div className="truncate flex-1">
              <div className="text-[11px] uppercase tracking-wider text-white/60">Configuratore</div>
              <div className="text-sm font-semibold truncate">{azienda.nome}</div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded hover:bg-white/10 shrink-0"
              title="Chiudi menù"
              data-testid="sidebar-toggle-close"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV.map((group) => {
            const visibleItems = group.items.filter((it) => it.roles.includes(role));
            if (!visibleItems.length) return null;
            return (
              <div key={group.section}>
                <div className="px-3 text-[10px] uppercase tracking-[0.15em] text-white/50 font-semibold mb-1.5">
                  {group.section}
                </div>
                <ul className="space-y-0.5">
                  {visibleItems.map((it) => (
                    <li key={it.to}>
                      <NavLink
                        to={it.to}
                        data-testid={`nav-${it.to.replace(/\//g, "")}`}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                            isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                          }`
                        }
                      >
                        <it.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{it.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-white/5">
            <UserCircle2 className="h-8 w-8" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{user?.name || "Utente"}</div>
              <div className="text-white/60 truncate capitalize">{role}</div>
            </div>
            <button
              onClick={async () => { await logout(); nav("/login"); }}
              className="p-1.5 rounded hover:bg-white/10"
              title="Esci"
              data-testid="btn-logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
