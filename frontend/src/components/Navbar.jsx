import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Ruler, LogOut, FolderOpen, Package, Receipt, LayoutDashboard } from "lucide-react";

export default function Navbar({ compact = false }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const linkCls = (active) =>
    `text-sm px-3 py-1.5 transition-colors flex items-center gap-1.5 ${active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`;

  return (
    <header
      className={`w-full border-b border-zinc-200 bg-white/90 backdrop-blur-xl ${compact ? "h-14" : "h-16"} flex items-center px-6 z-30`}
      data-testid="app-navbar"
    >
      <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 mr-8" data-testid="logo-link">
        <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center">
          <Ruler size={16} strokeWidth={2.4} />
        </div>
        <span className="font-semibold tracking-tight text-zinc-900" style={{ fontFamily: "Outfit" }}>
          Ristruttura<span className="text-blue-600">.</span>CAD
        </span>
      </Link>

      {user && (
        <nav className="flex items-center gap-1">
          <Link to="/dashboard" className={linkCls(pathname === "/dashboard" || pathname.startsWith("/editor"))} data-testid="nav-dashboard">
            <LayoutDashboard size={14} /> Progetti
          </Link>
          <Link to="/preventivi" className={linkCls(pathname.startsWith("/preventivi"))} data-testid="nav-preventivi">
            <Receipt size={14} /> Preventivi
          </Link>
          <Link to="/materials" className={linkCls(pathname.startsWith("/materials"))} data-testid="nav-materials">
            <Package size={14} /> Catalogo
          </Link>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <div className="text-right hidden sm:block">
              <div className="text-xs text-zinc-500">{user.email}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-sm"
              onClick={async () => { await logout(); nav("/"); }}
              data-testid="logout-button"
            >
              <LogOut size={14} className="mr-1.5" /> Esci
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm text-zinc-700 hover:text-zinc-900 px-3" data-testid="nav-login">Accedi</Link>
            <Link to="/register" data-testid="nav-register">
              <Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800">Inizia gratis</Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
