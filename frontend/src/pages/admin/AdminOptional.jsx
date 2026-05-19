import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Plus, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

// Tipi optional con label, unit di default e categoria di estrazione listino
const TIPI_OPTIONAL = [
  { k: "forfait", label: "Forfait fisso", unit: "forfait", helper: "Prezzo unico, indipendente da qty (es. 'Climatizzatore tutto incluso')" },
  { k: "pavimento_gres", label: "Pavimento gres", unit: "m²", category_filter: "PAVIMENTAZIONE_GRES", helper: "Prezzo €/m² da listino voci backoffice (categoria gres). Qty = mq del pavimento." },
  { k: "pavimento_parquet", label: "Pavimento parquet", unit: "m²", category_filter: "PAVIMENTAZIONE_PARQUET", helper: "Prezzo €/m² parquet. Qty = mq." },
  { k: "pavimento_laminato", label: "Pavimento laminato", unit: "m²", category_filter: "PAVIMENTAZIONE_LAMINATO", helper: "Prezzo €/m² laminato. Qty = mq." },
  { k: "pavimento_marmo", label: "Pavimento marmo", unit: "m²", category_filter: "PAVIMENTAZIONE_MARMO", helper: "Prezzo €/m² marmo. Qty = mq." },
  { k: "rivestimento", label: "Rivestimento piastrelle", unit: "m²", category_filter: "RIVESTIMENTO_PIASTRELLE", helper: "Prezzo €/m² rivestimenti. Qty = mq." },
  { k: "punto_acqua", label: "Punto acqua / scarico", unit: "punti", category_filter: "TERMO_IDRAULICO", helper: "Prezzo €/punto idraulico (lavabo, doccia, ecc.). Qty = numero punti." },
  { k: "punto_luce", label: "Punto luce / presa", unit: "punti", category_filter: "ELETTRICO", helper: "Prezzo €/punto elettrico. Qty = numero punti." },
  { k: "condizionatore", label: "Condizionatore / Trial Split", unit: "pz", category_filter: "TERMO_IDRAULICO", helper: "Prezzo €/pz climatizzatore. Qty = numero unità." },
  { k: "infissi", label: "Infissi (sostituiscono extra)", unit: "pz", category_filter: "INFISSI", helper: "Se attivato, i serramenti aggiunti dal venditore nel preventivo NON saranno conteggiati come extra (già inclusi).", excludes_extras: ["infissi"] },
  { k: "porte_interne", label: "Porte interne", unit: "pz", helper: "Sostituisce porte già nel pacchetto. Prezzo da listino fornitori." },
];

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
      <PageHeader title="Gestione Optional" subtitle="Optional avanzati: forfait, prezzo da listino backoffice scontato, esclusione extra"
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
              <tr>
                <th className="px-3 py-2 text-left">Optional</th>
                <th className="px-3 py-2 text-left">Tipo / Unità</th>
                <th className="px-3 py-2 text-right">Listino €</th>
                <th className="px-3 py-2 text-right">Sconto %</th>
                <th className="px-3 py-2 text-right">Prezzo finale</th>
                <th className="px-3 py-2 text-center">Esclude Extra</th>
                <th className="px-3 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((o) => {
                const tipo = TIPI_OPTIONAL.find(t => t.k === (o.tipo_prezzo || "forfait")) || TIPI_OPTIONAL[0];
                // Calcolo prezzo finale: listino × (1 - sconto/100). Se forfait, usa price_scontato direttamente.
                let listino, finale, sconto;
                if (o.tipo_prezzo === "forfait" || !o.tipo_prezzo) {
                  listino = o.price_listino || 0;
                  finale = o.price_scontato || listino;
                  sconto = listino > 0 ? Math.round((1 - finale / listino) * 100) : 0;
                } else {
                  listino = o.prezzo_unitario_listino || 0;
                  sconto = o.sconto_pct || 0;
                  finale = listino * (1 - sconto / 100);
                }
                return (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.name}</div>
                      {o.descrizione && <div className="text-[10px] text-zinc-500">{o.descrizione}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Badge>{tipo.label}</Badge>
                      <div className="text-[10px] text-zinc-500 mt-0.5">unità: {o.unit || tipo.unit}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur(listino)}{o.tipo_prezzo && o.tipo_prezzo !== "forfait" && <span className="text-[10px] text-zinc-500"> /{o.unit || tipo.unit}</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">{sconto > 0 ? `-${sconto}%` : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmtEur(finale)}{o.tipo_prezzo && o.tipo_prezzo !== "forfait" && <span className="text-[10px] text-zinc-500"> /{o.unit || tipo.unit}</span>}</td>
                    <td className="px-3 py-2 text-center text-xs">{(o.exclude_extras_categories || []).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditing(o)} className="p-1 hover:bg-zinc-100 rounded" data-testid={`opt-edit-${o.id}`}><Edit2 className="h-4 w-4 text-zinc-600" /></button>
                        <button onClick={() => del(o.id)} className="p-1 hover:bg-rose-50 rounded" data-testid={`opt-del-${o.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filt.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">Nessun optional</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-zinc-500 bg-amber-50 border border-amber-200 p-3 rounded space-y-1">
          <div><strong>📐 Forfait</strong>: prezzo fisso indipendente dalla qty (es. predisposizione domotica 800 €).</div>
          <div><strong>📊 Listino scontato</strong>: il prezzo è preso live dalle Voci Backoffice (es. pavimento gres €/m²) e scontato della % che imposti. La qty viene chiesta al venditore in fase di preventivo.</div>
          <div><strong>🚫 Esclude extra</strong>: se attivato per la categoria "infissi", quando il venditore aggiunge serramenti nel preventivo non vengono conteggiati come extra (già inclusi nell'optional).</div>
        </div>
      </Page>
      {(editing || creating) && <OptDialog opt={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={load} isNew={creating} />}
    </div>
  );
}

function Badge({ children }) {
  return <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold uppercase tracking-wider">{children}</span>;
}

function OptDialog({ opt, onClose, onSaved, isNew }) {
  const [form, setForm] = useState(opt || {
    name: "", descrizione: "", tipo_prezzo: "forfait", unit: "forfait",
    price_listino: 0, price_scontato: 0,
    voce_backoffice_id: "", prezzo_unitario_listino: 0, sconto_pct: 0,
    exclude_extras_categories: [],
    package_ids: [],
  });
  const [vociBackoffice, setVociBackoffice] = useState([]);

  // Carica voci backoffice per il select
  useEffect(() => {
    api.get("/voci-backoffice").then(r => setVociBackoffice(r.data || []));
  }, []);

  const tipoSel = TIPI_OPTIONAL.find(t => t.k === form.tipo_prezzo) || TIPI_OPTIONAL[0];
  const vociFiltered = tipoSel.category_filter
    ? vociBackoffice.filter(v => v.category === tipoSel.category_filter || (v.name || "").toLowerCase().includes(tipoSel.k.split("_")[0]))
    : vociBackoffice;

  const save = async () => {
    if (!form.name) return toast.error("Nome obbligatorio");
    // Auto-imposta exclude_extras se richiesto dal tipo
    const payload = { ...form };
    if (tipoSel.excludes_extras && tipoSel.excludes_extras.length && (!form.exclude_extras_categories || !form.exclude_extras_categories.length)) {
      payload.exclude_extras_categories = tipoSel.excludes_extras;
    }
    if (!payload.unit || payload.unit === "forfait") payload.unit = tipoSel.unit;
    try {
      if (isNew) await api.post("/optional", payload);
      else await api.put(`/optional/${payload.id}`, payload);
      toast.success("Salvato"); onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };

  const togglePkg = (id) => {
    const ids = form.package_ids || [];
    setForm({ ...form, package_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };
  const onTipoChange = (newTipo) => {
    const t = TIPI_OPTIONAL.find(x => x.k === newTipo) || TIPI_OPTIONAL[0];
    setForm({
      ...form,
      tipo_prezzo: newTipo,
      unit: t.unit,
      exclude_extras_categories: t.excludes_extras || [],
    });
  };
  const onVoceSelect = (vid) => {
    const voce = vociBackoffice.find(v => v.id === vid);
    if (!voce) return setForm({ ...form, voce_backoffice_id: "" });
    const prezzo = voce.prezzo_rivendita || Math.round((voce.prezzo_acquisto || 0) * (voce.ricarico || 1.8) * 100) / 100;
    setForm({
      ...form,
      voce_backoffice_id: vid,
      prezzo_unitario_listino: prezzo,
      unit: voce.unit || form.unit,
      name: form.name || voce.name,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()} data-testid="opt-dialog">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "Nuovo Optional" : "Modifica Optional"}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          {/* Tipo prezzo prima di tutto */}
          <div>
            <Label className="text-xs font-bold">Tipo prezzo *</Label>
            <select className="w-full h-10 px-2 border border-zinc-300 rounded mt-1" value={form.tipo_prezzo} onChange={(e) => onTipoChange(e.target.value)} data-testid="opt-form-tipo">
              {TIPI_OPTIONAL.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
            </select>
            <p className="text-[10px] text-zinc-500 mt-1">{tipoSel.helper}</p>
          </div>

          <div><Label>Nome optional *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="opt-form-name" placeholder="es: Upgrade pavimento gres 60×60" /></div>
          <div><Label className="text-xs">Descrizione (opzionale)</Label><Textarea rows={2} value={form.descrizione || ""} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="Dettagli tecnici, marca, ecc." /></div>

          {/* Branch: forfait vs listino_scontato */}
          {form.tipo_prezzo === "forfait" ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded p-3 space-y-2">
              <div className="text-[11px] uppercase font-bold text-zinc-500">Prezzo forfait</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Listino €</Label><Input type="number" value={form.price_listino} onChange={(e) => setForm({ ...form, price_listino: Number(e.target.value) })} data-testid="opt-form-price-listino" /></div>
                <div><Label>Scontato € (prezzo cliente)</Label><Input type="number" value={form.price_scontato} onChange={(e) => setForm({ ...form, price_scontato: Number(e.target.value) })} data-testid="opt-form-price-scontato" /></div>
              </div>
              {form.price_listino > 0 && form.price_scontato < form.price_listino && (
                <div className="text-xs text-emerald-700 font-semibold">
                  Risparmio cliente: {fmtEur(form.price_listino - form.price_scontato)} ({Math.round((1 - form.price_scontato / form.price_listino) * 100)}%)
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-3">
              <div className="text-[11px] uppercase font-bold text-blue-900">Prezzo da listino backoffice scontato</div>
              <div>
                <Label className="text-xs">Voce backoffice di riferimento *</Label>
                <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={form.voce_backoffice_id || ""} onChange={(e) => onVoceSelect(e.target.value)} data-testid="opt-form-voce">
                  <option value="">— Scegli voce dal listino backoffice —</option>
                  {vociFiltered.map(v => {
                    const p = v.prezzo_rivendita || Math.round((v.prezzo_acquisto || 0) * (v.ricarico || 1.8) * 100) / 100;
                    return <option key={v.id} value={v.id}>{v.name} · {v.category} · {fmtEur(p)}/{v.unit}</option>;
                  })}
                </select>
                <p className="text-[10px] text-blue-700 mt-1">
                  {tipoSel.category_filter
                    ? `Filtro: solo voci della categoria "${tipoSel.category_filter}".`
                    : "Tutte le voci disponibili."}
                  &nbsp;Il prezzo verrà sempre preso LIVE dal backoffice (se cambi listino, l'optional si aggiorna).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Prezzo unitario corrente</Label>
                  <Input type="number" value={form.prezzo_unitario_listino || 0} readOnly className="bg-zinc-100 mono" data-testid="opt-form-prezzo-unit" />
                  <p className="text-[10px] text-zinc-500">€/{form.unit || tipoSel.unit}</p>
                </div>
                <div>
                  <Label className="text-xs">Sconto % al cliente</Label>
                  <Input type="number" min="0" max="80" step="0.5" value={form.sconto_pct || 0} onChange={(e) => setForm({ ...form, sconto_pct: Number(e.target.value) })} data-testid="opt-form-sconto-pct" />
                </div>
                <div>
                  <Label className="text-xs">Unità misura</Label>
                  <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={form.unit || tipoSel.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="m²">m²</option>
                    <option value="ml">ml</option>
                    <option value="pz">pz</option>
                    <option value="punti">punti</option>
                  </select>
                </div>
              </div>
              {form.prezzo_unitario_listino > 0 && (
                <div className="text-xs">
                  <strong>Prezzo finale cliente: {fmtEur(form.prezzo_unitario_listino * (1 - (form.sconto_pct || 0) / 100))} /{form.unit || tipoSel.unit}</strong>
                  &nbsp;(la qty verrà chiesta al venditore in fase di preventivo)
                </div>
              )}
            </div>
          )}

          {/* Esclude categorie extras (per infissi e simili) */}
          {tipoSel.excludes_extras && tipoSel.excludes_extras.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <Label className="text-xs font-bold text-amber-900">🚫 Esclude da extra preventivo</Label>
              <p className="text-[10px] text-amber-700 mt-1">
                Categorie: <strong>{(form.exclude_extras_categories || tipoSel.excludes_extras).join(", ")}</strong>.<br/>
                Quando il venditore aggiunge elementi di queste categorie nel preventivo, NON saranno conteggiati come extra (già inclusi in questo optional).
              </p>
            </div>
          )}

          <div>
            <Label>Applicabile a pacchetti</Label>
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
