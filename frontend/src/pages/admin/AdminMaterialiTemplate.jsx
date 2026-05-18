import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Star, StarOff, Save } from "lucide-react";

export default function AdminMaterialiTemplate() {
  const [templates, setTemplates] = useState([]);
  const [edit, setEdit] = useState(null); // template selezionato per editing
  const reload = async () => {
    try { const r = await api.get("/admin/materiali-template"); setTemplates(r.data || []); }
    catch { toast.error("Errore caricamento template"); }
  };
  useEffect(() => { reload(); }, []);

  const newTemplate = () => setEdit({ nome: "Template Bagno standard", is_default: false, voci: [
    { name: "Piastrelle pavimento", category: "piastrelle", unit: "m²", qty_default: 10, prezzo_default: 35, finiture: ["Grigio chiaro", "Beige", "Marmo bianco"] },
    { name: "Piastrelle rivestimento", category: "piastrelle", unit: "m²", qty_default: 20, prezzo_default: 32, finiture: ["Bianco lucido", "Effetto pietra"] },
    { name: "WC sospeso", category: "sanitari", unit: "pz", qty_default: 1, prezzo_default: 280, finiture: ["Bianco classico", "Nero opaco"] },
    { name: "Lavabo bagno", category: "sanitari", unit: "pz", qty_default: 1, prezzo_default: 320, finiture: ["Bianco", "Antracite", "Tortora"] },
    { name: "Rubinetteria", category: "rubinetteria", unit: "set", qty_default: 1, prezzo_default: 450, finiture: ["Cromato", "Nero opaco", "Oro spazzolato"] },
  ]});

  const saveTemplate = async () => {
    if (!edit?.nome) { toast.error("Nome obbligatorio"); return; }
    try {
      if (edit.id) {
        await api.put(`/admin/materiali-template/${edit.id}`, edit);
        toast.success("Template aggiornato");
      } else {
        const r = await api.post("/admin/materiali-template", edit);
        toast.success("Template creato");
        setEdit(r.data);
      }
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore salvataggio"); }
  };

  const delTemplate = async (id) => {
    if (!window.confirm("Eliminare il template? L'azione è irreversibile.")) return;
    await api.delete(`/admin/materiali-template/${id}`);
    if (edit?.id === id) setEdit(null);
    reload();
  };

  const toggleDefault = async (t) => {
    await api.put(`/admin/materiali-template/${t.id}`, { ...t, is_default: !t.is_default });
    reload();
    if (edit?.id === t.id) setEdit({ ...edit, is_default: !edit.is_default });
  };

  const addRow = () => setEdit(e => ({ ...e, voci: [...(e.voci || []), { name: "Nuovo materiale", category: "materiali", unit: "pz", qty_default: 1, prezzo_default: 0, finiture: [] }] }));
  const updRow = (i, k, v) => setEdit(e => ({ ...e, voci: e.voci.map((row, j) => j === i ? { ...row, [k]: v } : row) }));
  const delRow = (i) => setEdit(e => ({ ...e, voci: e.voci.filter((_, j) => j !== i) }));

  return (
    <div data-testid="admin-materiali-template-page">
      <PageHeader
        title="Template Tabella Materiali"
        subtitle="Crea bozze pre-impostate di tabelle materiali. Quando un preventivo viene accettato, la commessa generata erediterà automaticamente il template impostato come predefinito (★). Il venditore dovrà solo scegliere le finiture."
      />
      <Page>
        <div className="space-y-5">

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          {/* lista template */}
          <div className="space-y-2">
            <Button onClick={newTemplate} className="w-full" style={{ background: "var(--brand)", color: "white" }} data-testid="mt-new"><Plus className="h-4 w-4 mr-1" /> Nuovo template</Button>
            <div className="bg-white border border-zinc-200 rounded divide-y divide-zinc-100">
              {templates.length === 0 && <div className="p-4 text-xs text-zinc-500 text-center">Nessun template. Crea il primo per attivare la funzione auto-popolamento materiali.</div>}
              {templates.map((t) => (
                <div key={t.id} className={`p-3 cursor-pointer hover:bg-zinc-50 ${edit?.id === t.id ? "bg-amber-50 border-l-4 border-amber-500" : ""}`} onClick={() => setEdit(t)} data-testid={`mt-row-${t.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{t.nome}</div>
                    <button onClick={(e) => { e.stopPropagation(); toggleDefault(t); }} className="text-amber-500 hover:text-amber-600" title={t.is_default ? "Template predefinito" : "Imposta come predefinito"}>
                      {t.is_default ? <Star className="h-4 w-4 fill-amber-500" /> : <StarOff className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{(t.voci || []).length} voci</div>
                </div>
              ))}
            </div>
          </div>

          {/* editor */}
          {edit ? (
            <div className="bg-white border border-zinc-200 rounded p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-3">
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">Nome template</Label>
                  <Input value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} className="mt-1" data-testid="mt-nome" />
                </div>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input type="checkbox" checked={!!edit.is_default} onChange={e => setEdit({ ...edit, is_default: e.target.checked })} data-testid="mt-is-default" />
                  Predefinito (auto-applicato a tutte le nuove commesse)
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">Voci del template</Label>
                  <Button size="sm" variant="outline" onClick={addRow} data-testid="mt-add-row"><Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi voce</Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 uppercase">
                    <tr>
                      <th className="px-2 py-2 text-left">Nome</th>
                      <th className="px-2 py-2 text-left w-32">Categoria</th>
                      <th className="px-2 py-2 text-left w-16">UM</th>
                      <th className="px-2 py-2 text-right w-20">Qty</th>
                      <th className="px-2 py-2 text-right w-24">Prezzo</th>
                      <th className="px-2 py-2 text-left">Finiture disponibili (separate da ; )</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(edit.voci || []).map((v, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1"><Input value={v.name || ""} onChange={e => updRow(i, "name", e.target.value)} className="h-8" /></td>
                        <td className="px-2 py-1"><Input value={v.category || ""} onChange={e => updRow(i, "category", e.target.value)} className="h-8" /></td>
                        <td className="px-2 py-1"><Input value={v.unit || ""} onChange={e => updRow(i, "unit", e.target.value)} className="h-8" /></td>
                        <td className="px-2 py-1"><Input type="number" value={v.qty_default || 0} onChange={e => updRow(i, "qty_default", parseFloat(e.target.value) || 0)} className="h-8 text-right mono" /></td>
                        <td className="px-2 py-1"><Input type="number" step="0.01" value={v.prezzo_default || 0} onChange={e => updRow(i, "prezzo_default", parseFloat(e.target.value) || 0)} className="h-8 text-right mono" /></td>
                        <td className="px-2 py-1"><Input value={(v.finiture || []).join("; ")} onChange={e => updRow(i, "finiture", e.target.value.split(";").map(s => s.trim()).filter(Boolean))} placeholder="es: Bianco; Nero opaco; Tortora" className="h-8" /></td>
                        <td className="px-2 py-1"><button onClick={() => delRow(i)} className="text-rose-600 p-1" data-testid={`mt-row-del-${i}`}><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                    {(edit.voci || []).length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-400">Nessuna voce. Clicca "Aggiungi voce" sopra.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
                {edit.id && <button onClick={() => delTemplate(edit.id)} className="text-xs text-rose-600 underline" data-testid="mt-delete">Elimina template</button>}
                <Button onClick={saveTemplate} className="ml-auto" style={{ background: "var(--brand)", color: "white" }} data-testid="mt-save"><Save className="h-4 w-4 mr-1.5" /> Salva template</Button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded p-12 text-center text-zinc-400">
              Seleziona un template a sinistra per modificarlo, oppure crea un nuovo template.
            </div>
          )}
        </div>
        </div>
      </Page>
    </div>
  );
}
