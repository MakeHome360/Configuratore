import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hammer, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";

const Page = ({ children }) => <div className="p-6 max-w-6xl mx-auto space-y-6">{children}</div>;

export default function SubappaltatoreDettaglio() {
  const { id } = useParams();
  const [cantieri, setCantieri] = useState([]);
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    api.get(`/subappaltatori/${id}/cantieri`).then(r => setCantieri(r.data || [])).catch(() => {}).finally(() => setLoading(false));
    api.get("/subappaltatori").then(r => setSub((r.data || []).find(s => s.id === id))).catch(() => {});
  };
  useEffect(reload, [id]);

  return (
    <Page>
      <div>
        <Link to="/dashboard-subappaltatori" className="text-xs text-blue-600 hover:underline mono">← dashboard subappaltatori</Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">{sub?.nome || "Subappaltatore"}</h1>
        <p className="text-sm text-zinc-500 mt-1">{sub?.categoria || ""} · {cantieri.length} assegnazioni</p>
      </div>

      {loading ? <div className="text-zinc-400 mono">caricamento…</div>
        : cantieri.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded p-6 text-zinc-500">Nessun cantiere assegnato a questo subappaltatore.</div>
        ) : cantieri.map(a => (
          <CantiereCard key={a.id} ass={a} onRefresh={reload} />
        ))}
    </Page>
  );
}

function CantiereCard({ ass, onRefresh }) {
  const [newAv, setNewAv] = useState({ descrizione: "", percentuale: 50, note: "" });
  const [open, setOpen] = useState(false);

  const addAvanzamento = async () => {
    try {
      await api.post(`/subappaltatori/assegnazioni/${ass.id}/avanzamenti`, newAv);
      toast.success("Avanzamento dichiarato. In attesa di convalida.");
      setNewAv({ descrizione: "", percentuale: 50, note: "" });
      setOpen(false);
      onRefresh();
    } catch (e) { toast.error("Errore"); }
  };

  const convalida = async (avId) => {
    try {
      await api.post(`/subappaltatori/assegnazioni/${ass.id}/avanzamenti/${avId}/convalida`);
      toast.success("Avanzamento convalidato. Pagamento sbloccato.");
      onRefresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  const c = ass.commessa || {};
  return (
    <div className="bg-white border border-zinc-200 rounded p-4 space-y-3" data-testid={`ass-card-${ass.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{c.numero || "Commessa"} · {c.cliente?.nome || c.cliente?.cognome || ""}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{ass.descrizione_lavori || "—"}</div>
        </div>
        <div className="text-right">
          <div className="mono text-sm">€ {(ass.importo_pattuito || 0).toLocaleString("it-IT")}</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">{ass.stato}</div>
        </div>
      </div>
      <div className="border-t border-zinc-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Avanzamenti dichiarati</div>
          <Button size="sm" variant="outline" className="rounded-sm h-7" onClick={() => setOpen(!open)} data-testid={`add-av-${ass.id}`}>
            <Plus size={12} className="mr-1" /> Dichiara avanzamento
          </Button>
        </div>
        {open && (
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded space-y-2">
            <Input placeholder="Descrizione (es. completato 50% impianto idraulico)" value={newAv.descrizione} onChange={e => setNewAv({...newAv, descrizione: e.target.value})} className="rounded-sm h-8" data-testid="new-av-desc" />
            <div className="flex gap-2 items-center">
              <Label className="text-xs">% completamento:</Label>
              <Input type="number" min={0} max={100} value={newAv.percentuale} onChange={e => setNewAv({...newAv, percentuale: parseFloat(e.target.value) || 0})} className="rounded-sm h-8 w-20 mono" data-testid="new-av-pct" />
            </div>
            <Textarea placeholder="Note" rows={2} value={newAv.note} onChange={e => setNewAv({...newAv, note: e.target.value})} className="rounded-sm" />
            <Button size="sm" className="rounded-sm h-8 bg-zinc-900 text-white" onClick={addAvanzamento} data-testid="submit-av">Dichiara</Button>
          </div>
        )}
        <div className="space-y-1.5 mt-2">
          {(ass.avanzamenti || []).length === 0 ? (
            <div className="text-xs text-zinc-400 mono">Nessun avanzamento dichiarato</div>
          ) : (ass.avanzamenti || []).map(av => (
            <div key={av.id} className={`flex items-center justify-between text-xs p-2 rounded ${av.convalidato ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`} data-testid={`av-${av.id}`}>
              <div className="flex-1">
                <div className="font-medium">{av.descrizione} · {av.percentuale}%</div>
                <div className="text-[10px] text-zinc-500 mono">{av.dichiarato_il?.slice(0, 10)} · {av.note}</div>
              </div>
              {av.convalidato ? (
                <span className="text-emerald-700 mono text-[10px] flex items-center gap-1"><Check size={12} /> CONVALIDATO</span>
              ) : (
                <Button size="sm" variant="outline" className="rounded-sm h-7 border-amber-500 text-amber-700" onClick={() => convalida(av.id)} data-testid={`convalida-${av.id}`}>
                  Convalida
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
