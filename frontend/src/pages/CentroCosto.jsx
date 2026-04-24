import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur } from "@/components/ui-kit";

export default function CentroCosto() {
  const [commesse, setCommesse] = useState([]);
  useEffect(() => { api.get("/commesse").then((r) => setCommesse(r.data || [])); }, []);
  const ricavo = commesse.reduce((s, c) => s + (c.totale_preventivo || 0), 0);
  const costi_eff = commesse.reduce((s, c) => s + (c.costi_effettivi || 0), 0);
  const margine = ricavo - costi_eff;
  const marginePct = ricavo ? (margine / ricavo) * 100 : 0;
  return (
    <div>
      <PageHeader title="Centro di Costo" subtitle="Analisi marginalità per commessa e per voce (solo Admin)" />
      <Page>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Ricavo Totale" value={fmtEur(ricavo)} />
          <StatCard label="Costo Effettivo" value={fmtEur(costi_eff)} />
          <StatCard label="Margine Totale" value={fmtEur(margine)} color={margine >= 0 ? "text-emerald-600" : "text-rose-600"} />
          <StatCard label="Margine %" value={`${marginePct.toFixed(1)}%`} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr><th className="px-3 py-2 text-left">Commessa</th><th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-right">Ricavo</th><th className="px-3 py-2 text-right">Costo Prev.</th>
                <th className="px-3 py-2 text-right">Costo Eff.</th><th className="px-3 py-2 text-right">Margine €</th>
                <th className="px-3 py-2 text-right">Margine %</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {commesse.map((c) => {
                const costoPrev = (c.voci_acquisti || []).reduce((s, v) => s + (v.preventivato || 0), 0);
                const costoEff = (c.voci_acquisti || []).reduce((s, v) => s + (v.effettivo || 0), 0);
                const mar = (c.totale_preventivo || 0) - costoEff;
                const marPct = c.totale_preventivo ? (mar / c.totale_preventivo * 100) : 0;
                return (
                  <tr key={c.id} data-testid={`cc-row-${c.id}`}>
                    <td className="px-3 py-2 font-mono text-xs">{c.numero}</td>
                    <td className="px-3 py-2">{c.cliente?.nome} {c.cliente?.cognome}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(c.totale_preventivo)}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(costoPrev)}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(costoEff)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${mar >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtEur(mar)}</td>
                    <td className="px-3 py-2 text-right">{marPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {!commesse.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">Nessuna commessa</td></tr>}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
