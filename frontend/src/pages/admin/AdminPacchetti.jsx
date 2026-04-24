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
  const initial = pkg ? { ...pkg, items: (pkg.items || []).map((it) => ({ voce_id: it.voce_id || it.id, qty_mode: it.qty_mode || "mq", qty_ratio: it.qty_ratio || 0, qty_value: it.qty_value || 0, unit_price_pkg: it.unit_price_pkg })) } : { name: "", subtitle: "", price_per_m2: 0, color: "#475569", description: "", items: [] };
  const [form, setForm] = useState(initial);
  const [search, setSearch] = useState("");
  const save = async () => {
    if (!form.name) return toast.error("Nome obbligatorio");
    try {
      if (isNew) await api.post("/packages", form);
      else await api.put(`/packages/${form.id}`, form);
      toast.success("Salvato"); onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };

  // Group voci by category respecting demolition-first order
  const sortVoce = (a, b) => {
    const isDemo = (n) => /demoliz|smaltim|rimoz/i.test(n);
    const order = { MURATURA: 2, IMPIANTI: 3, INFISSI: 4, SERVIZI: 5 };
    const ka = isDemo(a.name) ? 1 : (order[a.category] || 9);
    const kb = isDemo(b.name) ? 1 : (order[b.category] || 9);
    return ka - kb || a.name.localeCompare(b.name);
  };
  const groupedAvail = useMemo(() => {
    const matches = (v) => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase());
    const inSel = new Set((form.items || []).map((i) => i.voce_id));
    const filt = voci.filter((v) => matches(v) && !inSel.has(v.id)).sort(sortVoce);
    const groups = {};
    filt.forEach((v) => {
      const isDemo = /demoliz|smaltim|rimoz/i.test(v.name);
      const key = isDemo ? "DEMOLIZIONI" : v.category;
      groups[key] = groups[key] || []; groups[key].push(v);
    });
    return groups;
  }, [voci, form.items, search]);

  const selectedItems = (form.items || []).map((it) => ({ ...it, voce: voci.find((v) => v.id === it.voce_id) })).filter((i) => i.voce).sort((a, b) => sortVoce(a.voce, b.voce));
  const addVoce = (v) => setForm({ ...form, items: [...(form.items || []), { voce_id: v.id, qty_mode: v.unit === "pz" || v.unit === "punto" || v.unit === "forfait" ? "fissa" : "mq", qty_value: 1, qty_ratio: 1, unit_price_pkg: v.prezzo_rivendita }] });
  const removeVoce = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) });
  const updateItem = (i, k, val) => { const c = [...form.items]; c[i][k] = val; setForm({ ...form, items: c }); };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "Nuovo Pacchetto" : `Modifica ${form.name}`}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-12 gap-0 flex-1 overflow-hidden">
          {/* LEFT: Package data */}
          <div className="col-span-3 border-r p-5 space-y-3 overflow-y-auto">
            <div><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pkg-form-name" /></div>
            <div><Label className="text-xs">Prezzo €/mq *</Label><Input type="number" value={form.price_per_m2} onChange={(e) => setForm({ ...form, price_per_m2: Number(e.target.value) })} data-testid="pkg-form-price" /></div>
            <div><Label className="text-xs">Sottotitolo</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
            <div><Label className="text-xs">Descrizione</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label className="text-xs">Colore</Label><div className="flex items-center gap-2 mt-1"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-10 rounded cursor-pointer" /><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" /></div></div>
          </div>

          {/* MIDDLE: Available voci picker */}
          <div className="col-span-4 border-r flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b bg-zinc-50">
              <div className="font-semibold text-sm mb-2">Voci disponibili</div>
              <Input placeholder="Cerca voce..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="pkg-voce-search" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {["DEMOLIZIONI", "MURATURA", "IMPIANTI", "INFISSI", "SERVIZI"].map((k) => groupedAvail[k] && (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-1 px-1" style={{ color: k === "DEMOLIZIONI" ? "#DC2626" : k === "MURATURA" ? "#0F766E" : k === "IMPIANTI" ? "#2563EB" : k === "INFISSI" ? "#9333EA" : "#B45309" }}>{k}</div>
                  <div className="space-y-1">
                    {groupedAvail[k].map((v) => (
                      <button key={v.id} onClick={() => addVoce(v)} data-testid={`pkg-add-${v.id}`}
                        className="w-full text-left px-3 py-2 border border-zinc-200 rounded hover:border-zinc-900 hover:bg-zinc-50 group">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium truncate">{v.name}</div>
                          <Plus className="h-4 w-4 text-zinc-400 group-hover:text-zinc-900 shrink-0" />
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{v.unit} · acq {v.prezzo_acquisto?.toFixed(2)}€ × {v.ricarico}x = <strong>{v.prezzo_rivendita?.toFixed(2)}€</strong></div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(groupedAvail).length === 0 && <div className="text-sm text-zinc-500 text-center py-8">Nessuna voce disponibile</div>}
            </div>
          </div>

          {/* RIGHT: Selected voci */}
          <div className="col-span-5 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
              <div className="font-semibold text-sm">Voci incluse ({selectedItems.length})</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Demolizioni → Muratura → Impianti → Infissi → Servizi</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedItems.length === 0 && <div className="text-sm text-zinc-500 text-center py-12">Aggiungi voci dal centro</div>}
              {selectedItems.map((it, idx) => {
                const i = (form.items || []).findIndex((x) => x.voce_id === it.voce_id);
                const v = it.voce;
                const isDemo = /demoliz|smaltim|rimoz/i.test(v.name);
                const colorMap = { MURATURA: "#0F766E", IMPIANTI: "#2563EB", INFISSI: "#9333EA", SERVIZI: "#B45309" };
                const color = isDemo ? "#DC2626" : (colorMap[v.category] || "#64748B");
                return (
                  <div key={i} className="border-l-4 bg-zinc-50 rounded p-2.5" style={{ borderColor: color }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{v.name}</div>
                        <div className="text-[10px] text-zinc-500">{isDemo ? "DEMOLIZIONI" : v.category} · {v.unit}</div>
                      </div>
                      <button onClick={() => removeVoce(i)} className="p-1 hover:bg-rose-100 rounded shrink-0"><Trash2 className="h-3.5 w-3.5 text-rose-600" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">Modo</Label>
                        <select className="w-full border border-zinc-300 rounded h-8 px-2 text-xs" value={it.qty_mode || "mq"} onChange={(e) => updateItem(i, "qty_mode", e.target.value)} data-testid={`pkg-mode-${i}`}>
                          <option value="fissa">Fissa</option>
                          <option value="mq">A MQ</option>
                          <option value="ml">A ML</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px]">{it.qty_mode === "fissa" ? `Qtà (${v.unit})` : "Coefficiente"}</Label>
                        <Input type="number" step="0.001" className="h-8 text-xs" value={it.qty_mode === "fissa" ? (it.qty_value ?? 1) : (it.qty_ratio ?? 1)} onChange={(e) => updateItem(i, it.qty_mode === "fissa" ? "qty_value" : "qty_ratio", Number(e.target.value))} />
                      </div>
                      <div>
                        <Label className="text-[10px]">€/u</Label>
                        <Input type="number" step="0.01" className="h-8 text-xs" value={it.unit_price_pkg} onChange={(e) => updateItem(i, "unit_price_pkg", Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1.5 italic">
                      {it.qty_mode === "fissa" ? `${it.qty_value || 0} ${v.unit} fisse` : it.qty_mode === "ml" ? `${it.qty_ratio || 0} × ml abitazione` : `${it.qty_ratio || 0} × MQ abitazione`} = costo @70mq: <strong>{((it.qty_mode === "fissa" ? (it.qty_value || 0) : it.qty_mode === "ml" ? (it.qty_ratio || 0) * 28 : (it.qty_ratio || 0) * 70) * (it.unit_price_pkg || 0)).toFixed(0)}€</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t flex justify-end gap-2 bg-zinc-50">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} data-testid="pkg-form-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva Pacchetto</Button>
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
