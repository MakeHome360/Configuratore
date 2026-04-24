import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, X, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function AdminFasiCommessa() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState(null);

  const load = () => api.get("/fasi-commessa").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    if (data.id && rows.some((r) => r.id === data.id)) await api.put(`/fasi-commessa/${data.id}`, data);
    else await api.post("/fasi-commessa", data);
    toast.success("Salvato"); setEditing(null); setCreating(false); load();
  };

  const del = async (id) => {
    if (!window.confirm("Eliminare questa fase? Le commesse esistenti non saranno modificate.")) return;
    await api.delete(`/fasi-commessa/${id}`); toast.success("Eliminata"); load();
  };

  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = async (targetId) => {
    if (!dragId || dragId === targetId) return;
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, dragId);
    // optimistic update
    const newRows = ids.map((id, idx) => ({ ...rows.find((r) => r.id === id), order: idx + 1 }));
    setRows(newRows); setDragId(null);
    try { await api.post("/fasi-commessa/reorder", { ordered_ids: ids }); toast.success("Ordine aggiornato"); }
    catch { toast.error("Errore"); load(); }
  };

  return (
    <div>
      <PageHeader title="Fasi Commessa" subtitle="Trascina ↕ per riordinare. Configura la checklist delle fasi di lavorazione"
        actions={<Button onClick={() => setCreating(true)} data-testid="fase-new" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuova Fase</Button>} />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {rows.map((f) => (
            <div key={f.id}
                 draggable
                 onDragStart={() => onDragStart(f.id)}
                 onDragOver={onDragOver}
                 onDrop={() => onDrop(f.id)}
                 className={`px-3 py-3 flex items-center gap-3 cursor-move transition-colors ${dragId === f.id ? "opacity-40" : "hover:bg-zinc-50"}`}
                 data-testid={`fase-row-${f.id}`}>
              <GripVertical className="h-5 w-5 text-zinc-400 shrink-0" />
              <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold shrink-0">{f.order}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-zinc-500">{f.description}</div>
              </div>
              {f.has_doc && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded shrink-0">📄 Doc obbligatorio</span>}
              {f.obbligatoria && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded shrink-0">Obblig.</span>}
              <button onClick={() => setEditing(f)} className="p-1.5 rounded hover:bg-zinc-100" data-testid={`fase-edit-${f.id}`}><Edit2 className="h-4 w-4 text-zinc-600" /></button>
              <button onClick={() => del(f.id)} className="p-1.5 rounded hover:bg-rose-50"><Trash2 className="h-4 w-4 text-rose-600" /></button>
            </div>
          ))}
        </div>
      </Page>
      {(editing || creating) && <FaseDialog fase={editing} onClose={() => { setEditing(null); setCreating(false); }} onSave={save} isNew={creating} />}
    </div>
  );
}

function FaseDialog({ fase, onClose, onSave, isNew }) {
  const [f, setF] = useState(fase || { name: "", description: "", has_doc: false, obbligatoria: true });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between"><h2 className="font-semibold">{isNew ? "Nuova Fase" : `Modifica Fase ${f.order || ""}`}</h2><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="p-6 space-y-3">
          <div><Label>Nome *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="fase-form-name" /></div>
          <div><Label>Descrizione</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex flex-col gap-2 bg-zinc-50 p-3 rounded">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.has_doc} onChange={(e) => setF({ ...f, has_doc: e.target.checked })} data-testid="fase-has-doc" /><strong>Documento obbligatorio</strong> — non si può flaggare la fase senza upload</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.obbligatoria} onChange={(e) => setF({ ...f, obbligatoria: e.target.checked })} /> Fase obbligatoria nel workflow</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annulla</Button><Button onClick={() => onSave(f)} data-testid="fase-form-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button></div>
      </div>
    </div>
  );
}
