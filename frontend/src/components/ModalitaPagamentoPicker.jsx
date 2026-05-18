import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Info } from "lucide-react";

/**
 * Picker modalità di pagamento per il preventivo.
 * - Carica i preset da /dati-azienda.payment_presets
 * - Permette di scegliere un preset o entrare in modalità "personalizzato"
 * - Salva su prev.modalita_pagamento = { preset_id, label, rate: [{descrizione, pct}] }
 *
 * Usato in PreventivoPacchetto e PreventivoComposite step Riepilogo.
 */
export default function ModalitaPagamentoPicker({ prev, setPrev, totale }) {
  const [presets, setPresets] = useState([]);
  const [custom, setCustom] = useState(false);
  useEffect(() => {
    api.get("/dati-azienda").then(r => {
      const ps = (r.data || {}).payment_presets || [];
      setPresets(ps);
      // Auto-selezione del default se nessuna modalità scelta
      if (!prev.modalita_pagamento?.preset_id && !prev.modalita_pagamento?.rate?.length && ps.length) {
        const def = ps.find(p => p.default) || ps[0];
        if (def) applyPreset(def.id, ps);
      }
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);
  const mp = prev.modalita_pagamento || { preset_id: "", label: "", rate: [] };
  const applyPreset = (pid, list) => {
    const arr = list || presets;
    const p = arr.find(x => x.id === pid);
    if (!p) return;
    setCustom(false);
    setPrev(s => ({
      ...s,
      modalita_pagamento: {
        preset_id: pid,
        label: p.nome,
        rate: (p.rate || []).map(r => ({ descrizione: r.descrizione, pct: parseFloat(r.pct) || 0 })),
      },
    }));
  };
  const enterCustom = () => {
    setCustom(true);
    if (!mp.rate || !mp.rate.length) {
      setPrev(s => ({ ...s, modalita_pagamento: { preset_id: "custom", label: "Personalizzata", rate: [{ descrizione: "Acconto firma", pct: 30 }, { descrizione: "Saldo fine lavori", pct: 70 }] } }));
    } else {
      setPrev(s => ({ ...s, modalita_pagamento: { ...mp, preset_id: "custom", label: "Personalizzata" } }));
    }
  };
  const updRata = (i, k, v) => setPrev(s => ({
    ...s,
    modalita_pagamento: { ...mp, rate: mp.rate.map((r, j) => j === i ? { ...r, [k]: k === "pct" ? (parseFloat(v) || 0) : v } : r) },
  }));
  const addRata = () => setPrev(s => ({ ...s, modalita_pagamento: { ...mp, rate: [...(mp.rate || []), { descrizione: "Rata", pct: 0 }] } }));
  const delRata = (i) => setPrev(s => ({ ...s, modalita_pagamento: { ...mp, rate: mp.rate.filter((_, j) => j !== i) } }));
  const totPct = (mp.rate || []).reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);

  return (
    <div className="pt-3 border-t border-zinc-200" data-testid="modalita-pagamento-picker">
      <div className="label-kicker mb-2">Modalità di pagamento</div>
      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed flex items-start gap-1.5"><Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> Scegli una modalità dai preset configurati dall'admin, oppure personalizzala. Verrà <strong>congelata in commessa come bozza di "Allegato A"</strong> che potrai poi affinare con date e fasi cantiere.</p>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Select value={custom ? "custom" : (mp.preset_id || "")} onValueChange={(v) => v === "custom" ? enterCustom() : applyPreset(v)}>
          <SelectTrigger className="h-9 max-w-xs" data-testid="mp-select"><SelectValue placeholder={presets.length ? "Scegli preset…" : "Nessun preset configurato"} /></SelectTrigger>
          <SelectContent>
            {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} {p.default ? "★" : ""}</SelectItem>)}
            <SelectItem value="custom">✏️ Personalizzata</SelectItem>
          </SelectContent>
        </Select>
        {presets.length === 0 && (
          <Button size="sm" variant="outline" onClick={enterCustom} data-testid="mp-personalizza" className="h-9">✏️ Personalizza</Button>
        )}
      </div>
      {(mp.rate || []).length > 0 && (
        <table className="w-full text-xs mt-2">
          <thead className="text-zinc-500 uppercase border-b border-zinc-200"><tr>
            <th className="py-1 text-left">Rata</th>
            <th className="py-1 text-right w-20">%</th>
            <th className="py-1 text-right w-28">Importo</th>
            {custom && <th className="w-8"></th>}
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {(mp.rate || []).map((r, i) => (
              <tr key={i}>
                <td className="py-1.5">
                  {custom
                    ? <Input value={r.descrizione} onChange={e => updRata(i, "descrizione", e.target.value)} className="h-7 text-xs" data-testid={`mp-rata-desc-${i}`} />
                    : <span className="text-zinc-700">{r.descrizione}</span>}
                </td>
                <td className="py-1.5 text-right">
                  {custom
                    ? <Input type="number" step="0.5" value={r.pct} onChange={e => updRata(i, "pct", e.target.value)} className="h-7 text-xs text-right mono" data-testid={`mp-rata-pct-${i}`} />
                    : <span className="mono">{(parseFloat(r.pct) || 0).toFixed(2)}%</span>}
                </td>
                <td className="py-1.5 text-right mono font-semibold">€ {((totale || 0) * (parseFloat(r.pct) || 0) / 100).toFixed(2)}</td>
                {custom && <td className="py-1.5 text-right"><button onClick={() => delRata(i)} className="text-rose-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-200 font-semibold">
            <tr>
              <td className="py-1.5">Totale</td>
              <td className={`py-1.5 text-right mono ${Math.abs(totPct - 100) > 0.01 ? "text-rose-600" : "text-emerald-700"}`} data-testid="mp-tot-pct">{totPct.toFixed(2)}%</td>
              <td className="py-1.5 text-right mono">€ {((totale || 0) * totPct / 100).toFixed(2)}</td>
              {custom && <td></td>}
            </tr>
          </tfoot>
        </table>
      )}
      {custom && (
        <Button size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={addRata} data-testid="mp-add-rata"><Plus className="h-3.5 w-3.5 mr-1" /> Rata</Button>
      )}
      {Math.abs(totPct - 100) > 0.01 && (mp.rate || []).length > 0 && (
        <p className="text-[10px] text-rose-600 mt-1">⚠ Le rate non totalizzano 100% — verifica le percentuali prima di salvare.</p>
      )}
    </div>
  );
}
