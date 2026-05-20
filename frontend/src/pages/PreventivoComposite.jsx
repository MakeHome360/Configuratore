import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus, ShieldCheck, Clock, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { InfissoQuickConfigurator } from "@/components/InfissoQuickConfigurator";
import ModalitaPagamentoPicker from "@/components/ModalitaPagamentoPicker";
import ListinoProdottoPicker from "@/components/ListinoProdottoPicker";
import MarginalitaWidget from "@/components/MarginalitaWidget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const SOGLIA_SCONTO_AUTO = 5; // Venditore può applicare fino a 5% senza autorizzazione

export default function PreventivoComposite() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const [sections, setSections] = useState([]);
  const [cliente, setCliente] = useState({ nome: "", telefono: "", email: "", indirizzo: "" });
  const [mq, setMq] = useState(0);
  const [selections, setSelections] = useState({}); // voceId -> { qty }
  const [sicurezzaPct, setSicurezzaPct] = useState(3);
  const [direzionePct, setDirezionePct] = useState(5);
  const [sconto, setSconto] = useState(0);
  const [scontoPct, setScontoPct] = useState(0);
  const [ivaPct, setIvaPct] = useState(10);
  const [note, setNote] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const [infissiExtras, setInfissiExtras] = useState([]); // [{id,name,qty,unit,price,unit_price,infisso_meta}]
  const [infissiModalOpen, setInfissiModalOpen] = useState(false);
  const [scontoReq, setScontoReq] = useState(null);
  const [scontoDialog, setScontoDialog] = useState(false);
  const [scontoForm, setScontoForm] = useState({ pct: 10, motivo: "" });
  const [savedId, setSavedId] = useState(null);
  const [modalitaPagamento, setModalitaPagamento] = useState({ preset_id: "", label: "", rate: [] });
  // Selezioni da Listini Fornitori (porte/infissi/piastrelle/sanitari/...)
  const [listiniSelections, setListiniSelections] = useState([]);
  const [listinoPickerOpen, setListinoPickerOpen] = useState(false);
  const [listinoPickerCat, setListinoPickerCat] = useState("");

  const onInfissiConfirm = ({ items }) => {
    const rows = items.map((it, i) => ({
      id: `infisso-${Date.now()}-${i}`,
      name: `${it.tipologia_name || "Infisso"} ${it.larghezza}×${it.altezza}cm · ${it.materiale_name} ${it.vetro_name} (${it.ante} ante)${it.tapparella ? " + tapparella" : ""}${it.zanzariera ? " + zanzariera" : ""}`,
      unit: "pz", qty: it.qty || 1,
      unit_price: Math.round((it.price || 0) / (it.qty || 1)),
      price: it.price,
      infisso_meta: it,
    }));
    setInfissiExtras((arr) => [...arr, ...rows]);
    toast.success(`${items.length} infissi aggiunti`);
  };
  const removeInfisso = (id) => setInfissiExtras((arr) => arr.filter((r) => r.id !== id));
  const infissiTot = useMemo(() => infissiExtras.reduce((s, r) => s + (r.price || 0), 0), [infissiExtras]);

  useEffect(() => {
    api.get("/composite-sections").then((r) => { setSections(r.data); if (r.data[0]) setActiveSection(r.data[0].id); });
    if (!isNew) {
      api.get(`/preventivi/${id}`).then((r) => {
        const d = r.data;
        setCliente(d.cliente || {}); setMq(d.mq || 0); setNote(d.note || "");
        setSconto(d.sconto_eur || 0); setScontoPct(d.sconto_pct || 0); setIvaPct(d.iva_pct || 10);
        setSavedId(d.id);
        // Carica eventuale richiesta sconto attiva
        api.get(`/sconto-richieste`).then(sr => {
          const rows = (sr.data || []).filter(rr => rr.preventivo_id === d.id);
          if (rows.length) setScontoReq(rows[0]);
        }).catch(() => {});
        setSicurezzaPct(d.sicurezza_pct ?? 3); setDirezionePct(d.direzione_lavori_pct ?? 5);
        setModalitaPagamento(d.modalita_pagamento || { preset_id: "", label: "", rate: [] });
        setListiniSelections(d.listini_selections || []);
        const sel = {};
        (d.composite_selections || []).forEach((s) => { sel[s.voce_id] = { qty: s.qty, price: s.price }; });
        setSelections(sel);
        setInfissiExtras(d.infissi_extras || []);
      });
    }
  }, [id, isNew]);

  const totaleVoci = useMemo(() => {
    let total = 0;
    sections.forEach((s) => {
      s.voci.forEach((v) => {
        const sel = selections[v.id];
        if (sel && sel.qty > 0) {
          // Se voce modificabile + il venditore ha messo un prezzo custom, usa quello; altrimenti listino
          const effPrice = (v.modificabile_dal_venditore && typeof sel.price === "number" && sel.price >= 0) ? sel.price : v.price;
          total += (sel.qty || 0) * effPrice;
        }
      });
    });
    return total;
  }, [sections, selections]);

  const totaleListini = useMemo(() => listiniSelections.reduce((s, p) => s + ((parseFloat(p.qty) || 0) * (parseFloat(p.prezzo_rivendita) || 0)), 0), [listiniSelections]);

  // Costo diretto reale = sommatoria di prezzi_acquisto (voci) + netti listini + stima infissi (price/1.6)
  const costoDirettoReale = useMemo(() => {
    let tot = 0;
    sections.forEach((s) => {
      s.voci.forEach((v) => {
        const sel = selections[v.id];
        if (sel && sel.qty > 0) {
          const cost = Number(v.prezzo_acquisto) || (Number(v.price) || 0) / 1.6;
          tot += (sel.qty || 0) * cost;
        }
      });
    });
    listiniSelections.forEach((p) => {
      const qty = parseFloat(p.qty) || 0;
      const netto = Number(p.prezzo_netto) || Number(p.netto) || (Number(p.prezzo_rivendita) || 0) / 1.6;
      tot += qty * netto;
    });
    infissiExtras.forEach((i) => {
      const cost = Number(i.prezzo_acquisto) || (Number(i.price) || 0) / 1.6;
      tot += cost;
    });
    return Math.round(tot);
  }, [sections, selections, listiniSelections, infissiExtras]);

  const sicurezzaAmt = (totaleVoci + totaleListini) * (sicurezzaPct / 100);
  const direzioneAmt = (totaleVoci + totaleListini) * (direzionePct / 100);
  // Maggiorazione mq piccole: <40 a corpo (×1.15 e mq min 40), <60 +10%
  const mqAdj = useMemo(() => {
    const m = parseFloat(mq || 0);
    if (!m) return { multiplier: 1, mode: "normal" };
    if (m < 40) return { multiplier: 1.15, mode: "a_corpo" };
    if (m < 60) return { multiplier: 1.10, mode: "maggiorato" };
    return { multiplier: 1, mode: "normal" };
  }, [mq]);
  // Applica maggiorazione al totale voci+listini, non a infissi che sono extra fissi
  const totaleVociMaggiorato = (totaleVoci + totaleListini) * mqAdj.multiplier;
  const imponibilePreScontoPct = totaleVociMaggiorato + infissiTot + sicurezzaAmt + direzioneAmt - (sconto || 0);
  const scontoPctAmt = imponibilePreScontoPct * (scontoPct || 0) / 100;
  const imponibile = imponibilePreScontoPct - scontoPctAmt;
  const iva = imponibile * (ivaPct / 100);
  const totale = imponibile + iva;

  const save = async () => {
    if (!cliente.nome) return toast.error("Inserisci nome cliente");
    const comp = [];
    sections.forEach((s) => s.voci.forEach((v) => {
      const sel = selections[v.id];
      if (sel && sel.qty > 0) {
        const effPrice = (v.modificabile_dal_venditore && typeof sel.price === "number" && sel.price >= 0) ? sel.price : v.price;
        comp.push({ section_id: s.id, voce_id: v.id, name: v.name, unit: v.unit, price: effPrice, list_price: v.price, qty: sel.qty, modificabile_dal_venditore: !!v.modificabile_dal_venditore });
      }
    }));
    const payload = {
      tipo: "composite", cliente, mq, composite_selections: comp,
      infissi_extras: infissiExtras,
      sicurezza_pct: sicurezzaPct, direzione_lavori_pct: direzionePct,
      sconto_eur: sconto, sconto_pct: scontoPct, iva_pct: ivaPct, note,
      mq_adjustment_mode: mqAdj.mode, mq_multiplier: mqAdj.multiplier,
      totale_iva_incl: totale, totale_iva_escl: imponibile,
      modalita_pagamento: modalitaPagamento,
      listini_selections: listiniSelections,
    };
    try {
      if (isNew) {
        const { data } = await api.post("/preventivi", payload);
        setSavedId(data.id);
        toast.success("Preventivo salvato"); nav(`/preventivocomposite/${data.id}`, { replace: true });
      } else {
        await api.put(`/preventivi/${id}`, payload); toast.success("Aggiornato");
      }
    } catch (e) {
      console.error("[PreventivoComposite] save error:", e);
      toast.error(e?.response?.data?.detail || "Errore salvataggio");
    }
  };

  const sec = sections.find((s) => s.id === activeSection);

  return (
    <div>
      <PageHeader title="Preventivo Composite" subtitle="Configura la tua ristrutturazione pezzo per pezzo"
        actions={<div className="flex gap-4 items-center text-right">
          <div><div className="text-[10px] uppercase text-zinc-500">MQ</div><Input type="number" min={0} step="0.5" className="w-20 h-8" value={mq} onChange={(e) => setMq(Math.max(0, Number(e.target.value) || 0))} /></div>
          <div><div className="text-[10px] uppercase text-zinc-500">€/MQ</div><div className="text-sm font-mono">{mq ? fmtEur2(totaleVoci / mq) : "0.00 €"}</div></div>
          <div><div className="text-[10px] uppercase text-zinc-500">Sicurezza {sicurezzaPct}%</div><div className="text-sm font-mono">{fmtEur(sicurezzaAmt)}</div></div>
          <div><div className="text-[10px] uppercase text-zinc-500">Dir. Lav {direzionePct}%</div><div className="text-sm font-mono">{fmtEur(direzioneAmt)}</div></div>
          <div><div className="text-[10px] uppercase text-zinc-500">Totale IVA Incl.</div><div className="text-lg font-bold" data-testid="totale-composite">{fmtEur2(totale)}</div></div>
          <Button onClick={() => setInfissiModalOpen(true)} variant="outline" size="sm" className="rounded-sm" data-testid="comp-add-infissi-top-btn">
            <Plus className="h-4 w-4 mr-1" />Infissi {infissiExtras.length > 0 && `(${infissiExtras.length})`}
          </Button>
        </div>} />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-lg p-3">
            <div className="mb-3"><Label className="text-xs">Dati Cliente</Label>
              <Input placeholder="Nome *" className="mt-1" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} data-testid="comp-nome" />
              <Input placeholder="Telefono" className="mt-1" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
              <Input placeholder="Email" className="mt-1" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
              <Input placeholder="Indirizzo" className="mt-1" value={cliente.indirizzo} onChange={(e) => setCliente({ ...cliente, indirizzo: e.target.value })} />
            </div>
            {sections.length === 0 ? (
              <div className="text-xs text-zinc-500 italic px-2 py-3 border border-dashed border-zinc-300 rounded">
                Caricamento sezioni in corso… Se non appaiono, controlla che il backoffice contenga le voci.
              </div>
            ) : (
              <div className="space-y-1">
                {sections.map((s) => {
                  const count = s.voci.filter((v) => selections[v.id]?.qty > 0).length;
                  const tot = s.voci.reduce((acc, v) => acc + (selections[v.id]?.qty || 0) * v.price, 0);
                  return (
                    <button key={s.id} onClick={() => setActiveSection(s.id)} data-testid={`comp-sec-${s.id}`}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeSection === s.id ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
                      <div className="flex items-center justify-between">
                        <span>{s.name}</span>
                        {count > 0 && <span className="text-xs opacity-70">{count}</span>}
                      </div>
                      {tot > 0 && <div className="text-[10px] font-mono opacity-60">{fmtEur(tot)}</div>}
                    </button>
                  );
                })}
                <button onClick={() => setActiveSection("__infissi__")} data-testid="comp-sec-infissi"
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors mt-2 border-t border-zinc-200 pt-3 ${activeSection === "__infissi__" ? "bg-amber-600 text-white" : "hover:bg-amber-50 text-amber-700"}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Plus className="h-3 w-3" />Infissi (extra configuratore)</span>
                    {infissiExtras.length > 0 && <span className="text-xs opacity-70">{infissiExtras.length}</span>}
                  </div>
                  {infissiTot > 0 && <div className="text-[10px] font-mono opacity-60">{fmtEur(infissiTot)}</div>}
                </button>
                <button onClick={() => setActiveSection("__listini__")} data-testid="comp-sec-listini"
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeSection === "__listini__" ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-blue-700"}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">🛒 Listini fornitori</span>
                    {listiniSelections.length > 0 && <span className="text-xs opacity-70">{listiniSelections.length}</span>}
                  </div>
                  {totaleListini > 0 && <div className="text-[10px] font-mono opacity-60">{fmtEur(totaleListini)}</div>}
                </button>
              </div>
            )}
            {/* Banner maggiorazione mq piccole */}
            {mqAdj.mode !== "normal" && (
              <div className={`mt-3 p-2.5 rounded border-l-4 text-xs ${mqAdj.mode === "a_corpo" ? "bg-rose-50 border-rose-500 text-rose-900" : "bg-amber-50 border-amber-500 text-amber-900"}`} data-testid="comp-mq-banner">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>{mqAdj.mode === "a_corpo" ? "Modalità A CORPO" : "+10% mq piccole"}</strong>
                    <div className="mt-0.5 leading-snug">
                      {mqAdj.mode === "a_corpo" ? "Sotto i 40 m² i costi fissi non scalano: applico +15% sul totale voci." : "Sotto i 60 m² il totale voci è maggiorato del 10%."}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Sezione SCONTO con autorizzazione */}
            <div className="mt-3 p-2.5 border border-zinc-200 rounded bg-zinc-50">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs uppercase tracking-widest text-zinc-700">Sconto %</Label>
                {scontoReq && scontoReq.stato === "pending" && <span className="text-[9px] mono uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> in attesa</span>}
                {scontoReq && scontoReq.stato === "approvato" && <span className="text-[9px] mono uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><ShieldCheck className="h-2.5 w-2.5" /> {scontoReq.pct_approvato || scontoReq.pct_richiesto}% OK</span>}
              </div>
              <Input
                type="number" min={0} max={100} step="0.5" value={scontoPct}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                  if (!isAdmin && v > SOGLIA_SCONTO_AUTO) {
                    setScontoPct(SOGLIA_SCONTO_AUTO);
                    setScontoForm({ pct: v, motivo: scontoReq?.motivo || "" });
                    setScontoDialog(true);
                    toast.info(`Sconto > ${SOGLIA_SCONTO_AUTO}%: serve autorizzazione admin`);
                    return;
                  }
                  setScontoPct(v);
                }}
                className="h-8 mono" data-testid="comp-sconto-pct"
              />
              <div className="text-[10px] text-zinc-500 mt-1">
                {isAdmin ? "Admin: libero." : `Venditore: fino al ${SOGLIA_SCONTO_AUTO}% diretto`}
              </div>
              {!isAdmin && (
                <Button variant="outline" size="sm" className="mt-1.5 w-full h-7 text-[11px]" onClick={() => { setScontoForm({ pct: Math.max(scontoPct, SOGLIA_SCONTO_AUTO + 1), motivo: scontoReq?.motivo || "" }); setScontoDialog(true); }} disabled={!savedId && isNew} data-testid="comp-sconto-richiedi">
                  Richiedi sconto maggiore
                </Button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white border border-zinc-200 rounded-lg p-5">
            {activeSection === "__listini__" ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">🛒 Prodotti da Listini Fornitori</h3>
                    <p className="text-xs text-zinc-500">Aggiungi porte, infissi, piastrelle, sanitari, ecc. dai listini caricati in admin. I prezzi sono già a rivendita (netto×ricarico).</p>
                  </div>
                  <Button size="sm" onClick={() => { setListinoPickerCat(""); setListinoPickerOpen(true); }} data-testid="comp-listini-add-btn" style={{ background: "var(--brand)", color: "white" }}>
                    <Plus className="h-4 w-4 mr-1" />Aggiungi prodotti
                  </Button>
                </div>
                {listiniSelections.length === 0 ? (
                  <div className="text-zinc-500 text-center py-12">Nessun prodotto selezionato.<br/><span className="text-xs">Clicca "Aggiungi prodotti" per scegliere dai listini fornitori (porte, piastrelle, sanitari, ecc.).</span></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Prodotto</th>
                        <th className="px-3 py-2 text-left">Fornitore</th>
                        <th className="px-3 py-2 text-right w-20">Qty</th>
                        <th className="px-3 py-2 text-right w-24">€/u</th>
                        <th className="px-3 py-2 text-right w-28">Totale</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {listiniSelections.map((p, i) => (
                        <tr key={`${p.listino_id}-${p.id}-${i}`}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-xs">{p.nome}</div>
                            <div className="text-[10px] text-zinc-500">{p.codice ? `[${p.codice}] ` : ""}{p.categoria_dettaglio || p.categoria} · {p.unit}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-zinc-600">{p.fornitore_nome}</td>
                          <td className="px-3 py-2"><Input type="number" min={0.01} step="0.01" value={p.qty} onChange={e => {
                            const q = parseFloat(e.target.value) || 0;
                            setListiniSelections(ls => ls.map((x, j) => j === i ? { ...x, qty: q, importo: q * (x.prezzo_rivendita || 0) } : x));
                          }} className="h-8 text-xs text-right mono" data-testid={`comp-listino-qty-${i}`} /></td>
                          <td className="px-3 py-2 text-right mono text-xs">€ {(p.prezzo_rivendita || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right mono font-bold">€ {((p.qty || 0) * (p.prezzo_rivendita || 0)).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right"><button onClick={() => setListiniSelections(ls => ls.filter((_, j) => j !== i))} className="text-rose-600 text-xs" data-testid={`comp-listino-del-${i}`}>×</button></td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 font-bold">
                        <td colSpan={4} className="px-3 py-2 text-right">Subtotale listini</td>
                        <td className="px-3 py-2 text-right mono" data-testid="comp-listini-total">€ {totaleListini.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </>
            ) : activeSection === "__infissi__" ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Infissi · Configuratore extra</h3>
                  <Button size="sm" onClick={() => setInfissiModalOpen(true)} data-testid="comp-add-infissi-btn" style={{ background: "var(--brand)", color: "white" }}>
                    <Plus className="h-4 w-4 mr-1" />Aggiungi infissi
                  </Button>
                </div>
                {infissiExtras.length === 0 ? (
                  <div className="text-zinc-500 text-center py-12">Nessun infisso configurato. Clicca "Aggiungi infissi" per aprire il configuratore.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                      <tr><th className="px-3 py-2 text-left">Descrizione</th><th className="px-3 py-2 text-right w-20">Qty</th><th className="px-3 py-2 text-right w-24">Prezzo €</th><th className="px-3 py-2 text-right w-28">Totale</th><th className="w-10"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {infissiExtras.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtEur2(r.unit_price)} /{r.unit}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{fmtEur2(r.price)}</td>
                          <td className="px-3 py-2 text-right"><button onClick={() => removeInfisso(r.id)} className="text-rose-600 text-xs">×</button></td>
                        </tr>
                      ))}
                      <tr className="bg-amber-50 font-bold"><td colSpan={3} className="px-3 py-2 text-right">Subtotale infissi</td><td className="px-3 py-2 text-right font-mono">{fmtEur2(infissiTot)}</td><td></td></tr>
                    </tbody>
                  </table>
                )}
              </>
            ) : sec ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{sec.name}</h3>
                  <div className="text-sm text-zinc-600">Totale: <span className="font-bold">{fmtEur(sec.voci.reduce((acc, v) => acc + (selections[v.id]?.qty || 0) * v.price, 0))}</span></div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr><th className="px-3 py-2 text-left">Descrizione</th><th className="px-3 py-2 text-right w-32">Prezzo €/u</th><th className="px-3 py-2 text-center w-12">Sel.</th><th className="px-3 py-2 text-center w-20">Qtà</th><th className="px-3 py-2 text-right w-28">Totale</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sec.voci.map((v) => {
                      const sel = selections[v.id];
                      const editable = !!v.modificabile_dal_venditore;
                      const effPrice = (sel && editable && typeof sel.price === "number" && sel.price >= 0) ? sel.price : v.price;
                      return (
                        <tr key={v.id}>
                          <td className="px-3 py-2">
                            <span>{v.name}</span>
                            {editable && <span className="ml-1 text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 ml-2">prezzo editabile</span>}
                            {!editable && <span className="ml-1 text-[9px] uppercase font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1 ml-2">🔒 lavorazione</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {editable && sel ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input type="number" min={0} step="0.01"
                                  className="h-8 w-24 text-right font-mono"
                                  value={effPrice}
                                  onChange={(e) => setSelections({ ...selections, [v.id]: { ...sel, price: Math.max(0, Number(e.target.value) || 0) } })}
                                  data-testid={`comp-price-${v.id}`}
                                />
                                <span className="text-xs text-zinc-500">/{v.unit}</span>
                              </div>
                            ) : (
                              <span className={editable ? "text-emerald-700" : ""}>{fmtEur(v.price)} /{v.unit}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={!!sel} onChange={(e) => {
                              const s = { ...selections };
                              if (e.target.checked) s[v.id] = { qty: v.unit === "forfait" || v.unit === "pz" ? 1 : mq || 1, price: v.price };
                              else delete s[v.id];
                              setSelections(s);
                            }} data-testid={`comp-check-${v.id}`} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {sel && <Input type="number" min={0} step="0.5" className="h-8 w-20 mx-auto" value={sel.qty} onChange={(e) => setSelections({ ...selections, [v.id]: { ...sel, qty: Math.max(0, Number(e.target.value) || 0) } })} />}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{sel ? fmtEur((sel.qty || 0) * effPrice) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : <div className="text-zinc-500 text-center py-12">Seleziona una sezione</div>}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4 mt-5 grid grid-cols-5 gap-3 items-end">
          <div><Label className="text-xs">Sicurezza %</Label><Input type="number" min={0} max={100} step="0.5" value={sicurezzaPct} onChange={(e) => setSicurezzaPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <div><Label className="text-xs">Dir. Lavori %</Label><Input type="number" min={0} max={100} step="0.5" value={direzionePct} onChange={(e) => setDirezionePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <div><Label className="text-xs">Sconto €</Label><Input type="number" min={0} step="1" value={sconto} onChange={(e) => setSconto(Math.max(0, Number(e.target.value) || 0))} /></div>
          <div><Label className="text-xs">IVA %</Label><Input type="number" min={0} max={100} step="0.5" value={ivaPct} onChange={(e) => setIvaPct(Math.max(0, Math.min(100, Number(e.target.value) || 10)))} /></div>
          <Button onClick={save} data-testid="comp-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva Preventivo</Button>
          {savedId && !isNew && (
            <Button variant="outline" onClick={() => nav(`/preventivocomposite/${savedId || id}/stampa`)} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50" data-testid="comp-stampa">
              <FileText className="h-4 w-4 mr-2" />Anteprima stampa
            </Button>
          )}
        </div>
        <div className="mt-3"><Label className="text-xs">Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {/* Widget marginalità live (solo admin/responsabili) */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 mt-3">
          <MarginalitaWidget totaleIvaEscl={imponibile} ricaricoDefault={1.8} costiDirettiOverride={costoDirettoReale} />
        </div>
        {/* Modalità di pagamento (preset admin / personalizzata) */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 mt-3">
          <ModalitaPagamentoPicker
            prev={{ modalita_pagamento: modalitaPagamento }}
            setPrev={(updater) => { const next = typeof updater === "function" ? updater({ modalita_pagamento: modalitaPagamento }) : updater; setModalitaPagamento(next.modalita_pagamento || { preset_id: "", label: "", rate: [] }); }}
            totale={totale}
          />
        </div>
      </Page>
      <InfissoQuickConfigurator open={infissiModalOpen} onClose={() => setInfissiModalOpen(false)} onConfirm={onInfissiConfirm} />
      <ListinoProdottoPicker
        open={listinoPickerOpen}
        onOpenChange={setListinoPickerOpen}
        defaultCategoria={listinoPickerCat}
        onConfirm={(items) => {
          setListiniSelections(ls => {
            const out = [...ls];
            items.forEach(it => {
              // Se già presente con stesso listino_id+id → somma qty
              const idx = out.findIndex(x => x.listino_id === it.listino_id && x.id === it.id);
              if (idx >= 0) { out[idx] = { ...out[idx], qty: (parseFloat(out[idx].qty) || 0) + (parseFloat(it.qty) || 0) }; }
              else out.push(it);
            });
            return out;
          });
          toast.success(`${items.length} prodotto/i aggiunto/i ai listini`);
        }}
      />
      {/* Dialog: richiesta sconto > 5% per autorizzazione admin */}
      <Dialog open={scontoDialog} onOpenChange={setScontoDialog}>
        <DialogContent className="max-w-md" data-testid="comp-sconto-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-600" /> Richiesta sconto maggiore del {SOGLIA_SCONTO_AUTO}%</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-900">Per applicare uno sconto superiore al {SOGLIA_SCONTO_AUTO}% serve l'autorizzazione dell'admin. Riceverai notifica appena viene presa una decisione.</div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">% sconto richiesta</Label>
              <Input type="number" min={SOGLIA_SCONTO_AUTO + 0.5} max={100} step="0.5" value={scontoForm.pct} onChange={(e) => setScontoForm(s => ({ ...s, pct: parseFloat(e.target.value) || 0 }))} className="mono mt-1" data-testid="comp-sconto-req-pct" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Motivazione (obbligatoria)</Label>
              <Textarea value={scontoForm.motivo} onChange={(e) => setScontoForm(s => ({ ...s, motivo: e.target.value }))} placeholder="Es: cliente in trattativa, fidelizzazione, opportunità referral..." rows={4} className="mt-1" data-testid="comp-sconto-req-motivo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScontoDialog(false)}>Annulla</Button>
            <Button disabled={scontoForm.pct <= SOGLIA_SCONTO_AUTO || !scontoForm.motivo.trim() || (!savedId && isNew)}
              style={{ background: "#0F172A", color: "white" }}
              onClick={async () => {
                try {
                  const targetId = savedId || id;
                  const { data } = await api.post(`/preventivi/${targetId}/sconto-richiesta`, { pct: scontoForm.pct, motivo: scontoForm.motivo.trim() });
                  setScontoReq(data);
                  setScontoDialog(false);
                  toast.success(`Richiesta inviata all'admin (${data.pct_richiesto}%)`);
                } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
              }}
              data-testid="comp-sconto-req-send"
            >Invia richiesta all'admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
