import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Shield, Filter, X } from "lucide-react";

const ENTITIES = ["", "preventivo", "commessa", "impostazioni", "user", "auth"];
const ACTIONS = ["", "create", "update", "delete", "login", "sconto_request", "sconto_approvato", "sconto_rifiutato", "invite_user", "update_stato"];

function badgeColor(action) {
  if (!action) return "bg-zinc-100 text-zinc-700";
  if (action.startsWith("create") || action === "invite_user") return "bg-emerald-100 text-emerald-800";
  if (action.startsWith("delete")) return "bg-rose-100 text-rose-800";
  if (action.startsWith("sconto_approvato")) return "bg-emerald-100 text-emerald-800";
  if (action.startsWith("sconto_rifiutato")) return "bg-rose-100 text-rose-800";
  if (action.startsWith("sconto_request")) return "bg-amber-100 text-amber-800";
  if (action.startsWith("update")) return "bg-blue-100 text-blue-800";
  if (action === "login") return "bg-violet-100 text-violet-800";
  return "bg-zinc-100 text-zinc-700";
}

export default function AdminAuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (action) params.set("action", action);
      params.set("limit", "500");
      const { data } = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity, action]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter((l) =>
      (l.description || "").toLowerCase().includes(s) ||
      (l.user_email || "").toLowerCase().includes(s) ||
      (l.entity_id || "").toLowerCase().includes(s)
    );
  }, [logs, search]);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle={<span className="text-sm text-zinc-500">Cronologia completa delle azioni critiche (preventivi, commesse, impostazioni, utenti, sconti)</span>}
        actions={<div className="text-xs text-zinc-500 flex items-center gap-2"><Shield className="h-4 w-4" /> {filtered.length} eventi</div>}
      />
      <Page>
        {/* Filtri */}
        <div className="bg-white border border-zinc-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase text-zinc-500 block mb-1">Entità</label>
            <select className="border border-zinc-300 rounded h-9 px-2 text-sm" value={entity} onChange={(e) => setEntity(e.target.value)} data-testid="audit-filter-entity">
              {ENTITIES.map((e) => <option key={e} value={e}>{e || "— tutte —"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-zinc-500 block mb-1">Azione</label>
            <select className="border border-zinc-300 rounded h-9 px-2 text-sm" value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-filter-action">
              {ACTIONS.map((a) => <option key={a} value={a}>{a || "— tutte —"}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] uppercase text-zinc-500 block mb-1">Cerca (descrizione, email, ID)</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="es. PRV-2026 oppure admin@…" data-testid="audit-search" />
            </div>
          </div>
          <Button variant="outline" onClick={() => { setEntity(""); setAction(""); setSearch(""); }} data-testid="audit-clear">
            <X className="h-4 w-4 mr-1" /> Pulisci
          </Button>
          <Button onClick={load} disabled={loading} data-testid="audit-refresh">
            <Filter className="h-4 w-4 mr-1" />{loading ? "Caricamento…" : "Aggiorna"}
          </Button>
        </div>

        {/* Tabella */}
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] tracking-widest">
              <tr>
                <th className="px-3 py-2 text-left w-44">Data/Ora</th>
                <th className="px-3 py-2 text-left w-48">Utente</th>
                <th className="px-3 py-2 text-left w-28">Entità</th>
                <th className="px-3 py-2 text-left w-32">Azione</th>
                <th className="px-3 py-2 text-left">Descrizione</th>
                <th className="px-3 py-2 text-left w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-400 italic">Nessun evento registrato per questi filtri</td></tr>
              )}
              {filtered.map((l) => (
                <React.Fragment key={l.id}>
                  <tr className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer" onClick={() => setOpenId(openId === l.id ? null : l.id)} data-testid={`audit-row-${l.id}`}>
                    <td className="px-3 py-2 mono text-[11px] text-zinc-600">{new Date(l.ts).toLocaleString("it-IT")}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="text-zinc-900">{l.user_email || "—"}</div>
                      {l.user_role && <div className="text-[10px] text-zinc-500">{l.user_role}</div>}
                    </td>
                    <td className="px-3 py-2"><span className="inline-block px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] uppercase tracking-widest">{l.entity}</span></td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest ${badgeColor(l.action)}`}>{l.action}</span></td>
                    <td className="px-3 py-2 text-xs">{l.description || "—"}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{openId === l.id ? "▾" : "▸"}</td>
                  </tr>
                  {openId === l.id && (
                    <tr className="bg-zinc-50">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="grid grid-cols-3 gap-4 text-[11px]">
                          <div>
                            <div className="font-bold text-zinc-700 uppercase tracking-widest text-[10px] mb-1">Entity ID</div>
                            <div className="mono text-zinc-900">{l.entity_id || "—"}</div>
                          </div>
                          <div>
                            <div className="font-bold text-zinc-700 uppercase tracking-widest text-[10px] mb-1">IP</div>
                            <div className="mono">{l.ip || "—"}</div>
                          </div>
                          <div>
                            <div className="font-bold text-zinc-700 uppercase tracking-widest text-[10px] mb-1">Log ID</div>
                            <div className="mono text-zinc-500">{l.id}</div>
                          </div>
                        </div>
                        {l.before && (
                          <div className="mt-3">
                            <div className="font-bold text-rose-700 uppercase tracking-widest text-[10px] mb-1">Prima</div>
                            <pre className="bg-rose-50 border border-rose-200 rounded p-2 text-[11px] mono overflow-auto max-h-40">{JSON.stringify(l.before, null, 2)}</pre>
                          </div>
                        )}
                        {l.after && (
                          <div className="mt-2">
                            <div className="font-bold text-emerald-700 uppercase tracking-widest text-[10px] mb-1">Dopo</div>
                            <pre className="bg-emerald-50 border border-emerald-200 rounded p-2 text-[11px] mono overflow-auto max-h-40">{JSON.stringify(l.after, null, 2)}</pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
