import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Plus, Trash2, ChevronDown, ChevronUp, Save, X } from "lucide-react";
import { toast } from "sonner";

const MQ_SIM = [50, 70, 90, 120];

export default function AdminPacchetti() {
  const [packages, setPackages] = useState([]);
  const [voci, setVoci] = useState([]);
  const [tab, setTab] = useState("pacchetti");
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [p, v] = await Promise.all([api.get("/packages"), api.get("/voci-backoffice")]);
    setPackages(p.data || []); setVoci(v.data || []);
  };
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!window.confirm("Eliminare questo pacchetto?")) return;
    await api.delete(`/packages/${id}`); toast.success("Eliminato"); load();
  };

  return (
    <div>
      <PageHeader title="Pacchetti & Voci" subtitle="Gestisci prezzi, voci incluse e analisi di marginalità"
        actions={<Button onClick={() => setCreating(true)} data-testid="adm-new-pkg" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuovo Pacchetto</Button>}
      />
      <Page>
        <div className="flex gap-2 mb-5 border-b border-zinc-200">
          <button onClick={() => setTab("pacchetti")} className={`px-4 py-2 text-sm border-b-2 ${tab === "pacchetti" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-500"}`}>Gestione Pacchetti</button>
          <button onClick={() => setTab("voci")} className={`px-4 py-2 text-sm border-b-2 ${tab === "voci" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-500"}`}>Voci Incluse</button>
        </div>

        {tab === "pacchetti" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packages.map((p) => {
              const mq = 70;
              const ml = mq * 0.4; // approximate ml from mq
              const calcQty = (it, m, l) => {
                if (it.qty_mode === "fissa") return it.qty_value || 0;
                if (it.qty_mode === "ml") return (it.qty_ratio || 0) * l;
                return (it.qty_ratio || 0) * m; // default mq
              };
              const ricavo = p.price_per_m2 * mq;
              const costi = (p.items || []).reduce((s, it) => s + calcQty(it, mq, ml) * it.unit_price_pkg, 0);
              const margine = ricavo - costi;
              const marginePct = ricavo ? (margine / ricavo) * 100 : 0;
              const isOpen = expanded === p.id;
              return (
                <div key={p.id} className="bg-white border border-zinc-200 rounded-lg p-5" data-testid={`adm-pkg-${p.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xl font-bold" style={{ color: p.color }}>{p.name}</div>
                      <div className="text-xs text-zinc-500">{p.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase text-zinc-500">Prezzo</div>
                      <div className="text-2xl font-bold">{fmtEur(p.price_per_m2)}/mq</div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Marginalità stimata @ {mq} mq</div>
                  <div className="grid grid-cols-3 gap-2 text-sm pb-3 border-b border-zinc-100">
                    <div><div className="text-[10px] text-zinc-500">Ricavo</div><div className="font-semibold">{fmtEur(ricavo)}</div></div>
                    <div><div className="text-[10px] text-zinc-500">Costi ({p.items.length} voci)</div><div className="font-semibold">{fmtEur(costi)}</div></div>
                    <div><div className="text-[10px] text-zinc-500">Margine</div><div className={`font-semibold ${margine >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{marginePct.toFixed(1)}%</div></div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <button onClick={() => setExpanded(isOpen ? null : p.id)} className="text-sm flex items-center gap-1 text-zinc-600 hover:text-zinc-900">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Simula per MQ diversi
                    </button>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)} data-testid={`pkg-edit-${p.id}`}><Edit2 className="h-3 w-3 mr-1" />Modifica</Button>
                      <Button size="sm" variant="outline" onClick={() => del(p.id)} className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      {MQ_SIM.map((m) => {
                        const ml2 = m * 0.4;
                        const calcQty2 = (it) => it.qty_mode === "fissa" ? (it.qty_value || 0) : (it.qty_mode === "ml" ? (it.qty_ratio || 0) * ml2 : (it.qty_ratio || 0) * m);
                        const r = p.price_per_m2 * m;
                        const cc = (p.items || []).reduce((s, it) => s + calcQty2(it) * it.unit_price_pkg, 0);
                        return <div key={m} className="p-2 bg-zinc-50 rounded"><div className="font-mono">{m} mq</div><div>{fmtEur(r)}</div><div className={((r-cc)/r*100) >= 0 ? "text-emerald-600" : "text-rose-600"}>{((r-cc)/r*100).toFixed(1)}%</div></div>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "voci" && <VociIncluseTab packages={packages} voci={voci} reload={load} />}
      </Page>

      {(editing || creating) && <PackageDialog pkg={editing} voci={voci} onClose={() => { setEditing(null); setCreating(false); }} onSaved={load} isNew={creating} />}
    </div>
  );
}

function PackageDialog({ pkg, voci, onClose, onSaved, isNew }) {
  const [form, setForm] = useState(pkg || { name: "", subtitle: "", price_per_m2: 0, color: "#475569", description: "", items: [] });
  const save = async () => {
    if (!form.name) return toast.error("Nome obbligatorio");
    try {
      if (isNew) await api.post("/packages", form);
      else await api.put(`/packages/${form.id}`, form);
      toast.success("Salvato"); onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "Nuovo Pacchetto" : `Modifica ${form.name}`}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pkg-form-name" /></div>
            <div><Label>Prezzo €/mq *</Label><Input type="number" value={form.price_per_m2} onChange={(e) => setForm({ ...form, price_per_m2: Number(e.target.value) })} data-testid="pkg-form-price" /></div>
            <div className="col-span-2"><Label>Sottotitolo</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
            <div className="col-span-2"><Label>Descrizione</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Colore</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><Label>Voci incluse ({(form.items || []).length})</Label>
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, items: [...(form.items || []), { voce_id: voci[0]?.id, qty_mode: "mq", qty_value: 1, qty_ratio: 1, unit_price_pkg: voci[0]?.prezzo_rivendita || 0 }] })}><Plus className="h-3 w-3 mr-1" />Voce</Button>
            </div>
            <div className="text-xs text-zinc-500 mb-2 bg-blue-50 p-2 rounded">
              <strong>Modalità qtà:</strong>
              <ul className="ml-4 list-disc mt-1 space-y-0.5">
                <li><strong>Fissa</strong>: quantità sempre uguale (es. 1 caldaia, 6 punti luce)</li>
                <li><strong>MQ</strong>: qtà = MQ abitazione × coefficiente</li>
                <li><strong>ML</strong>: qtà = metri lineari × coefficiente</li>
              </ul>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {(form.items || []).map((it, i) => {
                const voce = voci.find(v => v.id === it.voce_id);
                return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 bg-zinc-50 rounded">
                  <select className="col-span-4 border border-zinc-300 rounded h-9 px-2 text-sm" value={it.voce_id} onChange={(e) => { const c = [...form.items]; c[i].voce_id = e.target.value; const v = voci.find(x => x.id === e.target.value); if (v) c[i].unit_price_pkg = v.prezzo_rivendita; setForm({ ...form, items: c }); }}>
                    {voci.map((v) => <option key={v.id} value={v.id}>[{v.category.slice(0,3)}] {v.name} ({v.unit})</option>)}
                  </select>
                  <select className="col-span-2 border border-zinc-300 rounded h-9 px-2 text-sm" value={it.qty_mode || "mq"} onChange={(e) => { const c = [...form.items]; c[i].qty_mode = e.target.value; setForm({ ...form, items: c }); }} data-testid={`pkg-qtymode-${i}`}>
                    <option value="fissa">Fissa</option>
                    <option value="mq">MQ</option>
                    <option value="ml">ML</option>
                  </select>
                  <Input className="col-span-2" type="number" step="0.001" placeholder={it.qty_mode === "fissa" ? "qty fissa" : "coefficiente"} value={it.qty_mode === "fissa" ? (it.qty_value ?? 1) : (it.qty_ratio ?? 1)} onChange={(e) => { const c = [...form.items]; if (c[i].qty_mode === "fissa") c[i].qty_value = Number(e.target.value); else c[i].qty_ratio = Number(e.target.value); setForm({ ...form, items: c }); }} />
                  <Input className="col-span-3" type="number" step="0.01" placeholder="€/u" value={it.unit_price_pkg} onChange={(e) => { const c = [...form.items]; c[i].unit_price_pkg = Number(e.target.value); setForm({ ...form, items: c }); }} />
                  <button className="col-span-1" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-rose-600 mx-auto" /></button>
                  {voce && <div className="col-span-12 text-[10px] text-zinc-500 -mt-1 px-1">{voce.unit} · acq {voce.prezzo_acquisto?.toFixed(2)}€ × {voce.ricarico}x = {voce.prezzo_rivendita?.toFixed(2)}€/u</div>}
                </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} data-testid="pkg-form-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button>
        </div>
      </div>
    </div>
  );
}

function VociIncluseTab({ packages, voci, reload }) {
  const [pkgId, setPkgId] = useState(packages[0]?.id);
  const pkg = packages.find((p) => p.id === pkgId);
  if (!packages.length) return <div className="text-zinc-500">Nessun pacchetto</div>;
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {packages.map((p) => (
          <button key={p.id} onClick={() => setPkgId(p.id)} className={`px-3 py-1.5 rounded text-sm ${pkgId === p.id ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>{p.name} ({p.items.length})</button>
        ))}
      </div>
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2 text-left">Voce</th><th className="px-3 py-2 text-left">Categoria</th><th className="px-3 py-2 text-center">Modo</th><th className="px-3 py-2 text-right">Quantità</th><th className="px-3 py-2 text-right">€/u</th><th className="px-3 py-2 text-right">Costo @70mq</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {(pkg?.items || []).map((it) => {
              const qtyDisplay = it.qty_mode === "fissa" ? `${it.qty_value || 0} ${it.unit}` : it.qty_mode === "ml" ? `${(it.qty_ratio || 0).toFixed(3)} × ml` : `${(it.qty_ratio || 0).toFixed(3)} × mq`;
              const qty70 = it.qty_mode === "fissa" ? (it.qty_value || 0) : it.qty_mode === "ml" ? (it.qty_ratio || 0) * 70 * 0.4 : (it.qty_ratio || 0) * 70;
              return (
              <tr key={it.id}>
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2 text-xs text-zinc-500">{it.category}</td>
                <td className="px-3 py-2 text-center text-xs">{(it.qty_mode || "mq").toUpperCase()}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{qtyDisplay}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtEur2(it.unit_price_pkg)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtEur(qty70 * it.unit_price_pkg)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
