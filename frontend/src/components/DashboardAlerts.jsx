import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Bell, AlertTriangle, Clock, FileWarning, CheckCircle2, ChevronRight } from "lucide-react";

const fmtEur = (n) => `€ ${Math.round(n || 0).toLocaleString("it-IT")}`;
const fmtDate = (iso) => iso ? new Date(iso.slice(0, 10)).toLocaleDateString("it-IT") : "—";

/**
 * DashboardAlerts — mostra notifiche live cross-cantieri:
 *   - Pagamenti in scadenza ≤7gg
 *   - Pagamenti scaduti
 *   - Documenti sub-appaltatore in scadenza/scaduti
 *   - Checklist cantieri incomplete da >30gg
 */
export default function DashboardAlerts() {
  const [data, setData] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const nav = useNavigate();

  useEffect(() => {
    api.get("/dashboard-alerts").then(r => setData(r.data)).catch(() => setData({}));
  }, []);

  if (!data) return <div className="bg-white border border-zinc-200 rounded p-4 text-sm text-zinc-500" data-testid="dash-alerts-loading">Caricamento alert…</div>;

  const tot = data.totale_alert_critici || 0;
  if (tot === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center gap-3" data-testid="dash-alerts-empty">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div className="text-sm">
          <b className="text-emerald-900">Tutto sotto controllo!</b>
          <span className="text-emerald-700 ml-2">Nessuna scadenza imminente o documento in pericolo.</span>
        </div>
      </div>
    );
  }

  const Section = ({ id, title, icon: Icon, items, color, render }) => {
    if (!items || items.length === 0) return null;
    const isCollapsed = collapsed[id];
    return (
      <div className={`bg-white border-l-4 ${color.border} border border-zinc-200 rounded shadow-sm`} data-testid={`alert-section-${id}`}>
        <button onClick={() => setCollapsed(c => ({ ...c, [id]: !c[id] }))} className="w-full flex items-center justify-between p-3 hover:bg-zinc-50">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color.text}`} />
            <span className="font-semibold text-sm">{title}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${color.bg} ${color.text} font-bold`} data-testid={`alert-count-${id}`}>{items.length}</span>
          </div>
          <ChevronRight className={`h-4 w-4 text-zinc-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
        </button>
        {!isCollapsed && (
          <div className="divide-y divide-zinc-100">
            {items.map(render)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2.5" data-testid="dashboard-alerts">
      {/* Header sintetico */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded p-3">
        <Bell className="h-5 w-5 text-amber-600" />
        <div className="flex-1 text-sm">
          <b className="text-amber-900">{tot} alert da gestire</b>
          <span className="text-amber-700 ml-2">— scadenze pagamenti, documenti sub-appaltatori e checklist da completare</span>
        </div>
      </div>

      {/* Scadenze scadute (più urgenti) */}
      <Section id="scadute" title="Pagamenti SCADUTI" icon={AlertTriangle} items={data.scadenze_scadute || []}
        color={{ border: "border-rose-500", text: "text-rose-700", bg: "bg-rose-100" }}
        render={(s) => (
          <button key={s.id} onClick={() => nav(`/commesse/${s.commessa_id}/workflow`)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-rose-50/50" data-testid={`scaduta-${s.id}`}>
            <div className="text-xs mono w-20 text-rose-700 font-bold">{fmtDate(s.data_scadenza)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.commessa_numero} · {s.cliente_nome || "—"}</div>
              <div className="text-xs text-zinc-500 truncate">{s.direzione === "incasso" ? "← incasso da cliente" : `→ ${s.beneficiario_nome || "—"}`} · {s.categoria} · {s.descrizione}</div>
            </div>
            <div className={`text-sm mono font-bold ${s.direzione === "incasso" ? "text-emerald-700" : "text-rose-700"}`}>{s.direzione === "incasso" ? "+" : "-"}{fmtEur(s.importo)}</div>
            <div className="text-[10px] uppercase text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">{Math.abs(s.giorni_rimasti || 0)}gg fa</div>
          </button>
        )} />

      {/* Scadenze imminenti */}
      <Section id="imminenti" title="In scadenza nei prossimi 7 giorni" icon={Clock} items={data.scadenze_imminenti || []}
        color={{ border: "border-amber-500", text: "text-amber-700", bg: "bg-amber-100" }}
        render={(s) => (
          <button key={s.id} onClick={() => nav(`/commesse/${s.commessa_id}/workflow`)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-amber-50/50" data-testid={`imminente-${s.id}`}>
            <div className="text-xs mono w-20 text-amber-700 font-bold">{fmtDate(s.data_scadenza)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.commessa_numero} · {s.cliente_nome || "—"}</div>
              <div className="text-xs text-zinc-500 truncate">{s.direzione === "incasso" ? "← incasso da cliente" : `→ ${s.beneficiario_nome || "—"}`} · {s.categoria}</div>
            </div>
            <div className={`text-sm mono font-bold ${s.direzione === "incasso" ? "text-emerald-700" : "text-rose-700"}`}>{s.direzione === "incasso" ? "+" : "-"}{fmtEur(s.importo)}</div>
            <div className="text-[10px] uppercase text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">tra {s.giorni_rimasti}gg</div>
          </button>
        )} />

      {/* Documenti sub in scadenza/scaduti */}
      <Section id="docsub" title="Documenti sub-appaltatori da rinnovare" icon={FileWarning} items={data.documenti_sub_alert || []}
        color={{ border: "border-violet-500", text: "text-violet-700", bg: "bg-violet-100" }}
        render={(d) => (
          <button key={d.id} onClick={() => nav(`/subappaltatori/${d.subappaltatore_id}`)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-violet-50/50" data-testid={`docsub-${d.id}`}>
            <div className="text-xs mono w-20 text-violet-700 font-bold">{fmtDate(d.data_scadenza)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{d.nome}</div>
              <div className="text-xs text-zinc-500 truncate uppercase">{d.tipo}</div>
            </div>
            <div className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${d.stato_alert === "scaduto" ? "text-rose-700 bg-rose-100" : "text-amber-700 bg-amber-100"}`}>{d.stato_alert === "scaduto" ? "SCADUTO" : `tra ${d.giorni_rimasti}gg`}</div>
          </button>
        )} />

      {/* Checklist incomplete da molto tempo */}
      <Section id="checklist" title="Cantieri con checklist incompleta da >30 giorni" icon={Bell} items={data.checklist_alerts || []}
        color={{ border: "border-blue-500", text: "text-blue-700", bg: "bg-blue-100" }}
        render={(c) => (
          <button key={c.commessa_id} onClick={() => nav(`/commesse/${c.commessa_id}/workflow`)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50/50" data-testid={`checklist-${c.commessa_id}`}>
            <div className="text-xs mono w-20 text-blue-700 font-bold">{c.giorni_aperta}gg</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.commessa_numero} · {c.cliente_nome || "—"}</div>
              <div className="text-xs text-zinc-500 truncate">Mancano: <b>{c.mancanti.join(", ")}</b></div>
            </div>
            <div className="text-[10px] uppercase text-blue-700 font-bold bg-blue-100 px-1.5 py-0.5 rounded">{c.mancanti.length} step</div>
          </button>
        )} />
    </div>
  );
}
