import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Plus, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

export default function AdminOptional() {
  const [optional, setOptional] = useState([]);
  const [pkg, setPkg] = useState("pkg-basic");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/optional").then((r) => setOptional(r.data || []));
  useEffect(() => { load(); }, []);

  const filt = optional.filter((o) => o.package_ids?.includes(pkg));
  const del = async (id) => { if (!window.confirm("Eliminare?")) return; await api.delete(`/optional/${id}`); toast.success("Eliminato"); load(); };

  return (
    <div>
      <PageHeader title="Gestione Optional" subtitle="Configura gli optional per ogni pacchetto"
        actions={<Button onClick={() => setCreating(true)} data-testid="opt-new" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuovo Optional</Button>} />
      <Page>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {Object.entries(PKG_NAMES).map(([id, name]) => (
            <button key={id} onClick={() => setPkg(id)} data-testid={`adm-opt-tab-${id}`}
              className={`p-4 border-2 rounded-lg text-left ${pkg === id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
              <div className="font-bold">{name}</div>
              <div className="text-xs text-zinc-500">{optional.filter((o) => o.package_ids?.includes(id)).length} optional</div>
            </button>
          ))}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50 font-semibold">Optional Pacchetto {PKG_NAMES[pkg]}</div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-zinc-500 bg-zinc-50">
              <tr><th className="px-3 py-2 text-left">Optional</th><th className="px-3 py-2 text-right">Listino</th><th className="px-3 py-2 text-right">Scontato</th><th className="px-3 py-2 text-right">Risparmio</th><th className="px-3 py-2 text-right">Azioni</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((o) => {
                const risp = (o.price_listino || 0) - (o.price_scontato || 0);
                const pct = o.price_listino ? (risp / o.price_listino * 100) : 0;
                return (
                  <tr key={o.id}>
                    <td className="px-3 py-2">{o.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur(o.price_listino)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur(o.price_scontato)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600">-{pct.toFixed(0)}% ({fmtEur(risp)})</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditing(o)} className="p-1 hover:bg-zinc-100 rounded" data-testid={`opt-edit-${o.id}`}><Edit2 className="h-4 w-4 text-zinc-600" /></button>
                        <button onClick={() => del(o.id)} className="p-1 hover:bg-rose-50 rounded"><Trash2 className="h-4 w-4 text-rose-600" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filt.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-500">Nessun optional</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-zinc-500 bg-amber-50 border border-amber-200 p-3 rounded">
          <strong>Come funziona:</strong> Il cliente paga il Prezzo Scontato invece del Listino, risparmiando la differenza.
        </div>
      </Page>
      {(editing || creating) && <OptDialog opt={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={load} isNew={creating} />}
    </div>
  );
}

function OptDialog({ opt, onClose, onSaved, isNew }) {
  const [form, setForm] = useState(opt || { name: "", price_listino: 0, price_scontato: 0, unit: "forfait", package_ids: [] });
  const save = async () => {
    if (!form.name) return toast.error("Nome obbligatorio");
    try {
      if (isNew) await api.post("/optional", form);
      else await api.put(`/optional/${form.id}`, form);
      toast.success("Salvato"); onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };
  const togglePkg = (id) => {
    const ids = form.package_ids || [];
    setForm({ ...form, package_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "Nuovo Optional" : "Modifica Optional"}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="opt-form-name" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Listino €</Label><Input type="number" value={form.price_listino} onChange={(e) => setForm({ ...form, price_listino: Number(e.target.value) })} /></div>
            <div><Label>Scontato €</Label><Input type="number" value={form.price_scontato} onChange={(e) => setForm({ ...form, price_scontato: Number(e.target.value) })} /></div>
            <div><Label>Unità</Label>
              <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="forfait">forfait</option><option value="pz">pz</option><option value="m²">m²</option><option value="ml">ml</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Applicabile a</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {Object.entries(PKG_NAMES).map(([id, name]) => (
                <label key={id} className={`p-2 border-2 rounded cursor-pointer text-center text-sm ${(form.package_ids || []).includes(id) ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                  <input type="checkbox" className="hidden" checked={(form.package_ids || []).includes(id)} onChange={() => togglePkg(id)} />
                  {name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} data-testid="opt-form-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button>
        </div>
      </div>
    </div>
  );
}
