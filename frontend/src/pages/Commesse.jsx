import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, fmtEur2, statoCommessaBadge } from "@/components/ui-kit";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

export default function Commesse() {
  const [rows, setRows] = useState([]);
  const [stato, setStato] = useState("");
  const nav = useNavigate();
  useEffect(() => { api.get("/commesse").then((r) => setRows(r.data || [])); }, []);

  const filt = rows.filter((c) => !stato || c.stato === stato);
  const totali = rows.length;
  const in_corso = rows.filter((r) => r.stato === "in_corso").length;
  const fatturato = rows.reduce((s, r) => s + (r.fatturato || 0), 0);
  const incassato = rows.reduce((s, r) => s + (r.incassato || 0), 0);

  return (
    <div>
      <PageHeader title="Commesse" subtitle="Gestisci i lavori in corso e completati" />
      <Page>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard label="Commesse Totali" value={totali} />
          <StatCard label="In Corso" value={in_corso} color="text-blue-600" />
          <StatCard label="Fatturato" value={fmtEur(fatturato)} />
          <StatCard label="Incassato" value={fmtEur(incassato)} color="text-emerald-600" />
        </div>

        <div className="mb-4 flex gap-2">
          {[["","Tutti"],["da_iniziare","Da Iniziare"],["in_corso","In Corso"],["completata","Completate"],["sospesa","Sospese"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setStato(k)} data-testid={`com-filter-${k || "all"}`}
              className={`px-3 py-1.5 rounded-full text-sm border ${stato === k ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:bg-zinc-100"}`}>{lbl}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filt.map((c) => (
            <button key={c.id} onClick={() => nav(`/dettagliocommessa/${c.id}`)} data-testid={`com-card-${c.id}`}
              className="text-left bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                {statoCommessaBadge(c.stato)}
                <span className="text-xs font-mono text-zinc-500">{c.numero}</span>
              </div>
              <div className="mb-2"><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--brand)" }}>{PKG_NAMES[c.package_id] || "—"}</span></div>
              <div className="text-lg font-bold text-zinc-900 mb-3">{c.cliente?.nome} {c.cliente?.cognome}</div>
              <div className="grid grid-cols-2 gap-3 text-sm pb-3 border-b border-zinc-100">
                <div><div className="text-zinc-500 text-[10px] uppercase">MQ</div><div className="font-semibold">{c.mq || 0}</div></div>
                <div><div className="text-zinc-500 text-[10px] uppercase">Preventivo</div><div className="font-semibold">{fmtEur(c.totale_preventivo)}</div></div>
                <div><div className="text-zinc-500 text-[10px] uppercase">Fatturato</div><div className="font-semibold">{fmtEur(c.fatturato)}</div></div>
                <div><div className="text-zinc-500 text-[10px] uppercase">Margine</div><div className="font-semibold">{fmtEur((c.fatturato || 0) - (c.costi_effettivi || 0))}</div></div>
              </div>
              <div className="pt-3">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1"><span>Avanzamento</span><span>{c.avanzamento_pct || 0}%</span></div>
                <div className="h-2 bg-zinc-100 rounded overflow-hidden"><div className="h-full" style={{ width: `${c.avanzamento_pct || 0}%`, background: "var(--brand)" }} /></div>
              </div>
            </button>
          ))}
          {!filt.length && <div className="col-span-full text-center text-zinc-500 py-12">Nessuna commessa</div>}
        </div>
      </Page>
    </div>
  );
}
