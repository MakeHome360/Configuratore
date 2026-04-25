import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Hammer, Check, Eye } from "lucide-react";
import { toast } from "sonner";

const Page = ({ children }) => <div className="p-6 max-w-7xl mx-auto space-y-6">{children}</div>;

export default function GestoreCantieri() {
  const [cantieri, setCantieri] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = () => api.get("/gestore/cantieri").then(r => setCantieri(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(reload, []);

  const convalida = async (assId, avId) => {
    try {
      await api.post(`/subappaltatori/assegnazioni/${assId}/avanzamenti/${avId}/convalida`);
      toast.success("Avanzamento convalidato. Pagamento sbloccato.");
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  return (
    <Page>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Gestione Cantieri</h1>
        <p className="text-sm text-zinc-500 mt-1">I cantieri assegnati. Convalida gli avanzamenti dei subappaltatori per sbloccare i pagamenti.</p>
      </div>

      {loading ? <div className="text-zinc-400 mono">caricamento…</div>
        : cantieri.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded p-6 text-zinc-500">Nessun cantiere assegnato.</div>
        ) : cantieri.map(c => (
          <div key={c.id} className="bg-white border border-zinc-200 rounded p-4 space-y-3" data-testid={`cantiere-card-${c.id}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{c.numero || "Commessa"} · {c.cliente?.nome || ""} {c.cliente?.cognome || ""}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Avanzamento: {c.avanzamento_pct || 0}% · Stato: {c.stato}</div>
              </div>
              <div className="flex items-center gap-2">
                {c.avanzamenti_da_convalidare > 0 && (
                  <span className="bg-amber-100 text-amber-800 px-2 py-1 text-xs mono rounded" data-testid={`pending-${c.id}`}>
                    {c.avanzamenti_da_convalidare} da convalidare
                  </span>
                )}
                <Link to={`/dettagliocommessa/${c.id}`} className="text-blue-600 text-xs hover:underline" data-testid={`detail-comm-${c.id}`}><Eye size={14} className="inline mr-1" />Dettaglio</Link>
              </div>
            </div>
            {(c.assegnazioni || []).flatMap(a => (a.avanzamenti || []).filter(av => !av.convalidato).map(av => ({ a, av }))).length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Avanzamenti in attesa di convalida</div>
                {(c.assegnazioni || []).flatMap(a => (a.avanzamenti || []).filter(av => !av.convalidato).map(av => ({ a, av }))).map(({ a, av }) => (
                  <div key={av.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2 rounded text-xs" data-testid={`pending-av-${av.id}`}>
                    <div className="flex-1">
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
        ))}
    </Page>
  );
}
