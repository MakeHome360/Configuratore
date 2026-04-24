import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur } from "@/components/ui-kit";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

export default function AdminOptional() {
  const [optional, setOptional] = useState([]);
  const [pkg, setPkg] = useState("pkg-basic");

  useEffect(() => { api.get("/packages/optional").then((r) => setOptional(r.data || [])); }, []);

  const filt = optional.filter((o) => o.package_ids.includes(pkg));

  return (
    <div>
      <PageHeader title="Gestione Optional" subtitle="Configura gli optional per ogni pacchetto" />
      <Page>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {Object.entries(PKG_NAMES).map(([id, name]) => (
            <button key={id} onClick={() => setPkg(id)} data-testid={`adm-opt-tab-${id}`}
              className={`p-4 border-2 rounded-lg text-left ${pkg === id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
              <div className="font-bold">{name}</div>
              <div className="text-xs text-zinc-500">{optional.filter((o) => o.package_ids.includes(id)).length} optional</div>
            </button>
          ))}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50 font-semibold">Optional Pacchetto {PKG_NAMES[pkg]}</div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-zinc-500 bg-zinc-50">
              <tr><th className="px-3 py-2 text-left">Optional</th><th className="px-3 py-2 text-right">Listino</th><th className="px-3 py-2 text-right">Scontato</th><th className="px-3 py-2 text-right">Risparmio</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((o) => {
                const risp = o.price_listino - o.price_scontato;
                const pct = o.price_listino ? (risp / o.price_listino * 100) : 0;
                return (
                  <tr key={o.id}>
                    <td className="px-3 py-2">{o.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur(o.price_listino)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur(o.price_scontato)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600">-{pct.toFixed(0)}% ({fmtEur(risp)})</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-zinc-500 bg-amber-50 border border-amber-200 p-3 rounded">
          <strong>Come funziona:</strong> Il cliente paga il Prezzo Scontato invece del Listino, risparmiando la differenza.
        </div>
      </Page>
    </div>
  );
}
