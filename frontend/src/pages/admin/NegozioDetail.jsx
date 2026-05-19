import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, Badge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Mail, Users2, TrendingUp, FileText, Hammer, Euro, Target } from "lucide-react";
import { toast } from "sonner";

function fmtEur(n) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n) || 0); }

export default function NegozioDetail() {
  const { nid } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/negozi/${nid}/dashboard`);
      setData(r.data);
    } catch (e) {
      toast.error("Negozio non trovato");
      nav("/adminnegozi");
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [nid]);

  if (loading || !data) return <div className="p-16 text-center mono text-zinc-500">caricamento…</div>;
  const neg = data.negozio;
  const tot = data.totali || {};
  const venditori = data.venditori || [];
  // Sort venditori per fatturato discendente
  const sorted = [...venditori].sort((a, b) => (b.kpi.fatturato_venduto || 0) - (a.kpi.fatturato_venduto || 0));

  return (
    <div data-testid="negozio-detail-page">
      <PageHeader
        title={neg.name}
        subtitle={<div className="flex items-center gap-3 mt-1 flex-wrap">
          {neg.code && <span className="text-xs mono text-zinc-500">[{neg.code}]</span>}
          {neg.active !== false ? <Badge color="green">Attivo</Badge> : <Badge color="red">Non attivo</Badge>}
          {neg.indirizzo && <span className="text-xs text-zinc-500">📍 {neg.indirizzo}</span>}
          {neg.telefono && <a href={`tel:${neg.telefono}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Phone className="h-3 w-3" />{neg.telefono}</a>}
          {neg.email && <a href={`mailto:${neg.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Mail className="h-3 w-3" />{neg.email}</a>}
        </div>}
        actions={<Button variant="outline" onClick={() => nav("/adminnegozi")} size="sm" data-testid="negozio-back"><ArrowLeft className="h-4 w-4 mr-1" />Torna alla lista</Button>}
      />
      <Page>

        {/* KPI totale negozio */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6" data-testid="negozio-kpi">
          <Kpi icon={Users2} color="purple" label="Venditori" value={tot.num_venditori} sub={`${tot.num_venditori_attivi} attivi`} />
          <Kpi icon={Target} color="blue" label="Lead" value={tot.lead_count} sub={`${tot.lead_vinti} vinti`} />
          <Kpi icon={TrendingUp} color="emerald" label="Conv. rate" value={`${tot.conversion_rate}%`} />
          <Kpi icon={FileText} color="amber" label="Preventivi" value={tot.preventivi_totali} />
          <Kpi icon={Hammer} color="indigo" label="Commesse attive" value={tot.commesse_attive} sub={`${tot.commesse_concluse} concluse`} />
          <Kpi icon={Euro} color="rose" label="Fatturato venduto" value={fmtEur(tot.fatturato_venduto)} mono />
        </div>

        {/* Tabella venditori con classifica */}
        <div className="bg-white border border-zinc-200 rounded-lg" data-testid="negozio-venditori-table">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Venditori del negozio</h3>
              <p className="text-xs text-zinc-500">Classifica per fatturato venduto (preventivi accettati). Click su una riga per dettaglio.</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 w-8">#</th>
              <th className="px-3 py-2 text-left">Venditore</th>
              <th className="px-3 py-2 text-center">Lead</th>
              <th className="px-3 py-2 text-center">Vinti</th>
              <th className="px-3 py-2 text-center">Conv. %</th>
              <th className="px-3 py-2 text-center">Preventivi</th>
              <th className="px-3 py-2 text-center">Commesse</th>
              <th className="px-3 py-2 text-right">Fatturato venduto</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((v, i) => (
                <tr key={v.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => nav(`/adminvenditori`)} data-testid={`negozio-venditore-${v.id}`}>
                  <td className="px-3 py-2 text-center font-bold text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium flex items-center gap-1">
                      {i === 0 && sorted.length > 1 && <span title="Top performer">🏆</span>}
                      {v.name}
                      {!v.active && <Badge color="zinc">disattivo</Badge>}
                    </div>
                    <div className="text-[10px] text-zinc-500">{v.email}</div>
                  </td>
                  <td className="px-3 py-2 text-center mono">{v.kpi.lead_count}</td>
                  <td className="px-3 py-2 text-center mono text-emerald-700">{v.kpi.lead_vinti}</td>
                  <td className="px-3 py-2 text-center mono">{v.kpi.conversion_rate}%</td>
                  <td className="px-3 py-2 text-center"><div className="mono">{v.kpi.preventivi_totali}</div><div className="text-[9px] text-zinc-500">{v.kpi.preventivi_ultimo_mese} ultimo mese</div></td>
                  <td className="px-3 py-2 text-center"><div className="mono text-amber-700">{v.kpi.commesse_attive}</div><div className="text-[9px] text-zinc-500">{v.kpi.commesse_concluse} concluse</div></td>
                  <td className="px-3 py-2 text-right mono font-bold text-rose-700">{fmtEur(v.kpi.fatturato_venduto)}</td>
                </tr>
              ))}
              {!sorted.length && <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-400 italic">Nessun venditore assegnato a questo negozio. Vai su <button onClick={() => nav("/adminvenditori")} className="text-blue-600 hover:underline">Venditori</button> per assegnarli (campo Negozio).</td></tr>}
            </tbody>
          </table>
        </div>

      </Page>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, sub, mono }) {
  const COLOR = {
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
  };
  return (
    <div className={`border rounded-lg p-3 ${COLOR[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-wider font-bold truncate">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${mono ? "mono" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}
