import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur } from "@/components/ui-kit";

export default function AdminReportBudget() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/commesse").then((r) => setRows(r.data || [])); }, []);
  const preventivato = rows.reduce((s, c) => s + (c.voci_acquisti || []).reduce((a, v) => a + (v.preventivato || 0), 0), 0);
  const effettivo = rows.reduce((s, c) => s + (c.voci_acquisti || []).reduce((a, v) => a + (v.effettivo || 0), 0), 0);
  const delta = effettivo - preventivato;
  const sfori = rows.filter((c) => (c.voci_acquisti || []).some((v) => v.effettivo > v.preventivato)).length;
  const risparmi = rows.filter((c) => (c.voci_acquisti || []).some((v) => v.effettivo < v.preventivato && v.effettivo > 0)).length;

  return (
    <div>
      <PageHeader title="Report Budget Subappalti" subtitle="Analisi in tempo reale dei delta tra costi preventivati e effettivi" />
      <Page>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatCard label="Preventivato" value={fmtEur(preventivato)} />
          <StatCard label="Effettivo" value={fmtEur(effettivo)} />
          <StatCard label="Delta Totale" value={fmtEur(delta)} color={delta <= 0 ? "text-emerald-600" : "text-rose-600"} />
          <StatCard label="Sfori Budget" value={sfori} color="text-rose-600" />
          <StatCard label="Risparmi" value={risparmi} color="text-emerald-600" />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr><th className="px-3 py-2 text-left">Cliente</th><th className="px-3 py-2 text-left">Indirizzo</th>
                <th className="px-3 py-2 text-right">Preventivato</th><th className="px-3 py-2 text-right">Effettivo</th>
                <th className="px-3 py-2 text-right">Delta</th><th className="px-3 py-2 text-left">Stato</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((c) => {
                const p = (c.voci_acquisti || []).reduce((s, v) => s + (v.preventivato || 0), 0);
                const e = (c.voci_acquisti || []).reduce((s, v) => s + (v.effettivo || 0), 0);
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{c.cliente?.nome}</td>
                    <td className="px-3 py-2 text-xs">{c.cliente?.indirizzo || "-"}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(p)}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(e)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${(e - p) > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtEur(e - p)}</td>
                    <td className="px-3 py-2">{c.stato}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Nessuna commessa</td></tr>}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
