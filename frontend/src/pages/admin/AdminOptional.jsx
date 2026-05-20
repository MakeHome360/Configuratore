import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Plus, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

// Tipo prezzo = unità di misura. Semplice e diretto.
const TIPI_PREZZO = [
  { k: "forfait", label: "💰 Forfait fisso", helper: "Un solo prezzo, indipendente dalla quantità" },
  { k: "mq", label: "📐 €/m² (al metro quadro)", helper: "Prezzo unitario al m². Es. pavimenti, rivestimenti, controsoffitti" },
  { k: "ml", label: "📏 €/ml (al metro lineare)", helper: "Prezzo unitario al metro lineare. Es. battiscopa, profili, tubi" },
  { k: "pz", label: "📦 €/pz (al pezzo)", helper: "Prezzo al pezzo. Es. porte, sanitari, condizionatori, elettrodomestici" },
  { k: "punti", label: "🔌 €/punto", helper: "Prezzo a punto. Es. punto luce, punto acqua, presa elettrica" },
];

// Sorgente prezzo (solo per tipi non-forfait, ma anche forfait può scegliere)
const SORGENTI = [
  { k: "manuale", label: "✋ Manuale", helper: "Inserisci tu il prezzo a mano" },
  { k: "listino_opere", label: "🛠 Listino Opere (voci backoffice)", helper: "Pesca il prezzo da una voce backoffice (manodopera + materiali). Si aggiorna live se cambi il listino." },
  { k: "listino_fornitori", label: "🏭 Listino Fornitori", helper: "Pesca il prezzo netto da un listino fornitore caricato (porte, infissi, piastrelle, ecc.) + ricarico." },
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
      <PageHeader title="Gestione Optional" subtitle="Tipo prezzo (forfait/mq/ml/pz/punti) + sorgente prezzo (manuale / listino opere / listino fornitori)"
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
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Sorgente</th>
                <th className="px-3 py-2 text-right">Listino</th>
                <th className="px-3 py-2 text-right">Sconto %</th>
                <th className="px-3 py-2 text-right">Prezzo finale</th>
                <th className="px-3 py-2 text-center">Esclude extra</th>
                <th className="px-3 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((o) => {
                const tp = o.tipo_prezzo || "forfait";
                const src = o.sorgente_prezzo || (tp === "forfait" ? "manuale" : "manuale");
                let listino, finale, sconto;
                if (tp === "forfait" && (!o.sorgente_prezzo || o.sorgente_prezzo === "manuale")) {
                  listino = o.price_listino || 0;
                  finale = o.price_scontato || listino;
                  sconto = listino > 0 ? Math.round((1 - finale / listino) * 100) : 0;
                } else {
                  listino = o.prezzo_unitario_listino || 0;
                  sconto = o.sconto_pct || 0;
                  finale = listino * (1 - sconto / 100);
                }
                const unitLabel = tp === "forfait" ? "" : `/${tp === "mq" ? "m²" : tp}`;
                const srcLabel = SORGENTI.find(s => s.k === src)?.label.split(" ").slice(1).join(" ") || src;
                return (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.name}</div>
                      {o.descrizione && <div className="text-[10px] text-zinc-500">{o.descrizione}</div>}
                    </td>
                    <td className="px-3 py-2"><Badge>{tp}</Badge></td>
                    <td className="px-3 py-2 text-xs text-zinc-600">{srcLabel}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur(listino)}{unitLabel && <span className="text-[10px] text-zinc-500">{unitLabel}</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">{sconto > 0 ? `-${sconto}%` : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmtEur(finale)}{unitLabel && <span className="text-[10px] text-zinc-500">{unitLabel}</span>}</td>
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
              {!filt.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-500">Nessun optional</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-zinc-500 bg-blue-50 border border-blue-200 p-3 rounded space-y-1">
          <div><strong>📐 Tipo prezzo</strong>: scegli l'unità di misura. Determina <em>come</em> il venditore inserisce la quantità nel preventivo (mq, ml, pz, punti, oppure forfait fisso).</div>
          <div><strong>🛠 Listino Opere</strong>: il prezzo viene letto dalle <strong>Voci Backoffice</strong> (manodopera + materiali aziendali, raggruppate per categoria opere).</div>
          <div><strong>🏭 Listino Fornitori</strong>: il prezzo è il netto del fornitore × ricarico, dalle categorie merceologiche (porte, infissi, sanitari, ecc.).</div>
          <div><strong>🚫 Esclude extra</strong>: se attivato per "infissi", quando il venditore aggiunge serramenti nel preventivo non vengono conteggiati come extra (sono già inclusi qui).</div>
        </div>
      </Page>
      {(editing || creating) && <OptDialog opt={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={load} isNew={creating} />}
    </div>
  );
}

function Badge({ children }) {
  return <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold uppercase tracking-wider">{children}</span>;
}

const DEFAULT_FORM = {
  name: "", descrizione: "",
  tipo_prezzo: "forfait",
  sorgente_prezzo: "manuale",
  // Forfait manuale
  price_listino: 0, price_scontato: 0,
  // Listino opere / fornitori
  voce_backoffice_id: "", listino_fornitore_id: "", listino_fornitore_prodotto_id: "",
  prezzo_unitario_listino: 0, sconto_pct: 0,
  // Categoria filtro (per UI)
  listino_categoria: "",
  // Esclude extras
  exclude_extras_categories: [],
  exclude_infissi: false,
  package_ids: [],
};

function OptDialog({ opt, onClose, onSaved, isNew }) {
  const [form, setForm] = useState(() => {
    const o = opt || DEFAULT_FORM;
    return {
      ...DEFAULT_FORM, ...o,
      exclude_infissi: (o.exclude_extras_categories || []).includes("infissi"),
    };
  });
  const [vociBackoffice, setVociBackoffice] = useState([]);
  const [categorieListini, setCategorieListini] = useState([]);
  const [prodottiListini, setProdottiListini] = useState([]);

  useEffect(() => {
    api.get("/voci-backoffice").then(r => setVociBackoffice(r.data || []));
    api.get("/fornitori-listini-categorie").then(r => setCategorieListini(r.data || [])).catch(() => {});
  }, []);

  // Quando cambia categoria fornitori, ricarica i prodotti
  useEffect(() => {
    if (form.sorgente_prezzo !== "listino_fornitori" || !form.listino_categoria) {
      setProdottiListini([]);
      return;
    }
    api.get(`/fornitori-listini-prodotti/cerca?categoria=${form.listino_categoria}&max_results=500`)
      .then(r => setProdottiListini(r.data || []))
      .catch(() => setProdottiListini([]));
  }, [form.sorgente_prezzo, form.listino_categoria]);

  // Voci backoffice raggruppate per categoria
  const vociByCategory = useMemo(() => {
    const out = {};
    vociBackoffice.forEach(v => {
      const cat = v.category || "ALTRO";
      if (!out[cat]) out[cat] = [];
      out[cat].push(v);
    });
    // Ordina ogni gruppo per nome
    Object.values(out).forEach(arr => arr.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    return out;
  }, [vociBackoffice]);

  // Prodotti fornitori raggruppati per fornitore (entro la stessa categoria)
  const prodottiByFornitore = useMemo(() => {
    const out = {};
    prodottiListini.forEach(p => {
      const f = p.fornitore_nome || p.listino_nome || "Senza fornitore";
      if (!out[f]) out[f] = [];
      out[f].push(p);
    });
    Object.values(out).forEach(arr => arr.sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
    return out;
  }, [prodottiListini]);

  const tipoSel = TIPI_PREZZO.find(t => t.k === form.tipo_prezzo) || TIPI_PREZZO[0];
  const sorgenteSel = SORGENTI.find(s => s.k === form.sorgente_prezzo) || SORGENTI[0];

  const save = async () => {
    if (!form.name) return toast.error("Nome obbligatorio");
    const payload = { ...form };
    // Normalizza esclusioni: priorità a checkbox infissi
    payload.exclude_extras_categories = form.exclude_infissi ? ["infissi"] : [];
    delete payload.exclude_infissi;
    // Unità coerente al tipo prezzo
    payload.unit = form.tipo_prezzo;
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
    setForm({
      ...form,
      tipo_prezzo: newTipo,
      // Per forfait, default sorgente=manuale
      sorgente_prezzo: newTipo === "forfait" ? "manuale" : form.sorgente_prezzo || "manuale",
      // Reset selezioni listino
      voce_backoffice_id: "", listino_fornitore_prodotto_id: "", prezzo_unitario_listino: 0,
    });
  };
  const onSorgenteChange = (newSrc) => {
    setForm({
      ...form,
      sorgente_prezzo: newSrc,
      voce_backoffice_id: "", listino_fornitore_prodotto_id: "", listino_categoria: "",
      prezzo_unitario_listino: newSrc === "manuale" ? form.prezzo_unitario_listino : 0,
    });
  };

  const onVoceSelect = (vid) => {
    const voce = vociBackoffice.find(v => v.id === vid);
    if (!voce) return setForm({ ...form, voce_backoffice_id: "" });
    const prezzo = voce.prezzo_rivendita || Math.round((voce.prezzo_acquisto || 0) * (voce.ricarico || 1.8) * 100) / 100;
    setForm({ ...form, voce_backoffice_id: vid, prezzo_unitario_listino: prezzo, name: form.name || voce.name });
  };
  const onProdottoFornitoreSelect = (pid) => {
    const p = prodottiListini.find(x => x.id === pid);
    if (!p) return setForm({ ...form, listino_fornitore_prodotto_id: "" });
    const prezzo = p.prezzo_rivendita || Math.round((p.prezzo_netto || 0) * (p.ricarico || 1.8) * 100) / 100;
    setForm({
      ...form,
      listino_fornitore_prodotto_id: pid,
      listino_fornitore_id: p.listino_id,
      prezzo_unitario_listino: prezzo,
      name: form.name || p.nome,
    });
  };

  const unitLabel = form.tipo_prezzo === "forfait" ? "" : `/${form.tipo_prezzo === "mq" ? "m²" : form.tipo_prezzo}`;
  const finalePerUnit = (form.prezzo_unitario_listino || 0) * (1 - (form.sconto_pct || 0) / 100);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()} data-testid="opt-dialog">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "Nuovo Optional" : "Modifica Optional"}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Nome */}
          <div><Label>Nome optional *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="opt-form-name" placeholder="es: Upgrade pavimento gres 60×60" /></div>
          <div><Label className="text-xs">Descrizione (opzionale)</Label><Textarea rows={2} value={form.descrizione || ""} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="Dettagli tecnici, marca, ecc." /></div>

          {/* Step 1: tipo prezzo (unità) */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-widest">1) Tipo prezzo / unità di misura *</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {TIPI_PREZZO.map(t => (
                <button key={t.k} type="button" onClick={() => onTipoChange(t.k)}
                  className={`p-2.5 border-2 rounded text-left text-xs ${form.tipo_prezzo === t.k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-400"}`}
                  data-testid={`opt-tipo-${t.k}`}>
                  <div className="font-bold">{t.label}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5">{tipoSel.helper}</p>
          </div>

          {/* Step 2: sorgente prezzo */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-widest">2) Sorgente prezzo *</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {SORGENTI.map(s => (
                <button key={s.k} type="button" onClick={() => onSorgenteChange(s.k)}
                  className={`p-2.5 border-2 rounded text-left text-xs ${form.sorgente_prezzo === s.k ? "border-blue-600 bg-blue-50" : "border-zinc-200 hover:border-zinc-400"}`}
                  data-testid={`opt-sorgente-${s.k}`}>
                  <div className="font-bold">{s.label}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5">{sorgenteSel.helper}</p>
          </div>

          {/* Step 3: input prezzo dipende da tipo + sorgente */}
          {form.sorgente_prezzo === "manuale" && form.tipo_prezzo === "forfait" && (
            <div className="bg-zinc-50 border border-zinc-200 rounded p-3 space-y-2">
              <div className="text-[11px] uppercase font-bold text-zinc-500">3) Prezzo forfait manuale</div>
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
          )}

          {form.sorgente_prezzo === "manuale" && form.tipo_prezzo !== "forfait" && (
            <div className="bg-zinc-50 border border-zinc-200 rounded p-3 space-y-2">
              <div className="text-[11px] uppercase font-bold text-zinc-500">3) Prezzo unitario manuale</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prezzo unitario €{unitLabel}</Label><Input type="number" step="0.01" value={form.prezzo_unitario_listino || 0} onChange={(e) => setForm({ ...form, prezzo_unitario_listino: Number(e.target.value) })} data-testid="opt-form-prezzo-unit" /></div>
                <div><Label>Sconto % al cliente</Label><Input type="number" min="0" max="80" step="0.5" value={form.sconto_pct || 0} onChange={(e) => setForm({ ...form, sconto_pct: Number(e.target.value) })} data-testid="opt-form-sconto-pct" /></div>
              </div>
              {form.prezzo_unitario_listino > 0 && (
                <div className="text-xs text-emerald-700 font-semibold">
                  Prezzo finale cliente: {fmtEur(finalePerUnit)}{unitLabel} (qty chiesta al venditore in fase di preventivo)
                </div>
              )}
            </div>
          )}

          {form.sorgente_prezzo === "listino_opere" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 space-y-3">
              <div className="text-[11px] uppercase font-bold text-emerald-900">3) Pesca da Listino Opere (Voci Backoffice)</div>
              <div>
                <Label className="text-xs">Scegli la voce raggruppata per categoria</Label>
                <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={form.voce_backoffice_id || ""} onChange={(e) => onVoceSelect(e.target.value)} data-testid="opt-form-voce">
                  <option value="">— Scegli voce dal Listino Opere —</option>
                  {Object.keys(vociByCategory).sort().map(cat => (
                    <optgroup key={cat} label={`📂 ${cat} (${vociByCategory[cat].length})`}>
                      {vociByCategory[cat].map(v => {
                        const p = v.prezzo_rivendita || Math.round((v.prezzo_acquisto || 0) * (v.ricarico || 1.8) * 100) / 100;
                        return <option key={v.id} value={v.id}>{v.name} — {fmtEur(p)}/{v.unit}</option>;
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Prezzo unitario corrente</Label><Input type="number" value={form.prezzo_unitario_listino || 0} readOnly className="bg-zinc-100 mono" /></div>
                <div><Label className="text-xs">Sconto % al cliente</Label><Input type="number" min="0" max="80" step="0.5" value={form.sconto_pct || 0} onChange={(e) => setForm({ ...form, sconto_pct: Number(e.target.value) })} data-testid="opt-form-sconto-pct" /></div>
              </div>
              {form.prezzo_unitario_listino > 0 && (
                <div className="text-xs text-emerald-800 font-bold bg-white border border-emerald-200 rounded p-2">
                  Prezzo finale cliente: {fmtEur(finalePerUnit)}{unitLabel}
                </div>
              )}
              <p className="text-[10px] text-emerald-700">Se cambi il listino delle Voci Backoffice, l'optional si aggiornerà automaticamente.</p>
            </div>
          )}

          {form.sorgente_prezzo === "listino_fornitori" && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-3">
              <div className="text-[11px] uppercase font-bold text-amber-900">3) Pesca da Listino Fornitori</div>
              <div>
                <Label className="text-xs">Categoria merceologica</Label>
                <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={form.listino_categoria || ""} onChange={(e) => setForm({ ...form, listino_categoria: e.target.value, listino_fornitore_prodotto_id: "", prezzo_unitario_listino: 0 })} data-testid="opt-form-categoria">
                  <option value="">— Scegli categoria —</option>
                  {categorieListini.map(c => (
                    <option key={c.key} value={c.key}>{c.icon} {c.label} {c.n_listini > 0 && `(${c.n_listini} listini)`}</option>
                  ))}
                </select>
              </div>
              {form.listino_categoria && (
                <div>
                  <Label className="text-xs">Prodotto (raggruppato per fornitore)</Label>
                  <select className="w-full h-10 px-2 border border-zinc-300 rounded" value={form.listino_fornitore_prodotto_id || ""} onChange={(e) => onProdottoFornitoreSelect(e.target.value)} data-testid="opt-form-prodotto">
                    <option value="">— Scegli prodotto —</option>
                    {Object.keys(prodottiByFornitore).sort().map(forn => (
                      <optgroup key={forn} label={`🏭 ${forn} (${prodottiByFornitore[forn].length})`}>
                        {prodottiByFornitore[forn].map(p => (
                          <option key={p.id} value={p.id}>
                            {p.codice ? `[${p.codice}] ` : ""}{p.nome} — {fmtEur(p.prezzo_rivendita || (p.prezzo_netto || 0) * (p.ricarico || 1.8))}/{p.unit || "pz"}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {!prodottiListini.length && <p className="text-[10px] text-amber-700 italic mt-1">Nessun prodotto in questa categoria. Carica un listino fornitori da "Listini Fornitori".</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Prezzo unitario corrente</Label><Input type="number" value={form.prezzo_unitario_listino || 0} readOnly className="bg-zinc-100 mono" /></div>
                <div><Label className="text-xs">Sconto % al cliente</Label><Input type="number" min="0" max="80" step="0.5" value={form.sconto_pct || 0} onChange={(e) => setForm({ ...form, sconto_pct: Number(e.target.value) })} data-testid="opt-form-sconto-pct" /></div>
              </div>
              {form.prezzo_unitario_listino > 0 && (
                <div className="text-xs text-amber-900 font-bold bg-white border border-amber-300 rounded p-2">
                  Prezzo finale cliente: {fmtEur(finalePerUnit)}{unitLabel}
                </div>
              )}
            </div>
          )}

          {/* Esclude infissi */}
          <div className="bg-rose-50 border border-rose-200 rounded p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.exclude_infissi} onChange={(e) => setForm({ ...form, exclude_infissi: e.target.checked })} data-testid="opt-form-exclude-infissi" />
              <span className="text-xs font-bold text-rose-900">🚫 Escludi infissi dagli extra del preventivo</span>
            </label>
            <p className="text-[10px] text-rose-700 mt-1 ml-6">Spunta SOLO se questo optional sostituisce gli infissi (es. "Pacchetto serramenti premium"). Quando il venditore aggiunge serramenti nel preventivo, NON saranno conteggiati come extra.</p>
          </div>

          {/* Pacchetti */}
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
