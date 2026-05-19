import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, API as API_BASE } from "@/lib/api";
import { Page, PageHeader, Badge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Upload, Phone, Mail, Search, Eye, Download, CheckCircle2, AlertTriangle } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const nav = useNavigate();

  const load = () => api.get("/leads").then((r) => setLeads(r.data || []));
  useEffect(() => { load(); }, []);

  const sources = useMemo(() => {
    const s = new Set();
    (leads || []).forEach(l => { if (l.source) s.add(l.source); });
    return Array.from(s);
  }, [leads]);

  const filtered = useMemo(() => {
    let arr = leads || [];
    if (filterSource) arr = arr.filter(l => l.source === filterSource);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(l =>
        (l.nome || "").toLowerCase().includes(q) ||
        (l.cognome || "").toLowerCase().includes(q) ||
        (l.telefono || "").includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.citta || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [leads, search, filterSource]);

  const changeStato = async (id, stato) => { await api.put(`/leads/${id}`, { stato }); load(); };
  const del = async (id, e) => { if (e) e.stopPropagation(); if (!window.confirm("Eliminare lead?")) return; await api.delete(`/leads/${id}`); load(); toast.success("Eliminato"); };
  const openLead = (id) => nav(`/crm/lead/${id}`);

  return (
    <div>
      <PageHeader title="CRM Lead" subtitle={`${filtered.length} di ${leads.length} lead · pipeline trattative`}
        actions={<div className="flex gap-2 flex-wrap">
          <div className="flex rounded border border-zinc-300 overflow-hidden text-sm">
            <button onClick={() => setView("pipeline")} className={`px-3 py-1.5 ${view === "pipeline" ? "bg-zinc-900 text-white" : ""}`} data-testid="crm-view-pipeline">Pipeline</button>
            <button onClick={() => setView("tabella")} className={`px-3 py-1.5 ${view === "tabella" ? "bg-zinc-900 text-white" : ""}`} data-testid="crm-view-tabella">Tabella</button>
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="crm-import-btn"><Upload className="h-4 w-4 mr-1" />Importa lista</Button>
          <Button onClick={() => nav("/configuratoreesigenze")} data-testid="crm-new-lead" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Nuovo Lead</Button>
        </div>} />
      <Page>

        {/* Search + filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nome, telefono, email, città…"
              className="pl-10"
              data-testid="crm-search"
            />
          </div>
          {sources.length > 0 && (
            <select className="border border-zinc-300 rounded h-10 px-3 text-sm" value={filterSource} onChange={e => setFilterSource(e.target.value)} data-testid="crm-filter-source">
              <option value="">Tutte le origini</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {view === "pipeline" ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto">
            {STATI.map((s) => {
              const col = filtered.filter((l) => (l.stato || "nuovo") === s.k);
              return (
                <div key={s.k} className="bg-zinc-50 rounded-lg p-2 min-w-[220px]" data-testid={`crm-col-${s.k}`}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <Badge color={s.color}>{s.label}</Badge>
                    <span className="text-xs text-zinc-500" data-testid={`crm-col-count-${s.k}`}>{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => openLead(l.id)}
                        className="bg-white border border-zinc-200 rounded p-3 text-sm cursor-pointer hover:border-zinc-900 hover:shadow-sm transition"
                        data-testid={`crm-lead-card-${l.id}`}
                      >
                        <div className="font-semibold truncate">{l.nome} {l.cognome}</div>
                        <div className="text-xs text-zinc-500 truncate">{l.citta || "—"} · {l.mq || 0}mq · {l.tipo_immobile || "—"}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600">
                          {l.telefono && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{l.telefono}</span>}
                          {l.email && <span className="flex items-center gap-0.5 truncate"><Mail className="h-2.5 w-2.5" />{l.email.split("@")[0]}</span>}
                        </div>
                        {l.source && <div className="mt-1 text-[9px] uppercase tracking-widest text-amber-700">📥 {l.source}</div>}
                        {l.pacchetto_consigliato && <div className="mt-1 text-[10px] font-semibold" style={{ color: "var(--brand)" }}>{String(l.pacchetto_consigliato).replace("pkg-", "").toUpperCase()}</div>}
                        <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                          <select className="text-xs border border-zinc-200 rounded px-1 py-0.5 flex-1" value={l.stato || "nuovo"} onChange={(e) => changeStato(l.id, e.target.value)} data-testid={`crm-stato-${l.id}`}>
                            {STATI.map((st) => <option key={st.k} value={st.k}>{st.label}</option>)}
                          </select>
                          <button onClick={(e) => { e.stopPropagation(); openLead(l.id); }} className="p-1 hover:bg-blue-50 rounded" title="Apri dettaglio" data-testid={`crm-open-${l.id}`}><Eye className="h-3 w-3 text-blue-600" /></button>
                          <button onClick={(e) => del(l.id, e)} className="p-1 hover:bg-rose-50 rounded"><Trash2 className="h-3 w-3 text-rose-600" /></button>
                        </div>
                      </div>
                    ))}
                    {!col.length && <div className="text-[10px] text-zinc-400 text-center italic py-4">Nessun lead</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Contatti</th>
                  <th className="px-3 py-2 text-left">Immobile</th>
                  <th className="px-3 py-2 text-left">MQ</th>
                  <th className="px-3 py-2 text-left">Origine</th>
                  <th className="px-3 py-2 text-left">Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => openLead(l.id)} data-testid={`crm-row-${l.id}`}>
                    <td className="px-3 py-2 font-medium">{l.nome} {l.cognome}</td>
                    <td className="px-3 py-2 text-xs">
                      {l.telefono && <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-zinc-400" /><a href={`tel:${l.telefono}`} onClick={e => e.stopPropagation()} className="hover:underline">{l.telefono}</a></div>}
                      {l.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-zinc-400" /><a href={`mailto:${l.email}`} onClick={e => e.stopPropagation()} className="hover:underline truncate max-w-[180px] inline-block">{l.email}</a></div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{l.tipo_immobile} · {l.citta}</td>
                    <td className="px-3 py-2">{l.mq}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{l.source ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px]">{l.source}</span> : "—"}</td>
                    <td className="px-3 py-2"><Badge color={STATI.find(s => s.k === l.stato)?.color || "zinc"}>{STATI.find(s => s.k === l.stato)?.label || l.stato}</Badge></td>
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openLead(l.id)} className="p-1 hover:bg-blue-50 rounded mr-1" title="Apri" data-testid={`crm-row-open-${l.id}`}><Eye className="h-4 w-4 text-blue-600" /></button>
                      <button onClick={() => del(l.id)}><Trash2 className="h-4 w-4 text-rose-600" /></button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">
                  {leads.length ? "Nessun lead corrisponde ai filtri." : <>Nessun lead. <button onClick={() => nav("/configuratoreesigenze")} className="text-blue-600 hover:underline">Crea il primo</button> oppure <button onClick={() => setImportOpen(true)} className="text-blue-600 hover:underline">importa una lista</button></>}
                </td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Page>

      {importOpen && <ImportLeadsDialog onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); load(); }} />}
    </div>
  );
}

function ImportLeadsDialog({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [source, setSource] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const downloadTemplate = () => {
    const csv = "Nome,Cognome,Telefono,Email,Citta,Indirizzo,MQ,Tipo_Immobile,Note\nMario,Rossi,3331234567,mario.rossi@example.com,Torino,Via Roma 10,80,Appartamento,Vuole rifare bagno e cucina\nLuigi,Verdi,3339876543,l.verdi@example.com,Milano,Corso Italia 5,120,Villa,Ristrutturazione completa\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_lead.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    if (!file) return toast.error("Seleziona un file");
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", source || file.name.replace(/\.[^.]+$/, ""));
      fd.append("dedupe", String(dedupe));
      const r = await fetch(`${API_BASE}/leads/import`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setResult(data);
      if (data.imported > 0) {
        toast.success(`${data.imported} lead importati`);
      }
    } catch (e) {
      toast.error(e.message || "Errore importazione");
    }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="crm-import-dialog">
        <DialogHeader><DialogTitle>Importa lista lead</DialogTitle></DialogHeader>
        {!result ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
              <div className="font-semibold mb-1">📄 Formato supportato: CSV, XLSX, XLS</div>
              <div className="text-xs text-blue-700">
                Le colonne riconosciute (case-insensitive, qualsiasi ordine):
                <code className="bg-blue-100 px-1 rounded mx-1">nome</code>
                <code className="bg-blue-100 px-1 rounded mx-1">cognome</code>
                <code className="bg-blue-100 px-1 rounded mx-1">telefono</code>
                <code className="bg-blue-100 px-1 rounded mx-1">email</code>
                <code className="bg-blue-100 px-1 rounded mx-1">città</code>
                <code className="bg-blue-100 px-1 rounded mx-1">indirizzo</code>
                <code className="bg-blue-100 px-1 rounded mx-1">mq</code>
                <code className="bg-blue-100 px-1 rounded mx-1">tipo_immobile</code>
                <code className="bg-blue-100 px-1 rounded mx-1">note</code>
              </div>
              <button onClick={downloadTemplate} className="text-xs mt-2 text-blue-700 hover:underline flex items-center gap-1" data-testid="crm-import-template-dl">
                <Download className="h-3 w-3" /> Scarica template CSV di esempio
              </button>
            </div>

            <div>
              <Label className="text-xs">File CSV / Excel</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={e => setFile(e.target.files?.[0] || null)}
                data-testid="crm-import-file"
                className="block w-full text-sm border border-zinc-300 rounded p-2 mt-1"
              />
              {file && <div className="text-xs text-zinc-500 mt-1">📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
            </div>

            <div>
              <Label className="text-xs">Origine lista (per tracciabilità, opzionale)</Label>
              <Input
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="es: 'Facebook Ads Gennaio 2026' o 'Lista_call_center'"
                data-testid="crm-import-source"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Verrà salvato in ogni lead come <code>source</code> e potrai filtrare i lead per origine.</p>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={dedupe} onChange={e => setDedupe(e.target.checked)} data-testid="crm-import-dedupe" />
              <span>Salta lead duplicati (stesso telefono o email già presente in CRM)</span>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`p-4 rounded-lg ${result.imported > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.imported > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                <h3 className="font-semibold">Risultato importazione</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-700 mono" data-testid="crm-import-result-imported">{result.imported}</div>
                  <div className="text-[10px] uppercase text-emerald-600">Importati</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-700 mono" data-testid="crm-import-result-skipped">{result.skipped_duplicates}</div>
                  <div className="text-[10px] uppercase text-amber-600">Duplicati saltati</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-700 mono">{result.total_rows}</div>
                  <div className="text-[10px] uppercase text-zinc-500">Righe totali</div>
                </div>
              </div>
            </div>

            {result.columns_detected?.length > 0 && (
              <div className="text-xs">
                <div className="font-semibold text-emerald-700">✓ Colonne mappate:</div>
                <div className="text-zinc-600 mt-1">{result.columns_detected.join(", ")}</div>
              </div>
            )}
            {result.columns_unmapped?.length > 0 && (
              <div className="text-xs">
                <div className="font-semibold text-amber-700">⚠ Colonne ignorate (non riconosciute):</div>
                <div className="text-zinc-600 mt-1">{result.columns_unmapped.join(", ")}</div>
              </div>
            )}
            {result.errors?.length > 0 && (
              <div className="text-xs">
                <div className="font-semibold text-rose-700">❌ Righe con errori ({result.errors.length}):</div>
                <ul className="mt-1 max-h-32 overflow-y-auto bg-rose-50 border border-rose-200 rounded p-2">
                  {result.errors.map((e, i) => <li key={i} className="text-rose-700">Riga {e.riga}: {e.motivo}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={onClose}>Annulla</Button>
              <Button onClick={doImport} disabled={!file || loading} data-testid="crm-import-do" style={{ background: "var(--brand)", color: "white" }}>
                {loading ? "Importazione…" : "Importa lead"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setResult(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }} data-testid="crm-import-again">Importa altri</Button>
              <Button onClick={onImported} data-testid="crm-import-done" style={{ background: "var(--brand)", color: "white" }}>Chiudi</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
