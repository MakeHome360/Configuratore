import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Check, Plus } from "lucide-react";
import { toast } from "sonner";

const Page = ({ children }) => <div className="p-6 max-w-5xl mx-auto space-y-6">{children}</div>;

export default function PortaleSub() {
  const { user } = useAuth();
  const [cantieri, setCantieri] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!user?.subappaltatore_id) { setLoading(false); return; }
    api.get(`/subappaltatori/${user.subappaltatore_id}/cantieri`).then(r => setCantieri(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(reload, [user?.subappaltatore_id]);

  return (
    <Page>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">I miei cantieri</h1>
        <p className="text-sm text-zinc-500 mt-1">Le commesse a te assegnate. Puoi dichiarare gli avanzamenti, che dovranno essere convalidati dal gestore.</p>
      </div>
      {!user?.subappaltatore_id && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded text-sm">⚠ Il tuo account non è ancora associato a una scheda subappaltatore. Contatta l'amministratore.</div>
      )}
      {loading ? <div className="mono text-zinc-400">caricamento…</div>
        : cantieri.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded p-6 text-zinc-500">Nessun cantiere assegnato al momento.</div>
        ) : cantieri.map(a => (
          <SubCantiere key={a.id} ass={a} onRefresh={reload} />
        ))}
    </Page>
  );
}

function SubCantiere({ ass, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [nf, setNf] = useState({ descrizione: "", percentuale: 50, note: "" });
  const c = ass.commessa || {};
  const submit = async () => {
    if (!nf.descrizione.trim()) { toast.error("Inserisci una descrizione"); return; }
    try {
      await api.post(`/subappaltatori/assegnazioni/${ass.id}/avanzamenti`, nf);
      toast.success("Avanzamento dichiarato. In attesa di convalida.");
      setNf({ descrizione: "", percentuale: 50, note: "" });
      setOpen(false);
      onRefresh();
    } catch (e) { toast.error("Errore"); }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded p-4 space-y-3" data-testid={`sub-cantiere-${ass.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-lg flex items-center gap-2"><Briefcase size={16} /> {c.numero || "Commessa"}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{c.cliente?.nome || ""} · {c.indirizzo || ""}</div>
          <div className="text-sm mt-2">{ass.descrizione_lavori || "—"}</div>
          {ass.fasi_assegnate?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ass.fasi_assegnate.map((f, i) => <span key={i} className="text-[10px] mono px-1.5 py-0.5 bg-zinc-100 rounded">{f}</span>)}
            </div>
          )}
        </div>
        <div className="text-right text-xs">
          <div className="mono">€ {(ass.importo_pattuito || 0).toLocaleString("it-IT")}</div>
          <div className="text-[10px] uppercase mt-1 text-zinc-500">scadenza {ass.data_fine_prevista?.slice(0, 10) || "—"}</div>
        </div>
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Avanzamenti</div>
          <Button size="sm" variant="outline" className="rounded-sm h-7" onClick={() => setOpen(!open)} data-testid={`sub-add-${ass.id}`}>
            <Plus size={12} className="mr-1" /> Dichiara avanzamento
          </Button>
        </div>
        {open && (
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded space-y-2 mb-2">
            <Input placeholder="Es. installato sanitari bagno" value={nf.descrizione} onChange={e => setNf({...nf, descrizione: e.target.value})} className="rounded-sm h-8" data-testid="sub-desc" />
            <div className="flex items-center gap-2">
              <Label className="text-xs">% completamento:</Label>
              <Input type="number" min={0} max={100} value={nf.percentuale} onChange={e => setNf({...nf, percentuale: parseFloat(e.target.value) || 0})} className="rounded-sm h-8 w-20 mono" data-testid="sub-pct" />
            </div>
            <Textarea placeholder="Note aggiuntive (opzionale)" rows={2} value={nf.note} onChange={e => setNf({...nf, note: e.target.value})} className="rounded-sm" />
            <Button size="sm" className="rounded-sm h-8 bg-zinc-900 text-white" onClick={submit} data-testid="sub-submit">Invia per convalida</Button>
          </div>
        )}
        <div className="space-y-1.5">
          {(ass.avanzamenti || []).length === 0 ? <div className="text-xs text-zinc-400 mono">Nessun avanzamento</div>
            : (ass.avanzamenti || []).map(av => (
              <div key={av.id} className={`text-xs p-2 rounded ${av.convalidato ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{av.descrizione} · {av.percentuale}%</span>
                  {av.convalidato ? (
                    <span className="text-emerald-700 mono text-[10px] flex items-center gap-1"><Check size={11} /> CONVALIDATO · pagamento sbloccato</span>
                  ) : (
                    <span className="text-amber-700 mono text-[10px]">⏳ in attesa convalida</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 mono mt-0.5">{av.dichiarato_il?.slice(0, 16).replace("T", " ")} · {av.note}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
