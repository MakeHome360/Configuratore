import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminSubappaltatori() {
  const [rows, setRows] = useState([]);
  const [tipo, setTipo] = useState("subappaltatore");
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState({ nome: "", categoria: "", telefono: "", email: "" });
  const load = () => api.get("/subappaltatori").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);
  const filt = rows.filter((r) => r.tipo === tipo);
  const save = async () => { await api.post("/subappaltatori", { ...draft, tipo }); setModal(false); setDraft({ nome: "", categoria: "", telefono: "", email: "" }); toast.success("Creato"); load(); };
  const del = async (id) => { if (!window.confirm("Eliminare?")) return; await api.delete(`/subappaltatori/${id}`); load(); };

  return (
    <div>
      <PageHeader title="Subappaltatori e Fornitori" subtitle="Gestisci la tua rete: cantieri, scadenze e pagamenti"
        actions={<Button onClick={() => setModal(true)} data-testid="sub-new" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuovo</Button>} />
      <Page>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTipo("subappaltatore")} data-testid="tab-subapp" className={`px-4 py-2 rounded ${tipo === "subappaltatore" ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>Subappaltatori ({rows.filter(r => r.tipo === "subappaltatore").length})</button>
          <button onClick={() => setTipo("fornitore")} data-testid="tab-forn" className={`px-4 py-2 rounded ${tipo === "fornitore" ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>Fornitori ({rows.filter(r => r.tipo === "fornitore").length})</button>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Categoria</th><th className="px-3 py-2 text-left">Contatti</th><th className="px-3 py-2 text-left">Cantieri</th><th className="px-3 py-2 text-center">Stato</th><th></th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.nome}</td>
                  <td className="px-3 py-2">{r.categoria}</td>
                  <td className="px-3 py-2 text-xs">{r.telefono} {r.email && <><br />{r.email}</>}</td>
                  <td className="px-3 py-2">{r.num_cantieri || 0} cantieri</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded ${r.attivo ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100"}`}>{r.attivo ? "Attivo" : "Inattivo"}</span></td>
                  <td className="px-3 py-2"><button onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-rose-600" /></button></td>
                </tr>
              ))}
              {!filt.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">Nessuno</td></tr>}
            </tbody>
          </table>
        </div>
        {modal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(false)}>
            <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg mb-4">Nuovo {tipo}</h3>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} data-testid="sub-new-nome" /></div>
                <div><Label>Categoria</Label><Input value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })} placeholder="es. Muratore, Elettricista" /></div>
                <div><Label>Telefono</Label><Input value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="outline" onClick={() => setModal(false)}>Annulla</Button>
                <Button onClick={save} data-testid="sub-save" style={{ background: "var(--brand)", color: "white" }}>Salva</Button>
              </div>
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}
