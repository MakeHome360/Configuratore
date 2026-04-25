import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, statoPreventivoBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { FilePlus2, Eye, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };
const TIPO_LABEL = { pacchetto: "Pacchetto", bagno: "Solo Bagno", composite: "Composite", infissi: "Solo Infissi" };
const ROUTES = { pacchetto: "/preventivopacchetto", bagno: "/preventivobagno", composite: "/preventivocomposite", infissi: "/preventivoinfissi" };

export default function Preventivi() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const nav = useNavigate();

  const load = () => api.get("/preventivi").then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await api.delete(`/preventivi/${id}`);
    toast.success("Eliminato");
    load();
  };

  const openOrCreateProgetto = async (p) => {
    try {
      if (p.project_id) {
        nav(`/editor/${p.project_id}`);
      } else {
        const { data } = await api.post(`/preventivi/${p.id}/create-project`);
        toast.success("Progetto creato e collegato al preventivo");
        nav(`/editor/${data.id}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore creazione progetto");
    }
  };

  const filtered = rows.filter((p) => {
    if (!filter) return true;
    const s = filter.toLowerCase();
    return (p.cliente?.nome || "").toLowerCase().includes(s) || (p.numero || "").toLowerCase().includes(s) || (p.cliente?.email || "").toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader
        title="Preventivi"
        subtitle="Gestisci tutti i preventivi"
        actions={<Button onClick={() => nav("/nuovopreventivo")} data-testid="btn-new-prev" style={{ background: "var(--brand)", color: "white" }}><FilePlus2 className="h-4 w-4 mr-2" />Nuovo Preventivo</Button>}
      />
      <Page>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Cerca cliente, numero, email..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-md border border-zinc-300 rounded-md px-3 py-2 text-sm"
            data-testid="prev-search"
          />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="table-preventivi">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Pacchetto</th>
                <th className="px-4 py-3 text-right">MQ</th>
                <th className="px-4 py-3 text-right">Totale</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.numero}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.cliente?.nome} {p.cliente?.cognome}</div>
                    <div className="text-xs text-zinc-500">{p.cliente?.email || p.cliente?.telefono || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{TIPO_LABEL[p.tipo] || "-"}</td>
                  <td className="px-4 py-3">{PKG_NAMES[p.package_id] || "-"}</td>
                  <td className="px-4 py-3 text-right">{p.mq || 0} mq</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtEur(p.totale_iva_incl)}</td>
                  <td className="px-4 py-3">{statoPreventivoBadge(p.stato)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(p.created_at).toLocaleDateString("it-IT")}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button className="p-1.5 rounded hover:bg-zinc-100" onClick={() => nav(`${ROUTES[p.tipo] || "/preventivopacchetto"}/${p.id}`)} title="Modifica" data-testid={`prev-open-${p.id}`}>
                        <Pencil className="h-4 w-4 text-zinc-600" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-emerald-50" onClick={() => openOrCreateProgetto(p)} title={p.project_id ? "Apri progettazione collegata" : "Crea progettazione da questo preventivo"} data-testid={`prev-cad-${p.id}`}>
                        <Eye className={`h-4 w-4 ${p.project_id ? "text-emerald-600" : "text-zinc-400"}`} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-rose-50" onClick={() => del(p.id)} title="Elimina" data-testid={`prev-del-${p.id}`}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500">Nessun preventivo trovato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
