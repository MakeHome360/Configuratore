import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, Badge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Phone, Mail, MapPin, Plus, Trash2, FileText, AlertTriangle, CheckCircle2, Clock, Hammer, Euro, Receipt } from "lucide-react";
import { toast } from "sonner";

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("it-IT"); } catch { return d; }
}
function fmtEur(n) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
}

const STATO_DOC = {
  valid:    { label: "Valido",      color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  expiring: { label: "In scadenza", color: "bg-amber-100 text-amber-800 border-amber-300",       icon: Clock },
  expired:  { label: "Scaduto",     color: "bg-rose-100 text-rose-800 border-rose-300",          icon: AlertTriangle },
  missing:  { label: "Mancante",    color: "bg-zinc-100 text-zinc-600 border-zinc-300",          icon: AlertTriangle },
};

export default function SubappaltatoreDetail() {
  const { sid } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({ tipo: "durc", nome: "", url: "", scadenza: "", note: "" });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/subappaltatori/${sid}/dashboard`);
      setData(r.data);
    } catch (e) {
      toast.error("Subappaltatore non trovato");
      nav("/adminsubappaltatori");
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sid]);

  const addDoc = async () => {
    if (!docForm.tipo) return toast.error("Seleziona tipo documento");
    try {
      await api.post(`/subappaltatori/${sid}/documenti`, docForm);
      setDocOpen(false);
      setDocForm({ tipo: "durc", nome: "", url: "", scadenza: "", note: "" });
      load();
      toast.success("Documento aggiunto");
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };
  const delDoc = async (did) => {
    if (!window.confirm("Eliminare documento?")) return;
    await api.delete(`/subappaltatori/${sid}/documenti/${did}`);
    load();
  };

  if (loading || !data) return <div className="p-16 text-center mono text-zinc-500">caricamento…</div>;
  const sub = data.subappaltatore;
  const docs = data.documenti_check || [];
  const allDocsRaw = sub.documenti_aziendali || [];
  const kpi = data.kpi || {};
  const cantieri = data.cantieri || [];
  const criticiCount = (data.documenti_critici_mancanti || []).length;

  return (
    <div data-testid="sub-detail-page">
      <PageHeader
        title={sub.nome}
        subtitle={<div className="flex items-center gap-3 mt-1 flex-wrap">
          <Badge color={sub.tipo === "fornitore" ? "blue" : "purple"}>{sub.tipo === "fornitore" ? "Fornitore" : "Subappaltatore"}</Badge>
          {sub.categoria && <span className="text-xs text-zinc-500">📂 {sub.categoria}</span>}
          {sub.attivo !== false ? <Badge color="green">Attivo</Badge> : <Badge color="red">Non attivo</Badge>}
          {criticiCount > 0 && <Badge color="red">⚠ {criticiCount} doc critici mancanti</Badge>}
        </div>}
        actions={<Button variant="outline" onClick={() => nav("/adminsubappaltatori")} size="sm" data-testid="sub-back"><ArrowLeft className="h-4 w-4 mr-1" />Torna alla lista</Button>}
      />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* COLONNA 1-2: KPI + Cantieri */}
          <div className="lg:col-span-2 space-y-4">

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="sub-kpi">
              <KpiCard icon={Hammer} color="purple" label="Cantieri attivi" value={kpi.num_cantieri_attivi} subtitle={`${kpi.num_cantieri_totali} totali`} />
              <KpiCard icon={FileText} color="blue" label="Preventivi inviati" value={kpi.num_preventivi_inviati} />
              <KpiCard icon={Euro} color="emerald" label="Incassato" value={fmtEur(kpi.incassato)} subtitle="già pagato" mono />
              <KpiCard icon={Receipt} color="amber" label="Da incassare" value={fmtEur(kpi.da_incassare)} subtitle="in attesa" mono />
            </div>

            {/* Cantieri */}
            <div className="bg-white border border-zinc-200 rounded-lg">
              <div className="p-4 border-b border-zinc-100">
                <h3 className="font-semibold">Cantieri / Commesse ({cantieri.length})</h3>
                <p className="text-xs text-zinc-500">Tutti i cantieri in cui questo subappaltatore è coinvolto.</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
                  <th className="px-3 py-2 text-left">Codice</th>
                  <th className="px-3 py-2 text-left">Cliente / Indirizzo</th>
                  <th className="px-3 py-2 text-left">Stato</th>
                  <th className="px-3 py-2 text-right">Totale lavori</th>
                  <th className="px-3 py-2 text-right">Pagato</th>
                  <th className="px-3 py-2 text-right">Residuo</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {cantieri.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => nav(`/commessa/${c.id}/workflow`)} data-testid={`sub-cantiere-${c.id}`}>
                      <td className="px-3 py-2 mono text-xs">{c.code || c.id?.slice(0, 8)}</td>
                      <td className="px-3 py-2"><div className="font-medium">{c.cliente_nome}</div><div className="text-xs text-zinc-500">{c.indirizzo}</div></td>
                      <td className="px-3 py-2"><Badge color={c.stato === "chiuso" || c.stato === "concluso" ? "zinc" : c.stato === "in_corso" ? "green" : "blue"}>{c.stato}</Badge></td>
                      <td className="px-3 py-2 text-right mono">{fmtEur(c.totale_lavori)}</td>
                      <td className="px-3 py-2 text-right mono text-emerald-700">{fmtEur(c.totale_pagato)}</td>
                      <td className="px-3 py-2 text-right mono text-amber-700 font-semibold">{fmtEur(c.totale_residuo)}</td>
                    </tr>
                  ))}
                  {!cantieri.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-400 text-xs italic">Nessun cantiere ancora collegato</td></tr>}
                </tbody>
                {cantieri.length > 0 && (
                  <tfoot className="bg-zinc-50 font-bold text-sm">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase">Totale fatturato:</td>
                      <td className="px-3 py-2 text-right mono">{fmtEur(kpi.fatturato_totale)}</td>
                      <td className="px-3 py-2 text-right mono text-emerald-700">{fmtEur(kpi.incassato)}</td>
                      <td className="px-3 py-2 text-right mono text-amber-700">{fmtEur(kpi.da_incassare)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

          </div>

          {/* COLONNA 3: Contatti + Documenti */}
          <div className="space-y-4">

            {/* Contatti */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Contatti</div>
              <div className="space-y-2 text-sm">
                {sub.telefono && <a href={`tel:${sub.telefono}`} className="flex items-center gap-2 hover:text-blue-700"><Phone className="h-4 w-4 text-zinc-400" />{sub.telefono}</a>}
                {sub.email && <a href={`mailto:${sub.email}`} className="flex items-center gap-2 hover:text-blue-700"><Mail className="h-4 w-4 text-zinc-400" /><span className="truncate">{sub.email}</span></a>}
                {sub.partita_iva && <div className="flex items-center gap-2 text-zinc-600"><span className="text-xs">P.IVA:</span> <span className="mono text-xs">{sub.partita_iva}</span></div>}
                {sub.indirizzo && <div className="flex items-center gap-2 text-zinc-600"><MapPin className="h-4 w-4 text-zinc-400" />{sub.indirizzo}</div>}
                {!sub.telefono && !sub.email && <div className="text-xs text-zinc-400 italic">Nessun contatto inserito</div>}
              </div>
            </div>

            {/* Documenti aziendali */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5" data-testid="sub-docs-section">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">Documenti aziendali</div>
                  <p className="text-[10px] text-zinc-500">DURC, Visura, Polizza RC, ecc.</p>
                </div>
                <Button size="sm" onClick={() => setDocOpen(true)} style={{ background: "var(--brand)", color: "white" }} data-testid="sub-doc-add"><Plus className="h-3 w-3 mr-1" />Aggiungi</Button>
              </div>
              <div className="space-y-1.5">
                {docs.map(d => {
                  const S = STATO_DOC[d.stato];
                  const Ic = S.icon;
                  return (
                    <div key={d.tipo} className={`flex items-start gap-2 p-2 rounded border ${S.color}`} data-testid={`sub-doc-${d.tipo}`}>
                      <Ic className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{d.label}</div>
                        <div className="text-[10px] opacity-80">{S.label}{d.scadenza ? ` · scade ${fmtDate(d.scadenza)}` : ""}</div>
                        {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-[10px] underline" onClick={e => e.stopPropagation()}>apri ↗</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Altri documenti caricati (oltre i 6 standard) */}
              {allDocsRaw.length > 0 && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Documenti caricati ({allDocsRaw.length})</div>
                  <div className="space-y-1">
                    {allDocsRaw.map(d => (
                      <div key={d.id} className="flex items-center gap-2 text-xs">
                        <FileText className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                        <div className="flex-1 truncate">
                          <span className="font-medium uppercase text-[10px] text-zinc-500 mr-1">{d.tipo}</span>
                          {d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{d.nome}</a> : d.nome}
                          {d.scadenza && <span className="text-[9px] text-zinc-500 ml-1">scade {fmtDate(d.scadenza)}</span>}
                        </div>
                        <button onClick={() => delDoc(d.id)} className="text-rose-400 hover:text-rose-700" data-testid={`sub-doc-del-${d.id}`}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Dialog add doc */}
        {docOpen && (
          <Dialog open onOpenChange={(o) => !o && setDocOpen(false)}>
            <DialogContent data-testid="sub-doc-dialog">
              <DialogHeader><DialogTitle>Aggiungi documento aziendale</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo *</Label>
                  <select className="w-full border border-zinc-300 rounded h-10 px-2 text-sm" value={docForm.tipo} onChange={e => setDocForm({ ...docForm, tipo: e.target.value })} data-testid="sub-doc-tipo">
                    <option value="durc">DURC</option>
                    <option value="visura">Visura Camerale</option>
                    <option value="cciaa">Iscrizione CCIAA</option>
                    <option value="polizza_rc">Polizza RC</option>
                    <option value="idoneita_tecnica">Idoneità Tecnica</option>
                    <option value="contratto_subappalto">Contratto Subappalto</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Nome / Identificativo</Label>
                  <Input value={docForm.nome} onChange={e => setDocForm({ ...docForm, nome: e.target.value })} placeholder="es: DURC n. 12345/2026" data-testid="sub-doc-nome" />
                </div>
                <div>
                  <Label className="text-xs">URL documento (PDF caricato esternamente)</Label>
                  <Input value={docForm.url} onChange={e => setDocForm({ ...docForm, url: e.target.value })} placeholder="https://..." data-testid="sub-doc-url" />
                </div>
                <div>
                  <Label className="text-xs">Data scadenza</Label>
                  <Input type="date" value={docForm.scadenza} onChange={e => setDocForm({ ...docForm, scadenza: e.target.value })} data-testid="sub-doc-scadenza" />
                </div>
                <div>
                  <Label className="text-xs">Note</Label>
                  <Textarea rows={2} value={docForm.note} onChange={e => setDocForm({ ...docForm, note: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDocOpen(false)}>Annulla</Button>
                <Button onClick={addDoc} style={{ background: "var(--brand)", color: "white" }} data-testid="sub-doc-save">Salva documento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Page>
    </div>
  );
}

function KpiCard({ icon: Icon, color, label, value, subtitle, mono }) {
  const COLOR = {
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`border rounded-lg p-3 ${COLOR[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${mono ? "mono" : ""}`}>{value}</div>
      {subtitle && <div className="text-[10px] opacity-70 mt-0.5">{subtitle}</div>}
    </div>
  );
}
