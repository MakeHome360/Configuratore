import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { fmtEur2 } from "@/components/ui-kit";

const COLOR_MAP = {
  bianco: "#FAFAFA", antracite: "#3F3F46", grigio: "#A1A1AA",
  marrone: "#78350F", noce: "#92400E", rovere: "#B45309",
};

/**
 * AbacoInfissoMini: schema compatto dell'infisso usato nel mini-configuratore.
 * Mostra dimensioni in riquadri ad alto contrasto, ante (1..4), tapparella, zanzariera.
 */
function AbacoInfissoMini({ tipologia, colore, larghezza, altezza, ante, tapparella, tapparella_colore, zanzariera }) {
  const W = 320, H = 220, pad = 36;
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
  const isScorrevole = tipoName.includes("scorrevole");
  const antaCount = Math.max(1, Math.min(4, Number(ante) || 1));
  const frameW = 6;
  const tappColor = COLOR_MAP[tapparella_colore] || "#3F3F46";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }}>
      {tapparella && (
        <g>
          <rect x={x - 4} y={y - 22} width={ww + 8} height={20} fill={tappColor} stroke={stroke} strokeWidth="1.2" rx="2" />
          <text x={cx} y={y - 7} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" fill={tapparella_colore === "bianco" ? "#3F3F46" : "#FFF"}>TAPPARELLA</text>
        </g>
      )}
      <line x1={x} y1={y - (tapparella ? 38 : 22)} x2={x + ww} y2={y - (tapparella ? 38 : 22)} stroke="#16A34A" strokeWidth="1.5" />
      <rect x={cx - 38} y={y - (tapparella ? 50 : 34)} width={76} height={18} fill="#FFF" stroke="#16A34A" strokeWidth="1.4" rx="2" />
      <text x={cx} y={y - (tapparella ? 38 : 22)} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="800" fill="#0A0A0A">{larghezza} cm</text>
      <line x1={x + ww + 22} y1={y} x2={x + ww + 22} y2={y + hh} stroke="#16A34A" strokeWidth="1.5" />
      <rect x={x + ww + 30} y={cy - 9} width={70} height={18} fill="#FFF" stroke="#16A34A" strokeWidth="1.4" rx="2" />
      <text x={x + ww + 65} y={cy + 4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fontWeight="800" fill="#0A0A0A">{altezza} cm</text>
      <rect x={x} y={y} width={ww} height={hh} fill={frameColor} stroke={stroke} strokeWidth="2" />
      <rect x={x + frameW} y={y + frameW} width={ww - 2 * frameW} height={hh - 2 * frameW} fill="#DBEAFE" fillOpacity="0.45" stroke={stroke} strokeWidth="1" />
      {!isScorrevole && antaCount > 1 && Array.from({ length: antaCount - 1 }).map((_, k) => {
        const dx = x + (ww / antaCount) * (k + 1);
        return <line key={k} x1={dx} y1={y + frameW} x2={dx} y2={y + hh - frameW} stroke={stroke} strokeWidth="2" />;
      })}
      {zanzariera && (
        <rect x={x + frameW + 1} y={y + frameW + 1} width={(ww - 2 * frameW - 2) / 2} height={hh - 2 * frameW - 2} fill="url(#mesh-z)" opacity="0.7" />
      )}
      <defs>
        <pattern id="mesh-z" width="4" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="4" y2="4" stroke="#71717A" strokeWidth="0.4" />
          <line x1="4" y1="0" x2="0" y2="4" stroke="#71717A" strokeWidth="0.4" />
        </pattern>
      </defs>
    </svg>
  );
}

/**
 * Dialog mini-configuratore infissi: si apre quando il venditore clicca "Aggiungi infissi" come extra.
 * onConfirm({ items: [...] }) restituisce gli infissi configurati con prezzo unitario e totale calcolato.
 */
export function InfissoQuickConfigurator({ open, onClose, onConfirm }) {
  const [conf, setConf] = useState({ tipologie: [], materiali: [], vetri: [] });
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    api.get("/infissi-config").then((r) => {
      setConf(r.data);
      // Pre-popola con un infisso di esempio
      setItems([{
        tipologia_id: r.data.tipologie[0]?.id, materiale_id: r.data.materiali[0]?.id, vetro_id: r.data.vetri[0]?.id,
        larghezza: 120, altezza: 140, qty: 1, colore: "bianco",
        ante: 2, tapparella: false, tapparella_colore: "antracite", tapparella_motorizzata: false,
        zanzariera: false,
      }]);
    });
  }, [open]);

  const calcPrice = (it) => {
    const m = conf.materiali.find((x) => x.id === it.materiale_id);
    const v = conf.vetri.find((x) => x.id === it.vetro_id);
    if (!m || !v) return 0;
    const area = (Number(it.larghezza) || 0) * (Number(it.altezza) || 0) / 10000;
    const base = area * m.base_per_mq * m.multiplier * v.multiplier;
    const tapp = it.tapparella ? area * 120 * (it.tapparella_motorizzata ? 1.6 : 1) : 0;
    const zanz = it.zanzariera ? area * 80 : 0;
    const ante = Math.max(1, Number(it.ante) || 1);
    const anteFactor = 1 + (ante - 1) * 0.05;
    return Math.round((base * anteFactor + tapp + zanz) * (it.qty || 1));
  };

  const upd = (i, k, v) => setItems((arr) => arr.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const del = (i) => setItems((arr) => arr.filter((_, j) => j !== i));
  const add = () => setItems([...items, {
    tipologia_id: conf.tipologie[0]?.id, materiale_id: conf.materiali[0]?.id, vetro_id: conf.vetri[0]?.id,
    larghezza: 120, altezza: 140, qty: 1, colore: "bianco",
    ante: 2, tapparella: false, tapparella_colore: "antracite", tapparella_motorizzata: false,
    zanzariera: false,
  }]);

  const totale = items.reduce((s, it) => s + calcPrice(it), 0);

  const confirm = () => {
    const enriched = items.map((it) => {
      const tip = conf.tipologie.find((x) => x.id === it.tipologia_id);
      const mat = conf.materiali.find((x) => x.id === it.materiale_id);
      const vet = conf.vetri.find((x) => x.id === it.vetro_id);
      return {
        ...it,
        tipologia_name: tip?.name, materiale_name: mat?.name, vetro_name: vet?.name,
        price: calcPrice(it),
      };
    });
    onConfirm({ items: enriched, totale });
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="infissi-quick-modal">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-lg" style={{ fontFamily: "Outfit" }}>Aggiungi Infissi (extra)</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="text-xs text-zinc-600 bg-amber-50 border border-amber-200 rounded p-2">
            Configura uno o più infissi esterni. Tapparelle e zanzariere sono opzionali per ogni infisso. Il totale verrà aggiunto come <strong>extra</strong> al preventivo.
          </div>
          {items.map((it, i) => {
            const tip = conf.tipologie.find((x) => x.id === it.tipologia_id);
            const mat = conf.materiali.find((x) => x.id === it.materiale_id);
            const vet = conf.vetri.find((x) => x.id === it.vetro_id);
            const price = calcPrice(it);
            return (
              <div key={i} className="border border-zinc-200 rounded p-3 grid grid-cols-12 gap-2 items-end" data-testid={`iqc-row-${i}`}>
                <div className="col-span-12 mb-2">
                  <AbacoInfissoMini tipologia={tip} colore={it.colore} larghezza={it.larghezza} altezza={it.altezza}
                    ante={it.ante} tapparella={it.tapparella} tapparella_colore={it.tapparella_colore} zanzariera={it.zanzariera} />
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
                  <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.colore} onChange={(e) => upd(i, "colore", e.target.value)}>
                    <option value="bianco">Bianco</option>
                    <option value="antracite">Antracite</option>
                    <option value="grigio">Grigio</option>
                    <option value="marrone">Marrone</option>
                    <option value="noce">Noce</option>
                  </select>
                </div>
                <div className="col-span-1"><Label className="text-xs">Ante</Label>
                  <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.ante} onChange={(e) => upd(i, "ante", Number(e.target.value))} data-testid={`iqc-ante-${i}`}>
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                  </select>
                </div>
                <div className="col-span-1"><Label className="text-xs">L (cm)</Label><Input type="number" value={it.larghezza} onChange={(e) => upd(i, "larghezza", Number(e.target.value))} /></div>
                <div className="col-span-1"><Label className="text-xs">H (cm)</Label><Input type="number" value={it.altezza} onChange={(e) => upd(i, "altezza", Number(e.target.value))} /></div>
                <div className="col-span-1"><Label className="text-xs">Qty</Label><Input type="number" value={it.qty} onChange={(e) => upd(i, "qty", Number(e.target.value))} /></div>
                <div className="col-span-12 mt-1 flex flex-wrap items-center gap-3 bg-zinc-50 border border-dashed border-zinc-300 rounded p-2 text-xs">
                  <span className="font-semibold text-zinc-700">Accessori:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!it.tapparella} onChange={(e) => upd(i, "tapparella", e.target.checked)} data-testid={`iqc-tapparella-${i}`} /> Tapparella
                  </label>
                  {it.tapparella && (
                    <>
                      <select className="border border-zinc-300 rounded h-7 px-1.5 text-xs" value={it.tapparella_colore} onChange={(e) => upd(i, "tapparella_colore", e.target.value)}>
                        <option value="bianco">Bianca</option><option value="antracite">Antracite</option><option value="marrone">Marrone</option>
                      </select>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!it.tapparella_motorizzata} onChange={(e) => upd(i, "tapparella_motorizzata", e.target.checked)} /> Motorizzata
                      </label>
                    </>
                  )}
                  <span className="text-zinc-300">|</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!it.zanzariera} onChange={(e) => upd(i, "zanzariera", e.target.checked)} data-testid={`iqc-zanzariera-${i}`} /> Zanzariera
                  </label>
                  <div className="ml-auto font-mono font-bold text-zinc-900">{fmtEur2(price)}</div>
                  <button onClick={() => del(i)} className="p-1 hover:bg-rose-50 rounded text-rose-600 text-xs">Rimuovi</button>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={add} className="rounded-sm" data-testid="iqc-add-row">+ Aggiungi un altro infisso</Button>
        </div>
        <div className="px-6 py-4 border-t flex justify-between items-center bg-zinc-50 sticky bottom-0">
          <div className="text-sm">Totale infissi: <span className="font-bold text-lg font-mono">{fmtEur2(totale)}</span></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annulla</Button>
            <Button style={{ background: "var(--brand)", color: "white" }} onClick={confirm} disabled={items.length === 0} data-testid="iqc-confirm-btn">Aggiungi al preventivo</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
