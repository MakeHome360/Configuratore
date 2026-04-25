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
    const price = area * m.base_per_mq * m.multiplier * v.multiplier;
    return Math.round(price * (it.qty || 1));
  };

  const items2 = items.map((it) => ({ ...it, price: calcPrice(it) }));
  const subtotal = items2.reduce((s, x) => s + x.price, 0);
  const afterSc = subtotal - (sconto || 0);
  const iva = afterSc * (ivaPct / 100);
  const totale = afterSc + iva;

  const addItem = () => setItems([...items, {
    tipologia_id: conf.tipologie[0]?.id, materiale_id: conf.materiali[0]?.id, vetro_id: conf.vetri[0]?.id,
    larghezza: 100, altezza: 140, qty: 1, note: "", colore: "bianco",
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
                      <AbacoInfisso tipologia={tip} colore={it.colore || "bianco"} larghezza={it.larghezza} altezza={it.altezza} materiale={mat?.name} vetro={vet?.name} />
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
                    <div className="col-span-1"><Label className="text-xs">L (cm)</Label><Input type="number" value={it.larghezza} onChange={(e) => upd(i, "larghezza", Number(e.target.value))} /></div>
                    <div className="col-span-1"><Label className="text-xs">H (cm)</Label><Input type="number" value={it.altezza} onChange={(e) => upd(i, "altezza", Number(e.target.value))} /></div>
                    <div className="col-span-1"><Label className="text-xs">Qty</Label><Input type="number" value={it.qty} onChange={(e) => upd(i, "qty", Number(e.target.value))} /></div>
                    <div className="col-span-1 text-right font-mono text-sm pt-5">{fmtEur(it.price)}</div>
                    <button className="col-span-12 lg:col-span-1 p-1 rounded hover:bg-rose-50 self-end flex items-center justify-center" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600" /></button>
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

function AbacoInfisso({ tipologia, colore, larghezza, altezza, materiale, vetro }) {
  // SVG schematic preview of an "abaco infissi". Scales window dims to 200x140 viewport keeping aspect ratio.
  const W = 280, H = 200, pad = 30;
  const aw = Math.max(40, Math.min(larghezza || 100, 400));
  const ah = Math.max(40, Math.min(altezza || 140, 300));
  const maxW = W - pad * 2 - 40, maxH = H - pad * 2;
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
  // anta count: 2 if width > 120cm or porta-finestra, else 1
  const antaCount = (aw > 120 || isPF) ? 2 : 1;
  const frameW = 6;
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-2 flex items-center gap-3">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} data-testid="abaco-svg" style={{ maxWidth: "100%" }}>
        {/* outer dimension lines */}
        <line x1={x} y1={y - 14} x2={x + ww} y2={y - 14} stroke="#16A34A" strokeWidth="1" />
        <line x1={x} y1={y - 18} x2={x} y2={y - 10} stroke="#16A34A" strokeWidth="1" />
        <line x1={x + ww} y1={y - 18} x2={x + ww} y2={y - 10} stroke="#16A34A" strokeWidth="1" />
        <text x={cx} y={y - 18} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#16A34A">{larghezza} cm</text>
        <line x1={x + ww + 14} y1={y} x2={x + ww + 14} y2={y + hh} stroke="#16A34A" strokeWidth="1" />
        <line x1={x + ww + 10} y1={y} x2={x + ww + 18} y2={y} stroke="#16A34A" strokeWidth="1" />
        <line x1={x + ww + 10} y1={y + hh} x2={x + ww + 18} y2={y + hh} stroke="#16A34A" strokeWidth="1" />
        <text x={x + ww + 18} y={cy + 4} textAnchor="start" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#16A34A">{altezza} cm</text>
        {/* sill (only window) */}
        {!isPorta && !isPF && (
          <line x1={x - 8} y1={y + hh + 4} x2={x + ww + 8} y2={y + hh + 4} stroke="#71717A" strokeWidth="2" />
        )}
        {/* frame */}
        <rect x={x} y={y} width={ww} height={hh} fill={frameColor} stroke={stroke} strokeWidth="2" />
        <rect x={x + frameW} y={y + frameW} width={ww - 2 * frameW} height={hh - 2 * frameW} fill="#DBEAFE" fillOpacity="0.45" stroke={stroke} strokeWidth="1" />
        {/* anta divider */}
        {antaCount === 2 && !isScorrevole && (
          <line x1={cx} y1={y + frameW} x2={cx} y2={y + hh - frameW} stroke={stroke} strokeWidth="2" />
        )}
        {antaCount === 2 && !isScorrevole && (
          <>
            <path d={`M ${x + frameW} ${y + hh - frameW} L ${cx - frameW / 2} ${y + frameW} L ${cx - frameW / 2} ${y + hh - frameW} Z`} fill="none" stroke={stroke} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
            <path d={`M ${x + ww - frameW} ${y + hh - frameW} L ${cx + frameW / 2} ${y + frameW} L ${cx + frameW / 2} ${y + hh - frameW} Z`} fill="none" stroke={stroke} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
          </>
        )}
        {antaCount === 1 && !isScorrevole && (
          <path d={`M ${x + frameW} ${y + hh - frameW} L ${x + ww - frameW} ${y + frameW} L ${x + ww - frameW} ${y + hh - frameW} Z`} fill="none" stroke={stroke} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
        )}
        {isScorrevole && (
          <>
            <line x1={cx} y1={y + frameW} x2={cx} y2={y + hh - frameW} stroke={stroke} strokeWidth="1" strokeDasharray="3,3" />
            <text x={cx - ww / 4} y={cy + 4} textAnchor="middle" fontSize="14" fill={stroke}>→</text>
            <text x={cx + ww / 4} y={cy + 4} textAnchor="middle" fontSize="14" fill={stroke}>←</text>
          </>
        )}
        {/* maniglia */}
        {!isScorrevole && <circle cx={antaCount === 2 ? cx + ww / 4 : x + ww - frameW - 8} cy={cy} r="2.5" fill={stroke} />}
      </svg>
      <div className="text-xs text-zinc-600 mono space-y-0.5">
        <div className="font-semibold text-zinc-800">{tipologia?.name || "—"}</div>
        <div>materiale: <span className="text-zinc-900">{materiale || "—"}</span></div>
        <div>vetro: <span className="text-zinc-900">{vetro || "—"}</span></div>
        <div>colore: <span className="text-zinc-900 capitalize">{colore}</span></div>
        <div>misura: <span className="text-zinc-900">{larghezza}×{altezza} cm</span></div>
      </div>
    </div>
  );
}
