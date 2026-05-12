import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, fmtNum } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSignature, Files, ListChecks, Calculator, Hammer, CalendarRange, Wallet, FileBarChart2, Plus, Trash2, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2, Clock, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

const STATO_ART_BADGE = {
  ok:               { txt: "OK",                cls: "bg-emerald-100 text-emerald-700" },
  warning:          { txt: "Warning",           cls: "bg-amber-100 text-amber-800" },
  da_autorizzare:   { txt: "BLOCCO",            cls: "bg-rose-100 text-rose-700" },
  autorizzato:      { txt: "Autorizzato",       cls: "bg-blue-100 text-blue-700" },
  interno:          { txt: "Operai interni",    cls: "bg-violet-100 text-violet-700" },
};

export default function CommessaWorkflow() {
  const { cid } = useParams();
  const nav = useNavigate();
  const [wf, setWf] = useState(null);
  const [tab, setTab] = useState("contratto");
  const [voci, setVoci] = useState([]);

  const reload = () => api.get(`/commesse/${cid}/workflow`).then(r => setWf(r.data));
  useEffect(() => { reload(); api.get("/voci-backoffice").then(r => setVoci(r.data || [])); /* eslint-disable-next-line */ }, [cid]);

  if (!wf) return <Page><div className="text-zinc-500">Caricamento commessa…</div></Page>;
  const c = wf.commessa || {};
  const marg = wf.marginalita || {};

  return (
    <div data-testid="commessa-workflow-page">
      <PageHeader
        title={`Cantiere ${c.numero || cid}`}
        subtitle={<>{c.cliente?.nome} {c.cliente?.cognome} · {c.mq || 0} mq · stato <b className="text-zinc-700">{c.stato}</b></>}
        actions={
          <Button variant="outline" onClick={() => nav("/commesse")} data-testid="btn-back-commesse">← Tutte le commesse</Button>
        }
      />
      <Page>
        {/* KPI row marginalità */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          <StatCard label="Preventivato" value={fmtEur(marg.ricavo_preventivato)} icon={Calculator} />
          <StatCard label="Costo previsto" value={fmtEur(marg.costo_previsionale)} icon={Hammer} sub={`Margine ${fmtNum(marg.margine_pct_previsionale, 1)}%`} />
          <StatCard label="Costo confermato" value={fmtEur(marg.costo_confermato)} icon={ShieldCheck} color="text-blue-600" />
          <StatCard label="Incassato" value={fmtEur(marg.incassato)} icon={Wallet} color="text-emerald-600" sub={`Saldo da incassare ${fmtEur(marg.saldo_residuo_cliente)}`} />
          <StatCard label="Uscite" value={fmtEur(marg.uscito)} icon={Wallet} color="text-rose-600" />
          <StatCard label="Margine attuale" value={fmtEur(marg.margine_attuale)} icon={FileBarChart2} color={marg.margine_attuale < marg.margine_previsionale ? "text-rose-600" : "text-emerald-600"} sub={`${fmtNum(marg.margine_pct_attuale, 1)}%`} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-sm flex-wrap h-auto">
            <TabsTrigger value="contratto" data-testid="tab-contratto"><FileSignature className="h-4 w-4 mr-1.5" /> 1. Contratto</TabsTrigger>
            <TabsTrigger value="checklist" data-testid="tab-checklist"><ClipboardCheck className="h-4 w-4 mr-1.5" /> 2. Checklist venditore</TabsTrigger>
            <TabsTrigger value="documenti" data-testid="tab-documenti"><Files className="h-4 w-4 mr-1.5" /> 3. Documenti</TabsTrigger>
            <TabsTrigger value="materiali" data-testid="tab-materiali"><ListChecks className="h-4 w-4 mr-1.5" /> 4. Materiali</TabsTrigger>
            <TabsTrigger value="computo" data-testid="tab-computo"><Calculator className="h-4 w-4 mr-1.5" /> 5. Computo</TabsTrigger>
            <TabsTrigger value="artigiani" data-testid="tab-artigiani"><Hammer className="h-4 w-4 mr-1.5" /> 6. Artigiani / Sub</TabsTrigger>
            <TabsTrigger value="lavorazioni" data-testid="tab-lavorazioni"><CalendarRange className="h-4 w-4 mr-1.5" /> 7. Lavorazioni / Calendario</TabsTrigger>
            <TabsTrigger value="fasi" data-testid="tab-fasi"><CalendarRange className="h-4 w-4 mr-1.5" /> 8. Fasi cantiere (Gantt)</TabsTrigger>
            <TabsTrigger value="voci-acquisti" data-testid="tab-voci-acquisti"><Wallet className="h-4 w-4 mr-1.5" /> 9. Voci e Acquisti</TabsTrigger>
            <TabsTrigger value="cassa" data-testid="tab-cassa"><Wallet className="h-4 w-4 mr-1.5" /> 10. Cassa & Pagamenti</TabsTrigger>
            <TabsTrigger value="resoconto" data-testid="tab-resoconto"><FileBarChart2 className="h-4 w-4 mr-1.5" /> 11. Resoconto</TabsTrigger>
          </TabsList>

          {/* 1. CONTRATTO */}
          <TabsContent value="contratto" className="mt-4"><Contratto wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 2. CHECKLIST VENDITORE */}
          <TabsContent value="checklist" className="mt-4"><ChecklistVenditore wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 3. DOCUMENTI */}
          <TabsContent value="documenti" className="mt-4"><Documenti wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 4. MATERIALI */}
          <TabsContent value="materiali" className="mt-4"><Materiali wf={wf} cid={cid} reload={reload} voci={voci} /></TabsContent>
          {/* 5. COMPUTO */}
          <TabsContent value="computo" className="mt-4"><ComputoTab wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 6. ARTIGIANI */}
          <TabsContent value="artigiani" className="mt-4"><Artigiani wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 7. LAVORAZIONI / CALENDARIO TASK */}
          <TabsContent value="lavorazioni" className="mt-4"><LavorazioniTab wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 8. FASI Gantt */}
          <TabsContent value="fasi" className="mt-4"><Fasi wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 9. VOCI E ACQUISTI */}
          <TabsContent value="voci-acquisti" className="mt-4"><VociAcquistiTab wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 10. CASSA */}
          <TabsContent value="cassa" className="mt-4"><Cassa wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 11. RESOCONTO */}
          <TabsContent value="resoconto" className="mt-4"><Resoconto cid={cid} marg={marg} wf={wf} /></TabsContent>
        </Tabs>
      </Page>
    </div>
  );
}

// Componente upload file riutilizzabile
function UploadField({ label, onUploaded, commessaId, tipo, accept = "*/*", testid = "upload-field" }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`inline-flex items-center gap-2 px-3 py-1.5 border-2 border-dashed border-zinc-300 rounded text-xs text-zinc-700 cursor-pointer hover:bg-zinc-50 ${busy ? "opacity-50" : ""}`} data-testid={testid}>
      <input type="file" accept={accept} className="hidden" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true);
        try {
          const fd = new FormData();
          fd.append("file", f);
          if (commessaId) fd.append("commessa_id", commessaId);
          if (tipo) fd.append("tipo", tipo);
          const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
          toast.success("File caricato");
          onUploaded?.(r.data);
        } catch (err) {
          toast.error("Errore upload: " + (err.response?.data?.detail || err.message));
        } finally { setBusy(false); e.target.value = ""; }
      }} />
      📎 {busy ? "Carico..." : (label || "Carica file")}
    </label>
  );
}

// ---- 1. CONTRATTO ----
function Contratto({ wf, cid, reload }) {
  const cn = wf.contratto || {};
  const [form, setForm] = useState({ url: cn.url || "", testo: cn.testo || "", firmato: !!cn.firmato, note: cn.note || "" });
  return (
    <div className="bg-white border border-zinc-200 rounded p-5 space-y-3 max-w-3xl">
      <h3 className="font-semibold">Contratto cliente</h3>
      <p className="text-xs text-zinc-500">Carica il contratto firmato (link Drive/Dropbox/altro) o incolla il testo. Il cliente può firmare anche dal Portale Cliente con OTP.</p>
      <div><Label className="text-xs">Link al contratto (PDF)</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://drive.google.com/..." data-testid="contr-url" /></div>
      <div><UploadField label="Oppure carica PDF contratto" onUploaded={(meta) => setForm({ ...form, url: window.location.origin + meta.url })} commessaId={cid} tipo="contratto" accept=".pdf,.doc,.docx" testid="upload-contratto" /></div>
      <div><Label className="text-xs">Testo / Note</Label><textarea value={form.testo} onChange={e => setForm({ ...form, testo: e.target.value })} className="w-full border border-zinc-300 rounded-sm p-2 text-sm h-32 mono" data-testid="contr-testo" /></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.firmato} onChange={e => setForm({ ...form, firmato: e.target.checked })} data-testid="contr-firmato" /> <span className="text-sm">Firmato dal cliente</span></label>
      <Button onClick={async () => {
        await api.post(`/commesse/${cid}/workflow/contratto`, { ...form, firma_data: form.firmato ? new Date().toISOString() : null });
        toast.success("Contratto salvato");
        reload();
      }} style={{ background: "var(--brand)", color: "white" }} data-testid="contr-save">Salva contratto</Button>
    </div>
  );
}

// ---- 2. CHECKLIST VENDITORE — anti-dimenticanza ----
function ChecklistVenditore({ wf, cid, reload }) {
  const cm = wf.commessa || {};
  const docs = wf.documenti || [];
  const contratto = wf.contratto || {};
  const materiali = wf.materiali || [];
  const computoOk = !!((wf.computo_metrico || {}).items || []).length;
  const fasi = wf.fasi || [];
  const artPrev = wf.artigiani_preventivi || [];
  const cassaItems = wf.cassa || [];
  const cliente = cm.cliente || {};

  // Build dynamic checklist
  const items = [
    { id: "ct-cliente", label: "Dati cliente completi (nome, telefono, email, indirizzo)", done: !!(cliente.nome && cliente.email && cliente.telefono), critico: true },
    { id: "ct-contratto", label: "Contratto caricato e firmato dal cliente", done: !!contratto.firmato, critico: true },
    { id: "ct-acconto", label: "Acconto iniziale registrato (cassa)", done: cassaItems.some(m => m.tipo === "incasso"), critico: true },
    { id: "ct-doc-pratica", label: "Documenti pratica edilizia (CILA/SCIA/permesso) caricati", done: docs.some(d => /cila|scia|permesso|pratica|edilizia/i.test(d.tipo || d.name || "")), critico: false },
    { id: "ct-progetto", label: "Progetto / planimetria CAD caricata", done: docs.some(d => /progetto|planimetria|cad|dwg/i.test(d.tipo || d.name || "")) || !!cm.project_id, critico: false },
    { id: "ct-materiali", label: "Scelta materiali principali (pavimenti, sanitari, ecc.)", done: materiali.length > 0, critico: true },
    { id: "ct-computo", label: "Computo metrico generato dal preventivo accettato", done: computoOk, critico: true },
    { id: "ct-preventivi-art", label: "Preventivi artigiani caricati e analizzati", done: artPrev.length > 0, critico: false },
    { id: "ct-fasi", label: "Fasi cantiere pianificate (Gantt)", done: fasi.length > 0, critico: false },
    { id: "ct-foto-rilievo", label: "Foto / rilievo pre-cantiere caricato", done: docs.some(d => /foto|rilievo/i.test(d.tipo || d.name || "")), critico: false },
    { id: "ct-privacy", label: "Modulo privacy/GDPR firmato dal cliente", done: docs.some(d => /privacy|gdpr/i.test(d.tipo || d.name || "")), critico: true },
    { id: "ct-data-inizio", label: "Data inizio lavori concordata con il cliente", done: !!cm.data_inizio_prevista || fasi.some(f => f.data_inizio), critico: true },
  ];
  const totCrit = items.filter(i => i.critico).length;
  const okCrit = items.filter(i => i.critico && i.done).length;
  const pct = Math.round(okCrit / Math.max(1, totCrit) * 100);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Checklist venditore — anti-dimenticanza</h3>
            <p className="text-xs text-zinc-500">Verifica tutti gli step prima di considerare la pratica chiusa.</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold mono ${pct === 100 ? "text-emerald-700" : pct > 60 ? "text-amber-700" : "text-rose-700"}`}>{pct}%</div>
            <div className="text-[10px] uppercase text-zinc-500">{okCrit}/{totCrit} step critici</div>
          </div>
        </div>
        <div className="h-2 bg-zinc-200 rounded overflow-hidden mb-4">
          <div className={`h-full ${pct === 100 ? "bg-emerald-500" : pct > 60 ? "bg-amber-500" : "bg-rose-500"} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="space-y-1.5">
          {items.map(it => (
            <div key={it.id} className={`flex items-center gap-3 p-2.5 rounded border ${it.done ? "bg-emerald-50 border-emerald-200" : it.critico ? "bg-rose-50/40 border-rose-200" : "bg-zinc-50 border-zinc-200"}`} data-testid={`check-${it.id}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${it.done ? "bg-emerald-500 text-white" : "bg-white border-2 border-zinc-300"}`}>
                {it.done && <CheckCircle2 size={14} />}
              </div>
              <div className="flex-1 text-sm">{it.label}</div>
              {it.critico && !it.done && <span className="text-[10px] px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded uppercase font-bold">Critico</span>}
              {it.done && <span className="text-[10px] text-emerald-700 mono">OK</span>}
            </div>
          ))}
        </div>
        {pct < 100 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-900">
            <AlertTriangle className="inline h-4 w-4 mr-1" /> Mancano alcuni step. Completa prima i punti <b>critici</b> per non avere problemi durante il cantiere.
          </div>
        )}
        {pct === 100 && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 p-3 rounded text-xs text-emerald-900">
            <CheckCircle2 className="inline h-4 w-4 mr-1" /> Checklist completata! Tutti gli step critici sono OK.
          </div>
        )}
      </div>
    </div>
  );
}


// ---- 2. DOCUMENTI ----
function Documenti({ wf, cid, reload }) {
  const docs = wf.documenti || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "progetto", name: "", url: "", note: "" });
  return (
    <div className="bg-white border border-zinc-200 rounded">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200">
        <h3 className="font-semibold">Documenti progetto / casa / cliente</h3>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="doc-add"><Plus className="h-4 w-4 mr-1" /> Aggiungi documento</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
          <th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Link</th><th className="px-3 py-2 text-left">Note</th><th className="px-3 py-2"></th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {docs.map(d => (
            <tr key={d.id}>
              <td className="px-3 py-2 text-xs uppercase">{d.tipo}</td>
              <td className="px-3 py-2">{d.name}</td>
              <td className="px-3 py-2 text-xs">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri ↗</a> : "-"}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{d.note}</td>
              <td className="px-3 py-2 text-right"><button className="text-rose-600 hover:bg-rose-50 p-1" onClick={async () => { await api.delete(`/commesse/${cid}/workflow/documenti/${d.id}`); reload(); }} data-testid={`doc-del-${d.id}`}><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
          {!docs.length && <tr><td colSpan={5} className="px-3 py-12 text-center text-zinc-500">Nessun documento. Aggiungi progetti, tavole, planimetrie, doc casa/cliente.</td></tr>}
        </tbody>
      </table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger data-testid="doc-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="progetto">Progetto</SelectItem>
                  <SelectItem value="tavola">Tavola tecnica</SelectItem>
                  <SelectItem value="doc_casa">Doc. immobile (visure, planimetria)</SelectItem>
                  <SelectItem value="doc_cliente">Doc. cliente (carta identità, codice fiscale)</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="doc-name" /></div>
            <div><Label className="text-xs">URL (link a Drive/Dropbox/Cloud)</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." data-testid="doc-url" /></div>
            <div><UploadField label="Oppure carica file dal PC" onUploaded={(meta) => setForm({ ...form, url: window.location.origin + meta.url, name: form.name || meta.name })} commessaId={cid} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.xls,.xlsx,.zip" testid="upload-documento" /></div>
            <div><Label className="text-xs">Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} data-testid="doc-note" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/documenti`, form); setOpen(false); setForm({ tipo: "progetto", name: "", url: "", note: "" }); toast.success("Documento aggiunto"); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="doc-save">Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 3. MATERIALI ----
function Materiali({ wf, cid, reload, voci }) {
  const m = wf.materiali_scelta || { items: [] };
  const [items, setItems] = useState(m.items || []);
  const [firmato, setFirmato] = useState(!!m.firmato_cliente);
  const totale = useMemo(() => items.reduce((s, x) => s + (parseFloat(x.qty || 0) * parseFloat(x.prezzo || 0)), 0), [items]);
  return (
    <div className="bg-white border border-zinc-200 rounded p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">Scelta materiali del cliente</h3>
          <p className="text-xs text-zinc-500 mt-1">Elenca i materiali specifici scelti dal cliente (es. piastrelle, sanitari, rubinetterie). Quando salvi con la firma, il cliente non potrà più chiedere modifiche senza extra.</p>
        </div>
        <Button size="sm" onClick={() => setItems([...items, { voce_id: "", name: "", qty: 1, unit: "pz", prezzo: 0, note: "" }])} data-testid="mat-add"><Plus className="h-4 w-4 mr-1" /> Aggiungi materiale</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
          <th className="px-2 py-2 text-left w-56" title="Seleziona dal listino backoffice per usare i prezzi già configurati">Da listino interno</th>
          <th className="px-2 py-2 text-left" title="Modello/colore esatto scelto dal cliente">Descrizione / modello scelto</th>
          <th className="px-2 py-2 text-right w-20" title="Quantità">Qty</th>
          <th className="px-2 py-2 text-left w-20" title="Unità di misura (m², pz, ml)">U.M.</th>
          <th className="px-2 py-2 text-right w-28" title="Prezzo al cliente per unità">Prezzo unit. (€)</th>
          <th className="px-2 py-2 text-right w-28">Totale</th>
          <th className="w-10"></th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((it, i) => {
            const upd = (k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x));
            return (
              <tr key={i}>
                <td className="px-2 py-1">
                  <Select value={it.voce_id || ""} onValueChange={v => { const voce = voci.find(x => x.id === v); upd("voce_id", v); if (voce) { upd("name", voce.name); upd("unit", voce.unit || "pz"); upd("prezzo", parseFloat(voce.prezzo_acquisto || 0) * parseFloat(voce.ricarico || 1.8)); } }}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`mat-voce-${i}`}><SelectValue placeholder="— oppure scrivi a mano —" /></SelectTrigger>
                    <SelectContent className="max-h-72">{voci.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1"><Input value={it.name} onChange={e => upd("name", e.target.value)} placeholder="Es: Piastrella Marazzi 60x60 grigio chiaro" className="h-8 text-xs" /></td>
                <td className="px-2 py-1"><Input type="number" value={it.qty} onChange={e => upd("qty", e.target.value)} className="h-8 text-xs text-right mono w-20" /></td>
                <td className="px-2 py-1"><Input value={it.unit} onChange={e => upd("unit", e.target.value)} placeholder="m²" className="h-8 text-xs w-16" /></td>
                <td className="px-2 py-1"><Input type="number" step="0.01" value={it.prezzo} onChange={e => upd("prezzo", e.target.value)} className="h-8 text-xs text-right mono w-24" /></td>
                <td className="px-2 py-1 text-right mono font-semibold">{fmtEur((it.qty || 0) * (it.prezzo || 0))}</td>
                <td><button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-600 p-1" data-testid={`mat-del-${i}`}><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            );
          })}
          {!items.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">Nessun materiale ancora aggiunto. Clicca "Aggiungi materiale" per il primo.</td></tr>}
        </tbody>
        {items.length > 0 && <tfoot><tr className="bg-zinc-50"><td colSpan={5} className="px-2 py-2 text-right font-bold uppercase text-xs">Totale materiali</td><td className="px-2 py-2 text-right font-bold mono">{fmtEur(totale)}</td><td></td></tr></tfoot>}
      </table>
      <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={firmato} onChange={e => setFirmato(e.target.checked)} data-testid="mat-firmato" /> <span className="text-sm">Confermato/firmato dal cliente (blocca cambi senza extra)</span></label>
        <div className="ml-auto"><Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/materiali`, { items, firmato_cliente: firmato, firma_data: firmato ? new Date().toISOString() : null }); toast.success("Materiali salvati"); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="mat-save">Salva scelta materiali</Button></div>
      </div>
    </div>
  );
}

// ---- 4. COMPUTO METRICO (3 viste: con prezzi · senza prezzi · da assegnare) ----
function ComputoTab({ wf, cid, reload }) {
  const cm = wf.computo_metrico || { items: [] };
  const items = cm.items || [];
  const artPrev = wf.artigiani_preventivi || [];
  const [view, setView] = useState("prices"); // prices | no_prices | assign
  const [filter, setFilter] = useState("all"); // all | assigned | unassigned (solo in vista assign)
  const [assignOpen, setAssignOpen] = useState(null);
  const [assignForm, setAssignForm] = useState({ stato_assegnazione: "artigiano", artigiano_nome: "", artigiano_id: "", note_assegnazione: "" });

  // Statistiche assegnazione
  const stats = useMemo(() => {
    const ass = items.filter(i => i.stato_assegnazione && i.stato_assegnazione !== "da_assegnare");
    const noA = items.filter(i => !i.stato_assegnazione || i.stato_assegnazione === "da_assegnare");
    const totEur = items.reduce((s, i) => s + (i.totale || i.qty * i.prezzo_unit || 0), 0);
    const assEur = ass.reduce((s, i) => s + (i.totale || i.qty * i.prezzo_unit || 0), 0);
    return { totale: items.length, assegnate: ass.length, da_assegnare: noA.length, totEur, assEur, pct: totEur ? (assEur / totEur * 100) : 0 };
  }, [items]);

  const displayed = useMemo(() => {
    if (view !== "assign") return items;
    if (filter === "assigned") return items.filter(i => i.stato_assegnazione && i.stato_assegnazione !== "da_assegnare");
    if (filter === "unassigned") return items.filter(i => !i.stato_assegnazione || i.stato_assegnazione === "da_assegnare");
    return items;
  }, [items, view, filter]);

  const openAssign = (it) => {
    setAssignForm({
      stato_assegnazione: it.stato_assegnazione && it.stato_assegnazione !== "da_assegnare" ? it.stato_assegnazione : "artigiano",
      artigiano_nome: it.artigiano_nome || "",
      artigiano_id: it.artigiano_id || "",
      note_assegnazione: it.note_assegnazione || "",
    });
    setAssignOpen(it);
  };

  const saveAssign = async () => {
    if (assignForm.stato_assegnazione === "artigiano" && !assignForm.artigiano_nome) {
      toast.error("Inserisci il nome dell'artigiano o seleziona 'Operai interni'");
      return;
    }
    try {
      await api.patch(`/commesse/${cid}/workflow/computo/${assignOpen.id}/assegna`, assignForm);
      toast.success("Voce assegnata");
      setAssignOpen(null);
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  const printAndExport = () => window.print();

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold">Computo metrico</h3>
            <p className="text-xs text-zinc-500">Generato dal preventivo accettato. Scegli la vista che ti serve.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={printAndExport} data-testid="cm-print">Stampa / PDF</Button>
            <Button size="sm" onClick={async () => { await api.post(`/commesse/${cid}/workflow/computo`); toast.success("Computo rigenerato dal preventivo"); reload(); }} data-testid="cm-gen"><Sparkles className="h-4 w-4 mr-1" /> Rigenera dal preventivo</Button>
          </div>
        </div>
        {/* Tabs vista */}
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-zinc-200 bg-zinc-50">
          <button onClick={() => setView("prices")} className={`px-3 py-1.5 text-xs rounded-sm border ${view === "prices" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`} data-testid="cm-view-prices">Con prezzi</button>
          <button onClick={() => setView("no_prices")} className={`px-3 py-1.5 text-xs rounded-sm border ${view === "no_prices" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`} data-testid="cm-view-noprices">Senza prezzi (per artigiani)</button>
          <button onClick={() => setView("assign")} className={`px-3 py-1.5 text-xs rounded-sm border ${view === "assign" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`} data-testid="cm-view-assign">Assegnazione voci</button>
          {view === "assign" && (
            <div className="ml-auto flex items-center gap-1 text-xs">
              <span className="text-zinc-500">Mostra:</span>
              <button onClick={() => setFilter("all")} className={`px-2 py-0.5 rounded-sm border ${filter === "all" ? "bg-zinc-900 text-white" : "bg-white"}`}>Tutte ({stats.totale})</button>
              <button onClick={() => setFilter("assigned")} className={`px-2 py-0.5 rounded-sm border ${filter === "assigned" ? "bg-emerald-700 text-white" : "bg-white"}`}>Assegnate ({stats.assegnate})</button>
              <button onClick={() => setFilter("unassigned")} className={`px-2 py-0.5 rounded-sm border ${filter === "unassigned" ? "bg-rose-700 text-white" : "bg-white"}`} data-testid="cm-filter-unassigned">Da assegnare ({stats.da_assegnare})</button>
            </div>
          )}
        </div>
        {/* Barra avanzamento assegnazione */}
        {view === "assign" && (
          <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50/50">
            <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
              <span>Avanzamento assegnazione: <b>{fmtNum(stats.pct, 1)}%</b> · {fmtEur(stats.assEur)} / {fmtEur(stats.totEur)}</span>
              <span className="text-rose-700 font-medium">{stats.da_assegnare} voci ancora da assegnare</span>
            </div>
            <div className="h-2 bg-zinc-200 rounded overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, stats.pct)}%` }} />
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-2 text-left">Categoria</th>
            <th className="px-3 py-2 text-left">Voce</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-left">U.M.</th>
            {view === "prices" && <th className="px-3 py-2 text-right">Prezzo unit.</th>}
            {view === "prices" && <th className="px-3 py-2 text-right">Totale</th>}
            {view === "assign" && <th className="px-3 py-2 text-left">Assegnata a</th>}
            {view === "assign" && <th className="px-3 py-2 text-right">Azione</th>}
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {displayed.map(it => {
              const ass = it.stato_assegnazione && it.stato_assegnazione !== "da_assegnare";
              return (
                <tr key={it.id} className={view === "assign" && !ass ? "bg-rose-50/40" : ""}>
                  <td className="px-3 py-2 text-xs text-zinc-500">{it.category || "—"}</td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right mono">{fmtNum(it.qty, 2)}</td>
                  <td className="px-3 py-2 text-xs">{it.unit}</td>
                  {view === "prices" && <td className="px-3 py-2 text-right mono">{fmtEur(it.prezzo_unit)}</td>}
                  {view === "prices" && <td className="px-3 py-2 text-right font-semibold mono">{fmtEur(it.totale || (it.qty * it.prezzo_unit))}</td>}
                  {view === "assign" && (
                    <td className="px-3 py-2 text-xs">
                      {ass ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${it.stato_assegnazione === "interno" ? "bg-violet-100 text-violet-700" : it.stato_assegnazione === "autorizzato" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{it.stato_assegnazione}</span>
                          {it.artigiano_nome && <span className="text-zinc-700">→ {it.artigiano_nome}</span>}
                        </span>
                      ) : <span className="text-rose-600 font-medium">DA ASSEGNARE</span>}
                    </td>
                  )}
                  {view === "assign" && (
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAssign(it)} data-testid={`cm-assign-${it.id}`}>{ass ? "Modifica" : "Assegna"}</Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {!displayed.length && <tr><td colSpan={view === "prices" ? 6 : (view === "assign" ? 7 : 4)} className="px-3 py-12 text-center text-zinc-500">{view === "assign" && filter === "unassigned" ? "Tutte le voci sono assegnate 🎉" : "Nessuna voce. Clicca 'Rigenera dal preventivo'."}</td></tr>}
          </tbody>
          {view === "prices" && items.length > 0 && (
            <tfoot className="bg-zinc-50 font-bold">
              <tr><td colSpan={5} className="px-3 py-2 text-right">TOTALE</td><td className="px-3 py-2 text-right mono">{fmtEur(stats.totEur)}</td></tr>
            </tfoot>
          )}
        </table>
        {view === "no_prices" && items.length > 0 && (
          <div className="p-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
            Versione senza prezzi: stampa o salva in PDF per consegnarla agli artigiani in fase di richiesta preventivo.
          </div>
        )}
      </div>

      {/* Modal assegnazione */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assegna voce: {assignOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-zinc-50 p-2 rounded text-xs">
              {fmtNum(assignOpen?.qty || 0, 2)} {assignOpen?.unit} · {fmtEur((assignOpen?.qty || 0) * (assignOpen?.prezzo_unit || 0))}
            </div>
            <div><Label className="text-xs">Eseguita da</Label>
              <Select value={assignForm.stato_assegnazione} onValueChange={v => setAssignForm({ ...assignForm, stato_assegnazione: v })}>
                <SelectTrigger data-testid="cm-assign-stato"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="artigiano">Artigiano / sub-appaltatore</SelectItem>
                  <SelectItem value="interno">Operai interni</SelectItem>
                  <SelectItem value="autorizzato">Già autorizzata (preventivo OK)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignForm.stato_assegnazione === "artigiano" && (
              <>
                <div>
                  <Label className="text-xs">Scegli da preventivi caricati</Label>
                  <Select value={assignForm.artigiano_id} onValueChange={v => {
                    const p = artPrev.find(x => x.id === v);
                    setAssignForm({ ...assignForm, artigiano_id: v, artigiano_nome: p?.artigiano_nome || assignForm.artigiano_nome });
                  }}>
                    <SelectTrigger data-testid="cm-assign-art"><SelectValue placeholder="— oppure scrivi il nome sotto —" /></SelectTrigger>
                    <SelectContent>
                      {artPrev.map(p => <SelectItem key={p.id} value={p.id}>{p.artigiano_nome} · {fmtEur(p.importo_offerto)} · {p.stato}</SelectItem>)}
                      {!artPrev.length && <div className="p-2 text-xs text-zinc-500">Nessun preventivo artigiano caricato</div>}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Nome artigiano / squadra</Label><Input value={assignForm.artigiano_nome} onChange={e => setAssignForm({ ...assignForm, artigiano_nome: e.target.value })} data-testid="cm-assign-name" /></div>
              </>
            )}
            <div><Label className="text-xs">Note</Label><Input value={assignForm.note_assegnazione} onChange={e => setAssignForm({ ...assignForm, note_assegnazione: e.target.value })} placeholder="Eventuali note sull'esecuzione" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Annulla</Button>
            <Button onClick={saveAssign} style={{ background: "var(--brand)", color: "white" }} data-testid="cm-assign-save">Salva assegnazione</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 5. ARTIGIANI ----
function Artigiani({ wf, cid, reload }) {
  const items = wf.artigiani_preventivi || [];
  const cmItems = (wf.computo_metrico || {}).items || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ artigiano_nome: "", voci_riferite: [], importo_offerto: 0, url_pdf: "", testo_estratto: "", note: "", modalita: "artigiano" });
  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="font-semibold">Preventivi artigiani <span className="ml-2 text-xs text-zinc-500">L'AI confronta con le voci backoffice</span></h3>
          <Button size="sm" onClick={() => setOpen(true)} data-testid="art-add"><Plus className="h-4 w-4 mr-1" /> Carica preventivo</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-2 text-left">Artigiano</th><th className="px-3 py-2 text-left">Modalità</th><th className="px-3 py-2 text-right">Offerto</th><th className="px-3 py-2 text-right">Riferimento</th><th className="px-3 py-2 text-right">Scarto</th><th className="px-3 py-2 text-left">Giudizio</th><th className="px-3 py-2 text-center">Stato</th><th></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map(p => {
              const sb = STATO_ART_BADGE[p.stato] || { txt: p.stato, cls: "bg-zinc-100 text-zinc-600" };
              const ai = p.ai_analisi || {};
              return (
                <tr key={p.id} className={p.stato === "da_autorizzare" ? "bg-rose-50/40" : ""}>
                  <td className="px-3 py-2 font-medium">{p.artigiano_nome}{p.url_pdf && <a href={p.url_pdf} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 hover:underline">PDF↗</a>}</td>
                  <td className="px-3 py-2 text-xs uppercase">{p.modalita}</td>
                  <td className="px-3 py-2 text-right mono">{fmtEur(p.importo_offerto)}</td>
                  <td className="px-3 py-2 text-right mono text-zinc-500">{fmtEur(ai.ref_rivendita)}</td>
                  <td className={`px-3 py-2 text-right mono ${(ai.scarto_pct_su_rivendita || 0) > 10 ? "text-rose-700 font-bold" : (ai.scarto_pct_su_rivendita || 0) < 0 ? "text-emerald-700" : ""}`}>{ai.scarto_pct_su_rivendita != null ? `${ai.scarto_pct_su_rivendita > 0 ? "+" : ""}${fmtNum(ai.scarto_pct_su_rivendita, 1)}%` : "—"}</td>
                  <td className="px-3 py-2 text-xs max-w-md">
                    <div className="text-zinc-700">{ai.giudizio}</div>
                    {ai.differenza_eur != null && <div className="text-[10px] text-zinc-500 mono mt-0.5">Δ vs rivendita: {ai.differenza_eur > 0 ? "+" : ""}{fmtEur(ai.differenza_eur)}</div>}
                  </td>
                  <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-[11px] font-medium ${sb.cls}`}>{sb.txt}</span></td>
                  <td className="px-3 py-2 text-right">
                    {p.stato === "da_autorizzare" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { await api.post(`/commesse/${cid}/workflow/artigiani-preventivi/${p.id}/autorizza`); toast.success("Autorizzato"); reload(); }} data-testid={`art-auth-${p.id}`}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Autorizza</Button>}
                  </td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-500">Nessun preventivo. Carica il primo per ricevere l'analisi AI.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nuovo preventivo artigiano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Modalità</Label>
                <Select value={form.modalita} onValueChange={v => setForm({ ...form, modalita: v })}>
                  <SelectTrigger data-testid="art-modalita"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artigiano">Artigiano esterno</SelectItem>
                    <SelectItem value="interno">Operai interni (no preventivo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Nome artigiano / squadra</Label><Input value={form.artigiano_nome} onChange={e => setForm({ ...form, artigiano_nome: e.target.value })} data-testid="art-nome" /></div>
            </div>
            <div><Label className="text-xs">Voci di computo riferite (assegnate a questo preventivo)</Label>
              <div className="border border-zinc-300 rounded p-2 max-h-44 overflow-y-auto space-y-1">
                {cmItems.map(it => (
                  <label key={it.id} className="flex items-center gap-2 text-xs hover:bg-zinc-50 px-1 py-0.5 cursor-pointer">
                    <input type="checkbox" checked={form.voci_riferite.includes(it.id)} onChange={e => setForm({ ...form, voci_riferite: e.target.checked ? [...form.voci_riferite, it.id] : form.voci_riferite.filter(x => x !== it.id) })} />
                    <span className="flex-1">{it.name}</span>
                    <span className="text-zinc-500">{fmtNum(it.qty, 1)} {it.unit}</span>
                    <span className="font-semibold mono w-20 text-right">{fmtEur(it.totale || (it.qty * it.prezzo_unit))}</span>
                  </label>
                ))}
                {!cmItems.length && <div className="text-xs text-zinc-500 text-center py-3">Nessuna voce di computo. Vai prima al tab "Computo".</div>}
              </div>
            </div>
            {form.modalita === "artigiano" && <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Importo offerto (€)</Label><Input type="number" value={form.importo_offerto} onChange={e => setForm({ ...form, importo_offerto: parseFloat(e.target.value) || 0 })} data-testid="art-importo" /></div>
                <div><Label className="text-xs">Link PDF preventivo</Label><Input value={form.url_pdf} onChange={e => setForm({ ...form, url_pdf: e.target.value })} placeholder="https://..." data-testid="art-pdf" /></div>
              </div>
              <div><UploadField label="Oppure carica PDF preventivo dal PC" onUploaded={(meta) => setForm({ ...form, url_pdf: window.location.origin + meta.url })} commessaId={cid} tipo="preventivo_artigiano" accept=".pdf,.png,.jpg,.jpeg" testid="upload-prev-art" /></div>
              <div><Label className="text-xs">Note interne (testo libero)</Label><textarea value={form.testo_estratto} onChange={e => setForm({ ...form, testo_estratto: e.target.value })} className="w-full border border-zinc-300 rounded-sm p-2 text-xs h-20 mono" placeholder="Eventuali note dal preventivo..." data-testid="art-testo" /></div>
            </>}
            <div><Label className="text-xs">Note interne</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} data-testid="art-note" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={async () => {
              if (!form.artigiano_nome) { toast.error("Inserisci nome artigiano/squadra"); return; }
              if (!form.voci_riferite.length) { toast.error("Seleziona almeno una voce di computo"); return; }
              try {
                const r = await api.post(`/commesse/${cid}/workflow/artigiani-preventivi`, form);
                if (r.data.stato === "da_autorizzare") toast.error("BLOCCO: scarto > 25% — richiesta autorizzazione inviata");
                else if (r.data.stato === "warning") toast.warning("Warning: scarto > 10% — verifica con il responsabile");
                else toast.success("Preventivo OK registrato");
                setOpen(false);
                setForm({ artigiano_nome: "", voci_riferite: [], importo_offerto: 0, url_pdf: "", testo_estratto: "", note: "", modalita: "artigiano" });
                reload();
              } catch (e) { toast.error("Errore: " + (e.response?.data?.detail || e.message)); }
            }} style={{ background: "var(--brand)", color: "white" }} data-testid="art-save">Carica e verifica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 6. FASI CANTIERE (con Gantt visivo) ----
function Fasi({ wf, cid, reload }) {
  const fasi = wf.fasi || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titolo: "", eseguito_da: "interno", artigiano_nome: "", data_inizio: "", data_fine: "", stato: "da_iniziare", note: "" });

  // Gantt computation
  const gantt = useMemo(() => {
    const fasiDate = fasi.filter(f => f.data_inizio && f.data_fine).map(f => ({ ...f, _start: new Date(f.data_inizio), _end: new Date(f.data_fine) }));
    if (!fasiDate.length) return null;
    const minD = new Date(Math.min(...fasiDate.map(f => f._start.getTime())));
    const maxD = new Date(Math.max(...fasiDate.map(f => f._end.getTime())));
    const totDays = Math.max(1, Math.round((maxD - minD) / 86400000) + 1);
    // Larghezza colonna giorno aumentata (più leggibile). Min 28 / Max 60 px.
    const COL_W = Math.max(28, Math.min(60, 1600 / totDays));
    return { fasiDate, minD, maxD, totDays, COL_W, width: COL_W * totDays };
  }, [fasi]);

  const STATO_COL = { da_iniziare: "#A1A1AA", in_corso: "#3B82F6", completata: "#10B981", sospesa: "#F59E0B" };
  const LABEL_W = 240; // colonna sx larga per nomi fase
  const ROW_H = 44;   // riga alta per leggibilità

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="font-semibold">Fasi cantiere <span className="ml-2 text-xs text-zinc-500">Pianifica chi fa cosa e quando · Gantt visivo grande</span></h3>
          <Button size="sm" onClick={() => setOpen(true)} data-testid="fase-add"><Plus className="h-4 w-4 mr-1" /> Nuova fase</Button>
        </div>
        {/* GANTT */}
        {gantt && (
          <div className="p-4 border-b border-zinc-200 overflow-x-auto bg-zinc-50/40" data-testid="gantt-svg-wrap">
            <div className="text-xs text-zinc-600 mb-3 mono flex items-center gap-3">
              <span>📅 <b>Calendario Gantt</b> — dal {gantt.minD.toLocaleDateString("it-IT")} al {gantt.maxD.toLocaleDateString("it-IT")} ({gantt.totDays} giorni · {fasi.length} fasi)</span>
            </div>
            <svg width={gantt.width + LABEL_W} height={fasi.length * ROW_H + 50} style={{ minWidth: gantt.width + LABEL_W, background: "white", borderRadius: 4 }}>
              {/* Header date */}
              {Array.from({ length: gantt.totDays }).map((_, i) => {
                const d = new Date(gantt.minD); d.setDate(d.getDate() + i);
                const x = LABEL_W + i * gantt.COL_W;
                const isMonday = d.getDay() === 1;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return <g key={i}>
                  {isWeekend && <rect x={x} y={30} width={gantt.COL_W} height={fasi.length * ROW_H} fill="#FEF3C7" fillOpacity="0.3" />}
                  <line x1={x} y1={30} x2={x} y2={fasi.length * ROW_H + 40} stroke={isMonday ? "#71717A" : "#E4E4E7"} strokeWidth={isMonday ? 1.5 : 0.5} />
                  {(isMonday || gantt.COL_W >= 35) && <text x={x + 3} y={18} fontSize="12" fontFamily="JetBrains Mono" fill="#27272A" fontWeight={isMonday ? "700" : "400"}>{d.getDate()}/{d.getMonth() + 1}</text>}
                </g>;
              })}
              {/* Fasi rows */}
              {fasi.map((f, i) => {
                const y = 36 + i * ROW_H;
                const rowBg = i % 2 === 0 ? "#FAFAFA" : "#FFFFFF";
                const txtRow = <text x={8} y={y + 22} fontSize="13" fill="#0A0A0A" fontWeight="600" style={{ pointerEvents: "none" }}>{(f.titolo || "").slice(0, 32)}</text>;
                const subTxt = <text x={8} y={y + 36} fontSize="10" fill="#71717A" style={{ pointerEvents: "none" }}>{f.eseguito_da === "interno" ? "🏠 Operai interni" : `🔨 ${f.artigiano_nome || "Artigiano"}`}</text>;
                if (!f.data_inizio || !f.data_fine) {
                  return <g key={f.id}>
                    <rect x={0} y={y} width={gantt.width + LABEL_W} height={ROW_H - 4} fill={rowBg} />
                    {txtRow}
                    {subTxt}
                    <text x={LABEL_W + 10} y={y + 28} fontSize="11" fill="#A1A1AA" fontStyle="italic">— assegna date (inizio/fine) per vederla nel calendario —</text>
                  </g>;
                }
                const startDays = Math.round((new Date(f.data_inizio) - gantt.minD) / 86400000);
                const lenDays = Math.max(1, Math.round((new Date(f.data_fine) - new Date(f.data_inizio)) / 86400000) + 1);
                const x = LABEL_W + startDays * gantt.COL_W;
                const w = lenDays * gantt.COL_W - 4;
                return <g key={f.id} data-testid={`gantt-bar-${f.id}`}>
                  <rect x={0} y={y} width={gantt.width + LABEL_W} height={ROW_H - 4} fill={rowBg} />
                  {txtRow}
                  {subTxt}
                  <rect x={x} y={y + 6} width={w} height={30} rx={4} fill={STATO_COL[f.stato] || "#A1A1AA"} fillOpacity="0.9" stroke={STATO_COL[f.stato] || "#A1A1AA"} strokeWidth={1.5} />
                  <text x={x + 10} y={y + 26} fontSize="12" fill="white" fontWeight="600" style={{ pointerEvents: "none" }}>{lenDays}gg</text>
                </g>;
              })}
            </svg>
            <div className="flex items-center gap-4 mt-3 text-[11px] uppercase tracking-widest text-zinc-600">
              {Object.entries(STATO_COL).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: c }} /> {k.replace("_", " ")}</span>)}
              <span className="ml-4 flex items-center gap-1.5"><span className="w-3 h-3 inline-block bg-amber-100" /> weekend</span>
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-2 text-left">Titolo</th><th className="px-3 py-2 text-left">Esecutore</th><th className="px-3 py-2 text-left">Inizio</th><th className="px-3 py-2 text-left">Fine</th><th className="px-3 py-2 text-center">Stato</th><th></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {fasi.map(f => (
              <tr key={f.id}>
                <td className="px-3 py-2 font-medium">{f.titolo}</td>
                <td className="px-3 py-2 text-xs">{f.eseguito_da === "interno" ? "🏠 Interni" : `🔨 ${f.artigiano_nome || "Artigiano"}`}</td>
                <td className="px-3 py-2 mono text-xs">{f.data_inizio || "-"}</td>
                <td className="px-3 py-2 mono text-xs">{f.data_fine || "-"}</td>
                <td className="px-3 py-2 text-center">
                  <Select value={f.stato} onValueChange={async v => { await api.put(`/commesse/${cid}/workflow/fasi/${f.id}`, { ...f, stato: v }); reload(); }}>
                    <SelectTrigger className="h-7 text-xs w-32 mx-auto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="da_iniziare">Da iniziare</SelectItem>
                      <SelectItem value="in_corso">In corso</SelectItem>
                      <SelectItem value="completata">Completata</SelectItem>
                      <SelectItem value="sospesa">Sospesa</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-right"><button className="text-rose-600 p-1" onClick={async () => { await api.delete(`/commesse/${cid}/workflow/fasi/${f.id}`); reload(); }}><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!fasi.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Nessuna fase. Pianifica il cantiere.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova fase cantiere</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titolo</Label><Input value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} data-testid="fase-titolo" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Esecutore</Label>
                <Select value={form.eseguito_da} onValueChange={v => setForm({ ...form, eseguito_da: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="interno">Operai interni</SelectItem><SelectItem value="artigiano">Artigiano esterno</SelectItem></SelectContent>
                </Select>
              </div>
              {form.eseguito_da === "artigiano" && <div><Label className="text-xs">Nome artigiano</Label><Input value={form.artigiano_nome} onChange={e => setForm({ ...form, artigiano_nome: e.target.value })} /></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data inizio</Label><Input type="date" value={form.data_inizio} onChange={e => setForm({ ...form, data_inizio: e.target.value })} data-testid="fase-inizio" /></div>
              <div><Label className="text-xs">Data fine</Label><Input type="date" value={form.data_fine} onChange={e => setForm({ ...form, data_fine: e.target.value })} data-testid="fase-fine" /></div>
            </div>
            <div><Label className="text-xs">Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/fasi`, form); setOpen(false); setForm({ titolo: "", eseguito_da: "interno", artigiano_nome: "", data_inizio: "", data_fine: "", stato: "da_iniziare", note: "" }); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="fase-save">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 7. CASSA ----
function Cassa({ wf, cid, reload }) {
  const mov = wf.cassa || [];
  const marg = wf.marginalita || {};
  const artigiani = wf.artigiani_preventivi || [];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("entrambi"); // entrambi | scadenze | movimenti
  const [form, setForm] = useState({
    tipo: "incasso", direzione: "incasso", importo: 0,
    data: new Date().toISOString().slice(0, 10),
    data_scadenza: "", stato_pagamento: "pagato",
    descrizione: "", metodo: "bonifico",
    beneficiario_tipo: "cliente", beneficiario_id: "", beneficiario_nome: "",
    categoria: "acconto",
  });

  // Aggregati per beneficiario (per vedere "quanto pagato e quanto manca")
  const aggregati = useMemo(() => {
    const map = {};
    (mov || []).forEach(m => {
      const key = `${m.beneficiario_tipo || (m.tipo === "incasso" ? "cliente" : "fornitore")}::${m.beneficiario_nome || m.artigiano_nome || (m.tipo === "incasso" ? "Cliente" : "—")}`;
      if (!map[key]) map[key] = { key, tipo: m.beneficiario_tipo || (m.tipo === "incasso" ? "cliente" : "fornitore"), nome: m.beneficiario_nome || m.artigiano_nome || (m.tipo === "incasso" ? "Cliente" : "—"), pagato: 0, da_pagare: 0, scaduto: 0, prossima_scadenza: null };
      const imp = Math.abs(parseFloat(m.importo) || 0);
      if (m.stato_pagamento === "pagato" || (!m.stato_pagamento && m.data)) map[key].pagato += imp;
      else {
        map[key].da_pagare += imp;
        const sc = m.data_scadenza || m.data;
        if (sc && new Date(sc) < new Date() && m.stato_pagamento !== "pagato") map[key].scaduto += imp;
        if (sc && (!map[key].prossima_scadenza || new Date(sc) < new Date(map[key].prossima_scadenza))) map[key].prossima_scadenza = sc;
      }
    });
    return Object.values(map).sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : (a.tipo === "cliente" ? -1 : 1)));
  }, [mov]);

  const upcoming = useMemo(() => (mov || [])
    .filter(m => m.stato_pagamento !== "pagato" && (m.data_scadenza || m.data))
    .sort((a, b) => new Date(a.data_scadenza || a.data) - new Date(b.data_scadenza || b.data)), [mov]);

  const markPaid = async (m) => {
    try {
      await api.patch(`/commesse/${cid}/workflow/cassa/${m.id}`, { stato_pagamento: "pagato", data: m.data || new Date().toISOString().slice(0, 10) });
      reload();
      toast.success("Pagamento registrato");
    } catch (e) { toast.error("Errore: " + (e.response?.data?.detail || e.message)); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Incassato" value={fmtEur(marg.incassato)} icon={Wallet} color="text-emerald-600" />
        <StatCard label="Da incassare" value={fmtEur(marg.saldo_residuo_cliente)} icon={Clock} color="text-amber-600" />
        <StatCard label="Uscite pagate" value={fmtEur(marg.uscito)} icon={Wallet} color="text-rose-600" />
        <StatCard label="Da pagare" value={fmtEur(aggregati.filter(a => a.tipo !== "cliente").reduce((s, a) => s + a.da_pagare, 0))} icon={Clock} color="text-rose-600" />
        <StatCard label="Saldo cassa" value={fmtEur(marg.saldo_cassa)} icon={Wallet} color={marg.saldo_cassa < 0 ? "text-rose-600" : "text-emerald-600"} />
      </div>

      {/* Switch vista */}
      <div className="flex flex-wrap items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded p-2">
        <button onClick={() => setView("entrambi")} className={`px-3 py-1 text-xs rounded-sm border ${view === "entrambi" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`}>Riepilogo per beneficiario</button>
        <button onClick={() => setView("scadenze")} className={`px-3 py-1 text-xs rounded-sm border ${view === "scadenze" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`} data-testid="cassa-view-scadenze">Scadenze pagamenti ({upcoming.length})</button>
        <button onClick={() => setView("movimenti")} className={`px-3 py-1 text-xs rounded-sm border ${view === "movimenti" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-300"}`}>Storico movimenti</button>
        <Button size="sm" className="ml-auto" onClick={() => setOpen(true)} data-testid="cassa-add"><Plus className="h-4 w-4 mr-1" /> Nuovo movimento/scadenza</Button>
      </div>

      {view === "entrambi" && (
        <div className="bg-white border border-zinc-200 rounded">
          <div className="p-3 border-b border-zinc-200 text-xs text-zinc-500">Vista per beneficiario · sai a colpo d'occhio quanto hai già dato e quanto manca per ognuno</div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left">Beneficiario</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-right">Pagato</th><th className="px-3 py-2 text-right">Da pagare</th><th className="px-3 py-2 text-right">Scaduto</th><th className="px-3 py-2 text-left">Prossima scadenza</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {aggregati.map(a => (
                <tr key={a.key} className={a.scaduto > 0 ? "bg-rose-50/40" : ""}>
                  <td className="px-3 py-2 font-medium">{a.nome}</td>
                  <td className="px-3 py-2 text-xs uppercase">{a.tipo}</td>
                  <td className="px-3 py-2 text-right mono text-emerald-700 font-semibold">{fmtEur(a.pagato)}</td>
                  <td className="px-3 py-2 text-right mono text-amber-700 font-semibold">{fmtEur(a.da_pagare)}</td>
                  <td className={`px-3 py-2 text-right mono ${a.scaduto > 0 ? "text-rose-700 font-bold" : "text-zinc-400"}`}>{a.scaduto > 0 ? fmtEur(a.scaduto) : "—"}</td>
                  <td className="px-3 py-2 text-xs mono">{a.prossima_scadenza ? new Date(a.prossima_scadenza).toLocaleDateString("it-IT") : "—"}</td>
                </tr>
              ))}
              {!aggregati.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Nessun movimento o scadenza registrata.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === "scadenze" && (
        <div className="bg-white border border-zinc-200 rounded">
          <div className="p-3 border-b border-zinc-200 text-xs text-zinc-500">Tutte le scadenze ancora aperte ordinate per data</div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left">Scadenza</th><th className="px-3 py-2 text-left">Direzione</th><th className="px-3 py-2 text-left">Beneficiario</th><th className="px-3 py-2 text-left">Descrizione</th><th className="px-3 py-2 text-right">Importo</th><th className="px-3 py-2 text-center">Stato</th><th></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {upcoming.map(m => {
                const sc = m.data_scadenza || m.data;
                const scaduto = sc && new Date(sc) < new Date();
                return (
                  <tr key={m.id} className={scaduto ? "bg-rose-50/40" : ""}>
                    <td className={`px-3 py-2 mono text-xs ${scaduto ? "text-rose-700 font-bold" : ""}`}>{sc ? new Date(sc).toLocaleDateString("it-IT") : "—"}</td>
                    <td className="px-3 py-2 text-xs uppercase font-bold">{m.tipo}</td>
                    <td className="px-3 py-2">{m.beneficiario_nome || m.artigiano_nome || "—"}</td>
                    <td className="px-3 py-2">{m.descrizione}<span className="ml-2 text-[10px] text-zinc-500 uppercase">{m.categoria}</span></td>
                    <td className={`px-3 py-2 text-right mono font-semibold ${m.tipo === "incasso" ? "text-emerald-700" : "text-rose-700"}`}>{m.tipo === "incasso" ? "+" : "-"}{fmtEur(m.importo)}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-[11px] px-2 py-0.5 rounded ${scaduto ? "bg-rose-200 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{scaduto ? "SCADUTO" : "PROGRAMMATO"}</span></td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markPaid(m)} data-testid={`cassa-mark-paid-${m.id}`}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Segna pagato</Button>
                    </td>
                  </tr>
                );
              })}
              {!upcoming.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">Nessuna scadenza pendente 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === "movimenti" && (
        <div className="bg-white border border-zinc-200 rounded">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Beneficiario</th><th className="px-3 py-2 text-left">Descrizione</th><th className="px-3 py-2 text-left">Metodo</th><th className="px-3 py-2 text-right">Importo</th><th className="px-3 py-2 text-center">Stato</th><th></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {mov.map(m => (
                <tr key={m.id} className={m.tipo === "incasso" ? "bg-emerald-50/30" : "bg-rose-50/30"}>
                  <td className="px-3 py-2 mono text-xs">{m.data}</td>
                  <td className="px-3 py-2 text-xs uppercase font-bold">{m.tipo}</td>
                  <td className="px-3 py-2">{m.beneficiario_nome || m.artigiano_nome || (m.tipo === "incasso" ? "Cliente" : "—")}</td>
                  <td className="px-3 py-2">{m.descrizione}<span className="ml-2 text-[10px] text-zinc-500 uppercase">{m.categoria}</span></td>
                  <td className="px-3 py-2 text-xs">{m.metodo}</td>
                  <td className={`px-3 py-2 text-right mono font-semibold ${m.tipo === "incasso" ? "text-emerald-700" : "text-rose-700"}`}>{m.tipo === "incasso" ? "+" : "-"}{fmtEur(m.importo)}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-[11px] px-2 py-0.5 rounded ${m.stato_pagamento === "pagato" || !m.stato_pagamento ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{m.stato_pagamento || "pagato"}</span></td>
                  <td className="px-3 py-2 text-right"><button className="text-rose-600 p-1" onClick={async () => { await api.delete(`/commesse/${cid}/workflow/cassa/${m.id}`); reload(); }}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {!mov.length && <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-500">Nessun movimento.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nuovo movimento o scadenza di pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Direzione</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v, beneficiario_tipo: v === "incasso" ? "cliente" : "fornitore" })}>
                  <SelectTrigger data-testid="cassa-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="incasso">Incasso (da cliente)</SelectItem><SelectItem value="uscita">Uscita (a sub/fornitore)</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Stato</Label>
                <Select value={form.stato_pagamento} onValueChange={v => setForm({ ...form, stato_pagamento: v })}>
                  <SelectTrigger data-testid="cassa-stato"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pagato">Già pagato/incassato</SelectItem><SelectItem value="programmato">Scadenza futura (non ancora pagato)</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acconto">Acconto</SelectItem>
                    <SelectItem value="avanzamento">Avanzamento SAL</SelectItem>
                    <SelectItem value="saldo">Saldo finale</SelectItem>
                    <SelectItem value="materiali">Materiali</SelectItem>
                    <SelectItem value="extra">Extra / variante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{form.stato_pagamento === "pagato" ? "Data pagamento" : "Data effettiva (se pagata)"}</Label>
                <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} data-testid="cassa-data" />
              </div>
              <div>
                <Label className="text-xs">Data scadenza (se programmata)</Label>
                <Input type="date" value={form.data_scadenza} onChange={e => setForm({ ...form, data_scadenza: e.target.value })} data-testid="cassa-scadenza" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Importo (€)</Label><Input type="number" value={form.importo} onChange={e => setForm({ ...form, importo: parseFloat(e.target.value) || 0 })} data-testid="cassa-importo" /></div>
              <div><Label className="text-xs">Metodo</Label>
                <Select value={form.metodo} onValueChange={v => setForm({ ...form, metodo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="bonifico">Bonifico</SelectItem><SelectItem value="contanti">Contanti</SelectItem><SelectItem value="assegno">Assegno</SelectItem><SelectItem value="altro">Altro</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {form.tipo === "uscita" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tipo beneficiario</Label>
                  <Select value={form.beneficiario_tipo} onValueChange={v => setForm({ ...form, beneficiario_tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subappaltatore">Sub-appaltatore / artigiano</SelectItem>
                      <SelectItem value="fornitore">Fornitore materiali</SelectItem>
                      <SelectItem value="interno">Operai interni / spese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Nome beneficiario</Label>
                  <Input list="art-list" value={form.beneficiario_nome} onChange={e => setForm({ ...form, beneficiario_nome: e.target.value })} placeholder="Cerca o digita nuovo..." data-testid="cassa-benef" />
                  <datalist id="art-list">{artigiani.map(a => <option key={a.id} value={a.artigiano_nome} />)}</datalist>
                </div>
              </div>
            )}
            <div><Label className="text-xs">Descrizione</Label><Input value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} placeholder="Es: Acconto 30% inizio lavori muratura" data-testid="cassa-desc" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={async () => {
              if (!form.importo) { toast.error("Inserisci l'importo"); return; }
              try {
                await api.post(`/commesse/${cid}/workflow/cassa`, form);
                setOpen(false);
                setForm({ tipo: "incasso", direzione: "incasso", importo: 0, data: new Date().toISOString().slice(0, 10), data_scadenza: "", stato_pagamento: "pagato", descrizione: "", metodo: "bonifico", beneficiario_tipo: "cliente", beneficiario_id: "", beneficiario_nome: "", categoria: "acconto" });
                reload();
                toast.success(form.stato_pagamento === "pagato" ? "Movimento registrato" : "Scadenza salvata");
              } catch (e) { toast.error("Errore: " + (e.response?.data?.detail || e.message)); }
            }} style={{ background: "var(--brand)", color: "white" }} data-testid="cassa-save">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 8. RESOCONTO ----

// ---- 9. VOCI E ACQUISTI ----
const FASE_COLORS = ["#0F766E", "#2563EB", "#9333EA", "#F59E0B", "#DC2626", "#0EA5E9", "#10B981", "#F97316"];

function VociAcquistiTab({ wf, cid, reload }) {
  const c = wf.commessa || {};
  const [items, setItems] = useState(c.voci_acquisti || []);
  const tot = useMemo(() => items.reduce((s, v) => ({
    prev: s.prev + (parseFloat(v.preventivato) || 0),
    eff: s.eff + (parseFloat(v.effettivo) || 0),
    pag: s.pag + ((v.pagato && (parseFloat(v.effettivo) || 0)) || 0),
  }), { prev: 0, eff: 0, pag: 0 }), [items]);

  const save = async () => {
    try {
      await api.put(`/commesse/${cid}`, { ...c, voci_acquisti: items });
      toast.success("Voci e acquisti salvati");
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  const add = () => setItems([...items, { voce: "", subappaltatore: "", preventivato: 0, effettivo: 0, pagato: false, note: "" }]);
  const upd = (i, k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x));

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold">Voci e Acquisti — riconciliazione preventivato vs effettivo</h3>
            <p className="text-xs text-zinc-500">Confronto tra quanto previsto in preventivo e quanto effettivamente speso per ogni subappaltatore/fornitore.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={add} data-testid="va-add"><Plus className="h-4 w-4 mr-1" /> Voce</Button>
            <Button size="sm" onClick={save} style={{ background: "var(--brand)", color: "white" }} data-testid="va-save">Salva</Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-2 py-2 text-left">Voce</th>
            <th className="px-2 py-2 text-left">Sub-appaltatore / Fornitore</th>
            <th className="px-2 py-2 text-right w-32">Preventivato</th>
            <th className="px-2 py-2 text-right w-32">Effettivo</th>
            <th className="px-2 py-2 text-right w-28">Δ</th>
            <th className="px-2 py-2 text-center w-20">Pagato</th>
            <th className="w-10"></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((v, i) => {
              const delta = (parseFloat(v.effettivo) || 0) - (parseFloat(v.preventivato) || 0);
              return (
                <tr key={i}>
                  <td className="px-2 py-1.5"><Input value={v.voce} onChange={(e) => upd(i, "voce", e.target.value)} placeholder="Es: Impianto idraulico" className="h-8 text-xs" data-testid={`va-voce-${i}`} /></td>
                  <td className="px-2 py-1.5"><Input value={v.subappaltatore} onChange={(e) => upd(i, "subappaltatore", e.target.value)} placeholder="Nome sub/fornitore" className="h-8 text-xs" /></td>
                  <td className="px-2 py-1.5"><Input type="number" value={v.preventivato} onChange={(e) => upd(i, "preventivato", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" /></td>
                  <td className="px-2 py-1.5"><Input type="number" value={v.effettivo} onChange={(e) => upd(i, "effettivo", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" /></td>
                  <td className={`px-2 py-1.5 text-right mono font-bold ${delta > 0 ? "text-rose-600" : delta < 0 ? "text-emerald-600" : "text-zinc-500"}`}>{delta > 0 ? "+" : ""}{fmtEur(delta)}</td>
                  <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={!!v.pagato} onChange={(e) => upd(i, "pagato", e.target.checked)} className="h-4 w-4" data-testid={`va-pagato-${i}`} /></td>
                  <td className="px-2 py-1.5"><button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-600 p-1"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">Nessuna voce. Clicca "Voce" per aggiungere la prima.</td></tr>}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-zinc-50 font-bold">
              <tr>
                <td colSpan={2} className="px-2 py-2 text-right uppercase text-xs">Totali</td>
                <td className="px-2 py-2 text-right mono">{fmtEur(tot.prev)}</td>
                <td className="px-2 py-2 text-right mono">{fmtEur(tot.eff)}</td>
                <td className={`px-2 py-2 text-right mono ${tot.eff - tot.prev > 0 ? "text-rose-600" : "text-emerald-600"}`}>{tot.eff - tot.prev > 0 ? "+" : ""}{fmtEur(tot.eff - tot.prev)}</td>
                <td className="px-2 py-2 text-right mono text-emerald-700">{fmtEur(tot.pag)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ---- 7. LAVORAZIONI / CALENDARIO TASK ----
function LavorazioniTab({ wf, cid, reload }) {
  const c = wf.commessa || {};
  const [tasks, setTasks] = useState(c.calendario || []);
  const [editTask, setEditTask] = useState(null);
  const today = new Date();
  const monthsToShow = 4;
  const daysPerMonth = 30;
  const totalDays = monthsToShow * daysPerMonth;
  const dayWidth = 18;

  const save = async (next) => {
    try {
      await api.put(`/commesse/${cid}`, { ...c, calendario: next });
      setTasks(next);
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  const addTask = () => setEditTask({
    id: `task-${Date.now()}`,
    name: "Nuova lavorazione",
    color: FASE_COLORS[tasks.length % FASE_COLORS.length],
    data_inizio: today.toISOString().slice(0, 10),
    data_fine: new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10),
    subappaltatore: "", note: "",
  });
  const saveTask = (t) => {
    const ex = tasks.findIndex((x) => x.id === t.id);
    const next = ex >= 0 ? tasks.map((x, i) => i === ex ? t : x) : [...tasks, t];
    save(next); setEditTask(null);
  };
  const delTask = (id) => save(tasks.filter((t) => t.id !== id));

  const earliest = tasks.reduce((m, t) => { const d = new Date(t.data_inizio); return d < m ? d : m; }, new Date());
  const baseDate = new Date(earliest); baseDate.setDate(baseDate.getDate() - 3);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold">Lavorazioni del cantiere — calendario giornaliero</h3>
            <p className="text-xs text-zinc-500">Pianifica chi fa cosa e quando, vista giornaliera dettagliata (alternativa alla vista Fasi Gantt).</p>
          </div>
          <Button size="sm" onClick={addTask} data-testid="lav-add" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" /> Lavorazione</Button>
        </div>
        <div className="overflow-x-auto" style={{ maxWidth: "100%" }}>
          <div style={{ minWidth: totalDays * dayWidth + 280 }}>
            <div className="flex sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[10px] mono">
              <div className="w-[280px] shrink-0 px-3 py-2 font-semibold text-zinc-700 border-r">Lavorazione</div>
              <div className="flex">
                {Array.from({ length: totalDays }).map((_, d) => {
                  const dt = new Date(baseDate); dt.setDate(dt.getDate() + d);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isToday = dt.toDateString() === today.toDateString();
                  const showLabel = dt.getDate() === 1 || d === 0;
                  return (
                    <div key={d} className={`shrink-0 ${isWeekend ? "bg-amber-50" : ""} ${isToday ? "bg-blue-100 ring-1 ring-blue-400" : ""} border-r border-zinc-100 text-center`} style={{ width: dayWidth, height: 36 }}>
                      {showLabel && <div className="text-[9px] font-bold mt-1">{dt.toLocaleString("it-IT", { month: "short" })}</div>}
                      <div className="mt-0.5">{dt.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {tasks.map((t) => {
              const ds = new Date(t.data_inizio), de = new Date(t.data_fine);
              const startDay = Math.round((ds - baseDate) / 86400000);
              const dur = Math.max(1, Math.round((de - ds) / 86400000) + 1);
              return (
                <div key={t.id} className="flex border-b border-zinc-100 hover:bg-zinc-50 group" data-testid={`lav-row-${t.id}`}>
                  <div className="w-[280px] shrink-0 px-3 py-2 border-r text-sm flex items-center justify-between gap-2">
                    <div className="truncate flex-1">
                      <div className="font-medium truncate">{t.name}</div>
                      {t.subappaltatore && <div className="text-[10px] text-zinc-500">🔨 {t.subappaltatore}</div>}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      <button onClick={() => setEditTask(t)} className="p-1 hover:bg-zinc-100 rounded"><FileSignature className="h-3.5 w-3.5 text-zinc-500" /></button>
                      <button onClick={() => delTask(t.id)} className="p-1 hover:bg-rose-100 rounded"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>
                    </div>
                  </div>
                  <div className="relative" style={{ width: totalDays * dayWidth, height: 40 }}>
                    <div className="absolute top-2 rounded text-white text-[10px] px-2 py-1.5 truncate font-medium cursor-pointer hover:opacity-90 shadow-md"
                      style={{ left: startDay * dayWidth, width: dur * dayWidth - 2, background: t.color }}
                      onClick={() => setEditTask(t)} data-testid={`lav-bar-${t.id}`}>
                      {t.name} <span className="opacity-75">({dur}g)</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!tasks.length && <div className="px-4 py-12 text-center text-zinc-500 text-sm">Nessuna lavorazione pianificata. Clicca "Lavorazione" per aggiungere la prima.</div>}
          </div>
        </div>
      </div>

      {editTask && (
        <Dialog open={true} onOpenChange={() => setEditTask(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Lavorazione</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><Label>Nome lavorazione</Label><Input value={editTask.name} onChange={(e) => setEditTask({ ...editTask, name: e.target.value })} data-testid="lav-task-name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Inizio</Label><Input type="date" value={editTask.data_inizio} onChange={(e) => setEditTask({ ...editTask, data_inizio: e.target.value })} data-testid="lav-task-start" /></div>
                <div><Label>Fine</Label><Input type="date" value={editTask.data_fine} onChange={(e) => setEditTask({ ...editTask, data_fine: e.target.value })} data-testid="lav-task-end" /></div>
              </div>
              <div><Label>Sub-appaltatore / squadra</Label><Input value={editTask.subappaltatore} onChange={(e) => setEditTask({ ...editTask, subappaltatore: e.target.value })} /></div>
              <div>
                <Label>Colore</Label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {FASE_COLORS.map((col) => (
                    <button key={col} onClick={() => setEditTask({ ...editTask, color: col })} className={`h-8 w-8 rounded border-2 ${editTask.color === col ? "border-zinc-900 ring-2 ring-zinc-300" : "border-zinc-200"}`} style={{ background: col }} />
                  ))}
                </div>
              </div>
              <div><Label>Note</Label><Input value={editTask.note || ""} onChange={(e) => setEditTask({ ...editTask, note: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTask(null)}>Annulla</Button>
              <Button onClick={() => saveTask(editTask)} style={{ background: "var(--brand)", color: "white" }} data-testid="lav-task-save">Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Resoconto({ cid, marg, wf }) {
  const [r, setR] = useState(null);
  useEffect(() => { api.get(`/commesse/${cid}/workflow/resoconto`).then(x => setR(x.data)); }, [cid]);
  if (!r) return <div className="text-zinc-500">Caricamento…</div>;
  const dM = r.arrivo.delta_margine;
  const ok = dM >= 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white border border-zinc-200 rounded p-5">
        <h3 className="font-semibold mb-3">Da dove siamo partiti</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Totale preventivato</dt><dd className="font-semibold mono">{fmtEur(r.partenza.totale_preventivato)}</dd></div>
          <div className="flex justify-between"><dt>Costo previsto</dt><dd className="mono">{fmtEur(r.partenza.costo_previsto)}</dd></div>
          <div className="flex justify-between text-emerald-700 border-t pt-2"><dt><b>Margine atteso</b></dt><dd className="font-bold mono">{fmtEur(r.partenza.margine_atteso)} <span className="text-xs">({fmtNum(r.partenza.margine_pct_atteso, 1)}%)</span></dd></div>
        </dl>
      </div>
      <div className={`bg-white border-2 rounded p-5 ${ok ? "border-emerald-300" : "border-rose-300"}`}>
        <h3 className="font-semibold mb-3">Dove siamo arrivati</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Incassato</dt><dd className="font-semibold mono text-emerald-700">+{fmtEur(r.arrivo.incassato)}</dd></div>
          <div className="flex justify-between"><dt>Uscite</dt><dd className="font-semibold mono text-rose-700">-{fmtEur(r.arrivo.uscite)}</dd></div>
          <div className="flex justify-between border-t pt-2"><dt><b>Saldo cassa</b></dt><dd className="font-bold mono">{fmtEur(r.arrivo.saldo)}</dd></div>
          <div className={`flex justify-between border-t pt-2 ${ok ? "text-emerald-700" : "text-rose-700"}`}>
            <dt><b>Margine attuale</b></dt><dd className="font-bold mono">{fmtEur(r.arrivo.margine_attuale)} <span className="text-xs">({fmtNum(r.arrivo.margine_pct_attuale, 1)}%)</span></dd>
          </div>
          <div className={`flex justify-between text-base pt-1 ${ok ? "text-emerald-700" : "text-rose-700"}`}>
            <dt><b>Δ vs atteso</b></dt><dd className="font-bold mono">{ok ? "+" : ""}{fmtEur(dM)}</dd>
          </div>
        </dl>
        <div className="mt-3 text-xs">
          {dM < 0 && <div className="bg-rose-50 border border-rose-300 p-2 text-rose-800"><AlertTriangle className="inline h-4 w-4 mr-1" /> Margine inferiore alle previsioni. Verifica preventivi artigiani sopra soglia o uscite extra.</div>}
          {dM >= 0 && r.fasi_totali > 0 && r.fasi_completate === r.fasi_totali && <div className="bg-emerald-50 border border-emerald-300 p-2 text-emerald-800"><CheckCircle2 className="inline h-4 w-4 mr-1" /> Cantiere chiuso in attivo!</div>}
        </div>
      </div>
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Artigiani" value={r.artigiani_count} icon={Hammer} sub={r.artigiani_da_autorizzare ? `${r.artigiani_da_autorizzare} da autorizzare` : "tutti OK"} />
        <StatCard label="Fasi" value={`${r.fasi_completate} / ${r.fasi_totali}`} icon={CalendarRange} />
        <StatCard label="Saldo da incassare" value={fmtEur(marg.saldo_residuo_cliente)} icon={Clock} color={marg.saldo_residuo_cliente > 0 ? "text-amber-600" : "text-emerald-600"} />
        <StatCard label="Documenti" value={(wf.documenti || []).length} icon={Files} />
      </div>
    </div>
  );
}
