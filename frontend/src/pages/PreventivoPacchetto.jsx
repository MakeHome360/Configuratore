import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
    optional: [],    // [{id, name, qty, total}]
    bathroom_tier: null,
    bathroom_surcharge: 0,
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
        setPackages(pk.data); setOptionals(op.data); setBathroomTiers(bt.data);
        if (!isNew) {
          const { data } = await api.get(`/preventivi/${id}`);
          setPrev({
            package_id: data.package_id, mq: data.mq,
            items: data.items || [], optional: data.optional || [],
            bathroom_tier: data.bathroom_tier,
            bathroom_surcharge: data.bathroom_tier ? (((bt.data.find((t) => t.id === data.bathroom_tier)?.price || 0) - (bt.data[0]?.price || 0)) || 0) : 0,
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
      } catch { toast.error("Errore caricamento"); }
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
          unit_price: it.prezzo_rivendita || 0,
          included_qty: parseFloat(included.toFixed(2)),
          qty_richiesta: existing ? existing.qty_richiesta : parseFloat(included.toFixed(2)),
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

  const pkg = packages.find((p) => p.id === prev.package_id);

  const totals = useMemo(() => {
    if (!pkg) return { base: 0, extras: 0, optional: 0, bagno: 0, subtotal: 0, sconto: 0, iva: 0, total: 0 };
    const base = pkg.price_per_m2 * (prev.mq || 0);
    const extras = (prev.items || []).reduce((s, it) => {
      const extra = Math.max(0, (it.qty_richiesta || 0) - (it.included_qty || 0));
      return s + extra * (it.unit_price || 0);
    }, 0);
    const optional = (prev.optional || []).reduce((s, o) => s + (o.total || 0), 0);
    const bagno = prev.bathroom_surcharge || 0;
    const subtotal = base + extras + optional + bagno;
    const sconto = subtotal * (prev.sconto_pct || 0) / 100;
    const afterDisc = subtotal - sconto;
    const iva = afterDisc * (prev.iva_pct || 10) / 100;
    const total = afterDisc + iva;
    return { base, extras, optional, bagno, subtotal, sconto, iva, total };
  }, [prev, pkg]);

  const save = async () => {
    setSaving(true);
    const payload = {
      tipo: "pacchetto",
      cliente: prev.cliente,
      package_id: prev.package_id,
      mq: prev.mq,
      items: prev.items,
      optional: prev.optional,
      bathroom_tier: prev.bathroom_tier,
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
                    value={prev.mq}
                    onChange={(e) => setPrev((s) => ({ ...s, mq: parseFloat(e.target.value) || 0 }))}
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
                      <div className="mono text-2xl font-bold text-amber-900" data-testid="pacchetto-extras-tot">{fmtEuro(totals?.extra || 0)}</div>
                      <div className="text-[11px] mono text-amber-700">solo le voci aggiuntive</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-700">Totale subtotale</div>
                      <div className="mono text-2xl font-bold text-zinc-900">{fmtEuro((pkg.price_per_m2 * prev.mq) + (totals?.extra || 0) + (totals?.optional || 0))}</div>
                      <div className="text-[11px] mono text-zinc-500">IVA esclusa, prima sconto</div>
                    </div>
                  </div>
                )}
                <p className="text-sm text-zinc-600 mb-4">Tutto questo è già <strong>incluso nel prezzo a m² del pacchetto {pkg?.name}</strong>. Se il cliente vuole una quantità superiore a quella inclusa, paga solo la differenza al prezzo del backoffice.</p>
                <div className="flex justify-end mb-3">
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
                  const colorMap = { DEMOLIZIONI: "#DC2626", MURATURA: "#0F766E", IMPIANTI: "#2563EB", INFISSI: "#9333EA", SERVIZI: "#B45309", EXTRA: "#EA580C" };
                  const catLabel = cat === "EXTRA" ? "EXTRA · Configuratore Esigenze" : cat;
                  return (
                    <div key={cat} className="mb-6">
                      <div className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: colorMap[cat] }}>{catLabel}</div>
                      <table className="w-full text-sm border border-zinc-200">
                        <thead className="bg-zinc-50 text-xs uppercase tracking-widest text-zinc-500">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium">Lavorazione</th>
                            <th className="text-right py-2 px-3 font-medium w-20">U.M.</th>
                            <th className="text-right py-2 px-3 font-medium w-28">Incluse</th>
                            <th className="text-right py-2 px-3 font-medium w-28">Richieste</th>
                            <th className="text-right py-2 px-3 font-medium w-32">Extra a pagamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((it) => {
                            const extra = Math.max(0, (it.qty_richiesta || 0) - (it.included_qty || 0));
                            const extraCost = extra * (it.unit_price || 0);
                            return (
                              <tr key={it.id} className="border-t border-zinc-100" data-testid={`lav-row-${it.id}`}>
                                <td className="py-2 px-3">{it.name}</td>
                                <td className="py-2 px-3 text-right mono text-xs text-zinc-500">{it.unit}</td>
                                <td className="py-2 px-3 text-right mono text-zinc-500">{fmtNum(it.included_qty, 2)}</td>
                                <td className="py-2 px-3 text-right">
                                  <Input type="number" value={it.qty_richiesta}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value) || 0;
                                      setPrev((s) => ({ ...s, items: s.items.map((x) => x.id === it.id ? { ...x, qty_richiesta: v } : x) }));
                                    }}
                                    className="rounded-sm h-7 text-right mono text-xs w-20 ml-auto"
                                    data-testid={`lav-qty-${it.id}`}
                                  />
                                </td>
                                <td className={`py-2 px-3 text-right mono text-xs ${extraCost > 0 ? "text-orange-600 font-semibold" : "text-zinc-400"}`}>
                                  {extraCost > 0 ? <>+{fmtNum(extra, 2)} × {fmtEuro(it.unit_price)} = <strong>{fmtEuro(extraCost)}</strong></> : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: "Outfit" }}>Optional</h2>
                <p className="text-sm text-zinc-600 mb-6">Aggiunte non incluse nel pacchetto. Prezzi scontati applicando il pacchetto.</p>
                <div className="space-y-3">
                  {optFiltered.map((o) => {
                    const selected = prev.optional.find((x) => x.id === o.id);
                    const qty = selected?.qty ?? 0;
                    const unitPrice = o.per_m2 ? (o.unit_price_scontato || o.price_scontato) : o.price_scontato;
                    const total = o.per_m2 ? qty * (o.unit_price_scontato || 0) : (qty ? o.price_scontato : 0);
                    return (
                      <div key={o.id} className={`border p-4 flex items-start gap-4 ${selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`} data-testid={`optional-${o.id}`}>
                        <Switch
                          checked={!!selected}
                          onCheckedChange={(v) => {
                            if (v) {
                              const defaultQty = o.per_m2 ? prev.mq : 1;
                              const t = o.per_m2 ? defaultQty * (o.unit_price_scontato || 0) : o.price_scontato;
                              setPrev((s) => ({ ...s, optional: [...s.optional, { id: o.id, name: o.name, qty: defaultQty, total: t, per_m2: o.per_m2 }] }));
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
                          </div>
                        </div>
                        {selected && o.per_m2 && (
                          <Input type="number" value={qty}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              const t = v * (o.unit_price_scontato || 0);
                              setPrev((s) => ({ ...s, optional: s.optional.map((x) => x.id === o.id ? { ...x, qty: v, total: t } : x) }));
                            }}
                            className="rounded-sm h-9 text-right mono w-24"
                          />
                        )}
                        <div className="mono text-right font-medium min-w-[100px]">
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
                <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: "Outfit" }}>Configurazione bagno</h2>
                <p className="text-sm text-zinc-600 mb-6">Scegli il livello di finitura del bagno principale.</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  {bathroomTiers.map((t, idx) => {
                    const silverPrice = bathroomTiers[0]?.price || 0;
                    const surcharge = (t.price || 0) - silverPrice;
                    return (
                    <button key={t.id}
                      onClick={() => setPrev((s) => ({ ...s, bathroom_tier: s.bathroom_tier === t.id ? null : t.id, bathroom_surcharge: s.bathroom_tier === t.id ? 0 : surcharge }))}
                      className={`text-left border p-5 transition-all hover:-translate-y-0.5 ${prev.bathroom_tier === t.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}
                      data-testid={`bagno-${t.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl font-semibold" style={{ fontFamily: "Outfit", color: t.color }}>{t.name}</span>
                        {surcharge > 0 && <div className="mono text-xs text-orange-600">+{fmtEuro(surcharge)}</div>}
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">{t.description}</p>
                      {prev.bathroom_tier === t.id && <div className="mt-3 text-xs text-zinc-900 mono flex items-center gap-1"><Check size={12} /> selezionato</div>}
                    </button>
                    );
                  })}
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
                    <Input type="number" value={prev.sconto_pct} onChange={(e) => setPrev((s) => ({ ...s, sconto_pct: parseFloat(e.target.value) || 0 }))} className="rounded-sm h-10 mt-1 mono" />
                  </div>
                  <div>
                    <Label className="label-kicker">IVA %</Label>
                    <Input type="number" value={prev.iva_pct} onChange={(e) => setPrev((s) => ({ ...s, iva_pct: parseFloat(e.target.value) || 10 }))} className="rounded-sm h-10 mt-1 mono" />
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
                  {totals.bagno > 0 && <Row label={`Bagno ${bathroomTiers.find(t => t.id === prev.bathroom_tier)?.name || ""}`} value={fmtEuro(totals.bagno)} />}
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

  // Extras
  (prev.items || []).forEach((it) => {
    const extra = Math.max(0, (it.qty_richiesta || 0) - (it.included_qty || 0));
    if (extra <= 0) return;
    const cost = extra * (it.unit_price || 0);
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
    doc.text(`${o.qty || 1}`, 110, y, { align: "right" });
    doc.text("", 140, y);
    doc.text(fmtEuro(o.total), W - 20, y, { align: "right" });
    y += 5;
  });
  if (totals.bagno > 0) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`Bagno ${prev.bathroom_tier}`, 20, y);
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
