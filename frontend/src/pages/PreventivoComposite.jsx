import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { InfissoQuickConfigurator } from "@/components/InfissoQuickConfigurator";

export default function PreventivoComposite() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const [sections, setSections] = useState([]);
  const [cliente, setCliente] = useState({ nome: "", telefono: "", email: "", indirizzo: "" });
  const [mq, setMq] = useState(0);
  const [selections, setSelections] = useState({}); // voceId -> { qty }
  const [sicurezzaPct, setSicurezzaPct] = useState(3);
  const [direzionePct, setDirezionePct] = useState(5);
  const [sconto, setSconto] = useState(0);
  const [ivaPct, setIvaPct] = useState(10);
  const [note, setNote] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const [infissiExtras, setInfissiExtras] = useState([]); // [{id,name,qty,unit,price,unit_price,infisso_meta}]
  const [infissiModalOpen, setInfissiModalOpen] = useState(false);

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
        setSconto(d.sconto_eur || 0); setIvaPct(d.iva_pct || 10);
        setSicurezzaPct(d.sicurezza_pct ?? 3); setDirezionePct(d.direzione_lavori_pct ?? 5);
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
        if (sel && sel.qty > 0) total += (sel.qty || 0) * v.price;
      });
    });
    return total;
  }, [sections, selections]);

  const sicurezzaAmt = totaleVoci * (sicurezzaPct / 100);
  const direzioneAmt = totaleVoci * (direzionePct / 100);
  const imponibile = totaleVoci + infissiTot + sicurezzaAmt + direzioneAmt - (sconto || 0);
  const iva = imponibile * (ivaPct / 100);
  const totale = imponibile + iva;

  const save = async () => {
    if (!cliente.nome) return toast.error("Inserisci nome cliente");
    const comp = [];
    sections.forEach((s) => s.voci.forEach((v) => {
      const sel = selections[v.id];
      if (sel && sel.qty > 0) comp.push({ section_id: s.id, voce_id: v.id, name: v.name, unit: v.unit, price: v.price, qty: sel.qty });
    }));
    const payload = {
      tipo: "composite", cliente, mq, composite_selections: comp,
      infissi_extras: infissiExtras,
      sicurezza_pct: sicurezzaPct, direzione_lavori_pct: direzionePct,
      sconto_eur: sconto, iva_pct: ivaPct, note,
      totale_iva_incl: totale, totale_iva_escl: imponibile,
    };
    try {
      if (isNew) {
        const { data } = await api.post("/preventivi", payload);
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
          <div><div className="text-[10px] uppercase text-zinc-500">MQ</div><Input type="number" className="w-20 h-8" value={mq} onChange={(e) => setMq(Number(e.target.value))} /></div>
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
              </div>
            )}
          </div>

          <div className="lg:col-span-3 bg-white border border-zinc-200 rounded-lg p-5">
            {activeSection === "__infissi__" ? (
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
                    <tr><th className="px-3 py-2 text-left">Descrizione</th><th className="px-3 py-2 text-right">Prezzo</th><th className="px-3 py-2 text-center">Sel.</th><th className="px-3 py-2 text-center">Qtà</th><th className="px-3 py-2 text-right">Totale</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sec.voci.map((v) => {
                      const sel = selections[v.id];
                      return (
                        <tr key={v.id}>
                          <td className="px-3 py-2">{v.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtEur(v.price)} /{v.unit}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={!!sel} onChange={(e) => {
                              const s = { ...selections };
                              if (e.target.checked) s[v.id] = { qty: v.unit === "forfait" || v.unit === "pz" ? 1 : mq || 1 };
                              else delete s[v.id];
                              setSelections(s);
                            }} data-testid={`comp-check-${v.id}`} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {sel && <Input type="number" className="h-8 w-20 mx-auto" value={sel.qty} onChange={(e) => setSelections({ ...selections, [v.id]: { qty: Number(e.target.value) } })} />}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{sel ? fmtEur((sel.qty || 0) * v.price) : "-"}</td>
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
          <div><Label className="text-xs">Sicurezza %</Label><Input type="number" value={sicurezzaPct} onChange={(e) => setSicurezzaPct(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Dir. Lavori %</Label><Input type="number" value={direzionePct} onChange={(e) => setDirezionePct(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Sconto €</Label><Input type="number" value={sconto} onChange={(e) => setSconto(Number(e.target.value))} /></div>
          <div><Label className="text-xs">IVA %</Label><Input type="number" value={ivaPct} onChange={(e) => setIvaPct(Number(e.target.value))} /></div>
          <Button onClick={save} data-testid="comp-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva Preventivo</Button>
        </div>
        <div className="mt-3"><Label className="text-xs">Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </Page>
      <InfissoQuickConfigurator open={infissiModalOpen} onClose={() => setInfissiModalOpen(false)} onConfirm={onInfissiConfirm} />
    </div>
  );
}
