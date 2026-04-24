import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Trash2, Plus, RefreshCcw, X, Edit2 } from "lucide-react";

const CATS = ["MURATURA", "IMPIANTI", "INFISSI", "SERVIZI"];

export default function AdminVociBackoffice() {
  const [rows, setRows] = useState([]);
  const [cat, setCat] = useState("MURATURA");
  const [dirty, setDirty] = useState({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/voci-backoffice").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);

  const byCat = (c) => rows.filter((v) => v.category === c);
  const filt = byCat(cat);

  const saveRow = async (id) => {
    const row = rows.find((r) => r.id === id);
    await api.put(`/voci-backoffice/${id}`, { prezzo_acquisto: row.prezzo_acquisto, ricarico: row.ricarico, name: row.name, unit: row.unit, category: row.category });
    toast.success("Salvato"); setDirty((d) => ({ ...d, [id]: false })); load();
  };
  const upd = (id, k, v) => { setRows(rows.map((r) => r.id === id ? { ...r, [k]: v } : r)); setDirty((d) => ({ ...d, [id]: true })); };
  const del = async (id) => { if (!window.confirm("Eliminare questa voce?")) return; await api.delete(`/voci-backoffice/${id}`); toast.success("Eliminato"); load(); };
  const sync = async () => {
    if (!window.confirm("Sincronizzare i prezzi di rivendita su TUTTI i pacchetti?")) return;
    const r = await api.post("/voci-backoffice/sync");
    toast.success(`${r.data.packages_updated} pacchetti aggiornati`);
  };

  return (
    <div>
      <PageHeader title="Voci Backoffice" subtitle="Gestisci costi di acquisto e ricarichi per calcolare i margini"
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={sync} data-testid="vb-sync"><RefreshCcw className="h-4 w-4 mr-1" />Sincronizza Tutti</Button>
          <Button onClick={() => setCreating(true)} data-testid="vb-new" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuova Voce</Button>
        </div>} />
      <Page>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {CATS.map((c) => {
            const vs = byCat(c);
            const acq = vs.reduce((s, v) => s + v.prezzo_acquisto, 0);
            const riv = vs.reduce((s, v) => s + (v.prezzo_acquisto * v.ricarico), 0);
            const mar = riv ? ((riv - acq) / riv * 100) : 0;
            return (
              <button key={c} onClick={() => setCat(c)} data-testid={`adm-vb-tab-${c}`}
                className={`p-4 border-2 rounded-lg text-left ${cat === c ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                <div className="font-bold">{c}</div>
                <div className="text-xs text-zinc-500 mt-1">Acquisto: {fmtEur2(acq)}</div>
                <div className="text-xs text-zinc-500">Rivendita: {fmtEur2(riv)}</div>
                <div className="text-xs font-semibold text-emerald-600">+{mar.toFixed(1)}%</div>
              </button>
            );
          })}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr><th className="px-3 py-2 text-left">Voce</th><th className="px-3 py-2 text-right">Acquisto</th><th className="px-3 py-2 text-right">Ricarico</th><th className="px-3 py-2 text-right">Rivendita</th><th className="px-3 py-2 text-right">Margine</th><th className="px-3 py-2 text-right">Azioni</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((v) => {
                const riv = v.prezzo_acquisto * v.ricarico;
                const marEur = riv - v.prezzo_acquisto;
                const marPct = riv ? (marEur / riv * 100) : 0;
                return (
                  <tr key={v.id}>
                    <td className="px-3 py-2">{v.name}</td>
                    <td className="px-3 py-2"><Input type="number" step="0.01" className="text-right h-8 w-24 ml-auto" value={v.prezzo_acquisto} onChange={(e) => upd(v.id, "prezzo_acquisto", Number(e.target.value))} data-testid={`vb-acq-${v.id}`} /></td>
                    <td className="px-3 py-2"><Input type="number" step="0.1" className="text-right h-8 w-20 ml-auto" value={v.ricarico} onChange={(e) => upd(v.id, "ricarico", Number(e.target.value))} /></td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur2(riv)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${marPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>+{marPct.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        {dirty[v.id] && <Button size="sm" onClick={() => saveRow(v.id)}><Save className="h-3 w-3" /></Button>}
                        <button onClick={() => setEditing(v)} className="p-1 hover:bg-zinc-100 rounded" data-testid={`vb-edit-${v.id}`}><Edit2 className="h-4 w-4 text-zinc-600" /></button>
                        <button onClick={() => del(v.id)} className="p-1 hover:bg-rose-50 rounded"><Trash2 className="h-4 w-4 text-rose-600" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Page>
      {(creating || editing) && <VoceDialog voce={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={load} isNew={creating} />}
    </div>
  );
}

function VoceDialog({ voce, onClose, onSaved, isNew }) {
  const [f, setF] = useState(voce || { name: "", category: "MURATURA", unit: "m²", prezzo_acquisto: 0, ricarico: 1.8 });
  const save = async () => {
    if (!f.name) return toast.error("Nome");
    try {
      if (isNew) await api.post("/voci-backoffice", f);
      else await api.put(`/voci-backoffice/${f.id}`, f);
      toast.success("Salvato"); onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center"><h2 className="font-semibold text-lg">{isNew ? "Nuova Voce" : "Modifica Voce"}</h2><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="p-6 space-y-3">
          <div><Label>Nome *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="vb-form-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria</Label>
              <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Unità</Label>
              <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
                <option value="m²">m²</option><option value="ml">ml</option><option value="pz">pz</option><option value="forfait">forfait</option>
              </select>
            </div>
            <div><Label>Prezzo Acquisto €</Label><Input type="number" step="0.01" value={f.prezzo_acquisto} onChange={(e) => setF({ ...f, prezzo_acquisto: Number(e.target.value) })} /></div>
            <div><Label>Ricarico (x)</Label><Input type="number" step="0.1" value={f.ricarico} onChange={(e) => setF({ ...f, ricarico: Number(e.target.value) })} /></div>
          </div>
          <div className="text-sm text-zinc-500">Rivendita = {fmtEur2(f.prezzo_acquisto * f.ricarico)}</div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annulla</Button><Button onClick={save} data-testid="vb-form-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button></div>
      </div>
    </div>
  );
}
