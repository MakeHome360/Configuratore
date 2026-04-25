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

export default function PreventivoInfissi() {
  const { id } = useParams();
  const isNew = !id;
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
        setItems(d.infissi || []); setNote(d.note || "");
        setSconto(d.sconto_eur || 0); setIvaPct(d.iva_pct || 10);
      });
    }
  }, [id, isNew]);

  const calcPrice = (it) => {
    const m = conf.materiali.find((x) => x.id === it.materiale_id);
    const v = conf.vetri.find((x) => x.id === it.vetro_id);
    if (!m || !v) return 0;
    const area = (Number(it.larghezza) || 0) * (Number(it.altezza) || 0) / 10000; // cm to m²
    const basePrice = area * m.base_per_mq * m.multiplier * v.multiplier;
    // Tapparella: ~120 €/mq, Zanzariera: ~80 €/mq (calcolate sull'area dell'infisso)
    const tappPrice = it.tapparella ? area * 120 * (it.tapparella_motorizzata ? 1.6 : 1) : 0;
    const zanzPrice = it.zanzariera ? area * 80 : 0;
    const ante = Number(it.ante) || 1;
    // Più ante = qualche maggiorazione sulla manodopera (5% per anta extra)
    const anteFactor = 1 + Math.max(0, ante - 1) * 0.05;
    const total = (basePrice * anteFactor + tappPrice + zanzPrice) * (it.qty || 1);
    return Math.round(total);
  };

  const items2 = items.map((it) => ({ ...it, price: calcPrice(it) }));
  const subtotal = items2.reduce((s, x) => s + x.price, 0);
  const afterSc = subtotal - (sconto || 0);
  const iva = afterSc * (ivaPct / 100);
  const totale = afterSc + iva;

  const addItem = () => setItems([...items, {
    tipologia_id: conf.tipologie[0]?.id, materiale_id: conf.materiali[0]?.id, vetro_id: conf.vetri[0]?.id,
    larghezza: 100, altezza: 140, qty: 1, note: "", colore: "bianco",
    ante: 1, tapparella: false, tapparella_colore: "antracite", tapparella_motorizzata: false,
    zanzariera: false, zanzariera_tipo: "avvolgibile",
  }]);

  const upd = (i, k, v) => { const c = [...items]; c[i][k] = v; setItems(c); };

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
                <Button size="sm" onClick={addItem} data-testid="inf-add"><Plus className="h-4 w-4 mr-1" /> Aggiungi Infisso</Button>
              </div>
              <div className="space-y-3">
                {items2.map((it, i) => {
                  const tip = conf.tipologie.find((t) => t.id === it.tipologia_id);
                  const mat = conf.materiali.find((m) => m.id === it.materiale_id);
                  const vet = conf.vetri.find((v) => v.id === it.vetro_id);
                  return (
                  <div key={i} className="border border-zinc-200 rounded p-3 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 mb-2">
                      <AbacoInfisso tipologia={tip} colore={it.colore || "bianco"} larghezza={it.larghezza} altezza={it.altezza} materiale={mat?.name} vetro={vet?.name} ante={Number(it.ante) || 1} tapparella={!!it.tapparella} tapparella_colore={it.tapparella_colore} zanzariera={!!it.zanzariera} />
                    </div>
                    <div className="col-span-3"><Label className="text-xs">Tipologia</Label>
                      <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.tipologia_id} onChange={(e) => upd(i, "tipologia_id", e.target.value)}>
                        {conf.tipologie.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2"><Label className="text-xs">Materiale</Label>
                      <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.materiale_id} onChange={(e) => upd(i, "materiale_id", e.target.value)}>
                        {conf.materiali.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2"><Label className="text-xs">Vetro</Label>
                      <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.vetro_id} onChange={(e) => upd(i, "vetro_id", e.target.value)}>
                        {conf.vetri.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1"><Label className="text-xs">Colore</Label>
                      <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.colore || "bianco"} onChange={(e) => upd(i, "colore", e.target.value)} data-testid={`inf-colore-${i}`}>
                        <option value="bianco">Bianco</option>
                        <option value="antracite">Antracite</option>
                        <option value="grigio">Grigio</option>
                        <option value="marrone">Marrone</option>
                        <option value="noce">Noce</option>
                        <option value="rovere">Rovere</option>
                      </select>
                    </div>
                    <div className="col-span-1"><Label className="text-xs">Ante</Label>
                      <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.ante || 1} onChange={(e) => upd(i, "ante", Number(e.target.value))} data-testid={`inf-ante-${i}`}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </div>
                    <div className="col-span-1"><Label className="text-xs">L (cm)</Label><Input type="number" value={it.larghezza} onChange={(e) => upd(i, "larghezza", Number(e.target.value))} /></div>
                    <div className="col-span-1"><Label className="text-xs">H (cm)</Label><Input type="number" value={it.altezza} onChange={(e) => upd(i, "altezza", Number(e.target.value))} /></div>
                    <div className="col-span-1"><Label className="text-xs">Qty</Label><Input type="number" value={it.qty} onChange={(e) => upd(i, "qty", Number(e.target.value))} /></div>
                    <div className="col-span-1 text-right font-mono text-sm pt-5">{fmtEur2(it.price)}</div>
                    <button className="col-span-12 lg:col-span-1 p-1 rounded hover:bg-rose-50 self-end flex items-center justify-center" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600" /></button>
                    {/* Mini-configuratore Tapparelle + Zanzariere */}
                    <div className="col-span-12 mt-1 flex flex-wrap items-center gap-3 bg-zinc-50 border border-dashed border-zinc-300 rounded p-2 text-xs">
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
                <div><Label className="text-xs">Sconto €</Label><Input type="number" value={sconto} onChange={(e) => setSconto(Number(e.target.value))} /></div>
                <div><Label className="text-xs">IVA %</Label><Input type="number" value={ivaPct} onChange={(e) => setIvaPct(Number(e.target.value))} /></div>
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

function AbacoInfisso({ tipologia, colore, larghezza, altezza, materiale, vetro, ante = 1, tapparella, tapparella_colore, zanzariera }) {
  // SVG schematic preview of an "abaco infissi". Scales window dims to 320x230 viewport keeping aspect ratio.
  const W = 340, H = 240, pad = 38;
  const aw = Math.max(40, Math.min(larghezza || 100, 600));
  const ah = Math.max(40, Math.min(altezza || 140, 400));
  const maxW = W - pad * 2 - 50, maxH = H - pad * 2 - 30;
  const scale = Math.min(maxW / aw, maxH / ah);
  const ww = aw * scale, hh = ah * scale;
  const cx = pad + maxW / 2, cy = pad + maxH / 2;
  const x = cx - ww / 2, y = cy - hh / 2;
  const frameColor = COLOR_MAP[colore] || "#FAFAFA";
  const stroke = colore === "bianco" ? "#3F3F46" : "#0A0A0A";
  const tipoName = (tipologia?.name || "").toLowerCase();
  const isPF = tipoName.includes("porta") && tipoName.includes("finestra");
  const isPorta = tipoName.includes("porta") && !tipoName.includes("finestra");
  const isScorrevole = tipoName.includes("scorrevole");
  // ante: ora rispetta esplicitamente la scelta dell'utente (1..4) - nessun blocco di dimensioni
  const antaCount = Math.max(1, Math.min(4, Number(ante) || 1));
  const frameW = 6;
  const tappColor = COLOR_MAP[tapparella_colore] || "#3F3F46";
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-2 flex items-center gap-3">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} data-testid="abaco-svg" style={{ maxWidth: "100%" }}>
        {/* Cassonetto tapparella (sopra il telaio) */}
        {tapparella && (
          <g>
            <rect x={x - 4} y={y - 22} width={ww + 8} height={20} fill={tappColor} stroke={stroke} strokeWidth="1.2" rx="2" />
            <line x1={x + 4} y1={y - 12} x2={x + ww - 4} y2={y - 12} stroke="#FFF" strokeWidth="0.5" opacity="0.6" />
            <text x={cx} y={y - 7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" fill={tapparella_colore === "bianco" ? "#3F3F46" : "#FFF"}>TAPPARELLA</text>
          </g>
        )}
        {/* Outer dimension WIDTH (con riquadro bianco di contrasto) */}
        <line x1={x} y1={y - (tapparella ? 38 : 22)} x2={x + ww} y2={y - (tapparella ? 38 : 22)} stroke="#16A34A" strokeWidth="1.5" />
        <line x1={x} y1={y - (tapparella ? 42 : 26)} x2={x} y2={y - (tapparella ? 34 : 18)} stroke="#16A34A" strokeWidth="1.5" />
        <line x1={x + ww} y1={y - (tapparella ? 42 : 26)} x2={x + ww} y2={y - (tapparella ? 34 : 18)} stroke="#16A34A" strokeWidth="1.5" />
        <rect x={cx - 38} y={y - (tapparella ? 50 : 34)} width={76} height={18} fill="#FFF" stroke="#16A34A" strokeWidth="1.4" rx="2" />
        <text x={cx} y={y - (tapparella ? 38 : 22)} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="800" fill="#0A0A0A">{larghezza} cm</text>
        {/* Outer dimension HEIGHT (riquadro bianco) */}
        <line x1={x + ww + 22} y1={y} x2={x + ww + 22} y2={y + hh} stroke="#16A34A" strokeWidth="1.5" />
        <line x1={x + ww + 18} y1={y} x2={x + ww + 26} y2={y} stroke="#16A34A" strokeWidth="1.5" />
        <line x1={x + ww + 18} y1={y + hh} x2={x + ww + 26} y2={y + hh} stroke="#16A34A" strokeWidth="1.5" />
        <rect x={x + ww + 30} y={cy - 9} width={70} height={18} fill="#FFF" stroke="#16A34A" strokeWidth="1.4" rx="2" />
        <text x={x + ww + 65} y={cy + 4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="800" fill="#0A0A0A">{altezza} cm</text>
        {/* sill (only window) */}
        {!isPorta && !isPF && (
          <line x1={x - 8} y1={y + hh + 4} x2={x + ww + 8} y2={y + hh + 4} stroke="#71717A" strokeWidth="2" />
        )}
        {/* frame */}
        <rect x={x} y={y} width={ww} height={hh} fill={frameColor} stroke={stroke} strokeWidth="2" />
        <rect x={x + frameW} y={y + frameW} width={ww - 2 * frameW} height={hh - 2 * frameW} fill="#DBEAFE" fillOpacity="0.45" stroke={stroke} strokeWidth="1" />
        {/* anta dividers - support 1, 2, 3, 4 ante */}
        {!isScorrevole && antaCount > 1 && Array.from({ length: antaCount - 1 }).map((_, k) => {
          const dx = x + (ww / antaCount) * (k + 1);
          return <line key={k} x1={dx} y1={y + frameW} x2={dx} y2={y + hh - frameW} stroke={stroke} strokeWidth="2" />;
        })}
        {/* anta opening triangles (per anta) */}
        {!isScorrevole && Array.from({ length: antaCount }).map((_, k) => {
          const ax = x + (ww / antaCount) * k;
          const aw_ = ww / antaCount;
          const goesRight = k % 2 === 0;
          const startX = goesRight ? ax + frameW : ax + aw_ - frameW;
          const endX = goesRight ? ax + aw_ - frameW : ax + frameW;
          return (
            <path key={k} d={`M ${startX} ${y + hh - frameW} L ${endX} ${y + frameW} L ${endX} ${y + hh - frameW} Z`} fill="none" stroke={stroke} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
          );
        })}
        {isScorrevole && (
          <>
            <line x1={cx} y1={y + frameW} x2={cx} y2={y + hh - frameW} stroke={stroke} strokeWidth="1" strokeDasharray="3,3" />
            <text x={cx - ww / 4} y={cy + 4} textAnchor="middle" fontSize="14" fill={stroke}>→</text>
            <text x={cx + ww / 4} y={cy + 4} textAnchor="middle" fontSize="14" fill={stroke}>←</text>
          </>
        )}
        {/* maniglia (su anta destra) */}
        {!isScorrevole && <circle cx={x + ww - frameW - 8} cy={cy} r="3" fill={stroke} />}
        {/* Zanzariera schematic (linee sottili oblique sul lato sinistro del telaio) */}
        {zanzariera && (
          <g pointerEvents="none">
            <rect x={x + frameW + 1} y={y + frameW + 1} width={(ww - 2 * frameW - 2) / 2} height={hh - 2 * frameW - 2} fill="url(#mesh-zanz)" opacity="0.7" />
            <text x={x + ww / 4} y={y + hh - 8} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" fill="#525252">ZANZARIERA</text>
          </g>
        )}
        <defs>
          <pattern id="mesh-zanz" width="4" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="4" y2="4" stroke="#71717A" strokeWidth="0.4" />
            <line x1="4" y1="0" x2="0" y2="4" stroke="#71717A" strokeWidth="0.4" />
          </pattern>
        </defs>
      </svg>
      <div className="text-xs text-zinc-600 mono space-y-0.5">
        <div className="font-semibold text-zinc-800">{tipologia?.name || "—"}</div>
        <div>materiale: <span className="text-zinc-900">{materiale || "—"}</span></div>
        <div>vetro: <span className="text-zinc-900">{vetro || "—"}</span></div>
        <div>colore: <span className="text-zinc-900 capitalize">{colore}</span></div>
        <div>misura: <span className="text-zinc-900 font-bold">{larghezza}×{altezza} cm</span></div>
        <div>ante: <span className="text-zinc-900 font-bold">{antaCount}</span></div>
        {tapparella && <div className="text-amber-700">+ Tapparella <span className="capitalize">({tapparella_colore})</span></div>}
        {zanzariera && <div className="text-emerald-700">+ Zanzariera</div>}
      </div>
    </div>
  );
}
