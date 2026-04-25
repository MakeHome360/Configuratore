import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Briefcase, AlertCircle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const Page = ({ children }) => <div className="p-6 max-w-7xl mx-auto space-y-6">{children}</div>;

export default function DashboardSubappaltatori() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/subappaltatori-dashboard").then(r => setSubs(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totFatturato = subs.reduce((s, x) => s + (x.fatturato || 0), 0);
  const totIncassato = subs.reduce((s, x) => s + (x.incassato || 0), 0);
  const totDaIncassare = subs.reduce((s, x) => s + (x.da_incassare || 0), 0);
  const totRitardi = subs.reduce((s, x) => s + (x.ritardi || 0), 0);

  return (
    <Page>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard Subappaltatori</h1>
          <p className="text-sm text-zinc-500 mt-1">Stato finanziario, cantieri attivi e ritardi per ogni subappaltatore.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Fatturato totale" value={`€ ${totFatturato.toLocaleString("it-IT")}`} icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} />
        <KPI label="Incassato" value={`€ ${totIncassato.toLocaleString("it-IT")}`} icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
        <KPI label="Da incassare" value={`€ ${totDaIncassare.toLocaleString("it-IT")}`} icon={<TrendingUp className="h-5 w-5 text-amber-600" />} />
        <KPI label="Ritardi" value={totRitardi} icon={<AlertCircle className="h-5 w-5 text-rose-600" />} />
      </div>

      <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
        <table className="w-full text-sm" data-testid="subapp-dashboard-table">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-left text-xs uppercase tracking-widest text-zinc-500">
              <th className="p-3">Subappaltatore</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Cantieri attivi</th>
              <th className="p-3">Importo totale</th>
              <th className="p-3">Fatturato</th>
              <th className="p-3">Incassato</th>
              <th className="p-3">Da incassare</th>
              <th className="p-3">Ritardi</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="p-4 text-center text-zinc-400 mono">caricamento…</td></tr>
              : subs.length === 0 ? <tr><td colSpan={9} className="p-4 text-center text-zinc-400">Nessun subappaltatore. Aggiungili in /adminsubappaltatori.</td></tr>
              : subs.map(s => (
                <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50" data-testid={`subapp-row-${s.id}`}>
                  <td className="p-3 font-medium">{s.nome}</td>
                  <td className="p-3 text-zinc-600">{s.categoria || "-"}</td>
                  <td className="p-3 mono">{s.num_cantieri_attivi}/{s.num_cantieri_totali}</td>
                  <td className="p-3 mono">€ {(s.importo_totale || 0).toLocaleString("it-IT")}</td>
                  <td className="p-3 mono">€ {(s.fatturato || 0).toLocaleString("it-IT")}</td>
                  <td className="p-3 mono text-emerald-700">€ {(s.incassato || 0).toLocaleString("it-IT")}</td>
                  <td className="p-3 mono text-amber-700">€ {(s.da_incassare || 0).toLocaleString("it-IT")}</td>
                  <td className="p-3 mono">
                    {s.ritardi > 0 ? <span className="text-rose-700 font-bold">{s.ritardi} ⚠</span> : <span className="text-zinc-400">0</span>}
                  </td>
                  <td className="p-3"><Link to={`/subappaltatori/${s.id}`} className="text-blue-600 hover:underline text-xs" data-testid={`subapp-detail-${s.id}`}>Dettaglio →</Link></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

function KPI({ label, value, icon }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-md p-4 flex items-center justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
        <div className="text-2xl font-semibold mono mt-1">{value}</div>
      </div>
      <div>{icon}</div>
    </div>
  );
}
