import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, statoCommessaBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, TrendingUp, Briefcase, Files, Crown, Users2, FilePlus2 } from "lucide-react";

const LEVEL_LABEL = { semplice: "Venditore", responsabile: "Responsabile Punto Vendita", area_manager: "Area Manager" };
const STATO_BADGE = {
  previsionale:        { txt: "Previsionale",        cls: "bg-zinc-100 text-zinc-600" },
  maturata:            { txt: "Maturata",            cls: "bg-blue-100 text-blue-700" },
  maturata_completa:   { txt: "Maturata (chiusa)",   cls: "bg-emerald-100 text-emerald-700" },
  sospesa:             { txt: "Sospesa",             cls: "bg-amber-100 text-amber-700" },
};

export default function DashboardVenditore() {
  const { vid } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const nav = useNavigate();

  useEffect(() => {
    const url = vid ? `/venditori/${vid}/dashboard` : "/venditori/me/dashboard";
    api.get(url).then(r => setData(r.data)).catch(() => setData({ error: true }));
  }, [vid]);

  if (!data) return <Page><div className="text-zinc-500" data-testid="dash-vend-loading">Caricamento dashboard…</div></Page>;
  if (data.error) return <Page><div className="text-rose-600">Errore caricamento dashboard.</div></Page>;

  const v = data.venditore || {};
  const s = data.stats || {};
  const isManager = v.level === "responsabile" || v.level === "area_manager";

  return (
    <div data-testid="dashboard-venditore">
      <PageHeader
        title={`Ciao ${v.name || ""}`.trim()}
        subtitle={
          <>
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500 font-semibold">
              <Crown className="h-3.5 w-3.5" /> {LEVEL_LABEL[v.level] || "Venditore"}
            </span>
            <span className="ml-3 text-xs text-zinc-400">Provvigione personale: <b className="text-zinc-700">{(data.settings?.own_pct || 0).toFixed(1)}%</b>{isManager && <> · Override team: <b className="text-zinc-700">{(data.settings?.override_pct || 0).toFixed(1)}%</b></>}</span>
          </>
        }
        actions={
          <Button onClick={() => nav("/nuovopreventivo")} data-testid="btn-nuovo-preventivo-vend" style={{ background: "var(--brand)", color: "white" }}>
            <FilePlus2 className="h-4 w-4 mr-2" /> Nuovo Preventivo
          </Button>
        }
      />
      <Page>
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Provvigioni Totali" value={fmtEur(s.provvigioni_totali)} icon={Wallet} color="text-emerald-600" sub={`Maturate: ${fmtEur(s.provvigioni_maturate)}`} />
          <StatCard label="Fatturato Personale" value={fmtEur(s.fatturato_proprio)} icon={TrendingUp} sub={`${s.commesse_proprie || 0} commesse`} />
          <StatCard label="Preventivi" value={s.preventivi_propri || 0} icon={Files} sub={isManager ? `+${s.preventivi_team || 0} dal team` : ""} />
          {isManager
            ? <StatCard label="Fatturato Team" value={fmtEur(s.fatturato_team)} icon={Users2} color="text-blue-600" sub={`${s.commesse_team || 0} commesse team`} />
            : <StatCard label="Commesse Attive" value={s.commesse_proprie || 0} icon={Briefcase} />
          }
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="rounded-sm">
            <TabsTrigger value="overview" data-testid="tab-overview">Panoramica</TabsTrigger>
            <TabsTrigger value="provvigioni" data-testid="tab-provvigioni">Provvigioni</TabsTrigger>
            {isManager && <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>}
          </TabsList>

          {/* PANORAMICA */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-zinc-200 rounded-lg">
                <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">Ultimi Preventivi</h3>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => nav("/preventivi")}>Vedi tutti</button>
                </div>
                <div className="divide-y divide-zinc-100">
                  {(data.ultimi_preventivi || []).slice(0, 6).map(p => (
                    <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{p.cliente?.nome || "—"} {p.cliente?.cognome || ""}</div>
                        <div className="text-xs text-zinc-500">{(p.tipo || "").toUpperCase()} · {p.mq || 0} mq</div>
                      </div>
                      <div className="text-sm font-semibold">{fmtEur(p.totale_iva_incl)}</div>
                    </div>
                  ))}
                  {!(data.ultimi_preventivi || []).length && <div className="px-5 py-8 text-sm text-zinc-500 text-center">Nessun preventivo</div>}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg">
                <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">Ultime Commesse</h3>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => nav("/commesse")}>Vedi tutte</button>
                </div>
                <div className="divide-y divide-zinc-100">
                  {(data.ultime_commesse || []).slice(0, 6).map(c => (
                    <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 cursor-pointer" onClick={() => nav(`/dettagliocommessa/${c.id}`)}>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{c.cliente?.nome || "—"}</div>
                        <div className="text-xs text-zinc-500">{c.numero} · {c.mq || 0} mq</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-sm font-semibold">{fmtEur(c.totale_preventivo)}</div>
                        {statoCommessaBadge(c.stato)}
                      </div>
                    </div>
                  ))}
                  {!(data.ultime_commesse || []).length && <div className="px-5 py-8 text-sm text-zinc-500 text-center">Nessuna commessa</div>}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PROVVIGIONI */}
          <TabsContent value="provvigioni" className="mt-4">
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900">Dettaglio Provvigioni</h3>
                <div className="text-sm">
                  Totale maturate: <b className="text-emerald-600">{fmtEur(s.provvigioni_maturate)}</b>
                  <span className="mx-2 text-zinc-300">|</span>
                  Previsionali: <b className="text-zinc-600">{fmtEur(s.provvigioni_previsionali)}</b>
                </div>
              </div>
              <table className="w-full text-sm" data-testid="provvigioni-table">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Commessa</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Totale</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2 text-right">Importo</th>
                    <th className="px-3 py-2 text-center">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(data.provvigioni || []).map((p, i) => {
                    const sb = STATO_BADGE[p.stato] || { txt: p.stato, cls: "bg-zinc-100 text-zinc-600" };
                    return (
                      <tr key={`${p.commessa_id}-${i}`} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 mono text-xs">{p.commessa_numero}</td>
                        <td className="px-3 py-2">{p.cliente?.nome || "—"} {p.cliente?.cognome || ""}{p.tipo === "override" && p.venditore_nome && <span className="text-xs text-zinc-400 ml-1">· {p.venditore_nome}</span>}</td>
                        <td className="px-3 py-2 text-xs">{p.tipo === "override" ? "Override team" : "Diretta"}</td>
                        <td className="px-3 py-2 text-right mono">{fmtEur(p.totale_commessa)}</td>
                        <td className="px-3 py-2 text-right mono">{(p.pct || 0).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtEur(p.importo)}</td>
                        <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-[11px] font-medium ${sb.cls}`}>{sb.txt}</span></td>
                      </tr>
                    );
                  })}
                  {!(data.provvigioni || []).length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">Nessuna provvigione registrata</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-zinc-500 bg-amber-50 border border-amber-200 p-3 rounded">
              <strong>Nota:</strong> Le provvigioni sono calcolate live sui totali commessa IVA inclusa.
              Le aliquote sono configurabili da Admin → Impostazioni → Provvigioni.
            </div>
          </TabsContent>

          {/* TEAM (solo manager) */}
          {isManager && (
            <TabsContent value="team" className="mt-4">
              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-900">Performance Team</h3>
                </div>
                <table className="w-full text-sm" data-testid="ranking-team">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Venditore</th>
                    <th className="px-3 py-2 text-left">Livello</th>
                    <th className="px-3 py-2 text-right">Preventivi</th>
                    <th className="px-3 py-2 text-right">Commesse</th>
                    <th className="px-3 py-2 text-right">Fatturato</th>
                  </tr></thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(data.ranking_team || []).map((r, i) => (
                      <tr key={r.venditore_id} className={r.is_self ? "bg-emerald-50/40" : "hover:bg-zinc-50"}>
                        <td className="px-3 py-2 mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.name}{r.is_self && <span className="ml-2 text-[11px] text-emerald-700">(tu)</span>}</td>
                        <td className="px-3 py-2 text-xs uppercase">{r.level}</td>
                        <td className="px-3 py-2 text-right mono">{r.preventivi}</td>
                        <td className="px-3 py-2 text-right mono">{r.commesse}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtEur(r.fatturato)}</td>
                      </tr>
                    ))}
                    {!(data.ranking_team || []).length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Nessun membro nel team</td></tr>}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </Page>
    </div>
  );
}
