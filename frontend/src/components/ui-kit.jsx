import React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-5 flex items-start justify-between gap-4" data-testid="page-header">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className }) {
  return <div className={cn("px-6 py-6", className)}>{children}</div>;
}

export function StatCard({ label, value, sub, icon: Icon, color = "text-zinc-900" }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5" data-testid={`stat-${label?.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
      </div>
      <div className={cn("mt-2 text-3xl font-bold", color)}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export function Badge({ color = "zinc", children }) {
  const map = {
    zinc: "bg-zinc-100 text-zinc-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
    teal: "bg-teal-100 text-teal-700",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold", map[color])}>{children}</span>;
}

export const statoPreventivoBadge = (stato) => {
  const m = { bozza: "zinc", inviato: "blue", accettato: "green", rifiutato: "red" };
  return <Badge color={m[stato] || "zinc"}>{stato}</Badge>;
};
export const statoCommessaBadge = (stato) => {
  const m = { da_iniziare: "zinc", in_corso: "blue", completata: "green", sospesa: "yellow" };
  const labels = { da_iniziare: "Da Iniziare", in_corso: "In Corso", completata: "Completata", sospesa: "Sospesa" };
  return <Badge color={m[stato] || "zinc"}>{labels[stato] || stato}</Badge>;
};

export const fmtEur = (n) => `€ ${Number(n || 0).toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
export const fmtEur2 = (n) => `€ ${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
