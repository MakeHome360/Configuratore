import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Hammer, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtEur, statoCommessaBadge } from "@/components/ui-kit";

const Page = ({ children }) => <div className="p-6 max-w-7xl mx-auto space-y-6">{children}</div>;

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

export default function GestoreCantieri() {
  const [cantieri, setCantieri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stato, setStato] = useState("");
  const nav = useNavigate();

  const reload = () => api.get("/gestore/cantieri").then(r => setCantieri(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const convalida = async (assId, avId) => {
    try {
      await api.post(`/subappaltatori/assegnazioni/${assId}/avanzamenti/${avId}/convalida`);
      toast.success("Avanzamento convalidato. Pagamento sbloccato.");
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  const filt = cantieri.filter((c) => !stato || c.stato === stato);
  const totali = cantieri.length;
  const in_corso = cantieri.filter((r) => r.stato === "in_corso").length;
  const fatturato = cantieri.reduce((s, r) => s + (r.fatturato || 0), 0);
  const incassato = cantieri.reduce((s, r) => s + (r.incassato || 0), 0);
  const da_convalidare = cantieri.reduce((s, r) => s + (r.avanzamenti_da_convalidare || 0), 0);

  return (
    <Page>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Gestione Cantieri</h1>
        <p className="text-sm text-zinc-500 mt-1">Tutti i cantieri attivi e da iniziare. Convalida gli avanzamenti dei subappaltatori per sbloccare i pagamenti.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Cantieri" value={totali} testid="kpi-totali" />
        <KPI label="In corso" value={in_corso} color="text-blue-600" testid="kpi-in-corso" />
        <KPI label="Fatturato" value={fmtEur(fatturato)} testid="kpi-fatturato" />
        <KPI label="Incassato" value={fmtEur(incassato)} color="text-emerald-600" testid="kpi-incassato" />
        <KPI label="Da convalidare" value={da_convalidare} color="text-amber-600" testid="kpi-pending" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[["","Tutti"],["da_iniziare","Da Iniziare"],["in_corso","In Corso"],["completata","Completate"],["sospesa","Sospese"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setStato(k)} data-testid={`gc-filter-${k || "all"}`}
            className={`px-3 py-1.5 rounded-full text-sm border ${stato === k ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:bg-zinc-100"}`}>{lbl}</button>
        ))}
      </div>

      {loading ? <div className="text-zinc-400 mono">caricamento…</div>
        : filt.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded p-6 text-zinc-500">Nessun cantiere.</div>
        ) : (
          <div className="space-y-4">
            {filt.map(c => {
              const pending = (c.assegnazioni || []).flatMap(a => (a.avanzamenti || []).filter(av => !av.convalidato).map(av => ({ a, av })));
              return (
                <div key={c.id} className="bg-white border border-zinc-200 rounded p-4 space-y-3" data-testid={`cantiere-card-${c.id}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-zinc-500">{c.numero}</span>
                        {statoCommessaBadge(c.stato)}
                        {c.package_id && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-zinc-100 rounded" style={{ color: "var(--brand)" }}>{PKG_NAMES[c.package_id] || ""}</span>}
                      </div>
                      <div className="font-semibold text-lg mt-1">{c.cliente?.nome || ""} {c.cliente?.cognome || ""}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Avanzamento: {c.avanzamento_pct || 0}% · MQ: {c.mq || 0} · Preventivo: {fmtEur(c.totale_preventivo)} · Fatturato: {fmtEur(c.fatturato)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.avanzamenti_da_convalidare > 0 && (
                        <span className="bg-amber-100 text-amber-800 px-2 py-1 text-xs mono rounded" data-testid={`pending-${c.id}`}>
                          {c.avanzamenti_da_convalidare} da convalidare
                        </span>
                      )}
                      <Link to={`/dettagliocommessa/${c.id}`} className="text-blue-600 text-xs hover:underline px-3 py-1.5 border border-blue-200 rounded hover:bg-blue-50" data-testid={`detail-comm-${c.id}`}><Eye size={14} className="inline mr-1" />Dettaglio</Link>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded overflow-hidden"><div className="h-full" style={{ width: `${c.avanzamento_pct || 0}%`, background: "var(--brand)" }} /></div>
                  {pending.length > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Avanzamenti in attesa di convalida</div>
                      {pending.map(({ a, av }) => (
                        <div key={av.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2 rounded text-xs gap-2" data-testid={`pending-av-${av.id}`}>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{av.descrizione}</span> · {av.percentuale}% · sub#{a.subappaltatore_id?.slice(-6)}
                            <div className="text-[10px] text-zinc-500 mono">{av.dichiarato_il?.slice(0, 16).replace("T", " ")}</div>
                          </div>
                          <Button size="sm" className="rounded-sm h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => convalida(a.id, av.id)} data-testid={`gestore-convalida-${av.id}`}>
                            <Check size={12} className="mr-1" /> Convalida & sblocca pagamento
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </Page>
  );
}

function KPI({ label, value, color = "text-zinc-900", testid }) {
  return (
    <div className="bg-white border border-zinc-200 rounded p-4" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
