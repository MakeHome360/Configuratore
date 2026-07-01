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
    const pkgs = (p.data || []).slice().sort((a, b) => (a.price_per_m2 || 0) - (b.price_per_m2 || 0));
    setPackages(pkgs); setVoci(v.data || []);
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
          <button onClick={() => setTab("bagno")} data-testid="tab-pacchetti-bagno" className={`px-4 py-2 text-sm border-b-2 ${tab === "bagno" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-500"}`}>Pacchetti Bagno (Silver/Gold/Platinum)</button>
        </div>

        {tab === "bagno" && <BagnoConfigEditor />}

        {tab === "pacchetti" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packages.map((p) => {
              const mq = 70;
              const ml = mq * 0.4;
              const calcQty = (it, m, l) => {
                if (it.qty_mode === "fissa") return it.qty_value || 0;
                if (it.qty_mode === "ml") return (it.qty_ratio || 0) * l;
                return (it.qty_ratio || 0) * m;
              };
              const ricavo = p.price_per_m2 * mq;
              // COSTI = sommatoria (qty × prezzo_acquisto) = costo netto al fornitore.
              // NON usare prezzo_rivendita: quello è il prezzo di vendita al cliente, non il costo.
              const costi = (p.items || []).reduce((s, it) => s + calcQty(it, mq, ml) * (it.prezzo_acquisto || 0), 0);
              // RIVENDITA TOTALE = sommatoria (qty × prezzo_rivendita) = se si vendessero le voci a listino
              const rivenditaTotale = (p.items || []).reduce((s, it) => s + calcQty(it, mq, ml) * (it.prezzo_rivendita || 0), 0);
              const margine = ricavo - costi;
              const marginePct = ricavo ? (margine / ricavo) * 100 : 0;
              const margineListinoPct = rivenditaTotale ? ((rivenditaTotale - costi) / rivenditaTotale) * 100 : 0;
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
                  <div className="grid grid-cols-2 gap-2 text-sm pb-3 border-b border-zinc-100">
                    <div><div className="text-[10px] text-zinc-500">Ricavo pacchetto</div><div className="font-semibold">{fmtEur(ricavo)}</div></div>
                    <div><div className="text-[10px] text-zinc-500">Costo netto ({p.items.length} voci)</div><div className="font-semibold">{fmtEur(costi)}</div></div>
                    <div><div className="text-[10px] text-zinc-500">Rivendita totale (listino)</div><div className="font-semibold text-zinc-600">{fmtEur(rivenditaTotale)}</div></div>
                    <div><div className="text-[10px] text-zinc-500">Margine con pacchetto</div><div className={`font-semibold ${margine >= 0 ? "text-emerald-600" : "text-rose-600"}`} data-testid={`pkg-margin-${p.id}`}>{marginePct.toFixed(2)}%</div></div>
                    <div className="col-span-2"><div className="text-[10px] text-zinc-500">Margine con listino (se vendute a prezzo pieno)</div><div className={`font-semibold ${margineListinoPct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{margineListinoPct.toFixed(2)}%</div></div>
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
                        const cc = (p.items || []).reduce((s, it) => s + calcQty2(it) * (it.prezzo_acquisto || 0), 0);
                        return <div key={m} className="p-2 bg-zinc-50 rounded"><div className="font-mono">{m} mq</div><div className="text-[10px] text-zinc-500">Ricavo</div><div>{fmtEur(r)}</div><div className="text-[10px] text-zinc-500 mt-1">Costo netto</div><div>{fmtEur(cc)}</div><div className={`mt-1 font-semibold ${((r-cc)/r*100) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{((r-cc)/r*100).toFixed(2)}%</div></div>;
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
  const initial = pkg ? { ...pkg, items: (pkg.items || []).map((it) => ({ voce_id: it.voce_id || it.id, qty_mode: it.qty_mode || "mq", qty_ratio: it.qty_ratio || 0, qty_value: it.qty_value || 0, unit_price_pkg: it.unit_price_pkg })), listini_items: pkg.listini_items || [], price_override: pkg.price_override ?? null } : { name: "", subtitle: "", price_per_m2: 0, color: "#475569", description: "", items: [], listini_items: [], price_override: null };
  const [form, setForm] = useState(initial);
  const [search, setSearch] = useState("");
  // Carica TUTTI i prodotti dei listini fornitori (raggruppati per categoria + fornitore)
  const [allProdotti, setAllProdotti] = useState([]);
  const [listiniSearch, setListiniSearch] = useState("");
  const [listiniExpandedCat, setListiniExpandedCat] = useState({});
  useEffect(() => {
    api.get("/fornitori-listini-prodotti/cerca?max_results=2000")
      .then(r => setAllProdotti(r.data || []))
      .catch(() => setAllProdotti([]));
  }, []);
  const prodottiByCatFornitore = useMemo(() => {
    const out = {};
    const q = listiniSearch.toLowerCase().trim();
    allProdotti.forEach(p => {
      if (q) {
        const blob = `${p.nome || ""} ${p.codice || ""} ${p.fornitore_nome || ""} ${p.categoria || ""}`.toLowerCase();
        if (!blob.includes(q)) return;
      }
      const cat = p.categoria || "altro";
      const forn = p.fornitore_nome || p.listino_nome || "Senza fornitore";
      if (!out[cat]) out[cat] = {};
      if (!out[cat][forn]) out[cat][forn] = [];
      out[cat][forn].push(p);
    });
    return out;
  }, [allProdotti, listiniSearch]);
  const selectedKeys = useMemo(() => {
    const s = new Set();
    (form.listini_items || []).forEach(li => s.add(`${li.listino_id}__${li.id}`));
    return s;
  }, [form.listini_items]);
  const toggleProdotto = (p) => {
    const key = `${p.listino_id}__${p.id}`;
    const cur = form.listini_items || [];
    if (selectedKeys.has(key)) {
      setForm({ ...form, listini_items: cur.filter(li => !(li.listino_id === p.listino_id && li.id === p.id)) });
    } else {
      setForm({ ...form, listini_items: [...cur, { ...p, qty: 1, modificabile_dal_venditore: true }] });
    }
  };
  const updateListinoItemField = (key, k, v) => {
    setForm({
      ...form,
      listini_items: (form.listini_items || []).map(li => `${li.listino_id}__${li.id}` === key ? { ...li, [k]: v } : li),
    });
  };
  const save = async () => {
    if (!form.name) return toast.error("Nome obbligatorio");
    try {
      // Rimuoviamo price_override dal form (deprecato in UI ma backend lo accetta ancora)
      const payload = { ...form };
      delete payload.price_override;
      if (isNew) await api.post("/packages", payload);
      else await api.put(`/packages/${payload.id}`, payload);
      toast.success(isNew ? "Pacchetto creato" : "Pacchetto aggiornato"); onSaved(); onClose();
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

  // Cross-search: se la query in "Voci disponibili" non trova nulla nel backoffice,
  // cerca tra i prodotti dei listini fornitori e suggerisci di andare lì.
  const matchingListiniFornitori = useMemo(() => {
    if (!search || !allProdotti.length) return [];
    const q = search.toLowerCase();
    return allProdotti.filter(p =>
      `${p.nome || ""} ${p.codice || ""} ${p.fornitore_nome || ""} ${p.categoria || ""}`.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [search, allProdotti]);

  // Quando clicco "Vai al prodotto": setta search nel widget listini + espande tutte le categorie con match + scroll
  const jumpToListini = (categoriaToOpen) => {
    setListiniSearch(search);
    const cats = new Set();
    if (categoriaToOpen) cats.add(categoriaToOpen);
    matchingListiniFornitori.forEach(p => p.categoria && cats.add(p.categoria));
    const map = { ...listiniExpandedCat };
    cats.forEach(c => { map[c] = true; });
    setListiniExpandedCat(map);
    // Scroll
    setTimeout(() => {
      const el = document.querySelector('[data-testid="pkg-listini-search"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const selectedItems = (form.items || []).map((it) => ({ ...it, voce: voci.find((v) => v.id === it.voce_id) })).filter((i) => i.voce).sort((a, b) => sortVoce(a.voce, b.voce));
  const addVoce = (v) => setForm({ ...form, items: [...(form.items || []), { voce_id: v.id, qty_mode: v.unit === "pz" || v.unit === "punto" || v.unit === "forfait" ? "fissa" : "mq", qty_value: 1, qty_ratio: 1 }] });
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

            {/* PRODOTTI DA LISTINI FORNITORI inclusi nel pacchetto — TUTTI sempre visibili, raggruppati per categoria + fornitore */}
            <div className="border-t pt-3 mt-3">
              <Label className="text-xs font-semibold">🛒 Listini Fornitori inclusi ({(form.listini_items || []).length} selezionati)</Label>
              <p className="text-[10px] text-zinc-500 mb-2 leading-snug">
                Sotto trovi <strong>TUTTI i prodotti dei listini fornitori</strong> caricati, raggruppati per categoria → fornitore.<br/>
                Spunta i prodotti che vuoi includere di default nel pacchetto, imposta la quantità e se il venditore può sostituirli.
              </p>
              <Input placeholder="🔎 Cerca prodotto / fornitore / categoria…" value={listiniSearch} onChange={(e) => setListiniSearch(e.target.value)} className="h-7 text-xs mb-2" data-testid="pkg-listini-search" />
              {allProdotti.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic text-center py-3 border border-dashed border-zinc-200 rounded">
                  Nessun prodotto caricato. Vai a <strong>Listini Fornitori</strong> per importare un Excel/CSV.
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 border border-zinc-200 rounded p-2 bg-zinc-50/50">
                  {Object.keys(prodottiByCatFornitore).sort().map(cat => {
                    const fornGroups = prodottiByCatFornitore[cat];
                    const totalInCat = Object.values(fornGroups).reduce((s, arr) => s + arr.length, 0);
                    const isOpen = !!listiniExpandedCat[cat];
                    const selCount = Object.values(fornGroups).flat().filter(p => selectedKeys.has(`${p.listino_id}__${p.id}`)).length;
                    return (
                      <div key={cat} className="bg-white border border-zinc-200 rounded">
                        <button onClick={() => setListiniExpandedCat(s => ({ ...s, [cat]: !s[cat] }))}
                                className="w-full px-2 py-1.5 flex items-center justify-between text-left hover:bg-zinc-50"
                                data-testid={`pkg-listini-cat-${cat}`}>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">📂 {cat} <span className="text-zinc-400 normal-case font-normal">({totalInCat})</span></span>
                          <span className="text-[10px] text-zinc-500">{selCount > 0 && <span className="text-emerald-700 font-bold">{selCount} sel · </span>}{isOpen ? "▾" : "▸"}</span>
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-2 space-y-1.5">
                            {Object.keys(fornGroups).sort().map(forn => (
                              <div key={forn} className="border-l-2 border-blue-300 pl-2">
                                <div className="text-[10px] font-bold text-blue-800 mt-1.5 mb-0.5">🏭 {forn}</div>
                                {fornGroups[forn].map(p => {
                                  const key = `${p.listino_id}__${p.id}`;
                                  const isSel = selectedKeys.has(key);
                                  const li = isSel ? (form.listini_items || []).find(x => x.listino_id === p.listino_id && x.id === p.id) : null;
                                  return (
                                    <div key={key} className={`flex items-start gap-1.5 p-1 rounded ${isSel ? "bg-emerald-50 border border-emerald-200" : "hover:bg-zinc-50"}`} data-testid={`pkg-listini-prod-${p.id}`}>
                                      <input type="checkbox" checked={isSel} onChange={() => toggleProdotto(p)} className="mt-0.5" data-testid={`pkg-listini-toggle-${p.id}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-medium truncate">{p.codice ? `[${p.codice}] ` : ""}{p.nome}</div>
                                        <div className="text-[9px] text-zinc-500">€ {Number(p.prezzo_rivendita || 0).toFixed(2)}/{p.unit || "pz"}</div>
                                      </div>
                                      {isSel && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Input type="number" min={0.01} step="0.01" value={li?.qty ?? 1}
                                                 onChange={(e) => updateListinoItemField(key, "qty", parseFloat(e.target.value) || 0)}
                                                 className="h-6 w-12 text-[10px] text-right mono"
                                                 title="Quantità"
                                                 data-testid={`pkg-listini-qty-${p.id}`} />
                                          <input type="checkbox" checked={!!li?.modificabile_dal_venditore}
                                                 onChange={(e) => updateListinoItemField(key, "modificabile_dal_venditore", e.target.checked)}
                                                 title="Il venditore può sostituirlo"
                                                 data-testid={`pkg-listini-mod-${p.id}`} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {(form.listini_items || []).length > 0 && (
                <div className="text-[10px] text-zinc-600 mono text-right pt-2 border-t border-zinc-200 mt-2">
                  Subtot. listini di default: € {(form.listini_items || []).reduce((s, x) => s + ((parseFloat(x.qty) || 0) * (parseFloat(x.prezzo_rivendita) || 0)), 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE: Available voci picker */}
          <div className="col-span-4 border-r flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b bg-zinc-50">
              <div className="font-semibold text-sm mb-1">Voci disponibili <span className="text-[10px] text-zinc-400 font-normal">(dal Listino Opere)</span></div>
              <p className="text-[10px] text-zinc-500 mb-2 leading-tight">Solo voci tecniche del backoffice (manodopera+materiali). Per i prodotti fornitori scorri sotto.</p>
              <Input placeholder="Cerca voce... (es: demolizione, pavimento)" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="pkg-voce-search" />
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
              {Object.keys(groupedAvail).length === 0 && (
                <div className="text-center py-6 px-3">
                  <div className="text-sm text-zinc-600 font-medium mb-1">Nessuna voce backoffice trovata</div>
                  {search ? (
                    <>
                      <div className="text-[11px] text-zinc-500 leading-snug mb-3">
                        "<strong>{search}</strong>" non corrisponde a nessuna voce del Listino Opere.
                      </div>
                      {matchingListiniFornitori.length > 0 ? (
                        <div className="bg-amber-50 border border-amber-300 rounded p-2 text-left">
                          <div className="text-[11px] font-bold text-amber-900 mb-1.5">
                            🛒 Trovato in <strong>Listini Fornitori</strong> ({matchingListiniFornitori.length}):
                          </div>
                          <div className="space-y-1">
                            {matchingListiniFornitori.map(p => (
                              <button key={`${p.listino_id}-${p.id}`} onClick={() => jumpToListini(p.categoria)}
                                className="w-full text-left bg-white border border-amber-200 hover:border-amber-500 rounded p-1.5 transition" data-testid={`pkg-jump-${p.id}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-medium truncate">{p.codice ? `[${p.codice}] ` : ""}{p.nome}</div>
                                    <div className="text-[9px] text-zinc-500">📂 {p.categoria} · 🏭 {p.fornitore_nome || p.listino_nome || "—"} · € {Number(p.prezzo_rivendita || 0).toFixed(2)}/{p.unit || "pz"}</div>
                                  </div>
                                  <span className="text-[10px] text-amber-700 font-bold shrink-0">↓ Vai</span>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="text-[9px] text-amber-700 italic mt-2 text-center">Clicca un risultato per scorrere alla sezione listini fornitori e selezionarlo.</div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500 leading-snug">
                          🛒 Nessun prodotto fornitore corrisponde a "<strong>{search}</strong>".<br/>
                          Carica i listini in <strong>Listini Fornitori</strong> oppure crea una voce in <strong>Voci Backoffice</strong>.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-500">Non hai ancora voci nel Listino Opere. Vai a <strong>Voci Backoffice</strong> per crearle.</div>
                  )}
                </div>
              )}
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
                    <div className="grid grid-cols-2 gap-2">
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
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1.5 italic">
                      Prezzo {v.prezzo_rivendita?.toFixed(2)}€/{v.unit} (acq {v.prezzo_acquisto?.toFixed(2)}€ × {v.ricarico}x) ← <strong>dal Backoffice</strong>
                    </div>
                    <div className="text-[10px] text-zinc-500 italic">
                      {it.qty_mode === "fissa" ? `${it.qty_value || 0} ${v.unit} fisse` : it.qty_mode === "ml" ? `${it.qty_ratio || 0} × ml abitazione` : `${it.qty_ratio || 0} × MQ abitazione`} → @70mq: costo netto <strong>{((it.qty_mode === "fissa" ? (it.qty_value || 0) : it.qty_mode === "ml" ? (it.qty_ratio || 0) * 28 : (it.qty_ratio || 0) * 70) * (v.prezzo_acquisto || 0)).toFixed(0)}€</strong> · rivendita <strong>{((it.qty_mode === "fissa" ? (it.qty_value || 0) : it.qty_mode === "ml" ? (it.qty_ratio || 0) * 28 : (it.qty_ratio || 0) * 70) * (v.prezzo_rivendita || 0)).toFixed(0)}€</strong>
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
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2 text-left">Voce</th><th className="px-3 py-2 text-left">Categoria</th><th className="px-3 py-2 text-center">Modo</th><th className="px-3 py-2 text-right">Quantità</th><th className="px-3 py-2 text-right">€/u (Backoffice)</th><th className="px-3 py-2 text-right">Costo @70mq</th></tr></thead>
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
                <td className="px-3 py-2 text-right font-mono">{fmtEur2(it.prezzo_rivendita || 0)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtEur(qty70 * (it.prezzo_rivendita || 0))}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================================
// BagnoConfigEditor — R89: pacchetti bagno (Silver/Gold/Platinum) + manodopera €6500 editabili
// =====================================================================
function BagnoConfigEditor() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/bagno-config");
    // Assicura included_items per ogni tier
    const tiers = (data.tiers || []).map((t) => ({ ...t, included_items: t.included_items || [] }));
    setCfg({
      tiers,
      manodopera_base: data.manodopera_base || 6500,
      manodopera_description: data.manodopera_description || "",
      manodopera_included_items: data.manodopera_included_items || [],
    });
  };
  useEffect(() => { load(); }, []);

  if (!cfg) return <div className="text-center py-12 text-zinc-500">Caricamento configurazione…</div>;

  const updateTier = (idx, field, value) => {
    const next = [...cfg.tiers];
    next[idx] = { ...next[idx], [field]: value };
    setCfg({ ...cfg, tiers: next });
  };
  const addTierItem = (idx) => {
    const next = [...cfg.tiers];
    next[idx] = { ...next[idx], included_items: [...(next[idx].included_items || []), ""] };
    setCfg({ ...cfg, tiers: next });
  };
  const updateTierItem = (idx, itIdx, value) => {
    const next = [...cfg.tiers];
    const items = [...(next[idx].included_items || [])];
    items[itIdx] = value;
    next[idx] = { ...next[idx], included_items: items };
    setCfg({ ...cfg, tiers: next });
  };
  const removeTierItem = (idx, itIdx) => {
    const next = [...cfg.tiers];
    next[idx] = { ...next[idx], included_items: (next[idx].included_items || []).filter((_, i) => i !== itIdx) };
    setCfg({ ...cfg, tiers: next });
  };

  const addManodoperaItem = () => setCfg({ ...cfg, manodopera_included_items: [...cfg.manodopera_included_items, ""] });
  const updateManodoperaItem = (i, v) => {
    const items = [...cfg.manodopera_included_items];
    items[i] = v;
    setCfg({ ...cfg, manodopera_included_items: items });
  };
  const removeManodoperaItem = (i) => setCfg({ ...cfg, manodopera_included_items: cfg.manodopera_included_items.filter((_, j) => j !== i) });

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/bagno-config", cfg);
      toast.success("Configurazione bagno salvata. I prezzi si applicano immediatamente ai nuovi Preventivi Bagno.");
      load();
    } catch (e) {
      toast.error("Errore salvataggio: " + (e?.response?.data?.detail || e?.message || "sconosciuto"));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Manodopera base */}
      <div className="bg-white border-2 border-amber-200 rounded-lg p-5" data-testid="bagno-cfg-manodopera">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">🛠 Manodopera Base bagno</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Prezzo fisso:</span>
            <Input
              type="number" min={0} step="100"
              className="w-32 h-9 text-right font-mono font-bold text-lg"
              value={cfg.manodopera_base}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setCfg({ ...cfg, manodopera_base: Math.max(0, Number(e.target.value) || 0) })}
              data-testid="bagno-cfg-manodopera-price"
            /> €
          </div>
        </div>
        <Label className="text-xs">Descrizione (visibile in preventivo)</Label>
        <Input
          value={cfg.manodopera_description}
          onChange={(e) => setCfg({ ...cfg, manodopera_description: e.target.value })}
          className="mb-3" data-testid="bagno-cfg-manodopera-desc"
        />
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">Cosa include la manodopera</Label>
            <Button size="sm" variant="outline" onClick={addManodoperaItem} data-testid="bagno-cfg-manodopera-add-item">
              <Plus className="h-3 w-3 mr-1" /> Aggiungi voce
            </Button>
          </div>
          <div className="space-y-1.5">
            {cfg.manodopera_included_items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs w-5">✓</span>
                <Input value={it} onChange={(e) => updateManodoperaItem(i, e.target.value)} className="h-8 text-sm" data-testid={`bagno-cfg-manodopera-item-${i}`} />
                <button onClick={() => removeManodoperaItem(i)} className="p-1 rounded hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </button>
              </div>
            ))}
            {cfg.manodopera_included_items.length === 0 && <div className="text-xs text-zinc-400 italic">Nessuna voce inclusa</div>}
          </div>
        </div>
      </div>

      {/* Tiers cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cfg.tiers.map((t, idx) => (
          <div key={t.id} className="bg-white border-2 rounded-lg p-4" style={{ borderColor: t.color || "#94A3B8" }} data-testid={`bagno-cfg-tier-${t.id}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: t.color }}>
              <Input
                value={t.name}
                onChange={(e) => updateTier(idx, "name", e.target.value.toUpperCase())}
                className="h-9 font-bold text-lg uppercase"
                style={{ color: t.color, borderColor: t.color }}
                data-testid={`bagno-cfg-tier-name-${t.id}`}
              />
              <input
                type="color"
                value={t.color || "#94A3B8"}
                onChange={(e) => updateTier(idx, "color", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer ml-2"
                title="Colore identificativo"
              />
            </div>
            {/* Price */}
            <Label className="text-xs uppercase text-zinc-500">Prezzo</Label>
            <div className="flex items-center gap-2 mb-3">
              <Input
                type="number" min={0} step="100"
                className="h-11 text-2xl font-mono font-extrabold text-right"
                value={t.price}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateTier(idx, "price", Math.max(0, Number(e.target.value) || 0))}
                data-testid={`bagno-cfg-tier-price-${t.id}`}
              />
              <span className="text-lg font-semibold">€</span>
            </div>
            {/* Description */}
            <Label className="text-xs">Descrizione riepilogo</Label>
            <Textarea
              rows={2}
              value={t.description || ""}
              onChange={(e) => updateTier(idx, "description", e.target.value)}
              className="mb-3 text-xs"
              data-testid={`bagno-cfg-tier-desc-${t.id}`}
            />
            {/* Included items */}
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Cosa è incluso</Label>
              <Button size="sm" variant="outline" onClick={() => addTierItem(idx)} data-testid={`bagno-cfg-tier-add-item-${t.id}`}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {(t.included_items || []).map((it, itIdx) => (
                <div key={itIdx} className="flex items-center gap-1">
                  <span className="text-emerald-500 text-xs">✓</span>
                  <Input
                    value={it}
                    onChange={(e) => updateTierItem(idx, itIdx, e.target.value)}
                    className="h-7 text-[11px]"
                    data-testid={`bagno-cfg-tier-item-${t.id}-${itIdx}`}
                  />
                  <button onClick={() => removeTierItem(idx, itIdx)} className="p-0.5 rounded hover:bg-rose-50">
                    <Trash2 className="h-3 w-3 text-rose-500" />
                  </button>
                </div>
              ))}
              {(t.included_items || []).length === 0 && <div className="text-[10px] text-zinc-400 italic pl-3">Nessuna voce</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-200 p-4 -mx-4 -mb-4 flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          I prezzi qui impostati verranno usati nei nuovi Preventivi Bagno.
          <br />I preventivi già salvati mantengono il prezzo storicizzato al momento del salvataggio.
        </div>
        <Button
          onClick={save}
          disabled={saving}
          data-testid="bagno-cfg-save"
          style={{ background: "var(--brand)", color: "white" }}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvataggio…" : "Salva configurazione bagno"}
        </Button>
      </div>
    </div>
  );
}

