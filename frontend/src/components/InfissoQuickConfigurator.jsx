import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { toast } from "sonner";
import { fmtEur2 } from "@/components/ui-kit";
import AbacoInfisso from "@/components/AbacoInfisso";

function resolveTipologiaId(categoria, apertura, tipologie) {
  if (apertura === "scorrevole") {
    const sc = tipologie.find((t) => (t.category || "").toLowerCase().includes("scorrevole"));
    if (sc) return sc.id;
  }
  const wantsCat = categoria === "portafinestra" ? "portafinestra" : "finestra";
  // preferenza: prima la 1-anta, poi 2-ante; il pricing scala con anteFactor (1 + 0.05*(ante-1))
  return tipologie.find((t) => t.id === `inf-${wantsCat}-1anta`)?.id
    || tipologie.find((t) => t.id === `inf-${wantsCat}-2ante`)?.id
    || tipologie.find((t) => (t.category || "").toLowerCase() === wantsCat)?.id
    || tipologie[0]?.id;
}

export function InfissoQuickConfigurator({ open, onClose, onConfirm }) {
  const [conf, setConf] = useState({ tipologie: [], materiali: [], vetri: [] });
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    api.get("/infissi-config").then((r) => {
      setConf(r.data);
      setItems([{
        categoria: "finestra", apertura: "battente", ante: 2, hingeSide: "sx",
        materiale_id: r.data.materiali[0]?.id, vetro_id: r.data.vetri[0]?.id,
        larghezza: 120, altezza: 140, qty: 1, colore: "bianco",
        tapparella: false, tapparella_colore: "antracite", tapparella_motorizzata: false,
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
    const scorrFactor = it.apertura === "scorrevole" ? 1.20 : 1.0;
    return Math.round((base * anteFactor * scorrFactor + tapp + zanz) * (it.qty || 1));
  };

  const upd = (i, k, v) => setItems((arr) => arr.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const del = (i) => setItems((arr) => arr.filter((_, j) => j !== i));
  const add = () => {
    if (!conf.tipologie?.length) { toast.error("Configurazione in caricamento, riprova"); return; }
    setItems([...items, {
      categoria: "finestra", apertura: "battente", ante: 2, hingeSide: "sx",
      materiale_id: conf.materiali[0]?.id, vetro_id: conf.vetri[0]?.id,
      larghezza: 120, altezza: 140, qty: 1, colore: "bianco",
      tapparella: false, tapparella_colore: "antracite", tapparella_motorizzata: false,
      zanzariera: false,
    }]);
  };

  const totale = items.reduce((s, it) => s + calcPrice(it), 0);

  const confirm = () => {
    const enriched = items.map((it) => {
      const tipologia_id = resolveTipologiaId(it.categoria, it.apertura, conf.tipologie);
      const tip = conf.tipologie.find((x) => x.id === tipologia_id);
      const mat = conf.materiali.find((x) => x.id === it.materiale_id);
      const vet = conf.vetri.find((x) => x.id === it.vetro_id);
      return {
        ...it, tipologia_id,
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
          <div className="text-xs text-zinc-700 bg-emerald-50 border border-emerald-200 rounded p-2.5 leading-snug">
            🔄 <strong>Prezzi allineati al Listino Opere</strong> — la base €/m² di ogni materiale è letta automaticamente dalle Voci Backoffice (es. "Infissi PVC bianchi" 504 €/m²).
            Eventuali maggiorazioni per <strong>n° ante (+5% per anta oltre la prima)</strong>, <strong>apertura scorrevole (+20%)</strong>, <strong>tapparelle (120 €/m²)</strong> e <strong>zanzariere (80 €/m²)</strong> sono aggiunte sopra alla base.
            <span className="block text-[10px] text-zinc-500 mt-1">Per modificare la base, vai in <em>Voci Backoffice → INFISSI</em>: il configuratore si aggiorna automaticamente.</span>
          </div>
          <div className="text-xs text-zinc-600 bg-amber-50 border border-amber-200 rounded p-2">
            Configura uno o più infissi esterni. Tapparelle e zanzariere sono opzionali per ogni infisso. Il totale verrà aggiunto come <strong>extra</strong> al preventivo.
          </div>
          {items.map((it, i) => {
            const mat = conf.materiali.find((x) => x.id === it.materiale_id);
            const vet = conf.vetri.find((x) => x.id === it.vetro_id);
            const price = calcPrice(it);
            const ante = Number(it.ante) || 1;
            return (
              <div key={i} className="border-2 border-zinc-200 rounded p-3 space-y-3" data-testid={`iqc-row-${i}`}>
                <AbacoInfisso
                  categoria={it.categoria || "finestra"}
                  apertura={it.apertura || "battente"}
                  hingeSide={it.hingeSide || "sx"}
                  colore={it.colore}
                  larghezza={it.larghezza}
                  altezza={it.altezza}
                  materiale={mat?.name}
                  vetro={vet?.name}
                  ante={ante}
                  tapparella={it.tapparella}
                  tapparella_colore={it.tapparella_colore}
                  zanzariera={it.zanzariera}
                  size="mini"
                />
                {/* Tipologia + Apertura + Ante */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-4"><Label className="text-xs uppercase font-bold">📐 Tipologia</Label>
                    <select className="w-full border-2 border-zinc-300 rounded h-10 px-2 text-sm font-bold font-mono mt-1" value={it.categoria || "finestra"} onChange={(e) => upd(i, "categoria", e.target.value)} data-testid={`iqc-cat-${i}`}>
                      <option value="finestra">Finestra</option>
                      <option value="portafinestra">Porta-finestra</option>
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-4"><Label className="text-xs uppercase font-bold">🔁 Apertura</Label>
                    <select className="w-full border-2 border-zinc-300 rounded h-10 px-2 text-sm font-bold font-mono mt-1" value={it.apertura || "battente"} onChange={(e) => upd(i, "apertura", e.target.value)} data-testid={`iqc-ap-${i}`}>
                      <option value="battente">Battente</option>
                      <option value="scorrevole">Scorrevole (+20%)</option>
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-4"><Label className="text-xs uppercase font-bold">▦ N° Ante</Label>
                    <select className="w-full border-2 border-zinc-300 rounded h-10 px-2 text-sm font-bold font-mono mt-1" value={it.ante} onChange={(e) => upd(i, "ante", Number(e.target.value))} data-testid={`iqc-ante-${i}`}>
                      <option value={1}>1 anta</option><option value={2}>2 ante</option><option value={3}>3 ante</option><option value={4}>4 ante</option>
                    </select>
                  </div>
                </div>
                {/* Lato cerniera (solo 1 anta battente) */}
                {ante === 1 && it.apertura !== "scorrevole" && (
                  <div>
                    <Label className="text-xs uppercase font-bold">🔄 Lato cerniera</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button onClick={() => upd(i, "hingeSide", "sx")} className={`h-10 border-2 font-semibold text-xs ${(it.hingeSide || "sx") === "sx" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`} data-testid={`iqc-hinge-sx-${i}`}>◀ SX (maniglia dx)</button>
                      <button onClick={() => upd(i, "hingeSide", "dx")} className={`h-10 border-2 font-semibold text-xs ${it.hingeSide === "dx" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`} data-testid={`iqc-hinge-dx-${i}`}>DX (maniglia sx) ▶</button>
                    </div>
                  </div>
                )}
                {/* Materiale + Vetro + Colore */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-4"><Label className="text-xs">Materiale</Label>
                    <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.materiale_id} onChange={(e) => upd(i, "materiale_id", e.target.value)}>
                      {conf.materiali.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-4"><Label className="text-xs">Vetro</Label>
                    <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.vetro_id} onChange={(e) => upd(i, "vetro_id", e.target.value)}>
                      {conf.vetri.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-4"><Label className="text-xs">Colore</Label>
                    <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={it.colore} onChange={(e) => upd(i, "colore", e.target.value)}>
                      <option value="bianco">Bianco</option><option value="antracite">Antracite</option><option value="grigio">Grigio</option><option value="marrone">Marrone</option><option value="noce">Noce</option><option value="rovere">Rovere</option>
                    </select>
                  </div>
                </div>
                {/* Misure GROSSE */}
                <div className="grid grid-cols-12 gap-2 items-end bg-amber-50 border border-amber-200 p-3 rounded">
                  <div className="col-span-4"><Label className="text-sm uppercase font-bold">📏 Larghezza (cm)</Label><Input type="number" min={20} step="1" className="h-11 text-xl font-mono font-extrabold text-center" value={it.larghezza} onChange={(e) => upd(i, "larghezza", Math.max(20, Number(e.target.value) || 20))} /></div>
                  <div className="col-span-4"><Label className="text-sm uppercase font-bold">📐 Altezza (cm)</Label><Input type="number" min={20} step="1" className="h-11 text-xl font-mono font-extrabold text-center" value={it.altezza} onChange={(e) => upd(i, "altezza", Math.max(20, Number(e.target.value) || 20))} /></div>
                  <div className="col-span-2"><Label className="text-sm uppercase font-bold">× Qty</Label><Input type="number" min={1} step="1" className="h-11 text-xl font-mono font-extrabold text-center" value={it.qty} onChange={(e) => upd(i, "qty", Math.max(1, Number(e.target.value) || 1))} /></div>
                  <div className="col-span-2 text-right"><div className="text-[10px] uppercase">Prezzo</div><div className="text-lg font-bold font-mono">{fmtEur2(price)}</div></div>
                </div>
                {/* Accessori */}
                <div className="flex flex-wrap items-center gap-3 bg-zinc-50 border border-dashed border-zinc-300 rounded p-2 text-xs">
                  <span className="font-semibold text-zinc-700">Accessori:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!it.tapparella} onChange={(e) => upd(i, "tapparella", e.target.checked)} data-testid={`iqc-tapparella-${i}`} /> Tapparella</label>
                  {it.tapparella && (<>
                    <select className="border border-zinc-300 rounded h-7 px-1.5 text-xs" value={it.tapparella_colore} onChange={(e) => upd(i, "tapparella_colore", e.target.value)}>
                      <option value="bianco">Bianca</option><option value="antracite">Antracite</option><option value="marrone">Marrone</option>
                    </select>
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!it.tapparella_motorizzata} onChange={(e) => upd(i, "tapparella_motorizzata", e.target.checked)} /> Motorizzata</label>
                  </>)}
                  <span className="text-zinc-300">|</span>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!it.zanzariera} onChange={(e) => upd(i, "zanzariera", e.target.checked)} data-testid={`iqc-zanzariera-${i}`} /> Zanzariera</label>
                  <button onClick={() => del(i)} className="ml-auto p-1 hover:bg-rose-50 rounded text-rose-600 text-xs">Rimuovi</button>
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
