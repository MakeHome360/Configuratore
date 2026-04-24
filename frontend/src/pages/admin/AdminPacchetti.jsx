import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Edit2, ChevronDown, ChevronUp } from "lucide-react";

const MQ_SIM = [50, 70, 90, 120];

export default function AdminPacchetti() {
  const [packages, setPackages] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { api.get("/packages").then((r) => setPackages(r.data || [])); }, []);

  return (
    <div>
      <PageHeader title="Pacchetti & Voci" subtitle="Gestisci prezzi, voci incluse e analisi di marginalità" />
      <Page>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((p) => {
            const mq = 70;
            const ricavo = p.price_per_m2 * mq;
            const costi = (p.items || []).reduce((s, it) => s + (it.qty_ratio * mq * it.unit_price_pkg), 0);
            const margine = ricavo - costi;
            const marginePct = ricavo ? (margine / ricavo) * 100 : 0;
            const isOpen = expanded === p.id;
            return (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-lg p-5" data-testid={`adm-pkg-${p.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xl font-bold" style={{ color: p.color }}>{p.name}</div>
                    <div className="text-xs text-zinc-500">{p.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase text-zinc-500">Prezzo</div>
                    <div className="text-2xl font-bold">{fmtEur(p.price_per_m2)}/mq</div>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Marginalità stimata @ {mq} mq</div>
                <div className="grid grid-cols-3 gap-2 text-sm pb-3 border-b border-zinc-100">
                  <div><div className="text-[10px] text-zinc-500">Ricavo</div><div className="font-semibold">{fmtEur(ricavo)}</div></div>
                  <div><div className="text-[10px] text-zinc-500">Costi ({p.items.length} voci)</div><div className="font-semibold">{fmtEur(costi)}</div></div>
                  <div><div className="text-[10px] text-zinc-500">Margine</div><div className={`font-semibold ${margine >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{marginePct.toFixed(1)}%</div></div>
                </div>
                <button onClick={() => setExpanded(isOpen ? null : p.id)} className="mt-3 text-sm flex items-center gap-1 text-zinc-600 hover:text-zinc-900">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Simula per MQ diversi
                </button>
                {isOpen && (
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    {MQ_SIM.map((m) => {
                      const r = p.price_per_m2 * m;
                      const cc = (p.items || []).reduce((s, it) => s + (it.qty_ratio * m * it.unit_price_pkg), 0);
                      return <div key={m} className="p-2 bg-zinc-50 rounded"><div className="font-mono">{m} mq</div><div>{fmtEur(r)}</div><div className={((r-cc)/r*100) >= 0 ? "text-emerald-600" : "text-rose-600"}>{((r-cc)/r*100).toFixed(1)}%</div></div>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Page>
    </div>
  );
}
