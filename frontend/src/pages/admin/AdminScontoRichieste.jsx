import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Clock, CheckCircle2, XCircle, TrendingUp, TrendingDown } from "lucide-react";

const fmtEuro = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);

export default function AdminScontoRichieste() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState({ stato: "approvato", pct_approvato: 0, admin_note: "" });

  const load = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/sconto-richieste" : `/sconto-richieste?stato=${filter}`;
      const { data } = await api.get(url);
      setRows(data || []);
    } catch (e) { toast.error("Errore caricamento richieste"); }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const openDecide = (r) => {
    setSelected(r);
    setDecision({ stato: "approvato", pct_approvato: r.pct_richiesto, admin_note: "" });
  };

  const submitDecision = async () => {
    try {
      await api.put(`/sconto-richieste/${selected.id}/decide`, decision);
      toast.success(decision.stato === "approvato" ? `Sconto del ${decision.pct_approvato}% approvato` : "Richiesta rifiutata");
      setSelected(null);
      load();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  return (
    <div className="px-6 py-6">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="label-kicker mb-1">Admin</div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "Outfit" }}>Richieste sconto preventivi</h1>
          <p className="text-sm text-zinc-500 mt-1">Approva o rifiuta le richieste di sconto superiori al 5% inoltrate dai venditori. La marginalità live tiene conto dello sconto richiesto.</p>
        </div>
        <div className="flex gap-2">
          {["pending", "approvato", "rifiutato", "all"].map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-sm" data-testid={`filter-${f}`}>
              {f === "all" ? "Tutte" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 mono text-sm">Caricamento…</div>
      ) : rows.length === 0 ? (
        <div className="border-2 border-dashed border-zinc-200 p-12 text-center">
          <ShieldCheck className="h-12 w-12 mx-auto text-zinc-300 mb-2" />
          <div className="text-zinc-500">Nessuna richiesta {filter !== "all" ? filter : ""}.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const m = r.marginalita_live || {};
            const mb = r.marginalita_senza_sconto_extra || {};
            const margine_decremento = (mb.margine_pct || 0) - (m.margine_pct || 0);
            const statoColor = r.stato === "pending" ? "bg-amber-100 text-amber-800 border-amber-300"
              : r.stato === "approvato" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-rose-100 text-rose-800 border-rose-300";
            const StatoIcon = r.stato === "pending" ? Clock : r.stato === "approvato" ? CheckCircle2 : XCircle;
            return (
              <div key={r.id} className="border border-zinc-200 bg-white p-4 rounded" data-testid={`sconto-row-${r.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] mono uppercase tracking-widest px-2 py-0.5 rounded border flex items-center gap-1 ${statoColor}`}>
                        <StatoIcon className="h-3 w-3" /> {r.stato}
                      </span>
                      <span className="text-xs mono text-zinc-500">{r.preventivo_numero}</span>
                    </div>
                    <div className="font-semibold">{r.cliente_nome || "Cliente"}</div>
                    <div className="text-xs text-zinc-500">
                      Richiesto da <strong>{r.requested_by_name}</strong> · {new Date(r.requested_at).toLocaleString("it-IT")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold mono text-amber-700">{r.pct_richiesto}%</div>
                    {r.stato === "approvato" && r.pct_approvato != null && r.pct_approvato !== r.pct_richiesto && (
                      <div className="text-[11px] text-emerald-700">approvato al <strong>{r.pct_approvato}%</strong></div>
                    )}
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">sconto richiesto</div>
                  </div>
                </div>

                <div className="bg-zinc-50 p-3 rounded text-sm mb-3">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Motivo del venditore</div>
                  <div className="italic">"{r.motivo}"</div>
                </div>

                {/* Marginalità live */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div className="bg-blue-50 border border-blue-200 p-2 rounded">
                    <div className="text-[10px] uppercase tracking-widest text-blue-700">Subtotale</div>
                    <div className="mono font-semibold text-sm">{fmtEuro(mb.subtotal || 0)}</div>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-2 rounded">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-700">Costo netto stimato</div>
                    <div className="mono font-semibold text-sm">{fmtEuro(m.costo_netto_stimato || 0)}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded">
                    <div className="text-[10px] uppercase tracking-widest text-emerald-700">Margine ATTUALE</div>
                    <div className="mono font-semibold text-sm text-emerald-900">{fmtEuro(mb.margine_eur || 0)} <span className="text-[10px]">({(mb.margine_pct || 0).toFixed(1)}%)</span></div>
                  </div>
                  <div className={`border p-2 rounded ${(m.margine_pct || 0) < 20 ? "bg-rose-50 border-rose-300" : "bg-amber-50 border-amber-200"}`}>
                    <div className={`text-[10px] uppercase tracking-widest ${(m.margine_pct || 0) < 20 ? "text-rose-700" : "text-amber-700"}`}>Margine SE APPROVO</div>
                    <div className={`mono font-semibold text-sm flex items-center gap-1 ${(m.margine_pct || 0) < 20 ? "text-rose-900" : "text-amber-900"}`}>
                      {fmtEuro(m.margine_eur || 0)} <span className="text-[10px]">({(m.margine_pct || 0).toFixed(1)}%)</span>
                      {margine_decremento > 0 && <TrendingDown className="h-3 w-3 inline text-rose-600" />}
                    </div>
                    <div className="text-[9px] mono text-zinc-500 mt-0.5">−{fmtEuro((mb.margine_eur || 0) - (m.margine_eur || 0))}</div>
                  </div>
                </div>

                {r.stato === "pending" && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelected(r); setDecision({ stato: "rifiutato", pct_approvato: 0, admin_note: "" }); }} className="rounded-sm text-rose-700 border-rose-300" data-testid={`sconto-reject-${r.id}`}>
                      <XCircle className="h-4 w-4 mr-1" /> Rifiuta
                    </Button>
                    <Button size="sm" onClick={() => openDecide(r)} className="rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white" data-testid={`sconto-approve-${r.id}`}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approva
                    </Button>
                  </div>
                )}
                {r.stato !== "pending" && r.admin_note && (
                  <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 p-2 rounded mt-2">
                    <strong>Nota admin:</strong> {r.admin_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md" data-testid="sconto-decide-dialog">
          <DialogHeader>
            <DialogTitle>{decision.stato === "approvato" ? "Approva richiesta sconto" : "Rifiuta richiesta sconto"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="bg-zinc-50 p-3 rounded">
                <div className="font-semibold">{selected.cliente_nome}</div>
                <div className="text-xs text-zinc-500">{selected.preventivo_numero}</div>
                <div className="mt-1 italic text-xs">"{selected.motivo}"</div>
              </div>
              {decision.stato === "approvato" && (
                <div>
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">% sconto da approvare (puoi modificare)</Label>
                  <Input
                    type="number" step="0.5" min="0" max="100"
                    value={decision.pct_approvato}
                    onChange={(e) => setDecision(s => ({ ...s, pct_approvato: parseFloat(e.target.value) || 0 }))}
                    className="mono"
                    data-testid="decide-pct"
                  />
                  <div className="text-[11px] text-zinc-500 mt-1">Originale richiesto: {selected.pct_richiesto}%</div>
                </div>
              )}
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Nota per il venditore (facoltativa)</Label>
                <Textarea value={decision.admin_note} onChange={(e) => setDecision(s => ({ ...s, admin_note: e.target.value }))} placeholder={decision.stato === "rifiutato" ? "Motivo del rifiuto" : "Eventuali condizioni"} rows={3} data-testid="decide-note" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Annulla</Button>
            <Button onClick={submitDecision} style={{ background: decision.stato === "approvato" ? "#059669" : "#dc2626", color: "white" }} data-testid="decide-submit">
              {decision.stato === "approvato" ? "Approva" : "Rifiuta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
