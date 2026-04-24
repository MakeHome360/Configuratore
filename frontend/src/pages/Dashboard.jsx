import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, statoCommessaBadge, statoPreventivoBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { FilePlus2, Files, Briefcase, TrendingUp } from "lucide-react";

const PKG_COLORS = { "pkg-basic": "#475569", "pkg-smart": "#3B82F6", "pkg-premium": "#0EA5E9", "pkg-elite": "#0A0A0A" };
const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    api.get("/stats/dashboard").then((r) => setStats(r.data)).catch(() => setStats({}));
  }, []);

  if (!stats) return <Page><div className="text-zinc-500">Caricamento...</div></Page>;

  const pkgTotal = Object.values(stats.per_pacchetto || {}).reduce((a, b) => a + b, 0) || 1;
  const stTotal = Object.values(stats.stati_commesse || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica generale dell'attività"
        actions={
          <Button onClick={() => nav("/nuovopreventivo")} data-testid="btn-nuovo-preventivo" style={{ background: "var(--brand)", color: "white" }}>
            <FilePlus2 className="h-4 w-4 mr-2" /> Nuovo Preventivo
          </Button>
        }
      />
      <Page>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Preventivi Totali" value={stats.preventivi_totali || 0} icon={Files} />
          <StatCard label="Preventivi Approvati" value={stats.preventivi_approvati || 0} icon={TrendingUp} color="text-emerald-600" />
          <StatCard label="Commesse Attive" value={stats.commesse_attive || 0} icon={Briefcase} color="text-blue-600" />
          <StatCard label="Fatturato Totale" value={fmtEur(stats.fatturato_totale)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-zinc-900">Preventivi per Pacchetto</h3>
            </div>
            <div className="space-y-2">
              {["pkg-basic","pkg-smart","pkg-premium","pkg-elite"].map((pid) => {
                const n = (stats.per_pacchetto || {})[pid] || 0;
                const pct = Math.round((n / pkgTotal) * 100);
                return (
                  <div key={pid}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium" style={{ color: PKG_COLORS[pid] }}>{PKG_NAMES[pid]}</span>
                      <span className="text-zinc-600">{n}</span>
                    </div>
                    <div className="h-2 rounded bg-zinc-100 overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: PKG_COLORS[pid] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h3 className="font-semibold text-zinc-900 mb-3">Stato Commesse</h3>
            <div className="space-y-2">
              {[["da_iniziare","Da Iniziare","#94A3B8"],["in_corso","In Corso","#3B82F6"],["completata","Completata","#10B981"],["sospesa","Sospesa","#F59E0B"]].map(([k, label, color]) => {
                const n = (stats.stati_commesse || {})[k] || 0;
                const pct = Math.round((n / stTotal) * 100);
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-zinc-700">{label}</span>
                      <span className="text-zinc-600">{n}</span>
                    </div>
                    <div className="h-2 rounded bg-zinc-100 overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">Ultimi Preventivi</h3>
              <button className="text-xs text-blue-600 hover:underline" onClick={() => nav("/preventivi")}>Vedi tutti</button>
            </div>
            <div className="divide-y divide-zinc-100">
              {(stats.ultimi_preventivi || []).slice(0, 5).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 cursor-pointer"
                     onClick={() => {
                       const routes = { pacchetto: "/preventivopacchetto", bagno: "/preventivobagno", composite: "/preventivocomposite", infissi: "/preventivoinfissi" };
                       nav(`${routes[p.tipo] || "/preventivopacchetto"}/${p.id}`);
                     }}>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.cliente?.nome || "—"} {p.cliente?.cognome || ""}</div>
                    <div className="text-xs text-zinc-500">{PKG_NAMES[p.package_id] || (p.tipo||"").toUpperCase()} • {p.mq || 0} mq</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm font-semibold">{fmtEur(p.totale_iva_incl)}</div>
                    {statoPreventivoBadge(p.stato)}
                  </div>
                </div>
              ))}
              {!(stats.ultimi_preventivi || []).length && <div className="px-5 py-8 text-sm text-zinc-500 text-center">Nessun preventivo</div>}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">Commesse Attive</h3>
              <button className="text-xs text-blue-600 hover:underline" onClick={() => nav("/commesse")}>Vedi tutte</button>
            </div>
            <div className="divide-y divide-zinc-100">
              {(stats.ultime_commesse || []).slice(0, 5).map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 cursor-pointer" onClick={() => nav(`/dettagliocommessa/${c.id}`)}>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.cliente?.nome || "—"}</div>
                    <div className="text-xs text-zinc-500">{c.numero} • {c.mq || 0} mq • {PKG_NAMES[c.package_id] || "—"}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm font-semibold">{fmtEur(c.totale_preventivo)}</div>
                    {statoCommessaBadge(c.stato)}
                  </div>
                </div>
              ))}
              {!(stats.ultime_commesse || []).length && <div className="px-5 py-8 text-sm text-zinc-500 text-center">Nessuna commessa attiva</div>}
            </div>
          </div>
        </div>
      </Page>
    </div>
  );
}
