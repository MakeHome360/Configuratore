import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

function fmtEur(n) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0); }

/**
 * Widget che mostra marginalità live di un preventivo: ricavo, costi diretti (stima),
 * costi fissi globali, provvigione venditore, utile netto e %.
 * Visibile solo ad admin/gestore/responsabile.
 */
export default function MarginalitaWidget({ totaleIvaEscl, ricaricoDefault = 1.8, costiDirettiOverride = null, ruoloDefault = "semplice" }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [ruolo, setRuolo] = useState(ruoloDefault);
  const [costiDir, setCostiDir] = useState(costiDirettiOverride);
  const visibile = ["admin", "gestore", "responsabile"].includes((user?.role || "").toLowerCase());

  // Stima costi diretti: se non override, usa ricavo / ricarico (es. 1.8 → costi ≈ 55% del ricavo)
  const costiDirStimati = costiDir != null ? Number(costiDir) : Math.round((Number(totaleIvaEscl) || 0) / Math.max(1, ricaricoDefault));

  useEffect(() => {
    if (!visibile || !open || !totaleIvaEscl || totaleIvaEscl <= 0) return;
    let cancel = false;
    api.post("/marginalita/calcola", {
      totale_iva_escl: Number(totaleIvaEscl),
      costi_diretti: costiDirStimati,
      ruolo_venditore: ruolo,
    }).then(r => { if (!cancel) setData(r.data); }).catch(() => {});
    return () => { cancel = true; };
  }, [open, totaleIvaEscl, ruolo, costiDirStimati, visibile]);

  if (!visibile) return null;

  return (
    <div className="mb-4" data-testid="marg-widget">
      <button onClick={() => setOpen(!open)} className="w-full text-left text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center justify-between hover:text-zinc-900 py-2 border-t border-zinc-200" data-testid="marg-toggle">
        <span>📊 Marginalità interna {open ? "▾" : "▸"}</span>
        {data && <span className={`font-bold ${data.sotto_soglia ? "text-rose-600" : "text-emerald-700"} normal-case tracking-normal`}>{data.margine_pct}%</span>}
      </button>
      {open && data && (
        <div className="bg-zinc-50 border border-zinc-200 rounded p-2.5 mt-1 space-y-1.5 mono text-[11px]" data-testid="marg-detail">
          <div className="flex gap-2 items-center mb-1">
            <label className="text-zinc-500">Ruolo:</label>
            <select className="text-[10px] border border-zinc-300 rounded h-6 px-1 flex-1" value={ruolo} onChange={(e) => setRuolo(e.target.value)} data-testid="marg-ruolo">
              <option value="semplice">Venditore semplice</option>
              <option value="responsabile">Responsabile P.V.</option>
              <option value="area_manager">Area Manager</option>
            </select>
          </div>
          <div className="flex gap-2 items-center mb-1">
            <label className="text-zinc-500">Costi diretti:</label>
            <input
              type="number"
              className="text-[10px] border border-zinc-300 rounded h-6 px-1 flex-1 text-right mono"
              value={costiDirStimati}
              onChange={(e) => setCostiDir(Number(e.target.value))}
              data-testid="marg-costi-dir"
            />
          </div>
          <div className="flex justify-between text-emerald-700"><span>Ricavo</span><span>{fmtEur(data.ricavo)}</span></div>
          <div className="flex justify-between text-rose-700"><span>− Costi diretti</span><span>− {fmtEur(data.costi_diretti)}</span></div>
          <div className="flex justify-between text-blue-700 border-t border-zinc-200 pt-1"><span>= Margine lordo</span><span>{fmtEur(data.margine_lordo)} ({data.margine_lordo_pct}%)</span></div>
          {(data.costi_fissi_breakdown || []).map(cf => (
            <div key={cf.id} className="flex justify-between text-zinc-600 text-[10px]"><span>− {cf.nome} {cf.tipo === "percentuale" ? `(${cf.valore_config}%)` : ""}</span><span>− {fmtEur(cf.importo)}</span></div>
          ))}
          <div className="flex justify-between text-amber-700"><span>− Provvigione venditore ({data.provvigione_venditore_pct}%)</span><span>− {fmtEur(data.provvigione_venditore)}</span></div>
          <div className={`flex justify-between font-bold text-sm border-t border-zinc-300 pt-1 ${data.sotto_soglia ? "text-rose-700" : "text-emerald-700"}`}>
            <span>= Utile netto</span><span>{fmtEur(data.utile_netto)}</span>
          </div>
          <div className={`flex justify-between text-[10px] ${data.sotto_soglia ? "text-rose-600 font-bold" : "text-zinc-500"}`}>
            <span>Margine {data.margine_pct}% {data.sotto_soglia && "⚠ SOTTO SOGLIA"}</span>
            <span>min {data.soglia_margine_minimo}%</span>
          </div>
          <div className="text-[9px] text-zinc-400 italic pt-1">⚠ I costi diretti sono stimati. Modificali per un calcolo preciso.</div>
        </div>
      )}
    </div>
  );
}
