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
import { FileSignature, Files, ListChecks, Calculator, Hammer, CalendarRange, Wallet, FileBarChart2, Plus, Trash2, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

const STATO_ART_BADGE = {
  ok:               { txt: "OK",                cls: "bg-emerald-100 text-emerald-700" },
  da_autorizzare:   { txt: "Da autorizzare",    cls: "bg-rose-100 text-rose-700" },
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
        actions={<Button variant="outline" onClick={() => nav("/commesse")} data-testid="btn-back-commesse">← Tutte le commesse</Button>}
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
            <TabsTrigger value="documenti" data-testid="tab-documenti"><Files className="h-4 w-4 mr-1.5" /> 2. Documenti</TabsTrigger>
            <TabsTrigger value="materiali" data-testid="tab-materiali"><ListChecks className="h-4 w-4 mr-1.5" /> 3. Materiali</TabsTrigger>
            <TabsTrigger value="computo" data-testid="tab-computo"><Calculator className="h-4 w-4 mr-1.5" /> 4. Computo</TabsTrigger>
            <TabsTrigger value="artigiani" data-testid="tab-artigiani"><Hammer className="h-4 w-4 mr-1.5" /> 5. Artigiani</TabsTrigger>
            <TabsTrigger value="fasi" data-testid="tab-fasi"><CalendarRange className="h-4 w-4 mr-1.5" /> 6. Fasi cantiere</TabsTrigger>
            <TabsTrigger value="cassa" data-testid="tab-cassa"><Wallet className="h-4 w-4 mr-1.5" /> 7. Cassa</TabsTrigger>
            <TabsTrigger value="resoconto" data-testid="tab-resoconto"><FileBarChart2 className="h-4 w-4 mr-1.5" /> 8. Resoconto</TabsTrigger>
          </TabsList>

          {/* 1. CONTRATTO */}
          <TabsContent value="contratto" className="mt-4"><Contratto wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 2. DOCUMENTI */}
          <TabsContent value="documenti" className="mt-4"><Documenti wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 3. MATERIALI */}
          <TabsContent value="materiali" className="mt-4"><Materiali wf={wf} cid={cid} reload={reload} voci={voci} /></TabsContent>
          {/* 4. COMPUTO */}
          <TabsContent value="computo" className="mt-4"><ComputoTab wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 5. ARTIGIANI */}
          <TabsContent value="artigiani" className="mt-4"><Artigiani wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 6. FASI */}
          <TabsContent value="fasi" className="mt-4"><Fasi wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 7. CASSA */}
          <TabsContent value="cassa" className="mt-4"><Cassa wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 8. RESOCONTO */}
          <TabsContent value="resoconto" className="mt-4"><Resoconto cid={cid} marg={marg} wf={wf} /></TabsContent>
        </Tabs>
      </Page>
    </div>
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
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Scelta materiali (firma cliente)</h3>
        <Button size="sm" onClick={() => setItems([...items, { voce_id: "", name: "", qty: 1, unit: "pz", prezzo: 0, note: "" }])} data-testid="mat-add"><Plus className="h-4 w-4 mr-1" /> Riga</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
          <th className="px-2 py-2 text-left">Voce backoffice</th><th className="px-2 py-2 text-left">Nome</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-left">Unità</th><th className="px-2 py-2 text-right">Prezzo</th><th className="px-2 py-2 text-right">Tot</th><th></th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((it, i) => {
            const upd = (k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x));
            return (
              <tr key={i}>
                <td className="px-2 py-1">
                  <Select value={it.voce_id || ""} onValueChange={v => { const voce = voci.find(x => x.id === v); upd("voce_id", v); if (voce) { upd("name", voce.name); upd("unit", voce.unit || "pz"); upd("prezzo", parseFloat(voce.prezzo_acquisto || 0) * parseFloat(voce.ricarico || 1.8)); } }}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`mat-voce-${i}`}><SelectValue placeholder="Scegli..." /></SelectTrigger>
                    <SelectContent className="max-h-72">{voci.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1"><Input value={it.name} onChange={e => upd("name", e.target.value)} className="h-8 text-xs" /></td>
                <td className="px-2 py-1"><Input type="number" value={it.qty} onChange={e => upd("qty", e.target.value)} className="h-8 text-xs text-right mono w-20" /></td>
                <td className="px-2 py-1"><Input value={it.unit} onChange={e => upd("unit", e.target.value)} className="h-8 text-xs w-16" /></td>
                <td className="px-2 py-1"><Input type="number" value={it.prezzo} onChange={e => upd("prezzo", e.target.value)} className="h-8 text-xs text-right mono w-24" /></td>
                <td className="px-2 py-1 text-right mono">{fmtEur((it.qty || 0) * (it.prezzo || 0))}</td>
                <td><button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-600 p-1"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            );
          })}
          {!items.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-500">Aggiungi le voci materiali da fare scegliere/firmare al cliente.</td></tr>}
        </tbody>
        {items.length > 0 && <tfoot><tr className="bg-zinc-50"><td colSpan={5} className="px-2 py-2 text-right font-bold uppercase text-xs">Totale</td><td className="px-2 py-2 text-right font-bold mono">{fmtEur(totale)}</td><td></td></tr></tfoot>}
      </table>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={firmato} onChange={e => setFirmato(e.target.checked)} data-testid="mat-firmato" /> <span className="text-sm">Firmato dal cliente</span></label>
        <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/materiali`, { items, firmato_cliente: firmato, firma_data: firmato ? new Date().toISOString() : null }); toast.success("Materiali salvati"); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="mat-save">Salva scelta</Button>
      </div>
    </div>
  );
}

// ---- 4. COMPUTO METRICO ----
function ComputoTab({ wf, cid, reload }) {
  const cm = wf.computo_metrico || { items: [] };
  return (
    <div className="bg-white border border-zinc-200 rounded">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200">
        <div>
          <h3 className="font-semibold">Computo metrico</h3>
          <p className="text-xs text-zinc-500">Generato dal preventivo. Ogni voce deve essere assegnata a un artigiano o a operai interni.</p>
        </div>
        <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/computo`); toast.success("Computo rigenerato dal preventivo"); reload(); }} data-testid="cm-gen"><Sparkles className="h-4 w-4 mr-1" /> Rigenera dal preventivo</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
          <th className="px-3 py-2 text-left">Voce</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-left">Unità</th><th className="px-3 py-2 text-right">Prezzo</th><th className="px-3 py-2 text-right">Totale</th><th className="px-3 py-2 text-center">Stato</th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {(cm.items || []).map(it => (
            <tr key={it.id}>
              <td className="px-3 py-2">{it.name}</td>
              <td className="px-3 py-2 text-right mono">{fmtNum(it.qty, 2)}</td>
              <td className="px-3 py-2 text-xs">{it.unit}</td>
              <td className="px-3 py-2 text-right mono">{fmtEur(it.prezzo_unit)}</td>
              <td className="px-3 py-2 text-right font-semibold mono">{fmtEur(it.totale || (it.qty * it.prezzo_unit))}</td>
              <td className="px-3 py-2 text-center"><span className="text-[11px] px-2 py-0.5 bg-zinc-100 rounded">{it.stato_assegnazione}</span></td>
            </tr>
          ))}
          {!(cm.items || []).length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Computo non generato. Clicca "Rigenera" qui sopra.</td></tr>}
        </tbody>
      </table>
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
                    {ai.giudizio_ai && <details className="text-[10px] text-zinc-500 mt-1"><summary className="cursor-pointer text-blue-600 hover:underline"><Sparkles className="inline h-3 w-3" /> Giudizio AI</summary><div className="mt-1 italic">{ai.giudizio_ai}</div></details>}
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
              <div><Label className="text-xs">Testo estratto dal PDF (per analisi AI più accurata)</Label><textarea value={form.testo_estratto} onChange={e => setForm({ ...form, testo_estratto: e.target.value })} className="w-full border border-zinc-300 rounded-sm p-2 text-xs h-24 mono" placeholder="Incolla qui il contenuto del preventivo..." data-testid="art-testo" /></div>
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
                if (r.data.stato === "da_autorizzare") toast.warning("Sopra soglia: richiesta autorizzazione inviata.");
                else toast.success("Preventivo registrato");
                setOpen(false);
                setForm({ artigiano_nome: "", voci_riferite: [], importo_offerto: 0, url_pdf: "", testo_estratto: "", note: "", modalita: "artigiano" });
                reload();
              } catch (e) { toast.error("Errore: " + (e.response?.data?.detail || e.message)); }
            }} style={{ background: "var(--brand)", color: "white" }} data-testid="art-save">Carica e analizza con AI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 6. FASI CANTIERE ----
function Fasi({ wf, cid, reload }) {
  const fasi = wf.fasi || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titolo: "", eseguito_da: "interno", artigiano_nome: "", data_inizio: "", data_fine: "", stato: "da_iniziare", note: "" });
  return (
    <div className="bg-white border border-zinc-200 rounded">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200">
        <h3 className="font-semibold">Fasi cantiere <span className="ml-2 text-xs text-zinc-500">Pianifica chi fa cosa e quando</span></h3>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="fase-add"><Plus className="h-4 w-4 mr-1" /> Nuova fase</Button>
      </div>
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
              <td className="px-3 py-2 text-center"><span className="text-[11px] px-2 py-0.5 bg-zinc-100 rounded">{f.stato}</span></td>
              <td className="px-3 py-2 text-right"><button className="text-rose-600 p-1" onClick={async () => { await api.delete(`/commesse/${cid}/workflow/fasi/${f.id}`); reload(); }}><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
          {!fasi.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Nessuna fase. Pianifica il cantiere.</td></tr>}
        </tbody>
      </table>
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "incasso", importo: 0, data: new Date().toISOString().slice(0, 10), descrizione: "", metodo: "bonifico" });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Incassato" value={fmtEur(marg.incassato)} icon={Wallet} color="text-emerald-600" />
        <StatCard label="Uscite" value={fmtEur(marg.uscito)} icon={Wallet} color="text-rose-600" />
        <StatCard label="Saldo cassa" value={fmtEur(marg.saldo_cassa)} icon={Wallet} color={marg.saldo_cassa < 0 ? "text-rose-600" : "text-emerald-600"} sub={`Saldo cliente da incassare: ${fmtEur(marg.saldo_residuo_cliente)}`} />
      </div>
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="font-semibold">Movimenti</h3>
          <Button size="sm" onClick={() => setOpen(true)} data-testid="cassa-add"><Plus className="h-4 w-4 mr-1" /> Movimento</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Descrizione</th><th className="px-3 py-2 text-left">Metodo</th><th className="px-3 py-2 text-right">Importo</th><th></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {mov.map(m => (
              <tr key={m.id} className={m.tipo === "incasso" ? "bg-emerald-50/30" : "bg-rose-50/30"}>
                <td className="px-3 py-2 mono text-xs">{m.data}</td>
                <td className="px-3 py-2 text-xs uppercase font-bold">{m.tipo}</td>
                <td className="px-3 py-2">{m.descrizione}{m.artigiano_nome && <span className="ml-2 text-[11px] text-zinc-500">→ {m.artigiano_nome}</span>}</td>
                <td className="px-3 py-2 text-xs">{m.metodo}</td>
                <td className={`px-3 py-2 text-right mono font-semibold ${m.tipo === "incasso" ? "text-emerald-700" : "text-rose-700"}`}>{m.tipo === "incasso" ? "+" : "-"}{fmtEur(m.importo)}</td>
                <td className="px-3 py-2 text-right"><button className="text-rose-600 p-1" onClick={async () => { await api.delete(`/commesse/${cid}/workflow/cassa/${m.id}`); reload(); }}><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!mov.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500">Nessun movimento.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo movimento di cassa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger data-testid="cassa-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="incasso">Incasso (cliente)</SelectItem><SelectItem value="uscita">Uscita (artigiano/fornitore)</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Data</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} data-testid="cassa-data" /></div>
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
            <div><Label className="text-xs">Descrizione</Label><Input value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} data-testid="cassa-desc" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/cassa`, form); setOpen(false); setForm({ tipo: "incasso", importo: 0, data: new Date().toISOString().slice(0, 10), descrizione: "", metodo: "bonifico" }); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="cassa-save">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 8. RESOCONTO ----
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
