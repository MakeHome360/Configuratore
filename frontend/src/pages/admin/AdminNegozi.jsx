import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Store } from "lucide-react";
import { toast } from "sonner";

export default function AdminNegozi() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState({ name: "", code: "", active: true });
  const load = () => api.get("/negozi").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);
  const save = async () => { await api.post("/negozi", draft); setModal(false); setDraft({ name: "", code: "", active: true }); toast.success("Creato"); load(); };

  return (
    <div>
      <PageHeader title="Gestione Negozi" subtitle="Configura i punti vendita e visualizza performance"
        actions={<Button onClick={() => setModal(true)} data-testid="neg-new" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuovo Negozio</Button>} />
      <Page>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((n) => (
            <div key={n.id} className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded bg-zinc-100 flex items-center justify-center"><Store className="h-5 w-5 text-zinc-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{n.name}</div>
                  <div className="text-xs text-zinc-500 font-mono">{n.code}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${n.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100"}`}>{n.active ? "Attivo" : "Inattivo"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-[10px] uppercase text-zinc-500">Lead</div><div className="font-semibold">0</div></div>
                <div><div className="text-[10px] uppercase text-zinc-500">Preventivi</div><div className="font-semibold">0</div></div>
                <div><div className="text-[10px] uppercase text-zinc-500">Commesse</div><div className="font-semibold">0</div></div>
                <div><div className="text-[10px] uppercase text-zinc-500">Fatturato</div><div className="font-semibold">{fmtEur(0)}</div></div>
              </div>
            </div>
          ))}
        </div>
        {modal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(false)}>
            <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg mb-4">Nuovo Negozio</h3>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="neg-name" /></div>
                <div><Label>Codice</Label><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase() })} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={() => setModal(false)}>Annulla</Button><Button onClick={save} style={{ background: "var(--brand)", color: "white" }}>Salva</Button></div>
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}
