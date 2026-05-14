import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Download, ChevronRight, ChevronLeft, Check, Sparkles, FileText, Send,
} from "lucide-react";
import { fmtEuro, fmtNum } from "../editor/utils";
import jsPDF from "jspdf";
import { InfissoQuickConfigurator } from "../components/InfissoQuickConfigurator";

export default function PreventivoPacchetto() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();

  const [step, setStep] = useState(0); // 0 package, 1 mq, 2 items, 3 optional, 4 bagno, 5 cliente, 6 result
  const [packages, setPackages] = useState([]);
  const [optionals, setOptionals] = useState([]);
  const [bathroomTiers, setBathroomTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [prev, setPrev] = useState({
    package_id: null,
    mq: 70,
    items: [],       // [{id, name, category, unit, qty_richiesta, included_qty, unit_price, unit_consigliato}]
    optional: [],    // [{id, name, qty, unit_price, total, per_m2, unit}]
    bathroom_tier: null, // legacy: kept for backward compat (singolo bagno)
    bathroom_surcharge: 0, // legacy
    bathrooms: [],   // NEW: [{ id, tier_id, included, surcharge_eur }] — array bagni multipli
    cliente: { nome: "", cognome: "", indirizzo: "", email: "", telefono: "" },
    note: "",
    sconto_pct: 0,
    iva_pct: 10,
  });
  const [numero, setNumero] = useState(null);
  const [stato, setStato] = useState("bozza");

  // Prefill ref: sopravvive a re-mount (StrictMode dev). Applichiamo extras una sola volta.
  const prefillRef = useRef({ data: null, applied: false, loaded: false });
  const [infissiModalOpen, setInfissiModalOpen] = useState(false);
  const [extraFreeOpen, setExtraFreeOpen] = useState(false);
  const [extraFreeForm, setExtraFreeForm] = useState({ name: "", category: "EXTRA", unit: "pz", qty: 1, unit_price: 0, note: "" });

  const onInfissiConfirm = ({ items, totale }) => {
    const newRows = items.map((it, i) => ({
      id: `infisso-${Date.now()}-${i}`,
      voce_id: `infisso-${Date.now()}-${i}`,
      name: `${it.tipologia_name || "Infisso"} ${it.larghezza}×${it.altezza}cm · ${it.materiale_name} ${it.vetro_name} (${it.ante} ante)${it.tapparella ? " + tapparella" : ""}${it.zanzariera ? " + zanzariera" : ""}`,
      category: "EXTRA",
      unit: "pz",
      qty_mode: "fissa", qty_ratio: 0, qty_value: it.qty || 1,
      unit_price: Math.round((it.price || 0) / (it.qty || 1)),
      included_qty: 0,
      qty_richiesta: it.qty || 1,
      from_infissi: true,
      infisso_meta: it,
    }));
    setPrev((p) => ({ ...p, items: [...(p.items || []), ...newRows] }));
    toast.success(`${items.length} infissi aggiunti come extra (${fmtEuro(totale)})`);
  };

  useEffect(() => {
    (async () => {
      try {
        const [pk, op, bt] = await Promise.all([
          api.get("/packages"), api.get("/packages/optional"), api.get("/packages/bathroom-tiers"),
        ]);
        const pkgsSorted = (pk.data || []).slice().sort((a, b) => (a.price_per_m2 || 0) - (b.price_per_m2 || 0));
        setPackages(pkgsSorted); setOptionals(op.data); setBathroomTiers(bt.data);
        if (!isNew) {
          const { data } = await api.get(`/preventivi/${id}`);
          const silverBasePrice = (bt.data && bt.data[0]?.price) || 0;
          // Backward-compat: se `bathrooms` non esiste, costruiscilo da `bathroom_tier` (singolo legacy)
          let bathrooms = Array.isArray(data.bathrooms) ? data.bathrooms : [];
          if (!bathrooms.length && data.bathroom_tier) {
            const tier = (bt.data || []).find((t) => t.id === data.bathroom_tier);
            bathrooms = [{ id: `bath-${Date.now()}`, tier_id: data.bathroom_tier, included: true, surcharge_eur: tier ? Math.max(0, (tier.price || 0) - silverBasePrice) : 0 }];
          }
          setPrev({
            package_id: data.package_id, mq: data.mq,
            items: data.items || [], optional: data.optional || [],
            bathroom_tier: data.bathroom_tier,
            bathroom_surcharge: data.bathroom_tier ? (((bt.data.find((t) => t.id === data.bathroom_tier)?.price || 0) - silverBasePrice) || 0) : 0,
            bathrooms,
            cliente: data.cliente || {}, note: data.note || "",
            sconto_pct: data.sconto_pct || 0, iva_pct: data.iva_pct || 10,
          });
          setNumero(data.numero); setStato(data.stato);
          setStep(6);
        } else {
          // Prefill dal configuratore esigenze (sessionStorage + URL ?prefill=1)
          // NON rimuoviamo subito sessionStorage: StrictMode (dev) può causare doppio mount,
          // l'eventuale removeItem nel primo mount cancellerebbe il dato prima del secondo mount.
          // Lo puliamo solo dopo aver salvato il preventivo.
          try {
            const params = new URLSearchParams(window.location.search);
            if (params.get("prefill") === "1" && !prefillRef.current.loaded) {
              const raw = sessionStorage.getItem("preventivo_prefill");
              if (raw) {
                const pf = JSON.parse(raw);
                prefillRef.current = { data: pf, applied: false, loaded: true };
                setPrev((p) => ({
                  ...p,
                  package_id: pf.package_id || null,
                  mq: pf.mq || p.mq,
                  cliente: { ...p.cliente, ...(pf.cliente || {}) },
                  note: pf.note || p.note,
                }));
                if (pf.package_id) setStep(2); // skip package and mq selection
              }
            }
          } catch (e) { /* prefill not available */ }
        }
      } catch (e) {
        console.error("[PreventivoPacchetto load]", e);
        toast.error("Errore caricamento: " + (e?.response?.data?.detail || e?.response?.statusText || e?.message || "verifica la connessione"));
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  // Recompute items when package or mq changes
  useEffect(() => {
    if (!prev.package_id) return;
    const pkg = packages.find((p) => p.id === prev.package_id); if (!pkg) return;
    setPrev((p) => {
      const ml = (p.mq || 0) * 0.4;
      const calcQty = (it, m) => {
        if (it.qty_mode === "fissa") return it.qty_value || 0;
        if (it.qty_mode === "ml") return (it.qty_ratio || 0) * ml;
        return (it.qty_ratio || 0) * m;
      };
      const newItems = (pkg.items || []).map((it) => {
        const included = calcQty(it, p.mq || 0);
        const existing = (p.items || []).find((x) => x.id === it.id);
        return {
          id: it.id, voce_id: it.voce_id || it.id, name: it.name, category: it.category, unit: it.unit,
          qty_mode: it.qty_mode, qty_ratio: it.qty_ratio, qty_value: it.qty_value,
          unit_price: existing && existing.unit_price != null ? existing.unit_price : (it.prezzo_rivendita != null ? it.prezzo_rivendita : (it.unit_price_pkg != null ? it.unit_price_pkg : 0)),
          included_qty: parseFloat(included.toFixed(2)),
          qty_richiesta: existing ? existing.qty_richiesta : parseFloat(included.toFixed(2)),
          modificabile_dal_venditore: it.modificabile_dal_venditore !== false, // default true se non specificato
          unit_price_pkg: it.unit_price_pkg, // SOGLIA MAX coperto dal pacchetto (€/unità). Se null → prezzo_rivendita standard
          excluded: existing ? !!existing.excluded : false,
        };
      });
      // Preserve EXTRA rows aggiunte dal configuratore (from_configuratore=true)
      // che non corrispondono a voci del pacchetto corrente
      const pkgVoceIds = new Set(newItems.map((it) => it.voce_id || it.id));
      const preservedExtras = [];
      (p.items || []).forEach((it) => {
        if (it.from_configuratore && !pkgVoceIds.has(it.voce_id || it.id)) {
          preservedExtras.push(it);
        }
      });
      newItems.push(...preservedExtras);
      // Apply prefill extras (UNA SOLA VOLTA: rilevato tramite presenza di item from_configuratore)
      const prefill = prefillRef.current;
      const alreadyApplied = (p.items || []).some((it) => it.from_configuratore);
      if (prefill.data && !alreadyApplied) {
        const extras = prefill.data.extras || [];
        extras.forEach((ex) => {
          const idx = newItems.findIndex((it) => (it.voce_id || it.id) === ex.voce_id);
          if (idx >= 0) {
            // voce già nel pacchetto → aumenta qty_richiesta oltre l'incluso
            newItems[idx] = {
              ...newItems[idx],
              qty_richiesta: parseFloat(((newItems[idx].included_qty || 0) + (ex.qty || 0)).toFixed(2)),
              from_configuratore: true,
            };
          } else {
            // voce non inclusa → aggiungi come riga extra (included_qty=0)
            newItems.push({
              id: ex.voce_id, voce_id: ex.voce_id, name: ex.name, category: "EXTRA", unit: ex.unit || "pz",
              qty_mode: "fissa", qty_ratio: 0, qty_value: ex.qty || 1,
              unit_price: ex.unit_price || 0,
              included_qty: 0,
              qty_richiesta: parseFloat((ex.qty || 1).toFixed(2)),
              from_configuratore: true,
            });
          }
        });
      }
      return { ...p, items: newItems };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev.package_id, prev.mq, packages]);

  // Auto-init: quando l'utente entra nello step 4 (Bagno) per la prima volta E i tier sono caricati,
  // se la lista bagni è vuota → crea il bagno #1 SILVER incluso (riflette il pacchetto base).
  useEffect(() => {
    if (step === 4 && (prev.bathrooms || []).length === 0 && bathroomTiers.length > 0) {
      setPrev((s) => (s.bathrooms?.length ? s : { ...s, bathrooms: [{ id: `bath-${Date.now()}`, tier_id: bathroomTiers[0].id, included: true }] }));
    }
  }, [step, bathroomTiers, prev.bathrooms]);

  const pkg = packages.find((p) => p.id === prev.package_id);

  const totals = useMemo(() => {
    if (!pkg) return { base: 0, extras: 0, optional: 0, bagno: 0, subtotal: 0, sconto: 0, iva: 0, total: 0 };
    // Voci ESCLUSE dal preventivo (rimosse dall'utente): non contano né come base né come extras
    const activeItems = (prev.items || []).filter((it) => !it.excluded);
    // Il forfait viene RIDOTTO proporzionalmente se l'utente ha escluso voci incluse (è giusto: ha tolto prestazioni)
    // Semplificazione: il base resta al prezzo a m² del pacchetto intero (il pacchetto è un'offerta unica). Le esclusioni si riflettono SOLO in meno extras.
    const base = pkg.price_per_m2 * (prev.mq || 0);
    const extras = activeItems.reduce((s, it) => {
      const incl = it.included_qty || 0;
      const reqs = Math.max(0, it.qty_richiesta || 0);
      const unitPrice = Math.max(0, it.unit_price || 0);
      // Extras = (eccedenza qty + eccedenza prezzo sopra soglia).
      // L'eccedenza prezzo si applica SOLO ai MATERIALI (modificabile_dal_venditore=true),
      // mai alle LAVORAZIONI (muratura/impianti/etc che NON sono modificabili).
      let extraVal = 0;
      if (incl === 0) {
        // Voce non inclusa → tutta extra (qty × prezzo)
        extraVal = reqs * unitPrice;
      } else {
        const extraQty = Math.max(0, reqs - incl);
        extraVal = extraQty * unitPrice;
        // Eccedenza prezzo SOLO per materiali modificabili sopra soglia
        if (it.modificabile_dal_venditore) {
          const soglia = it.unit_price_pkg;
          if (soglia != null && soglia > 0 && unitPrice > soglia) {
            extraVal += (unitPrice - soglia) * incl;
          }
        }
      }
      return s + extraVal;
    }, 0);
    const optional = (prev.optional || []).reduce((s, o) => s + (o.total || 0), 0);
    // Calcolo bagni multipli: per ogni bagno incluso → surcharge = max(0, tier.price - silver.price);
    // per ogni bagno extra → costo intero del tier scelto
    const silverBase = (bathroomTiers && bathroomTiers[0]?.price) || 0;
    let bagno = 0;
    const bathroomsList = prev.bathrooms || [];
    if (bathroomsList.length > 0) {
      bathroomsList.forEach((b) => {
        const t = bathroomTiers.find((x) => x.id === b.tier_id);
        if (!t) return;
        if (b.included) {
          bagno += Math.max(0, (t.price || 0) - silverBase);
        } else {
          bagno += (t.price || 0);
        }
      });
    } else {
      // Legacy: usa bathroom_surcharge se array vuoto
      bagno = prev.bathroom_surcharge || 0;
    }
    const subtotal = base + extras + optional + bagno;
    const sconto = subtotal * (prev.sconto_pct || 0) / 100;
    const afterDisc = subtotal - sconto;
    const iva = afterDisc * (prev.iva_pct || 10) / 100;
    const total = afterDisc + iva;
    return { base, extras, optional, bagno, subtotal, sconto, iva, total };
  }, [prev, pkg, bathroomTiers]);

  const save = async () => {
    setSaving(true);
    const payload = {
      tipo: "pacchetto",
      cliente: prev.cliente,
      package_id: prev.package_id,
      mq: prev.mq,
      items: prev.items,
      optional: prev.optional,
      bathroom_tier: prev.bathroom_tier, // legacy
      bathrooms: prev.bathrooms || [],   // nuovo: bagni multipli
      note: prev.note,
      sconto_pct: prev.sconto_pct,
      iva_pct: prev.iva_pct,
      totale_iva_incl: totals.total,
      totale_iva_escl: totals.subtotal - totals.sconto,
    };
    try {
      if (isNew || !numero) {
        const { data } = await api.post("/preventivi", payload);
        setNumero(data.numero);
        // Pulisci sessionStorage del configuratore (ora che il preventivo è salvato)
        try { sessionStorage.removeItem("preventivo_prefill"); } catch {}
        toast.success("Preventivo salvato");
        nav(`/preventivopacchetto/${data.id}`, { replace: true });
      } else {
        await api.put(`/preventivi/${id}`, payload);
        toast.success("Aggiornato");
      }
    } catch (e) {
      console.error("[PREVENTIVO] save error:", e);
      toast.error("Errore salvataggio");
    }
    setSaving(false);
  };

  const canNext = () => {
    if (step === 0) return !!prev.package_id;
    if (step === 1) return prev.mq > 0;
    if (step === 5) return (prev.cliente?.nome && prev.cliente?.cognome);
    return true;
  };

  const steps = ["Pacchetto", "Metri quadri", "Lavorazioni", "Optional", "Bagno", "Cliente", "Riepilogo"];

  if (loading) {
    return <div className="p-16 text-center mono text-zinc-500">caricamento…</div>;
  }

  const optFiltered = optionals.filter((o) => !prev.package_id || o.package_ids.includes(prev.package_id));

  return (
    <div className="min-h-screen bg-white" data-testid="preventivo-editor">
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => nav("/preventivi")} className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900" data-testid="back-to-preventivi">
            <ArrowLeft size={14} /> Preventivi
          </button>
          <div className="flex items-center gap-3">
            <div className="mono text-xs text-zinc-500">{numero || "nuovo"}</div>
            <Button variant="outline" className="rounded-sm h-9" onClick={() => exportPDF(prev, pkg, totals, numero)} data-testid="pdf-preventivo-button">
              <Download size={14} className="mr-2" /> PDF
            </Button>
            <Button className="rounded-sm h-9 bg-zinc-900 hover:bg-zinc-800" onClick={save} disabled={saving} data-testid="save-preventivo-button">
              <Save size={14} className="mr-2" /> Salva
            </Button>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 border border-zinc-200 mb-8 overflow-x-auto">
          {steps.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex-1 min-w-[120px] px-4 py-3 text-xs uppercase tracking-widest text-left border-r border-zinc-200 last:border-r-0 transition-colors ${step === i ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
              data-testid={`step-${i}`}
            >
              <div className="mono text-[10px] opacity-70 mb-1">{i + 1}</div>
              {s}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 min-w-0">
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "Outfit" }}>Scegli il pacchetto</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {packages.map((p) => (
                    <button key={p.id}
                      onClick={() => setPrev((s) => ({ ...s, package_id: p.id }))}
                      className={`text-left border p-6 transition-all hover:-translate-y-0.5 ${prev.package_id === p.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}
                      data-testid={`package-${p.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl font-semibold" style={{ fontFamily: "Outfit", color: p.color }}>{p.name}</span>
                        <div className="mono text-sm text-zinc-500">€/m²</div>
                      </div>
                      <div className="mono text-3xl font-semibold text-zinc-900 mb-2">{fmtNum(p.price_per_m2, 0)}</div>
                      <div className="text-xs text-zinc-500 uppercase tracking-widest mb-3">{p.subtitle}</div>
                      <p className="text-sm text-zinc-700 leading-relaxed mb-4">{p.description}</p>
                      <div className="mono text-xs text-zinc-500">{p.items.length} lavorazioni incluse</div>
                      {prev.package_id === p.id && <div className="mt-3 text-xs text-zinc-900 mono flex items-center gap-1"><Check size={12} /> selezionato</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "Outfit" }}>Superficie dell'abitazione</h2>
                <div className="max-w-md">
                  <Label className="label-kicker">Metri quadri</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={prev.mq}
                    onChange={(e) => setPrev((s) => ({ ...s, mq: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    className="rounded-sm h-16 mono text-4xl mt-2"
                    data-testid="mq-input"
                  />
                  <div className="mono text-xs text-zinc-500 mt-2">La superficie calpestabile totale dell'immobile.</div>
                </div>
                {pkg && prev.mq > 0 && (
                  <div className="mt-8 border border-zinc-200 p-6 max-w-md">
                    <div className="label-kicker mb-2">Preview base</div>
                    <div className="mono text-3xl">{fmtEuro(pkg.price_per_m2 * prev.mq)}</div>
                    <div className="text-xs text-zinc-500 mono mt-1">{pkg.name} · {fmtNum(pkg.price_per_m2, 0)} €/m² × {prev.mq} m²</div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: "Outfit" }}>Lavorazioni incluse nel pacchetto</h2>
                {pkg && prev.mq > 0 && (
                  <div className="bg-emerald-50 border-2 border-emerald-300 p-5 mb-5 grid grid-cols-3 gap-4" data-testid="pacchetto-totale-mq">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-emerald-700">Pacchetto base</div>
                      <div className="mono text-2xl font-bold text-emerald-900">{fmtEuro(pkg.price_per_m2 * prev.mq)}</div>
                      <div className="text-[11px] mono text-emerald-700">{pkg.name} · {fmtNum(pkg.price_per_m2, 0)}€/m² × {prev.mq}m²</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-amber-700">+ Extra dal configuratore/infissi</div>
                      <div className="mono text-2xl font-bold text-amber-900" data-testid="pacchetto-extras-tot">{fmtEuro(totals?.extras || 0)}</div>
                      <div className="text-[11px] mono text-amber-700">solo le voci aggiuntive</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-700">Totale subtotale</div>
                      <div className="mono text-2xl font-bold text-zinc-900">{fmtEuro((pkg.price_per_m2 * prev.mq) + (totals?.extras || 0) + (totals?.optional || 0))}</div>
                      <div className="text-[11px] mono text-zinc-500">IVA esclusa, prima sconto</div>
                    </div>
                  </div>
                )}
                <p className="text-sm text-zinc-600 mb-4">Tutto questo è già <strong>incluso nel prezzo a m² del pacchetto {pkg?.name}</strong>. Se il cliente vuole una quantità superiore a quella inclusa, paga solo la differenza al prezzo del backoffice.</p>
                <div className="flex justify-end mb-3 gap-2">
                  <Button variant="outline" size="sm" className="rounded-sm" onClick={() => setExtraFreeOpen(true)} data-testid="add-extra-free-btn">+ Aggiungi extra libero</Button>
                  <Button variant="outline" size="sm" className="rounded-sm" onClick={() => setInfissiModalOpen(true)} data-testid="add-infissi-btn">+ Aggiungi infissi (extra)</Button>
                </div>
                {["DEMOLIZIONI", "MURATURA", "IMPIANTI", "INFISSI", "SERVIZI", "EXTRA"].map((cat) => {
                  const list = prev.items.filter((it) => {
                    const isDemo = /demoliz|smaltim|rimoz/i.test(it.name);
                    if (cat === "DEMOLIZIONI") return isDemo;
                    if (cat === "EXTRA") return it.category === "EXTRA";
                    return !isDemo && it.category === cat;
                  });
                  if (list.length === 0) return null;
                  const activeList = list.filter((it) => !it.excluded);
                  const excludedList = list.filter((it) => it.excluded);
                  const colorMap = { DEMOLIZIONI: "#DC2626", MURATURA: "#0F766E", IMPIANTI: "#2563EB", INFISSI: "#9333EA", SERVIZI: "#B45309", EXTRA: "#EA580C" };
                  const catLabel = cat === "EXTRA" ? "EXTRA · Configuratore Esigenze" : cat;
                  return (
                    <div key={cat} className="mb-6">
                      <div className="text-xs uppercase tracking-widest font-bold mb-2 flex items-center gap-2" style={{ color: colorMap[cat] }}>
                        {catLabel}
                        <span className="text-[10px] mono text-zinc-400 normal-case">{activeList.length} voci · {excludedList.length > 0 ? `${excludedList.length} rimosse` : ""}</span>
                      </div>
                      <table className="w-full text-sm border border-zinc-200">
                        <thead className="bg-zinc-50 text-xs uppercase tracking-widest text-zinc-500">
                          <tr>
                            <th className="w-8"></th>
                            <th className="text-left py-2 px-3 font-medium">Lavorazione</th>
                            <th className="text-right py-2 px-3 font-medium w-20">U.M.</th>
                            <th className="text-right py-2 px-3 font-medium w-28">Incluse</th>
                            <th className="text-right py-2 px-3 font-medium w-28">Richieste</th>
                            <th className="text-right py-2 px-3 font-medium w-28 hidden" data-testid="th-price">€ / unità</th>
                            <th className="text-right py-2 px-3 font-medium w-32">Extra a pagamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeList.map((it) => {
                            const incl = it.included_qty || 0;
                            const reqs = Math.max(0, it.qty_richiesta || 0);
                            const unitPrice = Math.max(0, it.unit_price || 0);
                            // REGOLA: extra qty + extra prezzo soglia. Eccedenza prezzo SOLO se materiale modificabile.
                            const extraQty = incl === 0 ? reqs : Math.max(0, reqs - incl);
                            const extraQtyCost = extraQty * unitPrice;
                            const soglia = it.unit_price_pkg;
                            const isMaterialeMod = !!it.modificabile_dal_venditore;
                            const overSoglia = isMaterialeMod && soglia != null && soglia > 0 && unitPrice > soglia;
                            const extraPrezzoCost = overSoglia && incl > 0 ? (unitPrice - soglia) * incl : 0;
                            const extraCost = extraQtyCost + extraPrezzoCost;
                            return (
                              <tr key={it.id} className="border-t border-zinc-100" data-testid={`lav-row-${it.id}`}>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPrev((s) => ({ ...s, items: s.items.map((x) => x.id === it.id ? { ...x, excluded: true } : x) }));
                                      toast.success(`"${it.name}" rimossa dal preventivo`);
                                    }}
                                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded"
                                    title="Rimuovi questa voce dal preventivo"
                                    data-testid={`lav-remove-${it.id}`}
                                  ><span className="text-xs">✕</span></button>
                                </td>
                                <td className="py-2 px-3">
                                  {it.name}
                                </td>
                                <td className="py-2 px-3 text-right mono text-xs text-zinc-500">{it.unit}</td>
                                <td className="py-2 px-3 text-right mono text-zinc-500">{fmtNum(it.included_qty, 2)}</td>
                                <td className="py-2 px-3 text-right">
                                  <Input type="number" min={0} step="0.01" value={it.qty_richiesta}
                                    onChange={(e) => {
                                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                                      setPrev((s) => ({ ...s, items: s.items.map((x) => x.id === it.id ? { ...x, qty_richiesta: v } : x) }));
                                    }}
                                    className="rounded-sm h-7 text-right mono text-xs w-20 ml-auto"
                                    data-testid={`lav-qty-${it.id}`}
                                  />
                                </td>
                                <td className="hidden">
                                  {it.modificabile_dal_venditore ? (
                                    <Input type="number" min={0} step="0.01" value={it.unit_price}
                                      onChange={(e) => {
                                        const v = Math.max(0, parseFloat(e.target.value) || 0);
                                        setPrev((s) => ({ ...s, items: s.items.map((x) => x.id === it.id ? { ...x, unit_price: v } : x) }));
                                      }}
                                      className={`rounded-sm h-7 text-right mono text-xs w-20 ml-auto`}
                                      data-testid={`lav-price-${it.id}`}
                                    />
                                  ) : (
                                    <span>{fmtEuro(it.unit_price)}</span>
                                  )}
                                </td>
                                <td className={`py-2 px-3 text-right mono text-xs ${extraCost > 0 ? "text-orange-600 font-semibold" : "text-zinc-400"}`}>
                                  {extraCost > 0 ? (
                                    <div>
                                      {extraQty > 0 && <div>{`+${fmtNum(extraQty, 2)} ${it.unit} × ${fmtEuro(unitPrice)} = ${fmtEuro(extraQtyCost)}`}</div>}
                                      {overSoglia && incl > 0 && (
                                        <div className="text-amber-700">{`+${fmtEuro(unitPrice - soglia)}/${it.unit} (sopra soglia ${fmtEuro(soglia)}) × ${fmtNum(incl, 2)} = ${fmtEuro(extraPrezzoCost)}`}</div>
                                      )}
                                      <div className="font-bold mt-0.5">Tot. extra: {fmtEuro(extraCost)}</div>
                                    </div>
                                  ) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {excludedList.length > 0 && (
                        <div className="mt-2 bg-amber-50 border border-amber-300 p-2 text-[11px]" data-testid={`excluded-${cat}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="mono uppercase tracking-widest text-amber-800 text-[9px]">{excludedList.length} voci rimosse</span>
                            <button onClick={() => setPrev((s) => ({ ...s, items: s.items.map((x) => x.excluded ? { ...x, excluded: false } : x) }))} className="text-amber-800 underline text-[10px]" data-testid={`restore-all-${cat}`}>Ripristina tutte</button>
                          </div>
                          <ul className="space-y-0.5 max-h-32 overflow-auto">
                            {excludedList.map((it) => (
                              <li key={it.id} className="flex items-center justify-between gap-2">
                                <span className="text-amber-900 truncate">{it.name}</span>
                                <button onClick={() => setPrev((s) => ({ ...s, items: s.items.map((x) => x.id === it.id ? { ...x, excluded: false } : x) }))} className="text-amber-700 hover:text-amber-900 text-[11px] underline" data-testid={`restore-${it.id}`}>ripristina</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: "Outfit" }}>Optional</h2>
                <p className="text-sm text-zinc-600 mb-6">Aggiunte non incluse nel pacchetto. Prezzi scontati applicando il pacchetto. La quantità è sempre modificabile.</p>
                <div className="space-y-3">
                  {optFiltered.map((o) => {
                    const selected = prev.optional.find((x) => x.id === o.id);
                    const qty = selected?.qty ?? 0;
                    const unitPriceScontato = o.per_m2 ? (o.unit_price_scontato || 0) : (o.price_scontato || 0);
                    const total = selected ? (qty * unitPriceScontato) : 0;
                    return (
                      <div key={o.id} className={`border p-4 flex items-start gap-4 ${selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`} data-testid={`optional-${o.id}`}>
                        <Switch
                          checked={!!selected}
                          onCheckedChange={(v) => {
                            if (v) {
                              const defaultQty = o.per_m2 ? prev.mq : 1;
                              const t = defaultQty * unitPriceScontato;
                              setPrev((s) => ({ ...s, optional: [...s.optional, { id: o.id, name: o.name, qty: defaultQty, unit_price: unitPriceScontato, total: t, per_m2: o.per_m2, unit: o.unit || (o.per_m2 ? "m²" : "pz"), descrizione: o.descrizione || o.description || "" }] }));
                            } else {
                              setPrev((s) => ({ ...s, optional: s.optional.filter((x) => x.id !== o.id) }));
                            }
                          }}
                          data-testid={`optional-switch-${o.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{o.name}</div>
                          <div className="mono text-xs text-zinc-500 mt-1">
                            Listino {fmtEuro(o.price_listino)} · Pacchetto {fmtEuro(o.price_scontato)}
                            {o.per_m2 && <> · {fmtEuro(o.unit_price_scontato)}/m²</>}
                            {!o.per_m2 && <> · {fmtEuro(o.price_scontato)}/{o.unit || "pz"}</>}
                          </div>
                        </div>
                        {selected && (
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Qty</Label>
                            <Input
                              type="number" min={0} step={o.per_m2 ? "0.5" : "1"}
                              value={qty}
                              onChange={(e) => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                const t = v * unitPriceScontato;
                                setPrev((s) => ({ ...s, optional: s.optional.map((x) => x.id === o.id ? { ...x, qty: v, total: t } : x) }));
                              }}
                              className="rounded-sm h-9 text-right mono w-24"
                              data-testid={`optional-qty-${o.id}`}
                            />
                            <span className="text-xs text-zinc-500 mono">{o.unit || (o.per_m2 ? "m²" : "pz")}</span>
                          </div>
                        )}
                        <div className="mono text-right font-medium min-w-[110px]">
                          {selected ? fmtEuro(total) : <span className="text-zinc-400">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: "Outfit" }}>Configurazione bagni</h2>
                <p className="text-sm text-zinc-600 mb-4">
                  Il pacchetto <strong>{pkg?.name || ""}</strong> include <strong>1 bagno SILVER</strong>.
                  Puoi <strong>cambiare il livello</strong> di quel bagno (paghi solo la differenza) o <strong>aggiungere altri bagni</strong> (paghi il prezzo intero del livello scelto).
                </p>

                {/* Inizializza primo bagno (incluso) se la lista è vuota — handled by useEffect below */}

                <div className="space-y-3" data-testid="bathrooms-list">
                  {(prev.bathrooms || []).map((b, idx) => {
                    const silverBase = bathroomTiers[0]?.price || 0;
                    const currentTier = bathroomTiers.find((t) => t.id === b.tier_id);
                    const cost = b.included
                      ? Math.max(0, (currentTier?.price || 0) - silverBase)
                      : (currentTier?.price || 0);
                    return (
                      <div key={b.id} className="border-2 border-zinc-200 p-4 bg-white" data-testid={`bath-row-${idx}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-lg font-semibold" style={{ fontFamily: "Outfit" }}>Bagno #{idx + 1}</div>
                              {b.included ? (
                                <span className="text-[10px] mono uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">incluso nel pacchetto</span>
                              ) : (
                                <span className="text-[10px] mono uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-0.5 rounded">bagno extra</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {b.included
                                ? "Paghi solo la differenza rispetto al SILVER incluso."
                                : "Paghi il prezzo intero del livello scelto (bagno aggiuntivo completo)."}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="mono text-2xl font-bold" style={{ color: currentTier?.color || "#0F172A" }}>
                              {cost > 0 ? `+ ${fmtEuro(cost)}` : "incluso"}
                            </div>
                            {!b.included && (
                              <button
                                onClick={() => setPrev((s) => ({ ...s, bathrooms: s.bathrooms.filter((x) => x.id !== b.id) }))}
                                className="text-xs text-rose-600 hover:text-rose-800 underline mt-1"
                                data-testid={`bath-remove-${idx}`}
                              >Rimuovi bagno</button>
                            )}
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-2">
                          {bathroomTiers.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setPrev((s) => ({ ...s, bathrooms: s.bathrooms.map((x) => x.id === b.id ? { ...x, tier_id: t.id } : x) }))}
                              className={`text-left border-2 p-3 transition-all hover:-translate-y-0.5 ${b.tier_id === t.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}
                              data-testid={`bath-${idx}-tier-${t.id}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-base font-semibold" style={{ fontFamily: "Outfit", color: t.color }}>{t.name}</span>
                                {b.tier_id === t.id && <Check size={14} className="text-zinc-900" />}
                              </div>
                              <div className="text-[11px] text-zinc-600 leading-snug">{t.description}</div>
                              <div className="mt-2 mono text-[11px] text-zinc-500">
                                {b.included
                                  ? (t.id === bathroomTiers[0]?.id ? "incluso" : `+ ${fmtEuro((t.price || 0) - silverBase)} (upgrade)`)
                                  : `${fmtEuro(t.price || 0)} (intero)`
                                }
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  className="rounded-sm mt-4 h-10"
                  onClick={() => setPrev((s) => ({
                    ...s,
                    bathrooms: [...(s.bathrooms || []), { id: `bath-${Date.now()}`, tier_id: bathroomTiers[0]?.id, included: false }]
                  }))}
                  disabled={bathroomTiers.length === 0}
                  data-testid="add-bathroom-btn"
                >+ Aggiungi un altro bagno</Button>

                {/* Sintesi finale costi bagni */}
                <div className="mt-6 bg-zinc-50 border border-zinc-200 p-4">
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Sintesi bagni</div>
                  <div className="space-y-1.5 text-sm">
                    {(prev.bathrooms || []).map((b, i) => {
                      const silverBase = bathroomTiers[0]?.price || 0;
                      const t = bathroomTiers.find((x) => x.id === b.tier_id);
                      const cost = b.included ? Math.max(0, (t?.price || 0) - silverBase) : (t?.price || 0);
                      return (
                        <div key={b.id} className="flex justify-between">
                          <span>Bagno #{i + 1} · {t?.name || "—"} {b.included ? "(incluso)" : "(extra)"}</span>
                          <span className="mono">{cost > 0 ? `+ ${fmtEuro(cost)}` : "incluso"}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-2 mt-2 border-t border-zinc-300 font-semibold">
                      <span>Totale aggiunte bagni</span>
                      <span className="mono" data-testid="bagni-total">{fmtEuro(totals.bagno)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "Outfit" }}>Dati cliente</h2>
                <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                  <div>
                    <Label className="label-kicker">Nome *</Label>
                    <Input value={prev.cliente?.nome || ""} onChange={(e) => setPrev((s) => ({ ...s, cliente: { ...s.cliente, nome: e.target.value } }))} className="rounded-sm h-10 mt-1" data-testid="cliente-nome" />
                  </div>
                  <div>
                    <Label className="label-kicker">Cognome *</Label>
                    <Input value={prev.cliente?.cognome || ""} onChange={(e) => setPrev((s) => ({ ...s, cliente: { ...s.cliente, cognome: e.target.value } }))} className="rounded-sm h-10 mt-1" data-testid="cliente-cognome" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="label-kicker">Indirizzo cantiere</Label>
                    <Input value={prev.cliente?.indirizzo || ""} onChange={(e) => setPrev((s) => ({ ...s, cliente: { ...s.cliente, indirizzo: e.target.value } }))} className="rounded-sm h-10 mt-1" />
                  </div>
                  <div>
                    <Label className="label-kicker">Email</Label>
                    <Input type="email" value={prev.cliente?.email || ""} onChange={(e) => setPrev((s) => ({ ...s, cliente: { ...s.cliente, email: e.target.value } }))} className="rounded-sm h-10 mt-1" />
                  </div>
                  <div>
                    <Label className="label-kicker">Telefono</Label>
                    <Input value={prev.cliente?.telefono || ""} onChange={(e) => setPrev((s) => ({ ...s, cliente: { ...s.cliente, telefono: e.target.value } }))} className="rounded-sm h-10 mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="label-kicker">Note</Label>
                    <Textarea value={prev.note || ""} onChange={(e) => setPrev((s) => ({ ...s, note: e.target.value }))} rows={4} className="rounded-sm mt-1" />
                  </div>
                  <div>
                    <Label className="label-kicker">Sconto %</Label>
                    <Input type="number" min={0} max={100} step="0.5" value={prev.sconto_pct} onChange={(e) => setPrev((s) => ({ ...s, sconto_pct: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))} className="rounded-sm h-10 mt-1 mono" />
                  </div>
                  <div>
                    <Label className="label-kicker">IVA %</Label>
                    <Input type="number" min={0} max={100} step="0.5" value={prev.iva_pct} onChange={(e) => setPrev((s) => ({ ...s, iva_pct: Math.max(0, Math.min(100, parseFloat(e.target.value) || 10)) }))} className="rounded-sm h-10 mt-1 mono" />
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "Outfit" }}>Riepilogo preventivo</h2>
                {((prev.items || []).some((it) => it.from_configuratore) || /Configuratore/i.test(prev.note || "")) && pkg && (
                  <div className="bg-amber-50 border border-amber-300 px-4 py-3 mb-4 flex items-center gap-3" data-testid="conforme-badge">
                    <Sparkles size={16} className="text-amber-700 flex-shrink-0" />
                    <div className="text-sm text-amber-900">
                      <strong>Conforme al pacchetto {pkg.name}</strong> scelto in fase di consulenza (Configuratore Esigenze)
                    </div>
                  </div>
                )}
                <div className="border border-zinc-200 p-6 space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                    <div>
                      <div className="mono text-xs text-zinc-500">{numero || "—"}</div>
                      <div className="text-xl font-medium" style={{ fontFamily: "Outfit" }}>{(prev.cliente?.nome || "") + " " + (prev.cliente?.cognome || "")}</div>
                      <div className="text-sm text-zinc-500">{prev.cliente?.indirizzo}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-xs text-zinc-500">Pacchetto</div>
                      <div className="text-xl font-semibold" style={{ fontFamily: "Outfit", color: pkg?.color }}>{pkg?.name}</div>
                      <div className="mono text-xs text-zinc-500">{prev.mq} m² · {fmtNum(pkg?.price_per_m2 || 0, 0)} €/m²</div>
                    </div>
                  </div>
                  <Row label="Base pacchetto" value={fmtEuro(totals.base)} />
                  {totals.extras > 0 && <Row label="Extra lavorazioni" value={fmtEuro(totals.extras)} />}
                  {totals.optional > 0 && <Row label="Optional" value={fmtEuro(totals.optional)} />}
                  {totals.bagno > 0 && <Row label={`Bagni aggiuntivi (${(prev.bathrooms || []).length || 1})`} value={fmtEuro(totals.bagno)} />}
                  {/* DETTAGLIO BAGNI MULTIPLI */}
                  {(prev.bathrooms || []).length > 0 && (
                    <div className="pt-2" data-testid="riepilogo-bagni">
                      <div className="label-kicker mb-2">Configurazione bagni</div>
                      <ul className="text-sm space-y-1.5">
                        {(prev.bathrooms || []).map((b, i) => {
                          const silverBase = bathroomTiers[0]?.price || 0;
                          const t = bathroomTiers.find((x) => x.id === b.tier_id);
                          const cost = b.included ? Math.max(0, (t?.price || 0) - silverBase) : (t?.price || 0);
                          return (
                            <li key={b.id} className="flex justify-between border-b border-zinc-100 pb-1">
                              <span>
                                <strong>Bagno #{i + 1}</strong> · {t?.name || "—"}
                                <span className="text-zinc-500 text-xs ml-1">{b.included ? "(incluso, paga differenza)" : "(extra completo)"}</span>
                                {t?.description && <div className="text-[11px] text-zinc-500">{t.description}</div>}
                              </span>
                              <span className="mono font-semibold">{cost > 0 ? fmtEuro(cost) : <span className="text-zinc-400">incluso</span>}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {/* DETTAGLIO OPTIONAL SELEZIONATI — usa prev.optional (lista reale) */}
                  {(prev.optional || []).length > 0 && (
                    <div className="pt-2" data-testid="riepilogo-optional">
                      <div className="label-kicker mb-2">Optional selezionati</div>
                      <ul className="text-sm space-y-1.5">
                        {(prev.optional || []).map((o) => (
                          <li key={o.id} className="flex justify-between border-b border-zinc-100 pb-1">
                            <span>
                              <strong>{o.name}</strong>
                              {o.qty != null && o.qty > 0 && <span className="text-zinc-500"> · {fmtNum(o.qty, 2)} {o.unit || ""}</span>}
                              {o.descrizione && <div className="text-xs text-zinc-500">{o.descrizione}</div>}
                            </span>
                            <span className="mono font-semibold">{fmtEuro(o.total || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* DETTAGLIO VOCI: solo per preventivi a pacchetto NASCONDIAMO i prezzi unitari (è forfettario) */}
                  {(prev.items || []).filter(it => (it.qty || it.qty_richiesta) > 0).length > 0 && (
                    <div className="pt-2" data-testid="riepilogo-voci-table">
                      <div className="label-kicker mb-2">Lavorazioni incluse</div>
                      <p className="text-[10px] text-zinc-500 mb-2">Il prezzo del pacchetto è <strong>forfettario</strong> · queste sono le lavorazioni eseguite.</p>
                      <table className="w-full text-sm">
                        <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-200"><tr>
                          <th className="py-1.5 text-left">Lavorazione</th>
                          <th className="py-1.5 text-right w-20">Qty</th>
                          <th className="py-1.5 text-left w-16">U.M.</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-100">
                          {(prev.items || []).filter(it => (it.qty || it.qty_richiesta) > 0).map((it, i) => (
                            <tr key={i} className={it.from_configuratore ? "bg-amber-50/40" : (it.is_extra_libero ? "bg-blue-50/30" : "")}>
                              <td className="py-1.5">
                                <div className="font-medium">{it.name}{it.is_extra_libero && <span className="ml-2 text-[9px] uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">extra libero</span>}</div>
                                {it.category && <div className="text-[10px] uppercase text-zinc-500">{it.category}</div>}
                              </td>
                              <td className="py-1.5 text-right mono">{fmtNum(it.qty || it.qty_richiesta || 0, 2)}</td>
                              <td className="py-1.5 text-xs">{it.unit || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Separator />
                  <Row label="Subtotale" value={fmtEuro(totals.subtotal)} bold />
                  {totals.sconto > 0 && <Row label={`Sconto ${prev.sconto_pct}%`} value={`- ${fmtEuro(totals.sconto)}`} />}
                  <Row label={`IVA ${prev.iva_pct}%`} value={fmtEuro(totals.iva)} />
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <div className="label-kicker">Totale finale</div>
                    <div className="mono text-4xl font-semibold" data-testid="preventivo-total">{fmtEuro(totals.total)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right sticky summary */}
          <aside className="border border-zinc-200 p-5 h-fit sticky top-6">
            <div className="label-kicker mb-3">Totale preventivo</div>
            <div className="mono text-3xl font-semibold mb-4" data-testid="sidebar-total">{fmtEuro(totals.total)}</div>
            <div className="space-y-1.5 mono text-xs text-zinc-600 mb-5">
              <div className="flex justify-between"><span>Base</span><span>{fmtEuro(totals.base)}</span></div>
              <div className="flex justify-between"><span>Extra</span><span>{fmtEuro(totals.extras)}</span></div>
              <div className="flex justify-between"><span>Optional</span><span>{fmtEuro(totals.optional)}</span></div>
              {totals.bagno > 0 && <div className="flex justify-between"><span>Bagno</span><span>{fmtEuro(totals.bagno)}</span></div>}
              <div className="flex justify-between"><span>IVA</span><span>{fmtEuro(totals.iva)}</span></div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Button variant="outline" className="rounded-sm flex-1 h-9" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} data-testid="prev-step">
                <ChevronLeft size={14} /> Indietro
              </Button>
              <Button className="rounded-sm flex-1 h-9 bg-zinc-900 hover:bg-zinc-800" onClick={() => setStep((s) => Math.min(6, s + 1))} disabled={!canNext() || step === 6} data-testid="next-step">
                Avanti <ChevronRight size={14} />
              </Button>
            </div>
            <Button className="rounded-sm w-full h-10 bg-zinc-900 hover:bg-zinc-800" onClick={save} disabled={saving} data-testid="finalize-button">
              <Save size={14} className="mr-2" /> {saving ? "Salvo…" : "Salva preventivo"}
            </Button>
          </aside>
        </div>
      </main>
      <InfissoQuickConfigurator open={infissiModalOpen} onClose={() => setInfissiModalOpen(false)} onConfirm={onInfissiConfirm} />
      {/* Modal extra libero — qualsiasi voce extra con tutti i campi editabili */}
      <Dialog open={extraFreeOpen} onOpenChange={setExtraFreeOpen}>
        <DialogContent className="max-w-md" data-testid="extra-free-dialog">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">Aggiungi voce extra libera</h3>
              <p className="text-xs text-zinc-500 mt-1">Aggiungi una qualsiasi lavorazione, materiale o servizio fuori pacchetto. Tutti i campi sono modificabili.</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Descrizione</Label>
              <Input value={extraFreeForm.name} onChange={(e) => setExtraFreeForm(s => ({ ...s, name: e.target.value }))} placeholder="es. Carta da parati salone" className="mt-1" data-testid="extra-free-name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Categoria</Label>
                <Select value={extraFreeForm.category} onValueChange={(v) => setExtraFreeForm(s => ({ ...s, category: v }))}>
                  <SelectTrigger className="mt-1" data-testid="extra-free-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEMOLIZIONI">Demolizioni</SelectItem>
                    <SelectItem value="MURATURA">Muratura</SelectItem>
                    <SelectItem value="IMPIANTI">Impianti</SelectItem>
                    <SelectItem value="INFISSI">Infissi</SelectItem>
                    <SelectItem value="SERVIZI">Servizi</SelectItem>
                    <SelectItem value="EXTRA">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">U.M.</Label>
                <Input value={extraFreeForm.unit} onChange={(e) => setExtraFreeForm(s => ({ ...s, unit: e.target.value }))} placeholder="pz, m², ml" className="mt-1" data-testid="extra-free-unit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Quantità</Label>
                <Input type="number" min={0} step="0.01" value={extraFreeForm.qty} onChange={(e) => setExtraFreeForm(s => ({ ...s, qty: parseFloat(e.target.value) || 0 }))} className="mt-1 mono" data-testid="extra-free-qty" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">€ / unità</Label>
                <Input type="number" min={0} step="0.01" value={extraFreeForm.unit_price} onChange={(e) => setExtraFreeForm(s => ({ ...s, unit_price: parseFloat(e.target.value) || 0 }))} className="mt-1 mono" data-testid="extra-free-price" />
              </div>
            </div>
            <div className="text-sm mono text-right text-zinc-700">Totale: <strong>{fmtEuro((extraFreeForm.qty || 0) * (extraFreeForm.unit_price || 0))}</strong></div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Note (facoltative)</Label>
              <Input value={extraFreeForm.note} onChange={(e) => setExtraFreeForm(s => ({ ...s, note: e.target.value }))} className="mt-1 text-xs" data-testid="extra-free-note" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
              <Button variant="outline" size="sm" onClick={() => setExtraFreeOpen(false)}>Annulla</Button>
              <Button size="sm" disabled={!extraFreeForm.name || extraFreeForm.qty <= 0} onClick={() => {
                const newItem = {
                  id: `extra-${Date.now()}`,
                  voce_id: null,
                  name: extraFreeForm.name,
                  category: extraFreeForm.category,
                  unit: extraFreeForm.unit || "pz",
                  included_qty: 0,
                  qty_richiesta: extraFreeForm.qty,
                  unit_price: extraFreeForm.unit_price,
                  unit_price_pkg: 0,
                  modificabile_dal_venditore: true,
                  excluded: false,
                  is_extra_libero: true,
                  note: extraFreeForm.note,
                };
                setPrev(s => ({ ...s, items: [...s.items, newItem] }));
                setExtraFreeForm({ name: "", category: "EXTRA", unit: "pz", qty: 1, unit_price: 0, note: "" });
                setExtraFreeOpen(false);
              }} style={{ background: "var(--brand)", color: "white" }} data-testid="extra-free-save">Aggiungi al preventivo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div className="flex items-baseline justify-between">
      <div className={`${bold ? "font-medium" : "text-zinc-600"} text-sm`}>{label}</div>
      <div className={`mono ${bold ? "font-semibold" : ""}`}>{value}</div>
    </div>
  );
}

function exportPDF(prev, pkg, totals, numero) {
  if (!pkg) { toast.error("Seleziona un pacchetto"); return; }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("Preventivo Ristrutturazione", 18, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`${numero || ""} · ${new Date().toLocaleDateString("it-IT")}`, 18, y); y += 8;
  doc.setTextColor(0); doc.setLineWidth(0.3); doc.line(18, y, W - 18, y); y += 6;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Cliente: ${prev.cliente?.nome || ""} ${prev.cliente?.cognome || ""}`, 18, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
  if (prev.cliente?.indirizzo) { doc.text(prev.cliente.indirizzo, 18, y); y += 4; }
  if (prev.cliente?.email) { doc.text(prev.cliente.email, 18, y); y += 4; }
  doc.setTextColor(0);
  y += 4;

  // Badge "Conforme al pacchetto X scelto in fase di consulenza" (se origina dal configuratore)
  const fromConfiguratore = (prev.items || []).some((it) => it.from_configuratore) || /Configuratore/i.test(prev.note || "");
  if (fromConfiguratore && pkg) {
    doc.setFillColor(254, 243, 199); // amber-50
    doc.setDrawColor(217, 119, 6); // amber-600
    doc.setLineWidth(0.4);
    doc.rect(18, y, W - 36, 10, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(146, 64, 14); // amber-800
    doc.text(`Conforme al pacchetto ${pkg.name} scelto in fase di consulenza (Configuratore Esigenze)`, 22, y + 6.5);
    doc.setTextColor(0);
    y += 14;
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(`Pacchetto ${pkg.name}`, 18, y);
  doc.text(`${prev.mq} m² × ${fmtNum(pkg.price_per_m2, 0)} €/m²`, W - 18, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.setFillColor(244, 244, 245); doc.rect(18, y - 4, W - 36, 6, "F");
  doc.text("Descrizione", 20, y);
  doc.text("Q.ta", 110, y, { align: "right" });
  doc.text("€ unit.", 140, y, { align: "right" });
  doc.text("Totale", W - 20, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  // Base
  doc.text("Base pacchetto", 20, y);
  doc.text(`${prev.mq}`, 110, y, { align: "right" });
  doc.text(`${fmtNum(pkg.price_per_m2, 0)} €`, 140, y, { align: "right" });
  doc.text(fmtEuro(totals.base), W - 20, y, { align: "right" });
  y += 5;

  // Extras (allineato alla regola: extra solo se qty > incluse oppure incluse===0)
  (prev.items || []).forEach((it) => {
    if (it.excluded) return;
    const incl = it.included_qty || 0;
    const reqs = Math.max(0, it.qty_richiesta || 0);
    const extra = incl === 0 ? reqs : Math.max(0, reqs - incl);
    if (extra <= 0) return;
    const cost = extra * (Math.max(0, it.unit_price || 0));
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`Extra ${it.name}`, 20, y);
    doc.text(fmtNum(extra, 2), 110, y, { align: "right" });
    doc.text(fmtEuro(it.unit_price), 140, y, { align: "right" });
    doc.text(fmtEuro(cost), W - 20, y, { align: "right" });
    y += 5;
  });
  // Optional
  (prev.optional || []).forEach((o) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(o.name, 20, y);
    doc.text(`${fmtNum(o.qty || 1, 2)} ${o.unit || ""}`, 110, y, { align: "right" });
    if (o.unit_price) doc.text(fmtEuro(o.unit_price), 140, y, { align: "right" });
    doc.text(fmtEuro(o.total || 0), W - 20, y, { align: "right" });
    y += 5;
  });
  // Bagni multipli
  const silverBasePDF = 0; // Non disponibile qui senza tiers; usiamo total da prev.bathrooms.cost
  if ((prev.bathrooms || []).length > 0) {
    (prev.bathrooms || []).forEach((b, i) => {
      if (y > 275) { doc.addPage(); y = 20; }
      const label = `Bagno #${i + 1} · ${b.tier_id || ""} ${b.included ? "(incluso · paga differenza)" : "(extra completo)"}`;
      // Recupera costo dal computo principale (totals.bagno) non disponibile per voce — passiamo solo etichetta
      doc.text(label, 20, y);
      y += 5;
    });
    if (totals.bagno > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Totale bagni aggiuntivi", 140, y, { align: "right" });
      doc.text(fmtEuro(totals.bagno), W - 20, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;
    }
  } else if (totals.bagno > 0) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`Bagno ${prev.bathroom_tier || ""}`, 20, y);
    doc.text(fmtEuro(totals.bagno), W - 20, y, { align: "right" });
    y += 5;
  }

  y += 4;
  doc.line(18, y, W - 18, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Subtotale", 140, y, { align: "right" });
  doc.text(fmtEuro(totals.subtotal), W - 20, y, { align: "right" }); y += 5;
  if (totals.sconto > 0) {
    doc.text(`Sconto ${prev.sconto_pct}%`, 140, y, { align: "right" });
    doc.text(`- ${fmtEuro(totals.sconto)}`, W - 20, y, { align: "right" }); y += 5;
  }
  doc.text(`IVA ${prev.iva_pct}%`, 140, y, { align: "right" });
  doc.text(fmtEuro(totals.iva), W - 20, y, { align: "right" }); y += 6;

  doc.line(18, y, W - 18, y); y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("TOTALE", 20, y);
  doc.text(fmtEuro(totals.total), W - 20, y, { align: "right" });

  if (prev.note) {
    y += 15;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Note:", 18, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const lines = doc.splitTextToSize(prev.note, W - 36);
    doc.text(lines, 18, y);
  }

  doc.save(`${numero || "preventivo"}.pdf`);
}
