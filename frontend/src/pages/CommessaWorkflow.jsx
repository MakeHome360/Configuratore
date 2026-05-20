import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, fmtNum, Badge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSignature, Files, ListChecks, Calculator, Hammer, CalendarRange, Wallet, FileBarChart2, Plus, Trash2, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2, Clock, ClipboardCheck, Camera, Image as ImageIcon, Save, Download, X, Lock, Edit3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
            <TabsTrigger value="documenti" data-testid="tab-documenti"><Files className="h-4 w-4 mr-1.5" /> 1. Documenti & Contratto</TabsTrigger>
            <TabsTrigger value="preventivi" data-testid="tab-preventivi"><FileSignature className="h-4 w-4 mr-1.5" /> 2. Preventivi (originale + extra)</TabsTrigger>
            <TabsTrigger value="checklist" data-testid="tab-checklist"><ClipboardCheck className="h-4 w-4 mr-1.5" /> 3. Checklist venditore</TabsTrigger>
            <TabsTrigger value="materiali" data-testid="tab-materiali"><ListChecks className="h-4 w-4 mr-1.5" /> 4. Materiali</TabsTrigger>
            <TabsTrigger value="computo" data-testid="tab-computo"><Calculator className="h-4 w-4 mr-1.5" /> 5. Computo</TabsTrigger>
            <TabsTrigger value="artigiani" data-testid="tab-artigiani"><Hammer className="h-4 w-4 mr-1.5" /> 6. Artigiani / Sub</TabsTrigger>
            <TabsTrigger value="fasi" data-testid="tab-fasi"><CalendarRange className="h-4 w-4 mr-1.5" /> 7. Fasi cantiere (calendario)</TabsTrigger>
            <TabsTrigger value="foto-cantiere" data-testid="tab-foto-cantiere"><Camera className="h-4 w-4 mr-1.5" /> 8. Foto Cantiere</TabsTrigger>
            <TabsTrigger value="voci-acquisti" data-testid="tab-voci-acquisti"><Wallet className="h-4 w-4 mr-1.5" /> 9. Voci e Acquisti</TabsTrigger>
            <TabsTrigger value="cassa" data-testid="tab-cassa"><Wallet className="h-4 w-4 mr-1.5" /> 10. Cassa & Pagamenti</TabsTrigger>
            <TabsTrigger value="resoconto" data-testid="tab-resoconto"><FileBarChart2 className="h-4 w-4 mr-1.5" /> 11. Resoconto</TabsTrigger>
          </TabsList>

          {/* 1. DOCUMENTI (include Contratto + Allegato A + lista obbligatori) */}
          <TabsContent value="documenti" className="mt-4"><Documenti wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 2. PREVENTIVI (lista, modifica, clone-extra) */}
          <TabsContent value="preventivi" className="mt-4"><PreventiviCommessa cid={cid} com={wf.commessa || {}} /></TabsContent>
          {/* 2. CHECKLIST VENDITORE */}
          <TabsContent value="checklist" className="mt-4"><ChecklistVenditore wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 3. MATERIALI */}
          <TabsContent value="materiali" className="mt-4"><Materiali wf={wf} cid={cid} reload={reload} voci={voci} /></TabsContent>
          {/* 4. COMPUTO */}
          <TabsContent value="computo" className="mt-4"><ComputoTab wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 5. ARTIGIANI */}
          <TabsContent value="artigiani" className="mt-4"><Artigiani wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 6. FASI Cantiere */}
          <TabsContent value="fasi" className="mt-4"><Fasi wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 7. FOTO CANTIERE */}
          <TabsContent value="foto-cantiere" className="mt-4"><FotoCantiere wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 8. VOCI E ACQUISTI */}
          <TabsContent value="voci-acquisti" className="mt-4"><VociAcquistiTab wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 9. CASSA */}
          <TabsContent value="cassa" className="mt-4"><Cassa wf={wf} cid={cid} reload={reload} /></TabsContent>
          {/* 10. RESOCONTO */}
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

// ---- 1. DOCUMENTI & CONTRATTO unificato ----
function Documenti({ wf, cid, reload }) {
  const cn = wf.contratto || {};
  const com = wf.commessa || {};
  const docs = wf.documenti || [];
  const [form, setForm] = useState({ url: cn.url || "", testo: cn.testo || "", firmato: !!cn.firmato, note: cn.note || "" });
  useEffect(() => { setForm({ url: cn.url || "", testo: cn.testo || "", firmato: !!cn.firmato, note: cn.note || "" }); /* eslint-disable-next-line */ }, [JSON.stringify(cn)]);
  // Allegato A: piano rate (modalità di pagamento concordate col cliente)
  const initAllegato = com.allegato_a || { preset_id: "", rate: [], firmato: false, firma_data: null, note: "" };
  const [allegato, setAllegato] = useState(initAllegato);
  const [presets, setPresets] = useState([]);
  const totalePrev = parseFloat(com.totale_preventivo || 0);
  useEffect(() => {
    api.get("/dati-azienda").then(r => setPresets((r.data || {}).payment_presets || [])).catch(() => {});
  }, []);
  useEffect(() => { setAllegato(com.allegato_a || { preset_id: "", rate: [], firmato: false, firma_data: null, note: "" }); }, [JSON.stringify(com.allegato_a)]);

  const applyPreset = (pid) => {
    const p = presets.find(x => x.id === pid);
    if (!p) return;
    const rate = (p.rate || []).map((r, i) => ({
      id: `r-${Date.now()}-${i}`,
      descrizione: r.descrizione,
      pct: parseFloat(r.pct) || 0,
      importo: Math.round((totalePrev * (parseFloat(r.pct) || 0) / 100) * 100) / 100,
      data_prevista: "",
      stato: "previsto", // previsto | incassato
    }));
    setAllegato({ ...allegato, preset_id: pid, rate });
  };
  const addRata = () => setAllegato({ ...allegato, rate: [...(allegato.rate || []), { id: `r-${Date.now()}`, descrizione: "Rata", pct: 0, importo: 0, data_prevista: "", stato: "previsto" }] });
  const updRata = (i, k, v) => {
    const newRate = (allegato.rate || []).map((r, j) => {
      if (j !== i) return r;
      const out = { ...r, [k]: v };
      // se aggiorno pct → ricalcolo importo
      if (k === "pct") out.importo = Math.round((totalePrev * (parseFloat(v) || 0) / 100) * 100) / 100;
      // se aggiorno importo → ricalcolo pct
      if (k === "importo" && totalePrev > 0) out.pct = Math.round(((parseFloat(v) || 0) / totalePrev * 100) * 100) / 100;
      return out;
    });
    setAllegato({ ...allegato, rate: newRate });
  };
  const delRata = (i) => setAllegato({ ...allegato, rate: (allegato.rate || []).filter((_, j) => j !== i) });
  const totPct = (allegato.rate || []).reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);
  const totImp = (allegato.rate || []).reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);
  const saveAllegato = async () => {
    try {
      await api.put(`/commesse/${cid}`, { ...com, allegato_a: { ...allegato, updated_at: new Date().toISOString() } });
      toast.success("Allegato A salvato");
      reload();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore salvataggio Allegato A"); }
  };
  const stampaAllegato = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    const cli = com.cliente || {};
    const rows = (allegato.rate || []).map((r, i) => `<tr><td>${i+1}</td><td>${r.descrizione || "-"}</td><td style="text-align:right">${(parseFloat(r.pct)||0).toFixed(2)}%</td><td style="text-align:right">€ ${(parseFloat(r.importo)||0).toFixed(2)}</td><td>${r.data_prevista || "—"}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Allegato A · ${com.numero}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}h1{color:#0F766E;margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px;text-align:left}th{background:#f4f4f5;text-transform:uppercase;font-size:11px;letter-spacing:.05em}.k{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.signbox{margin-top:60px;display:flex;gap:60px}.signbox div{flex:1;border-top:1px solid #999;padding-top:8px;font-size:11px;color:#666}</style>
      </head><body>
      <h1>Allegato A — Piano dei Pagamenti</h1>
      <div style="margin-top:8px;color:#666;font-size:13px">Commessa <b>${com.numero || ""}</b> · ${new Date().toLocaleDateString("it-IT")}</div>
      <div style="margin-top:24px"><span class="k">Cliente</span><div style="font-size:14px"><b>${cli.nome || ""} ${cli.cognome || ""}</b> · ${cli.email || ""} · ${cli.telefono || ""}</div></div>
      <div style="margin-top:16px"><span class="k">Importo totale (IVA inclusa)</span><div style="font-size:18px;font-weight:bold">€ ${totalePrev.toFixed(2)}</div></div>
      <table><thead><tr><th>#</th><th>Descrizione rata</th><th style="text-align:right">%</th><th style="text-align:right">Importo</th><th>Data prevista</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr style="font-weight:bold;background:#fafafa"><td colspan="2">TOTALE</td><td style="text-align:right">${totPct.toFixed(2)}%</td><td style="text-align:right">€ ${totImp.toFixed(2)}</td><td></td></tr></tfoot></table>
      ${allegato.note ? `<div style="margin-top:24px"><span class="k">Note</span><div style="font-size:13px;white-space:pre-line">${allegato.note}</div></div>` : ""}
      <div class="signbox"><div>Firma Cliente</div><div>Firma Azienda</div></div>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-white border border-zinc-200 rounded p-5 space-y-3">
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

      {/* ALLEGATO A — Piano dei pagamenti strutturato */}
      <div className="bg-white border border-zinc-200 rounded p-5 space-y-3" data-testid="allegato-a-section">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Allegato "A" — Piano dei pagamenti</h3>
            <p className="text-xs text-zinc-500">Definisci con il cliente le rate, le percentuali, gli importi e le date previste. Questo documento è firmato come parte integrante del contratto e diventa il riferimento per la cassa.</p>
          </div>
          <div className="flex items-center gap-2">
            {presets.length > 0 && (
              <Select value={allegato.preset_id || ""} onValueChange={applyPreset}>
                <SelectTrigger className="h-9 w-56 text-xs" data-testid="allegato-preset"><SelectValue placeholder="Scegli preset…" /></SelectTrigger>
                <SelectContent>
                  {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} {p.default ? "★" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={addRata} data-testid="allegato-add-rata"><Plus className="h-4 w-4 mr-1" /> Rata</Button>
          </div>
        </div>
        {totalePrev > 0 && <div className="text-xs text-zinc-500">Importo totale di riferimento: <b className="text-zinc-800 mono">€ {totalePrev.toFixed(2)}</b></div>}
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-2 py-2 text-left">Descrizione</th>
            <th className="px-2 py-2 text-right w-20">%</th>
            <th className="px-2 py-2 text-right w-28">Importo €</th>
            <th className="px-2 py-2 text-left w-36">Data prevista</th>
            <th className="px-2 py-2 text-left w-44">Fase cantiere</th>
            <th className="px-2 py-2 text-left w-24">Stato</th>
            <th className="w-10"></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {(allegato.rate || []).map((r, i) => (
              <tr key={r.id || i}>
                <td className="px-2 py-1.5"><Input value={r.descrizione} onChange={e => updRata(i, "descrizione", e.target.value)} placeholder="Es: Acconto firma" className="h-8 text-xs" data-testid={`allegato-desc-${i}`} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="0.5" value={r.pct} onChange={e => updRata(i, "pct", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" data-testid={`allegato-pct-${i}`} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="0.01" value={r.importo} onChange={e => updRata(i, "importo", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" data-testid={`allegato-imp-${i}`} /></td>
                <td className="px-2 py-1.5"><Input type="date" value={r.data_prevista || ""} onChange={e => updRata(i, "data_prevista", e.target.value)} className="h-8 text-xs" data-testid={`allegato-data-${i}`} /></td>
                <td className="px-2 py-1.5">
                  <Select value={r.fase_cantiere_id || ""} onValueChange={v => updRata(i, "fase_cantiere_id", v)}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`allegato-fase-${i}`}><SelectValue placeholder="— scegli fase —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alla-firma">Alla firma del contratto</SelectItem>
                      <SelectItem value="inizio-lavori">All'inizio dei lavori</SelectItem>
                      {(wf.fasi || []).map(f => <SelectItem key={f.id} value={f.id}>{f.titolo || f.name}</SelectItem>)}
                      <SelectItem value="fine-lavori">Saldo a fine lavori</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Select value={r.stato || "previsto"} onValueChange={v => updRata(i, "stato", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="previsto">Previsto</SelectItem>
                      <SelectItem value="incassato">Incassato</SelectItem>
                      <SelectItem value="scaduto">Scaduto</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-right"><button onClick={() => delRata(i)} className="text-rose-600 p-1 hover:bg-rose-50 rounded" data-testid={`allegato-del-${i}`}><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!(allegato.rate || []).length && <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-400 text-xs">Nessuna rata. Scegli un preset o aggiungi manualmente.</td></tr>}
          </tbody>
          {(allegato.rate || []).length > 0 && (
            <tfoot><tr className="bg-zinc-50 font-semibold text-sm">
              <td className="px-2 py-2">TOTALE</td>
              <td className={`px-2 py-2 text-right mono ${Math.abs(totPct - 100) > 0.01 ? "text-rose-600" : "text-emerald-700"}`} data-testid="allegato-tot-pct">{totPct.toFixed(2)}%</td>
              <td className="px-2 py-2 text-right mono" data-testid="allegato-tot-imp">€ {totImp.toFixed(2)}</td>
              <td colSpan={4}></td>
            </tr></tfoot>
          )}
        </table>
        <div>
          <Label className="text-xs">Note Allegato A</Label>
          <textarea value={allegato.note || ""} onChange={e => setAllegato({ ...allegato, note: e.target.value })} className="w-full border border-zinc-300 rounded p-2 text-xs h-20" placeholder="Es. Tolleranza pagamenti +/- 5 gg. SAL validato dal direttore lavori." data-testid="allegato-note" />
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!allegato.firmato} onChange={e => setAllegato({ ...allegato, firmato: e.target.checked, firma_data: e.target.checked ? new Date().toISOString() : null })} data-testid="allegato-firmato" /> <span className="text-sm">Firmato dal cliente</span></label>
        <div className="flex gap-2">
          <Button onClick={saveAllegato} style={{ background: "var(--brand)", color: "white" }} data-testid="allegato-save"><Save className="h-4 w-4 mr-1.5" /> Salva Allegato A</Button>
          <Button variant="outline" onClick={stampaAllegato} disabled={!(allegato.rate || []).length} data-testid="allegato-stampa"><FileSignature className="h-4 w-4 mr-1.5" /> Stampa / PDF</Button>
        </div>
      </div>

      {/* DOCUMENTI OBBLIGATORI + ALTRI DOCUMENTI */}
      <DocumentiList wf={wf} cid={cid} reload={reload} contrattoUrl={form.url} contrattoFirmato={form.firmato} allegatoFirmato={!!allegato.firmato} allegatoRate={(allegato.rate||[]).length} />
    </div>
  );
}

// Lista documenti obbligatori + altri caricati
function DocumentiList({ wf, cid, reload, contrattoUrl, contrattoFirmato, allegatoFirmato, allegatoRate }) {
  const { user } = useAuth();
  const canEditConfig = user?.role === "admin"; // solo admin può modificare tipo lavori e skip
  const docs = wf.documenti || [];
  const com = wf.commessa || {};
  // tipo_lavori e doc skip list (mantenuti su commessa)
  const [tipoLavori, setTipoLavori] = useState(com.tipo_lavori || "ristrutturazione_completa");
  const [skipList, setSkipList] = useState(com.documenti_skip || []);
  useEffect(() => { setTipoLavori(com.tipo_lavori || "ristrutturazione_completa"); setSkipList(com.documenti_skip || []); /* eslint-disable-next-line */ }, [com.id, com.tipo_lavori, JSON.stringify(com.documenti_skip)]);

  // Preset: documenti richiesti per tipo di lavoro
  const PRESETS = {
    ristrutturazione_completa: ["contratto","allegato_a","doc_cliente","codice_fiscale","privacy","pratica","preventivo","tavola_progetto"],
    parziale: ["contratto","allegato_a","doc_cliente","codice_fiscale","privacy","preventivo"],
    manutenzione: ["contratto","allegato_a","doc_cliente","privacy","preventivo"],
    infissi_only: ["contratto","allegato_a","doc_cliente","codice_fiscale","privacy","preventivo","tavola_progetto"],
    custom: null, // custom = mostra tutti, l'utente decide quali skip
  };
  const TIPI_LAVORI_LABEL = {
    ristrutturazione_completa: "Ristrutturazione completa",
    parziale: "Ristrutturazione parziale",
    manutenzione: "Manutenzione / piccoli lavori",
    infissi_only: "Solo infissi",
    custom: "Personalizzato",
  };
  const applyPresetLavori = async (nuovo) => {
    setTipoLavori(nuovo);
    const richiesti = PRESETS[nuovo];
    // skipList = tutti gli obbligatori NON nel preset
    const all = ["contratto","allegato_a","doc_cliente","codice_fiscale","privacy","pratica","preventivo","tavola_progetto"];
    const newSkip = richiesti ? all.filter(x => !richiesti.includes(x)) : skipList;
    setSkipList(newSkip);
    try {
      await api.put(`/commesse/${cid}`, { ...com, tipo_lavori: nuovo, documenti_skip: newSkip });
      toast.success(`Tipo lavori impostato: ${TIPI_LAVORI_LABEL[nuovo]}`);
      reload();
    } catch (e) { toast.error("Errore salvataggio"); }
  };
  const toggleSkip = async (tipo) => {
    const nuovo = skipList.includes(tipo) ? skipList.filter(x => x !== tipo) : [...skipList, tipo];
    setSkipList(nuovo);
    try {
      await api.put(`/commesse/${cid}`, { ...com, documenti_skip: nuovo, tipo_lavori: "custom" });
      setTipoLavori("custom");
      reload();
    } catch (e) { toast.error("Errore salvataggio"); }
  };

  // Documenti OBBLIGATORI: ogni voce ha tipo, label, helper, e stato derivato
  const tavoleProgetto = docs.filter(d => /tavola|progetto|planimetria|cad/i.test(d.tipo || d.name || ""));
  const preventivoCaricato = docs.find(d => /preventivo/i.test(d.tipo || d.name || ""));
  // URL stampa del preventivo (auto-SYS row)
  const preventivoStampaUrl = com.preventivo_id ? `${window.location.origin}/preventivi/${com.preventivo_id}/stampa` : null;
  const obligatoriRaw = [
    { tipo: "contratto", label: "Contratto cliente firmato", done: !!contrattoUrl && !!contrattoFirmato, partial: !!contrattoUrl && !contrattoFirmato, hint: contrattoUrl ? "Caricato — manca firma" : "Carica contratto qui sopra", critico: true },
    { tipo: "allegato_a", label: "Allegato A — Piano dei pagamenti", done: allegatoRate > 0 && allegatoFirmato, partial: allegatoRate > 0 && !allegatoFirmato, hint: allegatoRate > 0 ? "Rate definite — manca firma" : "Compila le rate qui sopra", critico: true },
    { tipo: "doc_cliente", label: "Documento d'identità cliente", done: docs.some(d => /identit|carta|patente|passaporto/i.test(d.tipo || d.name || "")), hint: "Carica copia CI/Patente del cliente", critico: true },
    { tipo: "codice_fiscale", label: "Codice fiscale cliente", done: docs.some(d => /codice.?fiscale|cf|tessera.?sanitaria/i.test(d.tipo || d.name || "")), hint: "Carica copia del codice fiscale", critico: true },
    { tipo: "privacy", label: "Modulo Privacy / GDPR", done: docs.some(d => /privacy|gdpr/i.test(d.tipo || d.name || "")), hint: "Carica modulo privacy firmato", critico: true },
    { tipo: "pratica", label: "Pratica edilizia (CILA/SCIA/Permesso)", done: docs.some(d => /cila|scia|permesso|pratica|edilizia/i.test(d.tipo || d.name || "")), hint: "Carica CILA / SCIA / Permesso di costruire", critico: false },
    { tipo: "preventivo", label: "Preventivo accettato (PDF)", done: !!preventivoStampaUrl || !!preventivoCaricato, hint: preventivoStampaUrl ? "Generato automaticamente dal preventivo collegato" : "Verrà generato in automatico se preventivo collegato, oppure carica PDF", critico: false },
    { tipo: "tavola_progetto", label: "Tavole CAD / Progetto", done: tavoleProgetto.length > 0, hint: tavoleProgetto.length > 0 ? `${tavoleProgetto.length} tavola/e collegata/e` : "Carica PDF/DWG oppure conferma tavole dal CAD", critico: false },
  ];
  // Applica skipList (i marcati come "non richiesto" non contano per il totale)
  const obligatori = obligatoriRaw.map(o => ({ ...o, skipped: skipList.includes(o.tipo) }));
  const richiestiCount = obligatori.filter(o => !o.skipped).length;
  const okCount = obligatori.filter(o => !o.skipped && o.done).length;
  const totCount = richiestiCount;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "doc_cliente", name: "", url: "", note: "" });
  const downloadAll = () => {
    const links = docs.filter(d => d.url).map(d => d.url);
    if (contrattoUrl) links.unshift(contrattoUrl);
    if (preventivoStampaUrl) links.push(preventivoStampaUrl);
    if (!links.length) { toast.error("Nessun documento scaricabile"); return; }
    toast.success(`Apertura di ${links.length} documenti in nuove schede…`);
    links.forEach((u, i) => setTimeout(() => window.open(u, "_blank", "noopener"), i * 150));
  };

  return (
    <div className="space-y-3" data-testid="documenti-list-section">
      {/* Selettore tipo di lavori */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4" data-testid="tipo-lavori-section">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-blue-900">Tipo di lavori</h3>
            <p className="text-xs text-blue-700">
              {canEditConfig
                ? "Imposta lo scope dell'intervento per filtrare automaticamente i documenti obbligatori. Puoi anche personalizzare manualmente sotto."
                : <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Configurazione bloccata — solo l'admin può modificare il tipo lavori e quali documenti sono richiesti.</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(PRESETS).map(k => (
            <button
              key={k}
              onClick={() => canEditConfig && applyPresetLavori(k)}
              disabled={!canEditConfig}
              data-testid={`tipo-lavori-${k}`}
              className={`px-3 py-1.5 rounded text-xs font-semibold border ${tipoLavori === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"} ${!canEditConfig ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {TIPI_LAVORI_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist obbligatori */}
      <div className="bg-white border border-zinc-200 rounded p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Documenti obbligatori della commessa</h3>
            <p className="text-xs text-zinc-500">{TIPI_LAVORI_LABEL[tipoLavori]} · richiesti {richiestiCount} su {obligatoriRaw.length} totali. Disabilita singoli documenti per renderli opzionali.</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold mono ${okCount === totCount && totCount > 0 ? "text-emerald-700" : "text-amber-700"}`}>{okCount}/{totCount}</div>
            <div className="text-[10px] uppercase text-zinc-500">obbligatori OK</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {obligatori.map((o, i) => (
            <div key={o.tipo} className={`flex items-center gap-3 p-2.5 rounded border ${o.skipped ? "bg-zinc-50 border-zinc-200 opacity-50" : o.done ? "bg-emerald-50 border-emerald-200" : o.partial ? "bg-amber-50 border-amber-300" : o.critico ? "bg-rose-50/40 border-rose-200" : "bg-zinc-50 border-zinc-200"}`} data-testid={`doc-obbl-${o.tipo}`}>
              <span className="text-[10px] mono text-zinc-400 w-5 text-right">{i + 1}.</span>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${o.skipped ? "bg-zinc-200" : o.done ? "bg-emerald-500 text-white" : o.partial ? "bg-amber-500 text-white" : "bg-white border-2 border-zinc-300"}`}>
                {o.done && !o.skipped && <CheckCircle2 size={14} />}
                {o.partial && !o.done && !o.skipped && <Clock size={14} />}
                {o.skipped && <X size={12} className="text-zinc-500" />}
              </div>
              <div className="flex-1 text-sm">
                <div className={`font-medium ${o.skipped ? "line-through text-zinc-500" : ""}`}>{o.label}</div>
                <div className="text-xs text-zinc-500">{o.skipped ? "Non richiesto per questo tipo di lavori" : o.hint}</div>
              </div>
              {o.critico && !o.done && !o.skipped && <span className="text-[10px] px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded uppercase font-bold">Obbligatorio</span>}
              {o.done && !o.skipped && <span className="text-[10px] text-emerald-700 mono">OK</span>}
              {canEditConfig ? (
                <button
                  onClick={() => toggleSkip(o.tipo)}
                  className={`text-[10px] px-2 py-0.5 rounded border ${o.skipped ? "bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200" : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-100"}`}
                  data-testid={`doc-skip-${o.tipo}`}
                  title={o.skipped ? "Riattiva come richiesto" : "Marca come non richiesto"}
                >
                  {o.skipped ? "Richiedi" : "Non richiesto"}
                </button>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-400 flex items-center gap-1" title="Solo admin può modificare"><Lock className="h-2.5 w-2.5" />locked</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick action: carica tavole CAD */}
      <div className="bg-purple-50 border border-purple-200 rounded p-4 flex items-center justify-between flex-wrap gap-2" data-testid="tavole-cad-section">
        <div>
          <h3 className="font-semibold text-purple-900">Tavole di progetto / CAD</h3>
          <p className="text-xs text-purple-700">Carica direttamente PDF/DWG delle tavole, oppure conferma le tavole disegnate nel CAD dal pannello Editor (saranno linkate qui).</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setForm({ tipo: "tavola", name: "", url: "", note: "" }); setOpen(true); }} data-testid="tavola-upload-btn" className="border-purple-400 text-purple-700 hover:bg-purple-100">
            <Plus className="h-4 w-4 mr-1" /> Carica tavola
          </Button>
          {com.project_id && (
            <Button size="sm" variant="outline" onClick={() => window.open(`/editor/${com.project_id}`, "_blank")} data-testid="tavola-cad-link" className="border-purple-400 text-purple-700 hover:bg-purple-100">
              Apri CAD ↗
            </Button>
          )}
        </div>
      </div>

      {/* Lista documenti caricati (tutti i tipi) */}
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold">Tutti i documenti caricati ({docs.length + (contrattoUrl ? 1 : 0) + (preventivoStampaUrl ? 1 : 0)})</h3>
            <p className="text-xs text-zinc-500">Contratto, preventivo, doc cliente, pratiche, tavole, foto, ecc. Click su un link per aprire / scaricare. Bottone "Scarica tutti" apre ogni documento in una nuova scheda.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadAll} data-testid="doc-download-all"><Download className="h-4 w-4 mr-1" /> Scarica tutti</Button>
            <Button size="sm" onClick={() => { setForm({ tipo: "doc_cliente", name: "", url: "", note: "" }); setOpen(true); }} data-testid="doc-add" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" /> Aggiungi</Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Link</th><th className="px-3 py-2 text-left">Note</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {contrattoUrl && (
              <tr className={contrattoFirmato ? "bg-emerald-50/40" : "bg-amber-50/40"}>
                <td className="px-3 py-2 text-xs uppercase"><span className="inline-block text-[9px] mr-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">SYS</span>contratto</td>
                <td className="px-3 py-2 font-medium">{contrattoFirmato ? "Contratto firmato" : "Contratto cliente (non firmato)"}</td>
                <td className="px-3 py-2 text-xs"><a href={contrattoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri ↗</a></td>
                <td className="px-3 py-2 text-xs text-zinc-500">{contrattoFirmato ? "✓ Firmato" : "⚠ Non firmato"}</td>
                <td></td>
              </tr>
            )}
            {preventivoStampaUrl && (
              <tr className="bg-blue-50/40" data-testid="doc-row-preventivo">
                <td className="px-3 py-2 text-xs uppercase"><span className="inline-block text-[9px] mr-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">SYS</span>preventivo</td>
                <td className="px-3 py-2 font-medium">Preventivo accettato — pagina stampabile</td>
                <td className="px-3 py-2 text-xs"><a href={preventivoStampaUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline" data-testid="doc-preventivo-link">apri ↗</a></td>
                <td className="px-3 py-2 text-xs text-zinc-500">Generato automaticamente dal preventivo {com.preventivo_id?.slice(0, 8)}…</td>
                <td></td>
              </tr>
            )}
            {docs.map(d => (
              <tr key={d.id}>
                <td className="px-3 py-2 text-xs uppercase">{d.tipo}</td>
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2 text-xs">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri ↗</a> : "-"}</td>
                <td className="px-3 py-2 text-xs text-zinc-500">{d.note}</td>
                <td className="px-3 py-2 text-right"><button className="text-rose-600 hover:bg-rose-50 p-1" onClick={async () => { await api.delete(`/commesse/${cid}/workflow/documenti/${d.id}`); reload(); }} data-testid={`doc-del-${d.id}`}><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!docs.length && !contrattoUrl && !preventivoStampaUrl && <tr><td colSpan={5} className="px-3 py-12 text-center text-zinc-500">Nessun documento. Carica contratto sopra, oppure aggiungi documenti vari.</td></tr>}
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
                    <SelectItem value="doc_cliente">Documento identità cliente</SelectItem>
                    <SelectItem value="codice_fiscale">Codice fiscale cliente</SelectItem>
                    <SelectItem value="privacy">Privacy / GDPR</SelectItem>
                    <SelectItem value="pratica">Pratica edilizia (CILA/SCIA/permesso)</SelectItem>
                    <SelectItem value="progetto">Progetto / Planimetria</SelectItem>
                    <SelectItem value="tavola">Tavola tecnica</SelectItem>
                    <SelectItem value="preventivo">Preventivo PDF</SelectItem>
                    <SelectItem value="doc_casa">Doc immobile (visure)</SelectItem>
                    <SelectItem value="foto">Foto rilievo</SelectItem>
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
              <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/documenti`, form); setOpen(false); setForm({ tipo: "doc_cliente", name: "", url: "", note: "" }); toast.success("Documento aggiunto"); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="doc-save">Aggiungi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
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

  // Helper popup
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpItem, setHelpItem] = useState(null);
  const openHelp = (it) => { setHelpItem(it); setHelpOpen(true); };

  // Ordine workflow: cliente → contratto → acconto → pratica → progetto → materiali → computo → preventivi sub → fasi → data inizio → foto → privacy
  const items = [
    {
      id: "ct-cliente",
      label: "Dati cliente completi (nome, telefono, email, indirizzo)",
      done: !!(cliente.nome && cliente.email && cliente.telefono),
      critico: true,
      helper: "Apri la scheda della commessa e compila TUTTI i dati cliente: nome, cognome, email, telefono, indirizzo cantiere.\n\n✓ Condizione automatica: la spunta diventa verde quando sono presenti nome + email + telefono.",
    },
    {
      id: "ct-contratto",
      label: "Contratto caricato e firmato dal cliente",
      done: !!contratto.firmato,
      critico: true,
      helper: "Vai alla tab 1 — Contratto. Carica il PDF del contratto firmato e spunta 'Firmato dal cliente' inserendo la data firma.\n\n✓ Condizione automatica: spunta verde quando contratto.firmato = true.",
    },
    {
      id: "ct-acconto",
      label: "Acconto iniziale registrato (cassa)",
      done: cassaItems.some(m => m.tipo === "incasso"),
      critico: true,
      helper: "Vai alla tab 10 — Cassa & Pagamenti. Aggiungi un movimento di tipo INCASSO con la cifra ricevuta dal cliente come acconto iniziale.\n\n✓ Condizione automatica: spunta verde quando in cassa esiste almeno un movimento con tipo='incasso'.",
    },
    {
      id: "ct-doc-pratica",
      label: "Documenti pratica edilizia (CILA/SCIA/permesso) caricati",
      done: docs.some(d => /cila|scia|permesso|pratica|edilizia/i.test(d.tipo || d.name || "")),
      critico: false,
      helper: "Vai alla tab 3 — Documenti. Aggiungi un documento con tipo o nome contenente 'CILA', 'SCIA', 'Permesso' o 'Pratica edilizia'.\n\n✓ Condizione automatica: spunta verde quando esiste un documento il cui tipo/nome contiene una di quelle parole chiave.",
    },
    {
      id: "ct-progetto",
      label: "Progetto / planimetria CAD caricata",
      done: docs.some(d => /progetto|planimetria|cad|dwg/i.test(d.tipo || d.name || "")) || !!cm.project_id,
      critico: false,
      helper: "Due strade:\n1. Apri la tab 'Progetti CAD' della sidebar e crea/collega il progetto CAD del cliente (consigliato)\n2. Oppure tab 3 — Documenti → carica un documento con tipo/nome 'Progetto', 'Planimetria', 'CAD' o 'DWG'.\n\n✓ Condizione automatica: presente un project_id collegato OPPURE un documento corrispondente.",
    },
    {
      id: "ct-materiali",
      label: "Scelta materiali principali (pavimenti, sanitari, ecc.)",
      done: materiali.length > 0,
      critico: true,
      helper: "Vai alla tab 4 — Materiali. Aggiungi le scelte del cliente per pavimenti, rivestimenti, sanitari, rubinetterie, porte interne, ecc. con quantità e prezzo.\n\n✓ Condizione automatica: spunta verde quando esiste almeno una voce materiale.",
    },
    {
      id: "ct-computo",
      label: "Computo metrico generato dal preventivo accettato",
      done: computoOk,
      critico: true,
      helper: "Il computo metrico viene generato AUTOMATICAMENTE quando il preventivo passa a stato 'accettato'. Se manca, vai a tab 5 — Computo e clicca 'Rigenera dal preventivo'.\n\n✓ Condizione automatica: spunta verde quando il computo metrico ha almeno una voce.",
    },
    {
      id: "ct-preventivi-art",
      label: "Preventivi artigiani caricati e analizzati",
      done: artPrev.length > 0,
      critico: false,
      helper: "Vai alla tab 6 — Artigiani/Sub. Carica i preventivi degli artigiani con importo offerto. Il sistema confronta automaticamente con il listino interno.\n\n✓ Condizione automatica: almeno un preventivo artigiano salvato.",
    },
    {
      id: "ct-fasi",
      label: "Fasi cantiere pianificate (calendario)",
      done: fasi.length > 0,
      critico: false,
      helper: "Vai alla tab 7 — Fasi cantiere. Clicca 'Nuova fase' e scegli da una delle fasi che hai gestito nel menu 'Fasi Commessa' (admin).\n\n✓ Condizione automatica: almeno una fase creata.",
    },
    {
      id: "ct-data-inizio",
      label: "Data inizio lavori concordata con il cliente",
      done: !!cm.data_inizio_prevista || fasi.some(f => f.data_inizio),
      critico: true,
      helper: "Due strade equivalenti:\n1. Modifica la commessa e imposta 'Data inizio prevista'\n2. Oppure pianifica almeno una fase nella tab 7 — Fasi cantiere con data_inizio impostata.\n\n✓ Condizione automatica: commessa.data_inizio_prevista compilata OPPURE almeno una fase con data_inizio.",
    },
    {
      id: "ct-foto-rilievo",
      label: "Foto / rilievo pre-cantiere caricato",
      done: (wf.foto_cantiere || []).length > 0 || docs.some(d => /foto|rilievo/i.test(d.tipo || d.name || "")),
      critico: false,
      helper: "Vai alla nuova tab 📸 — Foto Cantiere. Carica le foto del sopralluogo iniziale (stato di fatto) raggruppate per giornata con un titolo descrittivo.\n\nIn alternativa: tab 3 — Documenti, carica un file con tipo/nome 'Foto' o 'Rilievo'.\n\n✓ Condizione automatica: almeno una foto cantiere OPPURE documento foto/rilievo.",
    },
    {
      id: "ct-privacy",
      label: "Modulo privacy/GDPR firmato dal cliente",
      done: docs.some(d => /privacy|gdpr/i.test(d.tipo || d.name || "")),
      critico: true,
      helper: "Vai alla tab 3 — Documenti. Carica il modulo privacy/GDPR firmato dal cliente (PDF). Il nome o il tipo del documento deve contenere 'privacy' o 'GDPR'.\n\n✓ Condizione automatica: documento con tipo/nome 'privacy' o 'GDPR'.",
    },
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
            <p className="text-xs text-zinc-500">Verifica tutti gli step prima di considerare la pratica chiusa. Clicca <strong>"?"</strong> per scoprire come completare ogni voce.</p>
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
          {items.map((it, idx) => (
            <div key={it.id} className={`flex items-center gap-3 p-2.5 rounded border ${it.done ? "bg-emerald-50 border-emerald-200" : it.critico ? "bg-rose-50/40 border-rose-200" : "bg-zinc-50 border-zinc-200"}`} data-testid={`check-${it.id}`}>
              <span className="text-[10px] mono text-zinc-400 w-5 text-right">{idx + 1}.</span>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${it.done ? "bg-emerald-500 text-white" : "bg-white border-2 border-zinc-300"}`}>
                {it.done && <CheckCircle2 size={14} />}
              </div>
              <div className="flex-1 text-sm">{it.label}</div>
              {it.critico && !it.done && <span className="text-[10px] px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded uppercase font-bold">Critico</span>}
              {it.done && <span className="text-[10px] text-emerald-700 mono">OK</span>}
              <button
                type="button"
                onClick={() => openHelp(it)}
                className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                title="Come completare questa voce"
                data-testid={`check-help-${it.id}`}
              >?</button>
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

      {/* Helper popup: spiega come completare la voce e mostra la condizione automatica */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg" data-testid="check-help-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full bg-blue-100 text-blue-800">?</span>
              Come completare questa voce
            </DialogTitle>
          </DialogHeader>
          {helpItem && (
            <div className="space-y-3">
              <div className="bg-zinc-100 p-3 rounded">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Step</div>
                <div className="font-semibold">{helpItem.label}</div>
                {helpItem.critico && <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded uppercase font-bold">Critico</span>}
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm whitespace-pre-line text-zinc-800">
                {helpItem.helper}
              </div>
              <div className={`p-2 rounded text-xs ${helpItem.done ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-zinc-50 text-zinc-700 border border-zinc-200"}`}>
                {helpItem.done
                  ? <><CheckCircle2 className="inline h-4 w-4 mr-1" /> Stato attuale: <strong>COMPLETATA</strong> — la condizione è già verificata.</>
                  : <><AlertTriangle className="inline h-4 w-4 mr-1" /> Stato attuale: <strong>DA COMPLETARE</strong> — segui le istruzioni qui sopra.</>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpOpen(false)} data-testid="check-help-close">Chiudi</Button>
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
  const isAutoBozza = m.auto_bozza === true && !m.firmato_cliente;
  const totale = useMemo(() => items.reduce((s, x) => s + (parseFloat(x.qty || 0) * parseFloat(x.prezzo || 0)), 0), [items]);
  return (
    <div className="bg-white border border-zinc-200 rounded p-5 space-y-3">
      {isAutoBozza && (
        <div className="bg-amber-50 border border-amber-300 p-3 rounded text-xs text-amber-900 leading-relaxed" data-testid="mat-auto-bozza-banner">
          🪄 <strong>Bozza auto-generata</strong> dal preventivo accettato {m.generato_il ? `il ${new Date(m.generato_il).toLocaleDateString("it-IT")}` : ""}. Scegli le <strong>finiture</strong> per ogni voce, modifica quantità/prezzi se serve, poi salva.
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">Scelta materiali del cliente</h3>
          <p className="text-xs text-zinc-500 mt-1">Elenca i materiali specifici scelti dal cliente. Quando salvi con la firma, il cliente non potrà più chiedere modifiche senza extra.</p>
        </div>
        <Button size="sm" onClick={() => setItems([...items, { voce_id: "", name: "", qty: 1, unit: "pz", prezzo: 0, finitura: "", finiture_disponibili: [], note: "" }])} data-testid="mat-add"><Plus className="h-4 w-4 mr-1" /> Aggiungi materiale</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
          <th className="px-2 py-2 text-left w-44">Da listino</th>
          <th className="px-2 py-2 text-left">Descrizione/modello</th>
          <th className="px-2 py-2 text-left w-44">Finitura</th>
          <th className="px-2 py-2 text-right w-16">Qty</th>
          <th className="px-2 py-2 text-left w-14">UM</th>
          <th className="px-2 py-2 text-right w-24">€/unit</th>
          <th className="px-2 py-2 text-right w-24">Totale</th>
          <th className="w-8"></th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((it, i) => {
            const upd = (k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x));
            const finOpts = it.finiture_disponibili || [];
            return (
              <tr key={i} className={it.from_template ? "bg-emerald-50/40" : (it.from_preventivo ? "bg-blue-50/30" : "")}>
                <td className="px-2 py-1">
                  {it.from_template && <div className="text-[9px] uppercase tracking-widest text-emerald-700 font-bold mb-0.5">📋 da template</div>}
                  {it.from_preventivo && <div className="text-[9px] uppercase tracking-widest text-blue-700 font-bold mb-0.5">💼 da preventivo</div>}
                  <Select value={it.voce_id || ""} onValueChange={v => { const voce = voci.find(x => x.id === v); upd("voce_id", v); if (voce) { upd("name", voce.name); upd("unit", voce.unit || "pz"); upd("prezzo", parseFloat(voce.prezzo_acquisto || 0) * parseFloat(voce.ricarico || 1.8)); } }}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`mat-voce-${i}`}><SelectValue placeholder="— oppure manuale —" /></SelectTrigger>
                    <SelectContent className="max-h-72">{voci.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1"><Input value={it.name} onChange={e => upd("name", e.target.value)} placeholder="Es: Piastrella 60x60" className="h-8 text-xs" /></td>
                <td className="px-2 py-1">
                  {finOpts.length > 0 ? (
                    <Select value={it.finitura || ""} onValueChange={v => upd("finitura", v)}>
                      <SelectTrigger className={`h-8 text-xs ${!it.finitura ? "border-amber-400 bg-amber-50" : ""}`} data-testid={`mat-fin-${i}`}><SelectValue placeholder="🎨 scegli finitura" /></SelectTrigger>
                      <SelectContent>{finOpts.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input value={it.finitura || ""} onChange={e => upd("finitura", e.target.value)} placeholder="es. Grigio, Marmo bianco" className="h-8 text-xs" data-testid={`mat-fin-txt-${i}`} />
                  )}
                </td>
                <td className="px-2 py-1"><Input type="number" value={it.qty} onChange={e => upd("qty", e.target.value)} className="h-8 text-xs text-right mono w-16" /></td>
                <td className="px-2 py-1"><Input value={it.unit} onChange={e => upd("unit", e.target.value)} placeholder="m²" className="h-8 text-xs w-14" /></td>
                <td className="px-2 py-1"><Input type="number" step="0.01" value={it.prezzo} onChange={e => upd("prezzo", e.target.value)} className="h-8 text-xs text-right mono w-24" /></td>
                <td className="px-2 py-1 text-right mono font-semibold">{fmtEur((it.qty || 0) * (it.prezzo || 0))}</td>
                <td><button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-600 p-1" data-testid={`mat-del-${i}`}><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            );
          })}
          {!items.length && <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-500">Nessun materiale. Crea un <strong>Template Materiali</strong> dall'admin per auto-popolare questa tabella ogni volta che accetti un preventivo.</td></tr>}
        </tbody>
        {items.length > 0 && <tfoot><tr className="bg-zinc-50"><td colSpan={6} className="px-2 py-2 text-right font-bold uppercase text-xs">Totale materiali</td><td className="px-2 py-2 text-right font-bold mono">{fmtEur(totale)}</td><td></td></tr></tfoot>}
      </table>
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-200">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={firmato} onChange={e => setFirmato(e.target.checked)} data-testid="mat-firmato" /> <span className="text-sm">Confermato/firmato dal cliente (blocca cambi senza extra)</span></label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => window.print()} disabled={!items.length} data-testid="mat-print">🖨️ Stampa tabella materiali</Button>
          <Button variant="outline" onClick={() => document.getElementById("mat-firma-upload")?.click()} disabled={!items.length} data-testid="mat-upload-firma">📎 Carica scansione firmata</Button>
          <input id="mat-firma-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const fd = new FormData(); fd.append("file", f);
            try {
              const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
              const url = (window.location.origin + (r.data.url || ""));
              // Save as documento del commessa + flag firmato
              await api.post(`/commesse/${cid}/workflow/documenti`, { nome: `Materiali firmati cliente · ${new Date().toLocaleDateString("it-IT")}`, tipo: "materiali_firmati", file_url: url });
              await api.post(`/commesse/${cid}/workflow/materiali`, { items, firmato_cliente: true, firma_data: new Date().toISOString() });
              toast.success("Scansione firmata caricata e materiali confermati");
              setFirmato(true); reload();
            } catch (err) { toast.error("Errore upload: " + (err?.response?.data?.detail || err.message)); }
          }} />
          <Button onClick={async () => { await api.post(`/commesse/${cid}/workflow/materiali`, { items, firmato_cliente: firmato, firma_data: firmato ? new Date().toISOString() : null }); toast.success("Materiali salvati"); reload(); }} style={{ background: "var(--brand)", color: "white" }} data-testid="mat-save">Salva scelta materiali</Button>
        </div>
      </div>
      {m.firmato_cliente && m.firma_data && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2.5 flex items-center gap-2" data-testid="mat-firma-stato">
          <CheckCircle2 className="h-4 w-4" /> Tabella materiali firmata dal cliente in data {new Date(m.firma_data).toLocaleString("it-IT")}. Eventuali modifiche generano extra in preventivo.
        </div>
      )}
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
      {cm.auto_from_preventivo && (
        <div className="bg-emerald-50 border border-emerald-300 p-3 rounded text-xs text-emerald-900 leading-relaxed" data-testid="cm-auto-banner">
          ✨ <strong>Computo auto-generato</strong> dal preventivo accettato {cm.generato_il ? `il ${new Date(cm.generato_il).toLocaleDateString("it-IT")}` : ""}. {items.length} voci · totale {fmtEur(stats.totEur)}. Procedi con l'assegnazione (vista "Assegnazioni" qui sotto).
        </div>
      )}
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold">Computo metrico</h3>
            <p className="text-xs text-zinc-500">Generato dal preventivo accettato. Scegli la vista che ti serve.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={printAndExport} data-testid="cm-print">Stampa / PDF</Button>
            <Button size="sm" onClick={async () => {
              try {
                const { data } = await api.post(`/commesse/${cid}/workflow/computo`);
                if (data?.warning) {
                  toast.error(data.warning);
                } else if (!data?.items?.length) {
                  toast.error("Il preventivo non contiene voci utilizzabili");
                } else {
                  toast.success(`Computo rigenerato: ${data.items.length} voci`);
                }
                reload();
              } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
            }} data-testid="cm-gen"><Sparkles className="h-4 w-4 mr-1" /> Rigenera dal preventivo</Button>
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

// ---- 6. FASI CANTIERE — template + calendario mensile + assegnatari ----
const ESECUTORE_TIPI = {
  interno: { label: "🏠 Operai interni", color: "#10B981" },
  artigiano: { label: "🔨 Artigiano / sub-appaltatore", color: "#3B82F6" },
  fornitore: { label: "📦 Fornitore (es. cucinieri)", color: "#9333EA" },
  cliente: { label: "👤 Cliente (lavori in economia)", color: "#F59E0B" },
};
const STATO_FASE = { da_iniziare: "#A1A1AA", in_corso: "#3B82F6", completata: "#10B981", sospesa: "#F59E0B" };
const STATO_LABEL = { da_iniziare: "Da iniziare", in_corso: "In corso", completata: "Completata", sospesa: "Sospesa" };

function Fasi({ wf, cid, reload }) {
  const fasi = wf.fasi || [];
  const subs = wf.artigiani_preventivi || [];
  const [open, setOpen] = useState(false);
  const [editFase, setEditFase] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [view, setView] = useState("calendar"); // calendar | list
  const empty = { titolo: "", template_key: "", color: "#71717A", eseguito_da_tipo: "artigiano", artigiano_id: "", artigiano_nome: "", fornitore_nome: "", data_inizio: "", data_fine: "", stato: "da_iniziare", note: "", categoria: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    // Carica le fasi gestite dall'admin in "Fasi Commessa" (DB persistente) — non i 21 template hardcoded.
    // Mappa i campi {name, description, order} → {titolo, durata_gg, ordine, color, categoria} attesi dal popup.
    api.get("/fasi-commessa").then(r => {
      const list = (r.data || []).map((f, idx) => ({
        key: f.id,
        titolo: f.name || f.titolo || "Fase senza nome",
        durata_gg: f.durata_gg || 1,
        ordine: f.order || (idx + 1),
        color: f.color || "#71717A",
        categoria: f.categoria || "generale",
        descrizione: f.description || "",
        obbligatoria: f.obbligatoria !== false,
      }));
      list.sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
      setTemplates(list);
    }).catch(() => setTemplates([]));
  }, []);

  const openNew = () => { setForm(empty); setEditFase(null); setOpen(true); };
  const openEdit = (f) => { setForm({ ...empty, ...f }); setEditFase(f); setOpen(true); };
  const pickTemplate = (key) => {
    const t = templates.find(x => x.key === key);
    if (!t) return;
    const today = new Date();
    const fine = new Date(today); fine.setDate(fine.getDate() + (t.durata_gg || 1) - 1);
    setForm({ ...form, template_key: key, titolo: t.titolo, color: t.color, categoria: t.categoria, data_inizio: form.data_inizio || today.toISOString().slice(0, 10), data_fine: form.data_fine || fine.toISOString().slice(0, 10) });
  };

  const save = async () => {
    if (!form.titolo) { toast.error("Inserisci un titolo o scegli un template"); return; }
    try {
      if (editFase) {
        await api.put(`/commesse/${cid}/workflow/fasi/${editFase.id}`, form);
        toast.success("Fase aggiornata");
      } else {
        await api.post(`/commesse/${cid}/workflow/fasi`, form);
        toast.success("Fase aggiunta");
      }
      setOpen(false); setForm(empty); setEditFase(null);
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };
  const del = async (id) => { if (!window.confirm("Eliminare questa fase?")) return; await api.delete(`/commesse/${cid}/workflow/fasi/${id}`); reload(); };

  // Aggregate templates by categoria for the picker
  const tplByCat = useMemo(() => {
    const m = {};
    templates.forEach(t => { (m[t.categoria || "altro"] = m[t.categoria || "altro"] || []).push(t); });
    return m;
  }, [templates]);

  // Calendario: vista mese-su-mese con righe = settimane
  const fasiDated = fasi.filter(f => f.data_inizio && f.data_fine);
  const today = new Date();
  const monthsCalendar = useMemo(() => {
    if (!fasiDated.length) {
      // mostra mese corrente + 2 successivi
      return [0, 1, 2].map(off => { const d = new Date(today.getFullYear(), today.getMonth() + off, 1); return d; });
    }
    const min = new Date(Math.min(...fasiDated.map(f => new Date(f.data_inizio).getTime())));
    const max = new Date(Math.max(...fasiDated.map(f => new Date(f.data_fine).getTime())));
    const arr = []; const cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) { arr.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
    return arr;
  }, [fasiDated]);

  const fasiByDay = useMemo(() => {
    const map = {};
    fasiDated.forEach(f => {
      const start = new Date(f.data_inizio); const end = new Date(f.data_fine);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().slice(0, 10);
        (map[k] = map[k] || []).push(f);
      }
    });
    return map;
  }, [fasiDated]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold">Fasi cantiere</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Pianifica chi fa cosa e quando. Scegli da template predefiniti e assegna a interni/artigiani/fornitori/cliente.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 rounded p-0.5">
              <button onClick={() => setView("calendar")} className={`px-3 py-1.5 text-xs rounded ${view === "calendar" ? "bg-white shadow-sm font-semibold" : "text-zinc-600"}`} data-testid="fasi-view-cal">📅 Calendario</button>
              <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs rounded ${view === "list" ? "bg-white shadow-sm font-semibold" : "text-zinc-600"}`} data-testid="fasi-view-list">📋 Lista</button>
            </div>
            <Button size="sm" onClick={openNew} data-testid="fase-add" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" /> Nuova fase</Button>
          </div>
        </div>

        {/* CALENDARIO MENSILE — non schiacciato */}
        {view === "calendar" && (
          <div className="p-4 space-y-6 bg-zinc-50/30" data-testid="calendar-monthly">
            {monthsCalendar.map((mDate, mi) => {
              const year = mDate.getFullYear(); const month = mDate.getMonth();
              const first = new Date(year, month, 1); const last = new Date(year, month + 1, 0);
              const offset = (first.getDay() + 6) % 7; // Mon-first
              const cells = []; for (let i = 0; i < offset; i++) cells.push(null);
              for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
              while (cells.length % 7) cells.push(null);
              return (
                <div key={mi} className="bg-white border border-zinc-200 rounded shadow-sm">
                  <div className="px-4 py-2.5 bg-zinc-100 border-b border-zinc-200 font-bold uppercase tracking-wide text-sm">{mDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</div>
                  <div className="grid grid-cols-7 text-[10px] uppercase tracking-widest text-zinc-500 border-b">
                    {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => <div key={d} className="px-2 py-1.5 text-center font-bold">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7">
                    {cells.map((cell, i) => {
                      if (!cell) return <div key={i} className="min-h-[110px] border-r border-b border-zinc-100 bg-zinc-50/50" />;
                      const iso = cell.toISOString().slice(0, 10);
                      const dayFasi = fasiByDay[iso] || [];
                      const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;
                      const isToday = cell.toDateString() === today.toDateString();
                      return (
                        <div key={i} className={`min-h-[110px] border-r border-b border-zinc-100 p-1.5 ${isWeekend ? "bg-amber-50/40" : ""} ${isToday ? "bg-blue-100/40 ring-2 ring-blue-400" : ""}`}>
                          <div className="text-[11px] mono font-bold text-zinc-600 mb-1">{cell.getDate()}</div>
                          <div className="space-y-1">
                            {dayFasi.slice(0, 3).map(f => (
                              <button key={f.id} onClick={() => openEdit(f)} className="block w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded text-white font-medium truncate hover:opacity-90 cursor-pointer" style={{ background: f.color || STATO_FASE[f.stato] || "#71717A" }} title={`${f.titolo} · ${f.artigiano_nome || f.fornitore_nome || (f.eseguito_da_tipo || "")}`} data-testid={`cal-fase-${f.id}`}>
                                {f.titolo}
                              </button>
                            ))}
                            {dayFasi.length > 3 && <div className="text-[9px] text-zinc-500 italic">+{dayFasi.length - 3} altre</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LISTA */}
        {view === "list" && (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left">Fase</th>
              <th className="px-3 py-2 text-left">Esecutore</th>
              <th className="px-3 py-2 text-left">Periodo</th>
              <th className="px-3 py-2 text-center">Stato</th>
              <th></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {fasi.map(f => {
                const tip = ESECUTORE_TIPI[f.eseguito_da_tipo || f.eseguito_da || "artigiano"] || ESECUTORE_TIPI.artigiano;
                const nome = f.artigiano_nome || f.fornitore_nome || (f.eseguito_da_tipo === "cliente" ? "Cliente" : f.eseguito_da_tipo === "interno" ? "Operai interni" : "—");
                return (
                  <tr key={f.id} className="hover:bg-zinc-50" data-testid={`fase-row-${f.id}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: f.color || "#71717A" }} />
                        <span className="font-medium">{f.titolo}</span>
                        {f.categoria && <span className="text-[10px] uppercase text-zinc-500 bg-zinc-100 px-1.5 rounded">{f.categoria}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{tip.label.split(" ")[0]} <b>{nome}</b></div>
                    </td>
                    <td className="px-3 py-2 mono text-xs">{f.data_inizio || "—"} → {f.data_fine || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Select value={f.stato} onValueChange={async v => { await api.put(`/commesse/${cid}/workflow/fasi/${f.id}`, { ...f, stato: v }); reload(); }}>
                        <SelectTrigger className="h-7 text-xs w-32 mx-auto" data-testid={`fase-stato-${f.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(STATO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => openEdit(f)} className="p-1 text-zinc-600 hover:bg-zinc-100 rounded mr-1"><FileSignature className="h-4 w-4" /></button>
                      <button className="text-rose-600 p-1" onClick={() => del(f.id)}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
              {!fasi.length && <tr><td colSpan={5} className="px-3 py-12 text-center text-zinc-500">Nessuna fase pianificata. Clicca "Nuova fase" per iniziare con i template.</td></tr>}
            </tbody>
          </table>
        )}

        <div className="px-4 py-2 border-t bg-zinc-50/50 text-[11px] uppercase tracking-widest text-zinc-600 flex items-center gap-4 flex-wrap">
          {Object.entries(STATO_FASE).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: c }} /> {STATO_LABEL[k]}</span>)}
          <span className="ml-4 flex items-center gap-1"><span className="w-3 h-3 bg-amber-100" /> weekend</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200" /> oggi</span>
        </div>
      </div>

      {/* DIALOG fase con TEMPLATE PICKER + ASSEGNATARIO */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editFase ? "Modifica fase" : "Nuova fase cantiere"}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            {/* Template picker */}
            {!editFase && (
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">1. Scegli da template predefiniti (consigliato)</Label>
                <div className="mt-2 max-h-[180px] overflow-y-auto border border-zinc-200 rounded p-2 space-y-1 bg-zinc-50/40">
                  {Object.entries(tplByCat).map(([cat, tpls]) => (
                    <div key={cat}>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 mb-1">{cat}</div>
                      <div className="flex flex-wrap gap-1">
                        {tpls.map(t => (
                          <button key={t.key} onClick={() => pickTemplate(t.key)} className={`text-xs px-2 py-1 rounded border ${form.template_key === t.key ? "border-zinc-900 bg-white" : "border-zinc-300 bg-white hover:border-zinc-500"}`} data-testid={`tpl-${t.key}`}>
                            <span className="w-2 h-2 inline-block rounded-sm mr-1.5 align-middle" style={{ background: t.color }} />
                            {t.titolo} <span className="text-zinc-400 ml-1">({t.durata_gg}g)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">{editFase ? "" : "2. "}Titolo fase</Label>
              <Input value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} placeholder="Es: Demolizioni e rimozioni" data-testid="fase-titolo" />
            </div>

            {/* Date */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{editFase ? "" : "3. "}Data inizio</Label><Input type="date" value={form.data_inizio} onChange={e => setForm({ ...form, data_inizio: e.target.value })} data-testid="fase-inizio" /></div>
              <div><Label className="text-xs">Data fine</Label><Input type="date" value={form.data_fine} onChange={e => setForm({ ...form, data_fine: e.target.value })} data-testid="fase-fine" /></div>
            </div>

            {/* ASSEGNAZIONE — chi fa la fase */}
            <div className="border-t pt-3">
              <Label className="text-xs uppercase tracking-widest text-zinc-500">{editFase ? "Esecutore" : "4. Chi esegue la fase?"}</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {Object.entries(ESECUTORE_TIPI).map(([k, t]) => (
                  <button key={k} onClick={() => setForm({ ...form, eseguito_da_tipo: k, eseguito_da: k })} className={`px-3 py-3 rounded border-2 text-left transition ${form.eseguito_da_tipo === k ? "border-zinc-900 bg-zinc-50 shadow-sm" : "border-zinc-200 hover:border-zinc-400 bg-white"}`} data-testid={`fase-esec-${k}`}>
                    <div className="text-xs font-bold">{t.label}</div>
                  </button>
                ))}
              </div>
              {form.eseguito_da_tipo === "artigiano" && (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">Scegli da preventivi artigiani caricati</Label>
                  <Select value={form.artigiano_id || ""} onValueChange={v => { const a = subs.find(s => s.id === v); setForm({ ...form, artigiano_id: v, artigiano_nome: a?.artigiano_nome || form.artigiano_nome }); }}>
                    <SelectTrigger data-testid="fase-art-select"><SelectValue placeholder="— oppure scrivi nome sotto —" /></SelectTrigger>
                    <SelectContent>{subs.map(a => <SelectItem key={a.id} value={a.id}>{a.artigiano_nome} · {fmtEur(a.importo_offerto)}</SelectItem>)}{!subs.length && <div className="p-2 text-xs text-zinc-500">Nessun preventivo artigiano caricato</div>}</SelectContent>
                  </Select>
                  <Input value={form.artigiano_nome} onChange={e => setForm({ ...form, artigiano_nome: e.target.value })} placeholder="Nome artigiano / squadra (libero)" data-testid="fase-art-nome" />
                </div>
              )}
              {form.eseguito_da_tipo === "fornitore" && (
                <div className="mt-3"><Label className="text-xs">Nome fornitore</Label><Input value={form.fornitore_nome} onChange={e => setForm({ ...form, fornitore_nome: e.target.value })} placeholder="Es: Cucine Veneta · Lavanderia Miele" data-testid="fase-forn-nome" /></div>
              )}
              {form.eseguito_da_tipo === "cliente" && <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">⚠️ La fase è gestita dal cliente in economia. Verrà mostrata in giallo nel calendario.</div>}
              {form.eseguito_da_tipo === "interno" && <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded">✓ Operai interni — non serve preventivo esterno.</div>}
            </div>

            <div><Label className="text-xs">Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Eventuali note operative" /></div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setOpen(false); setEditFase(null); }}>Annulla</Button>
            <Button onClick={save} style={{ background: "var(--brand)", color: "white" }} data-testid="fase-save">{editFase ? "Aggiorna fase" : "Aggiungi fase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 6b. FOTO CANTIERE — multi-upload raggruppato per giornata con titolo ----
function FotoCantiere({ wf, cid, reload }) {
  const groups = wf.foto_cantiere || [];
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const emptyForm = { id: null, data: new Date().toISOString().slice(0, 10), titolo: "", foto: [], note: "" };
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // {url, name}

  const openNew = () => { setForm(emptyForm); setEdit(null); setOpen(true); };
  const openEdit = (g) => { setForm({ id: g.id, data: g.data, titolo: g.titolo || "", foto: g.foto || [], note: g.note || "" }); setEdit(g); setOpen(true); };

  const uploadFiles = async (files) => {
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("commessa_id", cid);
        fd.append("tipo", "foto-cantiere");
        const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
        uploaded.push({ url: data.url, name: data.name, content_type: data.content_type, size: data.size });
      } catch (e) {
        toast.error(`Errore upload ${file.name}`);
      }
    }
    setForm(s => ({ ...s, foto: [...s.foto, ...uploaded] }));
    setUploading(false);
    if (uploaded.length) toast.success(`${uploaded.length} foto caricate`);
  };

  const removeFoto = (idx) => setForm(s => ({ ...s, foto: s.foto.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!form.data) { toast.error("Inserisci la data del giorno"); return; }
    if (!form.foto.length) { toast.error("Aggiungi almeno una foto"); return; }
    try {
      if (edit) {
        await api.put(`/commesse/${cid}/foto-cantiere/${edit.id}`, { data: form.data, titolo: form.titolo, foto: form.foto, note: form.note });
        toast.success("Giornata aggiornata");
      } else {
        await api.post(`/commesse/${cid}/foto-cantiere`, { data: form.data, titolo: form.titolo, foto: form.foto, note: form.note });
        toast.success("Giornata creata");
      }
      setOpen(false); setForm(emptyForm); setEdit(null);
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  const del = async (id) => {
    if (!window.confirm("Eliminare questa giornata e tutte le sue foto?")) return;
    await api.delete(`/commesse/${cid}/foto-cantiere/${id}`);
    toast.success("Eliminata");
    reload();
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Camera className="h-5 w-5 text-blue-600" /> Foto cantiere</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Carica più foto per ogni giornata di lavoro, raggruppate per data con titolo descrittivo (es: "Demolizioni cucina").</p>
          </div>
          <Button size="sm" onClick={openNew} data-testid="foto-cantiere-add" style={{ background: "var(--brand)", color: "white" }}>
            <Plus className="h-4 w-4 mr-1" /> Nuova giornata
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="px-6 py-16 text-center text-zinc-500">
            <ImageIcon className="h-12 w-12 mx-auto text-zinc-300 mb-2" />
            <p className="font-medium">Nessuna foto cantiere caricata.</p>
            <p className="text-xs mt-1">Clicca "Nuova giornata" per documentare lo stato dei lavori.</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {groups.map((g) => (
              <div key={g.id} className="border border-zinc-200 rounded bg-zinc-50/30" data-testid={`foto-day-${g.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <div className="mono text-[10px] uppercase tracking-widest text-zinc-500">{new Date(g.data).toLocaleDateString("it-IT", { weekday: "short" })}</div>
                      <div className="text-2xl font-bold text-blue-700 leading-tight">{new Date(g.data).getDate()}</div>
                      <div className="mono text-[10px] text-zinc-500">{new Date(g.data).toLocaleDateString("it-IT", { month: "short", year: "numeric" })}</div>
                    </div>
                    <div>
                      <div className="font-semibold">{g.titolo || <span className="text-zinc-400 italic">Senza titolo</span>}</div>
                      {g.note && <div className="text-xs text-zinc-500 mt-0.5">{g.note}</div>}
                      <div className="text-[10px] mono text-zinc-400 mt-0.5">{(g.foto || []).length} foto · caricate {new Date(g.uploaded_at).toLocaleDateString("it-IT")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(g)} className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded" title="Modifica" data-testid={`foto-day-edit-${g.id}`}><FileSignature className="h-4 w-4" /></button>
                    <button onClick={() => del(g.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Elimina" data-testid={`foto-day-del-${g.id}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {(g.foto || []).map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(f)}
                      className="aspect-square border border-zinc-200 rounded overflow-hidden bg-zinc-100 hover:ring-2 hover:ring-blue-500 transition"
                      data-testid={`foto-thumb-${g.id}-${i}`}
                    >
                      {(f.content_type || "").startsWith("image/") || /\.(jpg|jpeg|png|webp|heic|heif|gif)$/i.test(f.name || f.url || "") ? (
                        <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-xs text-zinc-500 p-2">
                          <Files className="h-6 w-6 mb-1" />
                          <span className="truncate w-full text-center">{f.name}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog upload/edit giornata */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="foto-cantiere-dialog">
          <DialogHeader><DialogTitle>{edit ? "Modifica giornata" : "Nuova giornata di foto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data giornata</Label>
                <Input type="date" value={form.data} onChange={e => setForm(s => ({ ...s, data: e.target.value }))} data-testid="foto-form-data" />
              </div>
              <div>
                <Label className="text-xs">Titolo / motivo della giornata</Label>
                <Input value={form.titolo} onChange={e => setForm(s => ({ ...s, titolo: e.target.value }))} placeholder="Es: Demolizione cucina, Posa massetto..." data-testid="foto-form-titolo" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Note (facoltative)</Label>
              <Input value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} placeholder="Eventuali dettagli sulla giornata" data-testid="foto-form-note" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Foto della giornata (puoi caricarne più di una)</Label>
              <label className="inline-flex items-center gap-2 px-3 py-2 border-2 border-dashed border-blue-300 rounded text-sm text-blue-700 cursor-pointer hover:bg-blue-50">
                <Plus className="h-4 w-4" />
                {uploading ? "Caricamento..." : "Aggiungi foto (multipla)"}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) uploadFiles(files); e.target.value = ""; }}
                  data-testid="foto-form-upload"
                />
              </label>
              {form.foto.length > 0 && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {form.foto.map((f, i) => (
                    <div key={i} className="relative aspect-square border border-zinc-200 rounded overflow-hidden bg-zinc-100 group">
                      {(f.content_type || "").startsWith("image/") ? (
                        <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 p-1 text-center">{f.name}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFoto(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        data-testid={`foto-form-remove-${i}`}
                      ><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-zinc-500 mt-2">Formati supportati: JPG, PNG, WEBP, HEIC. Max 20 MB per foto.</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setOpen(false); setEdit(null); }}>Annulla</Button>
            <Button onClick={save} disabled={uploading || !form.foto.length} style={{ background: "var(--brand)", color: "white" }} data-testid="foto-form-save">
              {uploading ? "Caricamento..." : (edit ? "Aggiorna" : "Salva giornata")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox full-screen */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-5xl bg-black/95 border-0" data-testid="foto-lightbox">
          {lightbox && (
            <div className="space-y-2">
              <img src={lightbox.url} alt={lightbox.name} className="max-h-[80vh] max-w-full mx-auto object-contain" />
              <div className="text-white text-xs text-center mono">{lightbox.name}</div>
            </div>
          )}
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
  const [voci, setVoci] = useState([]);
  useEffect(() => {
    api.get("/voci-backoffice").then(r => setVoci(r.data || [])).catch(() => {});
  }, []);
  // RE-SYNC quando il parent ricarica (es. dopo import-from-computo)
  useEffect(() => {
    setItems(c.voci_acquisti || []);
    // eslint-disable-next-line
  }, [JSON.stringify(c.voci_acquisti)]);
  const tot = useMemo(() => items.reduce((s, v) => {
    const stima = parseFloat(v.stima_backoffice) || 0;
    const prev = parseFloat(v.preventivato) || 0;
    const eff = parseFloat(v.effettivo) || 0;
    const pag = (v.pagato && eff) || 0;
    const tipo = v.tipo || "acquisto";
    return {
      prev: s.prev + prev, eff: s.eff + eff, pag: s.pag + pag, stima: s.stima + stima,
      stima_mano: s.stima_mano + (tipo === "manodopera" ? stima : 0),
      stima_acq: s.stima_acq + (tipo !== "manodopera" ? stima : 0),
      eff_mano: s.eff_mano + (tipo === "manodopera" ? eff : 0),
      eff_acq: s.eff_acq + (tipo !== "manodopera" ? eff : 0),
    };
  }, { prev: 0, eff: 0, pag: 0, stima: 0, stima_mano: 0, stima_acq: 0, eff_mano: 0, eff_acq: 0 }), [items]);

  const save = async () => {
    try {
      await api.put(`/commesse/${cid}`, { ...c, voci_acquisti: items });
      toast.success("Voci e acquisti salvati");
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  const add = () => setItems([...items, { voce: "", voce_id: "", subappaltatore: "", qty: 1, stima_backoffice: 0, preventivato: 0, effettivo: 0, pagato: false, note: "" }]);

  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState({ open: false, only_assigned: false });
  const cmCount = ((wf.computo_metrico || {}).items || []).length;

  const doImport = async (only_assigned) => {
    setImporting(true);
    try {
      const r = await api.post(`/commesse/${cid}/workflow/voci-acquisti/import-from-computo`, {
        only_assigned: !!only_assigned, merge: true,
      });
      toast.success(`${r.data.added} voci importate dal Computo Metrico (${r.data.skipped} saltate, totale ${r.data.total})`);
      setImportMode({ open: false, only_assigned: false });
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Errore import");
    } finally { setImporting(false); }
  };
  const upd = (i, k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x));
  // VOCI DEL PREVENTIVO (= items del computo metrico) per il dropdown
  const cmItems = (wf.computo_metrico || {}).items || [];
  const linkVoce = (i, voceUid) => {
    // voceUid è l'id dell'item del computo (uuid hex), non l'id backoffice
    const cmIt = cmItems.find(v => v.id === voceUid);
    if (!cmIt) return upd(i, "voce_id", "");
    const qty = parseFloat(items[i].qty) || parseFloat(cmIt.qty) || 1;
    // recupera info backoffice se voce_id presente
    const vb = (cmIt.voce_id && voci.find(v => v.id === cmIt.voce_id)) || null;
    const prezzoAcq = vb ? (vb.prezzo_acquisto || 0) : (cmIt.prezzo_unit ? cmIt.prezzo_unit / 1.8 : 0);
    const stima = prezzoAcq * qty;
    setItems(items.map((x, j) => j === i ? {
      ...x,
      voce_id: cmIt.voce_id || cmIt.id, // l'id catalogo o fallback all'id computo
      computo_item_id: cmIt.id,
      voce: cmIt.name,
      qty,
      stima_backoffice: stima,
      tipo: (vb && vb.tipo) || x.tipo || "acquisto",
      fornitore_id: (vb && vb.fornitore_id) || x.fornitore_id || "",
      category: cmIt.category || "",
    } : x));
  };
  const updQty = (i, q) => {
    const qty = parseFloat(q) || 0;
    const it = items[i];
    const voce = voci.find(v => v.id === it.voce_id);
    const stima = voce ? (voce.prezzo_acquisto || 0) * qty : (it.stima_backoffice || 0);
    setItems(items.map((x, j) => j === i ? { ...x, qty, stima_backoffice: stima } : x));
  };

  // Stato preventivi fornitori (artigiani) per linkare visivamente alle voci
  const prevArt = wf.artigiani_preventivi || [];
  const findPrevByComputoId = (cidRef) => prevArt.find(p => (p.voci_riferite || []).includes(cidRef));
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  // Toggle pagato → endpoint dedicato che crea/elimina movimento cassa
  const togglePagato = async (i, currentlyPaid) => {
    const v = items[i];
    if (currentlyPaid) {
      // Annulla pagamento
      if (!window.confirm("Annullare il pagamento? Il movimento di cassa verrà eliminato.")) return;
      try {
        await api.post(`/commesse/${cid}/workflow/voci-acquisti/annulla-pagamento`, { idx: i });
        toast.success("Pagamento annullato, movimento cassa rimosso");
        reload();
      } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
      return;
    }
    // Registra pagamento
    const eff = parseFloat(v.effettivo) || 0;
    if (eff <= 0) {
      toast.error("Inserisci prima l'importo effettivo (>0) per registrare il pagamento.");
      return;
    }
    // Salva prima eventuali modifiche locali
    try { await save(); } catch {}
    try {
      await api.post(`/commesse/${cid}/workflow/voci-acquisti/paga`, { idx: i });
      toast.success(`Pagamento di € ${eff.toFixed(2)} registrato in cassa`);
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  // Carica preventivo fornitore (dialog)
  const [prevDlgOpen, setPrevDlgOpen] = useState(false);
  const [prevDlgVoceIdx, setPrevDlgVoceIdx] = useState(null);
  const [prevForm, setPrevForm] = useState({ artigiano_nome: "", importo_offerto: 0, url_pdf: "", note: "", modalita: "artigiano" });
  const openPrevDialog = (idx) => {
    setPrevDlgVoceIdx(idx);
    const v = items[idx];
    setPrevForm({
      artigiano_nome: v.subappaltatore || "",
      importo_offerto: parseFloat(v.preventivato) || 0,
      url_pdf: "",
      note: `Voce: ${v.voce || ""}`,
      modalita: v.tipo === "manodopera" ? "artigiano" : "artigiano",
    });
    setPrevDlgOpen(true);
  };
  const submitPreventivoFornitore = async () => {
    if (!prevForm.artigiano_nome) { toast.error("Inserisci il nome del fornitore/sub"); return; }
    if (!prevForm.importo_offerto || prevForm.importo_offerto <= 0) { toast.error("Importo > 0 richiesto"); return; }
    const v = items[prevDlgVoceIdx];
    const computoId = v?.computo_item_id || v?.voce_id;
    if (!computoId) { toast.error("Voce non collegata al computo: collega prima la voce dal dropdown"); return; }
    try {
      await api.post(`/commesse/${cid}/workflow/artigiani-preventivi`, {
        artigiano_nome: prevForm.artigiano_nome,
        importo_offerto: parseFloat(prevForm.importo_offerto),
        url_pdf: prevForm.url_pdf || null,
        note: prevForm.note || null,
        modalita: prevForm.modalita,
        voci_riferite: [computoId],
      });
      toast.success("Preventivo fornitore caricato. In attesa di analisi/approvazione.");
      setPrevDlgOpen(false);
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };
  const approvaPreventivo = async (pid) => {
    if (!window.confirm("Approvare il preventivo del fornitore? Verrà segnato come autorizzato e l'importo aggiornerà la voce in commessa.")) return;
    try {
      await api.post(`/commesse/${cid}/workflow/artigiani-preventivi/${pid}/autorizza`);
      toast.success("Preventivo approvato");
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };
  const rifiutaPreventivo = async (pid) => {
    const motivo = window.prompt("Motivo del rifiuto (sarà visibile al venditore):", "");
    if (motivo === null) return;
    try {
      await api.post(`/commesse/${cid}/workflow/artigiani-preventivi/${pid}/rifiuta`, null, { params: { motivo } });
      toast.success("Preventivo rifiutato");
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  // VOCI EXTRA: voci aggiunte fuori dal preventivo originale (lavori extra concordati col cliente)
  const [extraItems, setExtraItems] = useState(c.voci_extra || []);
  useEffect(() => { setExtraItems(c.voci_extra || []); /* eslint-disable-next-line */ }, [JSON.stringify(c.voci_extra)]);
  const addExtra = () => setExtraItems([...extraItems, { id: `ex-${Date.now()}`, descrizione: "", qty: 1, prezzo_unit: 0, importo: 0, autorizzato_cliente: false, data: new Date().toISOString().slice(0, 10), note: "" }]);
  const updExtra = (i, k, v) => setExtraItems(extraItems.map((x, j) => {
    if (j !== i) return x;
    const out = { ...x, [k]: v };
    if (k === "qty" || k === "prezzo_unit") out.importo = (parseFloat(out.qty) || 0) * (parseFloat(out.prezzo_unit) || 0);
    return out;
  }));
  const delExtra = (i) => setExtraItems(extraItems.filter((_, j) => j !== i));
  const totExtra = extraItems.reduce((s, x) => s + (parseFloat(x.importo) || 0), 0);
  const saveExtra = async () => {
    try {
      await api.put(`/commesse/${cid}`, { ...c, voci_extra: extraItems });
      toast.success("Voci extra salvate");
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  return (
    <div className="space-y-3">
      {/* KPI separati manodopera vs acquisti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-white border border-zinc-200 rounded p-3" data-testid="va-kpi-mano">
          <div className="text-zinc-500 uppercase text-[10px]">🔨 Manodopera (stima)</div>
          <div className="text-lg font-bold mono text-orange-700">{fmtEur(tot.stima_mano)}</div>
          <div className="text-[10px] text-zinc-500">Effettivo: {fmtEur(tot.eff_mano)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded p-3" data-testid="va-kpi-acq">
          <div className="text-zinc-500 uppercase text-[10px]">🛒 Acquisti (stima)</div>
          <div className="text-lg font-bold mono text-blue-700">{fmtEur(tot.stima_acq)}</div>
          <div className="text-[10px] text-zinc-500">Effettivo: {fmtEur(tot.eff_acq)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded p-3">
          <div className="text-zinc-500 uppercase text-[10px]">Totale stima</div>
          <div className="text-lg font-bold mono">{fmtEur(tot.stima)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded p-3">
          <div className="text-zinc-500 uppercase text-[10px]">Δ Preventivato vs stima</div>
          <div className={`text-lg font-bold mono ${tot.prev - tot.stima > 0 ? "text-rose-600" : "text-emerald-700"}`}>{tot.prev - tot.stima > 0 ? "+" : ""}{fmtEur(tot.prev - tot.stima)}</div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div>
            <h3 className="font-semibold">Voci e Acquisti — riconciliazione preventivato vs effettivo</h3>
            <p className="text-xs text-zinc-500">Le voci provengono dal <strong>preventivo</strong> (= computo metrico). Per ognuna scegli il fornitore/sub e indica preventivato vs effettivo. <strong>Stima nostra</strong> = prezzo acquisto backoffice × qty.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={importing || !cmCount} onClick={() => doImport(false)} data-testid="va-import-all" title={!cmCount ? "Computo metrico vuoto: rigeneralo nella tab Computo" : `Importa tutte le ${cmCount} voci del computo`}>
              {importing ? "…" : <><Sparkles className="h-4 w-4 mr-1" /> Importa da Computo</>}
            </Button>
            <Button size="sm" variant="outline" disabled={importing || !cmCount} onClick={() => doImport(true)} data-testid="va-import-assigned" title="Importa solo le voci già assegnate (artigiano/interno/autorizzato)">
              Solo assegnate
            </Button>
            <Button size="sm" variant="outline" onClick={add} data-testid="va-add"><Plus className="h-4 w-4 mr-1" /> Voce</Button>
            <Button size="sm" onClick={save} style={{ background: "var(--brand)", color: "white" }} data-testid="va-save">Salva</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-2 py-2 text-left min-w-[200px]">Voce (dal preventivo)</th>
              <th className="px-2 py-2 text-left w-24">Tipo</th>
              <th className="px-2 py-2 text-left min-w-[150px]">Sub/Fornitore</th>
              <th className="px-2 py-2 text-right w-20">Qty</th>
              <th className="px-2 py-2 text-right w-24">Stima</th>
              <th className="px-2 py-2 text-right w-24">Preventivato</th>
              <th className="px-2 py-2 text-left w-40">Preventivo fornitore</th>
              <th className="px-2 py-2 text-right w-24">Effettivo</th>
              <th className="px-2 py-2 text-center w-24">Pagato</th>
              <th className="w-10"></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((v, i) => {
                const stima = parseFloat(v.stima_backoffice) || 0;
                const prev = parseFloat(v.preventivato) || 0;
                const eff = parseFloat(v.effettivo) || 0;
                const deltaStima = prev - stima;
                const computoId = v.computo_item_id || v.voce_id;
                const linkedPrev = computoId ? findPrevByComputoId(computoId) : null;
                const stato = linkedPrev?.stato || null; // ok | warning | da_autorizzare | autorizzato | rifiutato
                const statoBadge = {
                  ok: { c: "bg-emerald-100 text-emerald-800", t: "✓ OK" },
                  autorizzato: { c: "bg-emerald-100 text-emerald-800", t: "✓ Approvato" },
                  warning: { c: "bg-amber-100 text-amber-800", t: "⚠ Warning" },
                  da_autorizzare: { c: "bg-rose-100 text-rose-800", t: "⏳ Da approvare" },
                  rifiutato: { c: "bg-rose-100 text-rose-800 line-through", t: "✗ Rifiutato" },
                  interno: { c: "bg-blue-100 text-blue-800", t: "🏢 Interno" },
                }[stato] || null;
                return (
                  <tr key={i} className={v.from_computo ? "bg-blue-50/30" : ""}>
                    <td className="px-2 py-1.5">
                      {v.from_computo && <div className="text-[9px] uppercase tracking-widest text-blue-700 font-bold mb-0.5" title="Voce importata dal Computo Metrico">📋 da computo{v.category ? ` · ${v.category}` : ""}</div>}
                      <Select value={v.computo_item_id || ""} onValueChange={(val) => linkVoce(i, val)}>
                        <SelectTrigger className="h-8 text-xs" data-testid={`va-voce-link-${i}`}><SelectValue placeholder={cmItems.length ? "Scegli dalle voci del preventivo…" : "Computo vuoto — rigeneralo"} /></SelectTrigger>
                        <SelectContent>
                          {cmItems.map(vv => (<SelectItem key={vv.id} value={vv.id}>{vv.name} <span className="text-zinc-500">· {fmtNum(vv.qty || 0, 2)} {vv.unit}</span></SelectItem>))}
                        </SelectContent>
                      </Select>
                      {!v.computo_item_id && !v.voce_id && <Input value={v.voce} onChange={(e) => upd(i, "voce", e.target.value)} placeholder="o testo libero" className="h-7 text-[11px] mt-1" data-testid={`va-voce-${i}`} />}
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={v.tipo || "acquisto"} onValueChange={val => upd(i, "tipo", val)}>
                        <SelectTrigger className="h-8 text-xs" data-testid={`va-tipo-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acquisto">🛒 Acquisto</SelectItem>
                          <SelectItem value="manodopera">🔨 Manodopera</SelectItem>
                          <SelectItem value="misto">🔧 Misto</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5"><Input value={v.subappaltatore} onChange={(e) => upd(i, "subappaltatore", e.target.value)} placeholder="Nome sub/fornitore" className="h-8 text-xs" data-testid={`va-sub-${i}`} /></td>
                    <td className="px-2 py-1.5"><Input type="number" min={0} step="0.1" value={v.qty ?? 1} onChange={(e) => updQty(i, e.target.value)} className="h-8 text-xs text-right mono" data-testid={`va-qty-${i}`} /></td>
                    <td className="px-2 py-1.5 text-right mono text-blue-700 font-semibold text-xs" data-testid={`va-stima-${i}`}>{fmtEur(stima)}</td>
                    <td className="px-2 py-1.5"><Input type="number" value={prev} onChange={(e) => upd(i, "preventivato", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" data-testid={`va-prev-${i}`} /></td>
                    {/* Preventivo fornitore: stato + azione */}
                    <td className="px-2 py-1.5 text-xs">
                      {linkedPrev ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            {statoBadge && <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${statoBadge.c}`}>{statoBadge.t}</span>}
                            <span className="text-zinc-700 font-mono text-[10px]" data-testid={`va-prev-fornitore-importo-${i}`}>€ {(linkedPrev.importo_offerto || 0).toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate" title={linkedPrev.artigiano_nome}>{linkedPrev.artigiano_nome}</div>
                          {linkedPrev.url_pdf && <a href={linkedPrev.url_pdf} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">PDF ↗</a>}
                          {isAdmin && (stato === "warning" || stato === "da_autorizzare") && (
                            <div className="flex gap-1">
                              <button onClick={() => approvaPreventivo(linkedPrev.id)} className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700" data-testid={`va-prev-approva-${i}`}>Approva</button>
                              <button onClick={() => rifiutaPreventivo(linkedPrev.id)} className="text-[10px] px-1.5 py-0.5 bg-rose-600 text-white rounded hover:bg-rose-700" data-testid={`va-prev-rifiuta-${i}`}>Rifiuta</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => openPrevDialog(i)} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1" data-testid={`va-prev-upload-${i}`} disabled={!computoId} title={!computoId ? "Collega prima la voce al computo" : "Carica preventivo fornitore"}>
                          <Plus className="h-3 w-3" /> Carica preventivo
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1.5"><Input type="number" value={eff} onChange={(e) => upd(i, "effettivo", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" data-testid={`va-eff-${i}`} /></td>
                    <td className="px-2 py-1.5 text-center">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!v.pagato}
                          onChange={() => togglePagato(i, !!v.pagato)}
                          className="h-4 w-4"
                          data-testid={`va-pagato-${i}`}
                          disabled={!v.pagato && (!eff || eff <= 0)}
                          title={!v.pagato && (!eff || eff <= 0) ? "Inserisci prima Effettivo > 0" : (v.pagato ? "Pagamento registrato in cassa — clicca per annullare" : "Click per registrare pagamento e creare movimento cassa")}
                        />
                        {v.pagato && v.pagamento_id && <span className="text-[9px] text-emerald-700" title="Movimento cassa creato">€✓</span>}
                      </label>
                    </td>
                    <td className="px-2 py-1.5"><button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-rose-600 p-1"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr><td colSpan={10} className="px-3 py-12 text-center text-zinc-500">
                  {cmCount > 0 ? (
                    <div className="space-y-3">
                      <div>Nessuna voce.</div>
                      <div className="text-xs">Hai <strong>{cmCount}</strong> voci nel Computo Metrico → puoi importarle in 1 click</div>
                      <Button size="sm" onClick={() => doImport(false)} disabled={importing} data-testid="va-import-empty" style={{ background: "var(--brand)", color: "white" }}>
                        <Sparkles className="h-4 w-4 mr-1.5" /> Importa {cmCount} voci dal Computo
                      </Button>
                    </div>
                  ) : "Nessuna voce. Clicca \"Voce\" per aggiungere la prima."}
                </td></tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-zinc-50 font-bold">
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-right uppercase text-xs">Totali</td>
                  <td className="px-2 py-2 text-right mono text-blue-700">{fmtEur(tot.stima)}</td>
                  <td className="px-2 py-2 text-right mono">{fmtEur(tot.prev)}</td>
                  <td></td>
                  <td className="px-2 py-2 text-right mono">{fmtEur(tot.eff)}</td>
                  <td className="px-2 py-2 text-right mono text-emerald-700">{fmtEur(tot.pag)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Dialog upload preventivo fornitore per voce specifica */}
      <Dialog open={prevDlgOpen} onOpenChange={setPrevDlgOpen}>
        <DialogContent className="max-w-lg" data-testid="va-prev-dialog">
          <DialogHeader><DialogTitle>Carica preventivo fornitore</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {prevDlgVoceIdx !== null && items[prevDlgVoceIdx] && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                <div className="text-blue-900"><strong>Voce commessa:</strong> {items[prevDlgVoceIdx].voce || "—"}</div>
                <div className="text-blue-700">Qty: {items[prevDlgVoceIdx].qty || 1} · Stima nostra: € {(items[prevDlgVoceIdx].stima_backoffice || 0).toFixed(2)}</div>
              </div>
            )}
            <div>
              <Label className="text-xs">Modalità *</Label>
              <Select value={prevForm.modalita} onValueChange={v => setPrevForm({ ...prevForm, modalita: v })}>
                <SelectTrigger data-testid="va-prev-modalita"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="artigiano">Sub-appaltatore / Fornitore esterno</SelectItem>
                  <SelectItem value="interno">Lavoro interno (operai propri)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome fornitore/sub *</Label><Input value={prevForm.artigiano_nome} onChange={e => setPrevForm({ ...prevForm, artigiano_nome: e.target.value })} placeholder="Es. Idraulica Rossi srl" data-testid="va-prev-nome" /></div>
            <div><Label className="text-xs">Importo offerto € *</Label><Input type="number" step="0.01" value={prevForm.importo_offerto} onChange={e => setPrevForm({ ...prevForm, importo_offerto: parseFloat(e.target.value) || 0 })} className="mono text-right" data-testid="va-prev-importo" /></div>
            <div><Label className="text-xs">Link PDF preventivo</Label><Input value={prevForm.url_pdf} onChange={e => setPrevForm({ ...prevForm, url_pdf: e.target.value })} placeholder="https://drive.google.com/..." data-testid="va-prev-pdf" /></div>
            <div><UploadField label="Oppure carica PDF dal PC" onUploaded={(meta) => setPrevForm(p => ({ ...p, url_pdf: window.location.origin + meta.url }))} commessaId={cid} accept=".pdf,.doc,.docx,.png,.jpg" testid="upload-prev-fornitore" /></div>
            <div><Label className="text-xs">Note</Label><Input value={prevForm.note} onChange={e => setPrevForm({ ...prevForm, note: e.target.value })} data-testid="va-prev-note" /></div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <div>Il sistema confronta l'importo offerto con la stima e il preventivato del cliente. Se eccede del +25% richiederà <strong>approvazione admin</strong>. {!isAdmin && "I preventivi >25% vengono inviati in approvazione."}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevDlgOpen(false)}>Annulla</Button>
            <Button onClick={submitPreventivoFornitore} style={{ background: "var(--brand)", color: "white" }} data-testid="va-prev-submit">Carica preventivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VOCI EXTRA — lavori extra concordati con il cliente in corso d'opera */}
      <div className="bg-white border border-amber-200 rounded" data-testid="voci-extra-section">
        <div className="flex items-center justify-between p-4 border-b border-amber-200 bg-amber-50/50">
          <div>
            <h3 className="font-semibold text-amber-900">⚠ Voci Extra Commessa</h3>
            <p className="text-xs text-amber-800">Lavori EXTRA concordati con il cliente in corso d'opera (fuori dal preventivo originale). Vanno autorizzati per iscritto e fatturati a parte.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addExtra} data-testid="extra-add"><Plus className="h-4 w-4 mr-1" /> Voce extra</Button>
            <Button size="sm" onClick={saveExtra} style={{ background: "var(--brand)", color: "white" }} data-testid="extra-save">Salva extra</Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-2 py-2 text-left">Descrizione lavoro</th>
            <th className="px-2 py-2 text-right w-20">Qty</th>
            <th className="px-2 py-2 text-right w-28">Prezzo unit.</th>
            <th className="px-2 py-2 text-right w-28">Importo</th>
            <th className="px-2 py-2 text-left w-36">Data accordo</th>
            <th className="px-2 py-2 text-center w-32">Autorizzato cliente</th>
            <th className="w-10"></th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {extraItems.map((x, i) => (
              <tr key={x.id || i} className={x.autorizzato_cliente ? "bg-emerald-50/40" : ""}>
                <td className="px-2 py-1.5"><Input value={x.descrizione} onChange={e => updExtra(i, "descrizione", e.target.value)} placeholder="Es: Spostamento impianto idrico cucina" className="h-8 text-xs" data-testid={`extra-desc-${i}`} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="0.1" value={x.qty} onChange={e => updExtra(i, "qty", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" data-testid={`extra-qty-${i}`} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="0.01" value={x.prezzo_unit} onChange={e => updExtra(i, "prezzo_unit", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right mono" data-testid={`extra-pu-${i}`} /></td>
                <td className="px-2 py-1.5 text-right mono font-semibold">{fmtEur(parseFloat(x.importo) || 0)}</td>
                <td className="px-2 py-1.5"><Input type="date" value={x.data || ""} onChange={e => updExtra(i, "data", e.target.value)} className="h-8 text-xs" /></td>
                <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={!!x.autorizzato_cliente} onChange={e => updExtra(i, "autorizzato_cliente", e.target.checked)} className="h-4 w-4" data-testid={`extra-auth-${i}`} /></td>
                <td className="px-2 py-1.5"><button onClick={() => delExtra(i)} className="text-rose-600 p-1"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!extraItems.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-400 text-xs">Nessuna voce extra. Aggiungi lavori non previsti dal preventivo originale.</td></tr>}
          </tbody>
          {extraItems.length > 0 && (
            <tfoot className="bg-zinc-50 font-bold">
              <tr><td colSpan={3} className="px-2 py-2 text-right uppercase text-xs">Totale extra</td><td className="px-2 py-2 text-right mono text-amber-700" data-testid="extra-total">{fmtEur(totExtra)}</td><td colSpan={3}></td></tr>
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
  // Vista 1 mese con navigazione
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const dayWidth = 38;

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const monthLabel = viewMonth.toLocaleString("it-IT", { month: "long", year: "numeric" });

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  const goToday = () => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));

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

  // Filtra solo le lavorazioni che si sovrappongono al mese in vista
  const tasksInView = tasks.filter((t) => {
    const ds = new Date(t.data_inizio), de = new Date(t.data_fine);
    return de >= monthStart && ds <= monthEnd;
  });

  return (
    <div className="space-y-3">
      <div className="bg-white border border-zinc-200 rounded">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Lavorazioni del cantiere — calendario mensile</h3>
            <p className="text-xs text-zinc-500">Pianifica chi fa cosa e quando. Naviga tra i mesi con le frecce.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={prevMonth} data-testid="lav-prev-month">◀</Button>
            <div className="text-sm font-semibold uppercase tracking-wide min-w-[150px] text-center" data-testid="lav-month-label">{monthLabel}</div>
            <Button size="sm" variant="outline" onClick={nextMonth} data-testid="lav-next-month">▶</Button>
            <Button size="sm" variant="outline" onClick={goToday} data-testid="lav-today">Oggi</Button>
            <Button size="sm" onClick={addTask} data-testid="lav-add" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" /> Lavorazione</Button>
          </div>
        </div>
        <div className="overflow-x-auto" style={{ maxWidth: "100%" }}>
          <div style={{ minWidth: daysInMonth * dayWidth + 280 }}>
            <div className="flex sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[10px] mono">
              <div className="w-[280px] shrink-0 px-3 py-2 font-semibold text-zinc-700 border-r">Lavorazione</div>
              <div className="flex">
                {Array.from({ length: daysInMonth }).map((_, d) => {
                  const dt = new Date(monthStart); dt.setDate(dt.getDate() + d);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isToday = dt.toDateString() === today.toDateString();
                  return (
                    <div key={d} className={`shrink-0 ${isWeekend ? "bg-amber-50" : ""} ${isToday ? "bg-blue-100 ring-1 ring-blue-400" : ""} border-r border-zinc-100 text-center`} style={{ width: dayWidth, height: 44 }}>
                      <div className="text-[9px] text-zinc-500 mt-1">{dt.toLocaleString("it-IT", { weekday: "short" }).slice(0, 3)}</div>
                      <div className="text-[11px] font-semibold">{dt.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {tasksInView.map((t) => {
              const ds = new Date(t.data_inizio), de = new Date(t.data_fine);
              // Clip al mese in vista
              const clippedStart = ds < monthStart ? monthStart : ds;
              const clippedEnd = de > monthEnd ? monthEnd : de;
              const startDay = Math.round((clippedStart - monthStart) / 86400000);
              const dur = Math.max(1, Math.round((clippedEnd - clippedStart) / 86400000) + 1);
              const totalDur = Math.max(1, Math.round((de - ds) / 86400000) + 1);
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
                  <div className="relative" style={{ width: daysInMonth * dayWidth, height: 44 }}>
                    <div className="absolute top-2 rounded text-white text-[11px] px-2 py-1.5 truncate font-medium cursor-pointer hover:opacity-90 shadow-md"
                      style={{ left: startDay * dayWidth, width: dur * dayWidth - 2, background: t.color }}
                      onClick={() => setEditTask(t)} data-testid={`lav-bar-${t.id}`}>
                      {t.name} <span className="opacity-75">({totalDur}g)</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!tasksInView.length && <div className="px-4 py-12 text-center text-zinc-500 text-sm">{tasks.length ? `Nessuna lavorazione in ${monthLabel}. Usa le frecce per cambiare mese.` : 'Nessuna lavorazione pianificata. Clicca "Lavorazione" per aggiungere la prima.'}</div>}
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


// Tab Preventivi della commessa: lista principale + extra, modifica, clone, stampa
function PreventiviCommessa({ cid, com }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [prevs, setPrevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/commesse/${cid}/preventivi`);
      setPrevs(r.data || []);
    } catch (e) {
      toast.error("Errore caricamento preventivi");
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cid]);

  const editPreventivo = (p) => {
    const tipo = p.tipo || "pacchetto";
    const route = tipo === "composite" ? `/preventivocomposite/${p.id}` : `/preventivopacchetto/${p.id}`;
    nav(route);
  };

  const clonePreventivo = async (p) => {
    const titolo = window.prompt(`Crea un preventivo EXTRA basato su questo (originale rimane intatto).\n\nDai un nome all'extra (es. "Variante pavimento", "Extra impianto elettrico"):`, "Variante / extra lavori");
    if (!titolo) return;
    setCloning(true);
    try {
      const r = await api.post(`/commesse/${cid}/preventivi/clone-from/${p.id}`, { titolo });
      toast.success("Preventivo extra creato. Aprilo per modificarlo.");
      await load();
      editPreventivo(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
    setCloning(false);
  };

  const delPreventivo = async (p) => {
    if (p.is_principale) return toast.error("Non puoi eliminare il preventivo principale della commessa.");
    if (!window.confirm(`Eliminare preventivo extra?`)) return;
    try {
      await api.delete(`/preventivi/${p.id}`);
      toast.success("Eliminato");
      load();
    } catch (e) { toast.error("Errore"); }
  };

  const totale = prevs.reduce((s, p) => s + Number(p.totale_iva_incl || 0), 0);

  return (
    <div className="space-y-4" data-testid="preventivi-commessa-tab">
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-semibold text-blue-900">Preventivi collegati alla commessa</h3>
        <p className="text-xs text-blue-700 mt-1">
          <strong>Originale</strong>: il preventivo accettato che ha aperto la commessa.<br/>
          <strong>Extra</strong>: nuovi preventivi creati durante il cantiere (varianti, lavori aggiuntivi). Si sommano al totale commessa.<br/>
          ⚠ Modificare un preventivo già accettato lo riporterà in stato <strong>BOZZA</strong> e richiederà nuova accettazione dal cliente.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
            <th className="px-3 py-2 text-left w-24">Tipo</th>
            <th className="px-3 py-2 text-left">Descrizione</th>
            <th className="px-3 py-2 text-left w-32">Tipologia</th>
            <th className="px-3 py-2 text-center w-28">Stato</th>
            <th className="px-3 py-2 text-right w-32">Totale IVA incl.</th>
            <th className="px-3 py-2 text-center w-44">Azioni</th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500 text-xs">Caricamento…</td></tr>}
            {!loading && prevs.map(p => {
              const titoloExtra = p.note?.match(/\[(.+?)\]/)?.[1] || (p.is_extra ? "Extra" : "Originale");
              const needsReacc = p.needs_reacceptance && p.stato === "bozza";
              return (
                <tr key={p.id} className={p.is_principale ? "bg-blue-50/30" : ""} data-testid={`prev-row-${p.id}`}>
                  <td className="px-3 py-2">
                    {p.is_principale ? <Badge color="blue">Principale</Badge> : <Badge color="amber">Extra</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.is_principale ? `Preventivo originale della commessa` : titoloExtra}</div>
                    <div className="text-[10px] text-zinc-500 mono">{p.id.slice(0, 8)} · {new Date(p.created_at).toLocaleDateString("it-IT")}</div>
                    {needsReacc && <div className="text-[10px] text-rose-600 font-bold mt-0.5">⚠ MODIFICATO — Richiede nuova accettazione cliente</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{(p.tipo || "—").toUpperCase()}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge color={p.stato === "accettato" ? "green" : p.stato === "rifiutato" ? "red" : p.stato === "inviato" ? "blue" : "zinc"}>{p.stato || "bozza"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right mono font-bold">{fmtEur(p.totale_iva_incl || 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      <button onClick={() => window.open(`/preventivi/${p.id}/stampa`, "_blank")} className="text-xs px-2 py-1 border rounded hover:bg-zinc-50" title="Apri stampa" data-testid={`prev-print-${p.id}`}><FileText className="h-3 w-3 inline" /></button>
                      <button onClick={() => editPreventivo(p)} className="text-xs px-2 py-1 border rounded hover:bg-blue-50 text-blue-700" title="Modifica" data-testid={`prev-edit-${p.id}`}><Edit3 className="h-3 w-3 inline" /></button>
                      <button onClick={() => clonePreventivo(p)} disabled={cloning} className="text-xs px-2 py-1 border border-amber-300 rounded hover:bg-amber-50 text-amber-700 disabled:opacity-50" title="Crea EXTRA" data-testid={`prev-clone-${p.id}`}>+ Extra</button>
                      {!p.is_principale && (user?.role === "admin") && (
                        <button onClick={() => delPreventivo(p)} className="text-xs px-2 py-1 border border-rose-200 rounded hover:bg-rose-50 text-rose-600" title="Elimina" data-testid={`prev-del-${p.id}`}><Trash2 className="h-3 w-3 inline" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && !prevs.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-500 text-sm italic">Nessun preventivo collegato. La commessa è stata creata manualmente.</td></tr>}
          </tbody>
          {prevs.length > 0 && (
            <tfoot className="bg-zinc-50 font-bold">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase">Totale commessa (originale + extra):</td>
                <td className="px-3 py-2 text-right mono text-lg" data-testid="prev-totale-commessa">{fmtEur(totale)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
