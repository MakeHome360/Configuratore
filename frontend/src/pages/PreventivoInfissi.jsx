import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

// Mappa categoria + apertura + ante → tipologia_id del backend (per il pricing)
function resolveTipologiaId(categoria, apertura, ante, tipologie) {
  // Se "scorrevole" cerca scorrevole
  if (apertura === "scorrevole") {
    const sc = tipologie.find((t) => (t.category || "").toLowerCase().includes("scorrevole"));
    if (sc) return sc.id;
  }
  // Altrimenti finestra/portafinestra a 1 o 2+ ante (per 3/4 ante si usa 2-ante come base, prezzo scalato via anteFactor)
  const wantsCat = categoria === "portafinestra" ? "portafinestra" : "finestra";
  const wantsAnte = ante <= 1 ? "1anta" : "2ante";
  const exact = tipologie.find((t) => t.id === `inf-${wantsCat}-${wantsAnte}`);
  if (exact) return exact.id;
  // fallback: cerca per category
  const byCat = tipologie.find((t) => (t.category || "").toLowerCase() === wantsCat);
  return byCat?.id || tipologie[0]?.id;
}

export default function PreventivoInfissi() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const [conf, setConf] = useState({ tipologie: [], materiali: [], vetri: [] });
  const [cliente, setCliente] = useState({ nome: "", telefono: "", email: "", indirizzo: "" });
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [sconto, setSconto] = useState(0);
  const [ivaPct, setIvaPct] = useState(10);

  useEffect(() => {
    api.get("/infissi-config").then((r) => setConf(r.data));
    if (!isNew) {
      api.get(`/preventivi/${id}`).then((r) => {
        const d = r.data;
        setCliente(d.cliente || {});
        // Backward compat: deriva categoria/apertura/ante da tipologia_id se mancanti
        const loaded = (d.infissi || []).map((it) => {
          const cat = it.categoria || ((it.tipologia_id || "").includes("portafinestra") ? "portafinestra" : "finestra");
          const apert = it.apertura || ((it.tipologia_id || "").includes("scorrevole") ? "scorrevole" : "battente");
          return { ...it, categoria: cat, apertura: apert, ante: it.ante || 1 };
        });
        setItems(loaded);
        setNote(d.note || "");
        setSconto(d.sconto_eur || 0); setIvaPct(d.iva_pct || 10);
      });
    }
  }, [id, isNew]);

  const calcPrice = (it) => {
    const m = conf.materiali.find((x) => x.id === it.materiale_id);
    const v = conf.vetri.find((x) => x.id === it.vetro_id);
    if (!m || !v) return 0;
    const area = (Number(it.larghezza) || 0) * (Number(it.altezza) || 0) / 10000;
    const basePrice = area * m.base_per_mq * m.multiplier * v.multiplier;
    const tappPrice = it.tapparella ? area * 120 * (it.tapparella_motorizzata ? 1.6 : 1) : 0;
    const zanzPrice = it.zanzariera ? area * 80 : 0;
    const ante = Number(it.ante) || 1;
    const anteFactor = 1 + Math.max(0, ante - 1) * 0.05;
    // Scorrevole: maggiorazione +20%
    const scorrFactor = it.apertura === "scorrevole" ? 1.20 : 1.0;
    const total = (basePrice * anteFactor * scorrFactor + tappPrice + zanzPrice) * (it.qty || 1);
    return Math.round(total);
  };

  const items2 = items.map((it) => ({ ...it, price: calcPrice(it), tipologia_id: resolveTipologiaId(it.categoria, it.apertura, it.ante, conf.tipologie) }));
  const subtotal = items2.reduce((s, x) => s + x.price, 0);
  const afterSc = subtotal - (sconto || 0);
  const iva = afterSc * (ivaPct / 100);
  const totale = afterSc + iva;

  const addItem = () => {
    if (!conf.materiali?.length || !conf.vetri?.length) {
      toast.error("Configurazione infissi non ancora caricata. Attendi qualche secondo e riprova.");
      return;
    }
    setItems([...items, {
      categoria: "finestra",
      apertura: "battente",
      ante: 1,
      materiale_id: conf.materiali[0].id,
      vetro_id: conf.vetri[0].id,
      larghezza: 120, altezza: 140, qty: 1, note: "", colore: "bianco",
      tapparella: false, tapparella_colore: "antracite", tapparella_motorizzata: false,
      zanzariera: false, zanzariera_tipo: "avvolgibile",
    }]);
  };

  const upd = (i, k, v) => setItems((arr) => arr.map((it, j) => j === i ? { ...it, [k]: v } : it));

  const save = async () => {
    if (!cliente.nome) return toast.error("Nome cliente");
    const payload = { tipo: "infissi", cliente, infissi: items2, mq: 0, note, sconto_eur: sconto, iva_pct: ivaPct, totale_iva_incl: totale, totale_iva_escl: afterSc };
    try {
      if (isNew) { const { data } = await api.post("/preventivi", payload); toast.success("Salvato"); nav(`/preventivoinfissi/${data.id}`, { replace: true }); }
      else { await api.put(`/preventivi/${id}`, payload); toast.success("Aggiornato"); }
    } catch { toast.error("Errore"); }
  };

  return (
    <div>
      <PageHeader title="Preventivo Infissi" subtitle="Fornitura e posa infissi, porte e serramenti"
        actions={<div className="text-right"><div className="text-xs text-zinc-500">Totale IVA Inclusa</div><div className="text-2xl font-bold" data-testid="totale-infissi">{fmtEur2(totale)}</div></div>} />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Dati Cliente</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome *</Label><Input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} data-testid="inf-nome" /></div>
                <div><Label className="text-xs">Telefono</Label><Input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} /></div>
                <div><Label className="text-xs">Email</Label><Input value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} /></div>
                <div><Label className="text-xs">Indirizzo</Label><Input value={cliente.indirizzo} onChange={(e) => setCliente({ ...cliente, indirizzo: e.target.value })} /></div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Infissi</h3>
                <Button size="sm" onClick={addItem} disabled={!conf.materiali?.length} data-testid="inf-add"><Plus className="h-4 w-4 mr-1" /> Aggiungi Infisso</Button>
              </div>
              <div className="space-y-4">
                {items2.map((it, i) => {
                  const mat = conf.materiali.find((m) => m.id === it.materiale_id);
                  const vet = conf.vetri.find((v) => v.id === it.vetro_id);
                  return (
                  <div key={i} className="border-2 border-zinc-200 rounded-lg p-4 bg-zinc-50/40">
                    {/* Anteprima abaco (più grande, sopra) */}
                    <AbacoInfisso
                      categoria={it.categoria}
                      apertura={it.apertura}
                      colore={it.colore || "bianco"}
                      larghezza={it.larghezza}
                      altezza={it.altezza}
                      materiale={mat?.name}
                      vetro={vet?.name}
                      ante={Number(it.ante) || 1}
                      tapparella={!!it.tapparella}
                      tapparella_colore={it.tapparella_colore}
                      zanzariera={!!it.zanzariera}
                    />

                    {/* Riga 1 — A SINISTRA: Tipologia (solo finestra/portafinestra). A DESTRA: Apertura + Ante. */}
                    <div className="mt-3 grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-12 md:col-span-4">
                        <Label className="text-xs uppercase tracking-wider text-zinc-700 font-bold">📐 Tipologia</Label>
                        <select className="w-full border-2 border-zinc-300 rounded h-11 px-2 text-sm font-mono font-bold mt-1" value={it.categoria || "finestra"} onChange={(e) => upd(i, "categoria", e.target.value)} data-testid={`inf-categoria-${i}`}>
                          <option value="finestra">Finestra</option>
                          <option value="portafinestra">Porta-finestra</option>
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-4">
                        <Label className="text-xs uppercase tracking-wider text-zinc-700 font-bold">🔁 Apertura</Label>
                        <select className="w-full border-2 border-zinc-300 rounded h-11 px-2 text-sm font-mono font-bold mt-1" value={it.apertura || "battente"} onChange={(e) => upd(i, "apertura", e.target.value)} data-testid={`inf-apertura-${i}`}>
                          <option value="battente">Battente</option>
                          <option value="scorrevole">Scorrevole (+20%)</option>
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-4">
                        <Label className="text-xs uppercase tracking-wider text-zinc-700 font-bold">▦ Numero ante</Label>
                        <select className="w-full border-2 border-zinc-300 rounded h-11 px-2 text-sm font-mono font-bold mt-1" value={it.ante || 1} onChange={(e) => upd(i, "ante", Number(e.target.value))} data-testid={`inf-ante-${i}`}>
                          <option value={1}>1 anta</option>
                          <option value={2}>2 ante</option>
                          <option value={3}>3 ante</option>
                          <option value={4}>4 ante</option>
                        </select>
                      </div>
                    </div>

                    {/* Riga 2 — Materiale / Vetro / Colore */}
                    <div className="mt-3 grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-12 md:col-span-4">
                        <Label className="text-xs uppercase tracking-wider text-zinc-700 font-bold">🪵 Materiale</Label>
                        <select className="w-full border border-zinc-300 rounded h-10 px-2 text-sm mt-1" value={it.materiale_id} onChange={(e) => upd(i, "materiale_id", e.target.value)} data-testid={`inf-materiale-${i}`}>
                          {conf.materiali.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-4">
                        <Label className="text-xs uppercase tracking-wider text-zinc-700 font-bold">▢ Vetro</Label>
                        <select className="w-full border border-zinc-300 rounded h-10 px-2 text-sm mt-1" value={it.vetro_id} onChange={(e) => upd(i, "vetro_id", e.target.value)} data-testid={`inf-vetro-${i}`}>
                          {conf.vetri.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-4">
                        <Label className="text-xs uppercase tracking-wider text-zinc-700 font-bold">🎨 Colore</Label>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-block w-9 h-9 border-2 border-zinc-400 rounded shrink-0" style={{ background: ({ bianco: "#FAFAFA", antracite: "#3F3F46", grigio: "#A1A1AA", marrone: "#78350F", noce: "#5B3A1A", rovere: "#A87C4F" })[it.colore || "bianco"] }} />
                          <select className="flex-1 border border-zinc-300 rounded h-10 px-2 text-sm" value={it.colore || "bianco"} onChange={(e) => upd(i, "colore", e.target.value)} data-testid={`inf-colore-${i}`}>
                            <option value="bianco">Bianco</option>
                            <option value="antracite">Antracite</option>
                            <option value="grigio">Grigio</option>
                            <option value="marrone">Marrone</option>
                            <option value="noce">Noce</option>
                            <option value="rovere">Rovere</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Riga 3 — Misure GROSSE + Quantità + Prezzo */}
                    <div className="mt-3 grid grid-cols-12 gap-3 items-end bg-amber-50 border border-amber-200 p-3 rounded">
                      <div className="col-span-4 md:col-span-3">
                        <Label className="text-sm uppercase tracking-wider text-zinc-900 font-bold">📏 Larghezza (cm)</Label>
                        <Input type="number" min={20} step="1" className="h-12 text-2xl font-mono font-extrabold text-center mt-1" value={it.larghezza} onChange={(e) => upd(i, "larghezza", Math.max(20, Number(e.target.value) || 20))} data-testid={`inf-larghezza-${i}`} />
                      </div>
                      <div className="col-span-4 md:col-span-3">
                        <Label className="text-sm uppercase tracking-wider text-zinc-900 font-bold">📐 Altezza (cm)</Label>
                        <Input type="number" min={20} step="1" className="h-12 text-2xl font-mono font-extrabold text-center mt-1" value={it.altezza} onChange={(e) => upd(i, "altezza", Math.max(20, Number(e.target.value) || 20))} data-testid={`inf-altezza-${i}`} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-sm uppercase tracking-wider text-zinc-900 font-bold">× Qty</Label>
                        <Input type="number" min={1} step="1" className="h-12 text-2xl font-mono font-extrabold text-center mt-1" value={it.qty} onChange={(e) => upd(i, "qty", Math.max(1, Number(e.target.value) || 1))} />
                      </div>
                      <div className="col-span-8 md:col-span-3 text-right">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Prezzo unitario</div>
                        <div className="text-2xl font-bold font-mono">{fmtEur2(it.price)}</div>
                      </div>
                      <div className="col-span-4 md:col-span-1 text-right">
                        <button className="h-12 w-full rounded hover:bg-rose-50 inline-flex items-center justify-center" onClick={() => setItems(items.filter((_, j) => j !== i))} data-testid={`inf-del-${i}`}><Trash2 className="h-5 w-5 text-rose-600" /></button>
                      </div>
                    </div>

                    {/* Accessori: tapparella + zanzariera */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 bg-zinc-50 border border-dashed border-zinc-300 rounded p-2 text-xs">
                      <span className="font-semibold text-zinc-700">Accessori:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!it.tapparella} onChange={(e) => upd(i, "tapparella", e.target.checked)} data-testid={`inf-tapparella-${i}`} />
                        Tapparella
                      </label>
                      {it.tapparella && (
                        <>
                          <select className="border border-zinc-300 rounded h-7 px-1.5 text-xs" value={it.tapparella_colore || "antracite"} onChange={(e) => upd(i, "tapparella_colore", e.target.value)}>
                            <option value="bianco">Bianca</option>
                            <option value="antracite">Antracite</option>
                            <option value="marrone">Marrone</option>
                            <option value="noce">Noce</option>
                          </select>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!!it.tapparella_motorizzata} onChange={(e) => upd(i, "tapparella_motorizzata", e.target.checked)} />
                            Motorizzata (+60%)
                          </label>
                        </>
                      )}
                      <span className="mx-2 text-zinc-300">|</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!it.zanzariera} onChange={(e) => upd(i, "zanzariera", e.target.checked)} data-testid={`inf-zanzariera-${i}`} />
                        Zanzariera
                      </label>
                      {it.zanzariera && (
                        <select className="border border-zinc-300 rounded h-7 px-1.5 text-xs" value={it.zanzariera_tipo || "avvolgibile"} onChange={(e) => upd(i, "zanzariera_tipo", e.target.value)}>
                          <option value="avvolgibile">Avvolgibile</option>
                          <option value="plissettata">Plissettata</option>
                          <option value="fissa">Fissa</option>
                        </select>
                      )}
                    </div>
                  </div>
                  );
                })}
                {!items.length && <div className="text-zinc-500 text-sm italic">Nessun infisso. Clicca "Aggiungi Infisso".</div>}
              </div>
            </div>
          </div>
          <div>
            <div className="sticky top-4 bg-white border border-zinc-200 rounded-lg p-5 space-y-3">
              <h3 className="font-semibold pb-2 border-b border-zinc-200">Riepilogo</h3>
              <Row label="Subtotale" value={fmtEur2(subtotal)} bold />
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Sconto €</Label><Input type="number" min={0} step="1" value={sconto} onChange={(e) => setSconto(Math.max(0, Number(e.target.value) || 0))} /></div>
                <div><Label className="text-xs">IVA %</Label><Input type="number" min={0} max={100} step="0.5" value={ivaPct} onChange={(e) => setIvaPct(Math.max(0, Math.min(100, Number(e.target.value) || 10)))} /></div>
              </div>
              <Row label="TOTALE IVA INCLUSA" value={fmtEur2(totale)} bold big />
              <div><Label className="text-xs">Note</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <Button className="w-full" onClick={save} data-testid="inf-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button>
            </div>
          </div>
        </div>
      </Page>
    </div>
  );
}

const Row = ({ label, value, bold, big }) => (
  <div className={`flex items-center justify-between ${bold ? "font-bold" : ""} ${big ? "text-lg pt-2 border-t border-zinc-200" : "text-sm"}`}><span>{label}</span><span>{value}</span></div>
);

const COLOR_MAP = {
  bianco: "#FAFAFA", antracite: "#3F3F46", grigio: "#A1A1AA",
  marrone: "#78350F", noce: "#5B3A1A", rovere: "#A87C4F",
};

function AbacoInfisso({ categoria, apertura, colore, larghezza, altezza, materiale, vetro, ante = 1, tapparella, tapparella_colore, zanzariera }) {
  // SVG schematic preview MOLTO PIÙ GRANDE per leggibilità delle quote.
  const W = 560, H = 360, pad = 60;
  const aw = Math.max(40, Math.min(larghezza || 100, 600));
  const ah = Math.max(40, Math.min(altezza || 140, 400));
  const maxW = W - pad * 2 - 70, maxH = H - pad * 2 - 50;
  const scale = Math.min(maxW / aw, maxH / ah);
  const ww = aw * scale, hh = ah * scale;
  const cx = pad + maxW / 2, cy = pad + maxH / 2;
  const x = cx - ww / 2, y = cy - hh / 2;
  const frameColor = COLOR_MAP[colore] || "#FAFAFA";
  const stroke = colore === "bianco" ? "#3F3F46" : "#0A0A0A";
  const isPF = categoria === "portafinestra";
  const isScorrevole = apertura === "scorrevole";
  const antaCount = Math.max(1, Math.min(4, Number(ante) || 1));
  const frameW = 8;
  const tappColor = COLOR_MAP[tapparella_colore] || "#3F3F46";
  return (
    <div className="bg-white border-2 border-zinc-300 rounded p-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} data-testid="abaco-svg" style={{ maxWidth: "100%", height: "auto" }}>
        <defs>
          <filter id="frame-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
          </filter>
          <pattern id="mesh-zanz" width="4" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="4" y2="4" stroke="#71717A" strokeWidth="0.4" />
            <line x1="4" y1="0" x2="0" y2="4" stroke="#71717A" strokeWidth="0.4" />
          </pattern>
        </defs>
        {/* Cassonetto tapparella */}
        {tapparella && (
          <g>
            <rect x={x - 6} y={y - 30} width={ww + 12} height={26} fill={tappColor} stroke={stroke} strokeWidth="1.4" rx="3" />
            <text x={cx} y={y - 12} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="12" fontWeight="700" fill={tapparella_colore === "bianco" ? "#3F3F46" : "#FFF"}>TAPPARELLA</text>
          </g>
        )}
        {/* Quota LARGHEZZA in BIG (sopra) */}
        {(() => {
          const yQ = y - (tapparella ? 50 : 30);
          return (
            <g>
              <line x1={x} y1={yQ} x2={x + ww} y2={yQ} stroke="#16A34A" strokeWidth="2.5" />
              <line x1={x} y1={yQ - 6} x2={x} y2={yQ + 6} stroke="#16A34A" strokeWidth="2.5" />
              <line x1={x + ww} y1={yQ - 6} x2={x + ww} y2={yQ + 6} stroke="#16A34A" strokeWidth="2.5" />
              <rect x={cx - 56} y={yQ - 16} width={112} height={26} fill="#FFF" stroke="#16A34A" strokeWidth="2" rx="3" />
              <text x={cx} y={yQ + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="20" fontWeight="900" fill="#0A0A0A">{`${larghezza} cm`}</text>
            </g>
          );
        })()}
        {/* Quota ALTEZZA in BIG (destra) */}
        {(() => {
          const xQ = x + ww + 30;
          return (
            <g>
              <line x1={xQ} y1={y} x2={xQ} y2={y + hh} stroke="#16A34A" strokeWidth="2.5" />
              <line x1={xQ - 6} y1={y} x2={xQ + 6} y2={y} stroke="#16A34A" strokeWidth="2.5" />
              <line x1={xQ - 6} y1={y + hh} x2={xQ + 6} y2={y + hh} stroke="#16A34A" strokeWidth="2.5" />
              <rect x={xQ + 8} y={cy - 13} width={90} height={26} fill="#FFF" stroke="#16A34A" strokeWidth="2" rx="3" />
              <text x={xQ + 53} y={cy + 5} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="20" fontWeight="900" fill="#0A0A0A">{`${altezza} cm`}</text>
            </g>
          );
        })()}
        {/* Davanzale */}
        {!isPF && (
          <g>
            <rect x={x - 8} y={y + hh + 3} width={ww + 16} height={8} fill="#A1A1AA" stroke="#52525B" strokeWidth="1" />
            <text x={cx} y={y + hh + 22} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#525252">DAVANZALE</text>
          </g>
        )}
        {/* Frame esterno */}
        <rect x={x} y={y} width={ww} height={hh} fill={frameColor} stroke={stroke} strokeWidth="3" filter="url(#frame-shadow)" />
        <rect x={x + frameW} y={y + frameW} width={ww - 2 * frameW} height={hh - 2 * frameW} fill="#DBEAFE" fillOpacity="0.6" stroke={stroke} strokeWidth="1.5" />
        <line x1={x + frameW + 8} y1={y + frameW + 6} x2={x + ww - frameW - 8} y2={y + hh - frameW - 6} stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" />
        {/* Anta dividers + numeri (chiari) */}
        {!isScorrevole && antaCount > 1 && Array.from({ length: antaCount - 1 }).map((_, k) => {
          const dx = x + (ww / antaCount) * (k + 1);
          return (
            <g key={k}>
              <rect x={dx - 4} y={y + frameW} width={8} height={hh - 2 * frameW} fill={frameColor} stroke={stroke} strokeWidth="1.5" />
              <line x1={dx} y1={y + frameW + 2} x2={dx} y2={y + hh - frameW - 2} stroke={stroke} strokeWidth="0.6" />
            </g>
          );
        })}
        {/* Apertura tipo: triangoli o frecce */}
        {!isScorrevole && Array.from({ length: antaCount }).map((_, k) => {
          const ax = x + (ww / antaCount) * k;
          const aw_ = ww / antaCount;
          const goesRight = k % 2 === 0;
          const startX = goesRight ? ax + frameW : ax + aw_ - frameW;
          const endX = goesRight ? ax + aw_ - frameW : ax + frameW;
          return (
            <path key={k} d={`M ${startX} ${y + hh - frameW} L ${endX} ${y + frameW} L ${endX} ${y + hh - frameW} Z`} fill="none" stroke={stroke} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.55" />
          );
        })}
        {isScorrevole && (
          <>
            <line x1={cx} y1={y + frameW} x2={cx} y2={y + hh - frameW} stroke={stroke} strokeWidth="1.5" strokeDasharray="4,4" />
            <text x={cx - ww / 4} y={cy + 6} textAnchor="middle" fontSize="22" fontWeight="800" fill={stroke}>→</text>
            <text x={cx + ww / 4} y={cy + 6} textAnchor="middle" fontSize="22" fontWeight="800" fill={stroke}>←</text>
          </>
        )}
        {/* Numero anta (bolla bianca + numero) */}
        {antaCount > 1 && !isScorrevole && Array.from({ length: antaCount }).map((_, k) => {
          const ax = x + (ww / antaCount) * (k + 0.5);
          return (
            <g key={`n-${k}`}>
              <circle cx={ax} cy={y + hh - 18} r={12} fill="white" stroke={stroke} strokeWidth="1.5" />
              <text x={ax} y={y + hh - 13} textAnchor="middle" fontSize="14" fontWeight="900" fontFamily="JetBrains Mono" fill={stroke}>{k + 1}</text>
            </g>
          );
        })}
        {/* Maniglia cremonese */}
        {!isScorrevole && (() => {
          const handleX = x + ww - frameW - 14;
          const handleY = cy;
          const isLightFrame = colore === "bianco" || colore === "grigio";
          const handleColor = isLightFrame ? "#3F3F46" : "#E5E7EB";
          return (
            <g pointerEvents="none">
              <rect x={handleX - 3} y={handleY - 18} width={6} height={36} rx={3} fill={handleColor} stroke="#0A0A0A" strokeWidth="0.6" />
              <circle cx={handleX} cy={handleY} r={5} fill={handleColor} stroke="#0A0A0A" strokeWidth="0.8" />
            </g>
          );
        })()}
        {/* Cerniere lato sinistro */}
        {!isScorrevole && (
          <g pointerEvents="none">
            {[0.18, 0.5, 0.82].map((p, k) => (
              <rect key={k} x={x + frameW + 1} y={y + hh * p - 6} width={4} height={12} fill="#9CA3AF" stroke="#0A0A0A" strokeWidth="0.5" />
            ))}
          </g>
        )}
        {/* Zanzariera */}
        {zanzariera && (
          <g pointerEvents="none">
            <rect x={x + frameW + 2} y={y + frameW + 2} width={(ww - 2 * frameW - 4) / 2} height={hh - 2 * frameW - 4} fill="url(#mesh-zanz)" opacity="0.7" />
            <text x={x + ww / 4} y={y + hh - 26} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#525252">ZANZARIERA</text>
          </g>
        )}
        {/* Etichette: categoria + apertura + ante (info riepilogativo in basso a sinistra) */}
        <g>
          <rect x={20} y={H - 36} width={W - 40} height={24} fill="#FAFAFA" stroke="#D4D4D8" strokeWidth="1" rx="3" />
          <text x={28} y={H - 18} fontFamily="JetBrains Mono" fontSize="12" fontWeight="700" fill="#3F3F46">
            {`${isPF ? "PORTA-FINESTRA" : "FINESTRA"} · ${isScorrevole ? "SCORREVOLE" : "BATTENTE"} · ${antaCount} ANTA${antaCount > 1 ? "E" : ""} · ${materiale || "—"} · ${vetro || "—"}`}
          </text>
        </g>
      </svg>
    </div>
  );
}
