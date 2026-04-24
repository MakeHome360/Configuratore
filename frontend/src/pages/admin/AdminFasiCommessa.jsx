import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, X, Save, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminFasiCommessa() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/fasi-commessa").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);

  const save = async (data) => { await api.put(`/fasi-commessa/${data.id}`, data); toast.success("Salvato"); setEditing(null); load(); };

  return (
    <div>
      <PageHeader title="Fasi Commessa" subtitle="Configura la checklist delle fasi di lavorazione" />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {rows.map((f) => (
            <div key={f.id} className="px-4 py-3 flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold">{f.order}</div>
              <div className="flex-1">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-zinc-500">{f.description}</div>
              </div>
              {f.has_doc && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Doc</span>}
              {f.obbligatoria && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Obblig.</span>}
              <button onClick={() => setEditing(f)} className="p-1.5 rounded hover:bg-zinc-100" data-testid={`fase-edit-${f.id}`}><Edit2 className="h-4 w-4 text-zinc-600" /></button>
            </div>
          ))}
        </div>
      </Page>
      {editing && <FaseDialog fase={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function FaseDialog({ fase, onClose, onSave }) {
  const [f, setF] = useState(fase);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between"><h2 className="font-semibold">Modifica Fase {f.order}</h2><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="p-6 space-y-3">
          <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="fase-form-name" /></div>
          <div><Label>Descrizione</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.has_doc} onChange={(e) => setF({ ...f, has_doc: e.target.checked })} /> Richiede documento</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.obbligatoria} onChange={(e) => setF({ ...f, obbligatoria: e.target.checked })} /> Obbligatoria</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annulla</Button><Button onClick={() => onSave(f)} data-testid="fase-form-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button></div>
      </div>
    </div>
  );
}
