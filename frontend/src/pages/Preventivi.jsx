import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, statoPreventivoBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { FilePlus2, Eye, Trash2, Pencil, Hammer, Ruler, PenTool } from "lucide-react";
import { toast } from "sonner";

const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };
const TIPO_LABEL = { pacchetto: "Pacchetto", bagno: "Solo Bagno", composite: "Composite", infissi: "Solo Infissi", cad: "CAD" };
const ROUTES = { pacchetto: "/preventivopacchetto", bagno: "/preventivobagno", composite: "/preventivocomposite", infissi: "/preventivoinfissi" };

export default function Preventivi() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [commessaModal, setCommessaModal] = useState(null); // { preventivo, fasi, selected: Set }
  const [allFasi, setAllFasi] = useState([]);
  const nav = useNavigate();

  const load = () => api.get("/preventivi").then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); api.get("/fasi-commessa").then((r) => setAllFasi(r.data || [])).catch(() => {}); }, []);

  const del = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await api.delete(`/preventivi/${id}`);
    toast.success("Eliminato");
    load();
  };

  const openCommessaModal = (p) => {
    if (p.stato !== "accettato") {
      if (!window.confirm("Il preventivo non è ACCETTATO. Vuoi creare comunque la commessa?")) return;
    }
    setCommessaModal({ preventivo: p, selected: new Set(allFasi.map((f) => f.id)) });
  };

  const confirmCreateCommessa = async () => {
    const { preventivo, selected } = commessaModal;
    try {
      await api.post("/commesse", { preventivo_id: preventivo.id, fasi_attive_ids: Array.from(selected) });
      toast.success(`Commessa creata con ${selected.size} fasi`);
      setCommessaModal(null);
      nav("/commesse");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore creazione commessa");
    }
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
                      <button className="p-1.5 rounded hover:bg-blue-50" onClick={() => nav(`${ROUTES[p.tipo] || "/preventivopacchetto"}/${p.id}`)} title="Apri Preventivo" data-testid={`prev-open-${p.id}`}>
                        <Eye className="h-4 w-4 text-blue-600" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-emerald-50" onClick={() => openOrCreateProgetto(p)} title={p.project_id ? "Apri progetto CAD collegato" : "Crea progetto CAD da questo preventivo"} data-testid={`prev-cad-${p.id}`}>
                        <PenTool className={`h-4 w-4 ${p.project_id ? "text-emerald-600" : "text-zinc-400"}`} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-orange-50" onClick={() => openCommessaModal(p)} title="Converti in Commessa (cantiere)" data-testid={`prev-commessa-${p.id}`}>
                        <Hammer className="h-4 w-4 text-orange-600" />
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
      {commessaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCommessaModal(null)} data-testid="commessa-modal">
          <div className="bg-white w-full max-w-2xl rounded-lg flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Converti in Commessa</h2>
              <div className="text-xs text-zinc-500 mt-1">Preventivo {commessaModal.preventivo.numero} · {commessaModal.preventivo.cliente?.nome} {commessaModal.preventivo.cliente?.cognome}</div>
            </div>
            <div className="px-6 py-4 flex-1 overflow-auto">
              <div className="text-sm font-semibold mb-2">Seleziona le fasi attive per questo cantiere</div>
              <div className="text-xs text-zinc-500 mb-3">Solo le fasi selezionate verranno create nella commessa. Disabilita quelle non pertinenti per questo cantiere.</div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setCommessaModal((m) => ({ ...m, selected: new Set(allFasi.map((f) => f.id)) }))} className="text-xs underline text-emerald-700" data-testid="fasi-select-all">Seleziona tutte</button>
                <button onClick={() => setCommessaModal((m) => ({ ...m, selected: new Set() }))} className="text-xs underline text-zinc-600" data-testid="fasi-clear-all">Deseleziona tutte</button>
              </div>
              <div className="space-y-1.5 max-h-[400px] overflow-auto border border-zinc-200 rounded">
                {allFasi.map((f) => {
                  const checked = commessaModal.selected.has(f.id);
                  return (
                    <label key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100 last:border-b-0" data-testid={`fase-row-${f.id}`}>
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        const sel = new Set(commessaModal.selected);
                        if (e.target.checked) sel.add(f.id); else sel.delete(f.id);
                        setCommessaModal((m) => ({ ...m, selected: sel }));
                      }} className="h-4 w-4" data-testid={`fase-check-${f.id}`} />
                      <span className="font-mono text-xs text-zinc-400 w-8">{f.order || ""}</span>
                      <span className="text-sm flex-1">{f.name}</span>
                      <span className="text-xs text-zinc-400 mono">{f.tag || ""}</span>
                    </label>
                  );
                })}
                {!allFasi.length && (
                  <div className="px-3 py-6 text-center text-zinc-500 text-sm">Nessuna fase configurata. Vai in Admin → Fasi Commessa per crearle.</div>
                )}
              </div>
              <div className="text-xs text-emerald-700 mt-2 font-semibold" data-testid="fasi-selected-count">{commessaModal.selected.size} fasi attive su {allFasi.length}</div>
            </div>
            <div className="px-6 py-3 border-t flex justify-end gap-2 bg-zinc-50">
              <Button variant="outline" onClick={() => setCommessaModal(null)}>Annulla</Button>
              <Button onClick={confirmCreateCommessa} style={{ background: "var(--brand)", color: "white" }} data-testid="btn-create-commessa">Crea Commessa</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
