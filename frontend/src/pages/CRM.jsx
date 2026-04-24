import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, Badge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATI = [
  { k: "nuovo", label: "Nuovo", color: "zinc" },
  { k: "contattato", label: "Contattato", color: "blue" },
  { k: "preventivo", label: "Preventivo Inviato", color: "yellow" },
  { k: "vinto", label: "Vinto", color: "green" },
  { k: "perso", label: "Perso", color: "red" },
];

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [view, setView] = useState("pipeline");
  const nav = useNavigate();
  const load = () => api.get("/leads").then((r) => setLeads(r.data || []));
  useEffect(() => { load(); }, []);

  const changeStato = async (id, stato) => { await api.put(`/leads/${id}`, { stato }); load(); };
  const del = async (id) => { if (!window.confirm("Eliminare lead?")) return; await api.delete(`/leads/${id}`); load(); toast.success("Eliminato"); };

  return (
    <div>
      <PageHeader title="CRM Lead" subtitle="Pipeline trattative"
        actions={<div className="flex gap-2">
          <div className="flex rounded border border-zinc-300 overflow-hidden text-sm">
            <button onClick={() => setView("pipeline")} className={`px-3 py-1.5 ${view === "pipeline" ? "bg-zinc-900 text-white" : ""}`}>Pipeline</button>
            <button onClick={() => setView("tabella")} className={`px-3 py-1.5 ${view === "tabella" ? "bg-zinc-900 text-white" : ""}`}>Tabella</button>
          </div>
          <Button onClick={() => nav("/configuratoreesigenze")} data-testid="crm-new-lead" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuovo Lead</Button>
        </div>} />
      <Page>
        {view === "pipeline" ? (
          <div className="grid grid-cols-5 gap-3 overflow-x-auto">
            {STATI.map((s) => {
              const col = leads.filter((l) => (l.stato || "nuovo") === s.k);
              return (
                <div key={s.k} className="bg-zinc-50 rounded-lg p-2 min-w-[220px]" data-testid={`crm-col-${s.k}`}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <Badge color={s.color}>{s.label}</Badge>
                    <span className="text-xs text-zinc-500">{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((l) => (
                      <div key={l.id} className="bg-white border border-zinc-200 rounded p-3 text-sm">
                        <div className="font-semibold">{l.nome} {l.cognome}</div>
                        <div className="text-xs text-zinc-500">{l.citta || "-"} · {l.mq || 0} mq · {l.tipo_immobile}</div>
                        {l.pacchetto_consigliato && <div className="mt-1 text-[10px] font-semibold" style={{ color: "var(--brand)" }}>{String(l.pacchetto_consigliato).replace("pkg-","").toUpperCase()}</div>}
                        <div className="mt-2 flex gap-1">
                          <select className="text-xs border border-zinc-200 rounded px-1 py-0.5 flex-1" value={l.stato || "nuovo"} onChange={(e) => changeStato(l.id, e.target.value)} data-testid={`crm-stato-${l.id}`}>
                            {STATI.map((st) => <option key={st.k} value={st.k}>{st.label}</option>)}
                          </select>
                          <button onClick={() => del(l.id)} className="p-0.5 hover:bg-rose-50 rounded"><Trash2 className="h-3 w-3 text-rose-600" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Contatti</th><th className="px-3 py-2 text-left">Immobile</th><th className="px-3 py-2 text-left">MQ</th><th className="px-3 py-2 text-left">Pacchetto</th><th className="px-3 py-2 text-left">Stato</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 font-medium">{l.nome} {l.cognome}</td>
                    <td className="px-3 py-2 text-xs">{l.telefono}<br />{l.email}</td>
                    <td className="px-3 py-2 text-xs">{l.tipo_immobile} · {l.citta}</td>
                    <td className="px-3 py-2">{l.mq}</td>
                    <td className="px-3 py-2">{l.pacchetto_consigliato && String(l.pacchetto_consigliato).replace("pkg-","").toUpperCase()}</td>
                    <td className="px-3 py-2"><Badge color={STATI.find(s => s.k === l.stato)?.color || "zinc"}>{STATI.find(s => s.k === l.stato)?.label || l.stato}</Badge></td>
                    <td className="px-3 py-2"><button onClick={() => del(l.id)}><Trash2 className="h-4 w-4 text-rose-600" /></button></td>
                  </tr>
                ))}
                {!leads.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">Nessun lead. <button onClick={() => nav("/configuratoreesigenze")} className="text-blue-600 hover:underline">Crea il primo</button></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Page>
    </div>
  );
}
