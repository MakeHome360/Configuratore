import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, fmtEur2, statoCommessaBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Save, Plus, Trash2, FileText, Upload, Edit2, X } from "lucide-react";

const TABS = ["Preventivo","Calendario","Checklist","Materiali","Computo Metrico","Voci e Acquisti","Documenti","Dati Economici"];
const PKG_NAMES = { "pkg-basic": "BASIC", "pkg-smart": "SMART", "pkg-premium": "PREMIUM", "pkg-elite": "ELITE" };

export default function DettaglioCommessa() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [tab, setTab] = useState("Preventivo");
  const [preventivo, setPreventivo] = useState(null);

  useEffect(() => {
    api.get(`/commesse/${id}`).then(async (r) => {
      setC(r.data);
      if (r.data.preventivo_id) api.get(`/preventivi/${r.data.preventivo_id}`).then((rr) => setPreventivo(rr.data)).catch(() => {});
    });
  }, [id]);

  const save = async (upd) => {
    const { data } = await api.put(`/commesse/${id}`, { ...c, ...upd });
    setC(data); toast.success("Salvato");
  };

  const setStato = async (s) => { await api.patch(`/commesse/${id}/stato`, { stato: s }); const r = await api.get(`/commesse/${id}`); setC(r.data); toast.success("Stato aggiornato"); };

  if (!c) return <Page><div className="text-zinc-500">Caricamento...</div></Page>;

  const margine = (c.fatturato || 0) - (c.costi_effettivi || 0);

  return (
    <div>
      <PageHeader
        title={`${c.cliente?.nome || ""} ${c.cliente?.cognome || ""}`}
        subtitle={<div className="flex items-center gap-3 mt-1 text-sm"><span className="font-mono text-zinc-500">{c.numero}</span><span>• {c.mq} MQ</span><span>• {PKG_NAMES[c.package_id] || "-"}</span>{statoCommessaBadge(c.stato)}</div>}
        actions={
          <div className="flex gap-2">
            <select className="border border-zinc-300 rounded h-9 px-2 text-sm" value={c.stato} onChange={(e) => setStato(e.target.value)} data-testid="com-stato">
              <option value="da_iniziare">Da Iniziare</option>
              <option value="in_corso">In Corso</option>
              <option value="completata">Completata</option>
              <option value="sospesa">Sospesa</option>
            </select>
            <Button onClick={() => save({})} data-testid="com-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button>
          </div>
        }
      />
      <Page>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatCard label="Preventivo" value={fmtEur(c.totale_preventivo)} />
          <StatCard label="Fatturato" value={fmtEur(c.fatturato)} />
          <StatCard label="Incassato" value={fmtEur(c.incassato)} />
          <StatCard label="Margine Reale" value={fmtEur(margine)} color={margine >= 0 ? "text-emerald-600" : "text-rose-600"} />
          <StatCard label="Checklist" value={`${c.avanzamento_pct || 0}%`} />
        </div>

        <div className="border-b border-zinc-200 mb-4 overflow-x-auto">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} data-testid={`com-tab-${t.replace(/\s+/g,"")}`}
                className={`px-4 py-2.5 text-sm border-b-2 whitespace-nowrap ${tab === t ? "border-[var(--brand)] text-zinc-900 font-semibold" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-5 min-h-[300px]">
          {tab === "Preventivo" && <PreventivoTab c={c} preventivo={preventivo} />}
          {tab === "Calendario" && <CalendarioTab c={c} save={save} />}
          {tab === "Checklist" && <ChecklistTab c={c} save={save} />}
          {tab === "Materiali" && <MaterialiTab c={c} save={save} />}
          {tab === "Computo Metrico" && <ComputoMetricoTab c={c} />}
          {tab === "Voci e Acquisti" && <VociAcquistiTab c={c} save={save} />}
          {tab === "Documenti" && <DocumentiTab c={c} save={save} />}
          {tab === "Dati Economici" && <DatiEconomiciTab c={c} save={save} />}
        </div>
      </Page>
    </div>
  );
}

function PreventivoTab({ c, preventivo }) {
  return (
    <div>
      <h3 className="font-semibold mb-3">Dati Cliente</h3>
      <div className="grid grid-cols-4 gap-3 mb-5 text-sm">
        <div><div className="text-zinc-500 text-xs">Cliente</div><div className="font-medium">{c.cliente?.nome} {c.cliente?.cognome}</div></div>
        <div><div className="text-zinc-500 text-xs">Telefono</div><div>{c.cliente?.telefono || "-"}</div></div>
        <div><div className="text-zinc-500 text-xs">Email</div><div>{c.cliente?.email || "-"}</div></div>
        <div><div className="text-zinc-500 text-xs">Indirizzo</div><div>{c.cliente?.indirizzo || "-"}</div></div>
      </div>
      {preventivo ? (
        <div className="bg-zinc-50 rounded p-4">
          <div className="font-semibold mb-2">Preventivo {PKG_NAMES[preventivo.package_id]} - {preventivo.mq} MQ</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Totale Pacchetto" value={fmtEur2((preventivo.mq || 0) * 380)} />
            <Row label="Extra Voci" value={fmtEur(0)} />
            <Row label="Optional" value={fmtEur((preventivo.optional || []).reduce((s, o) => s + (o.total || 0), 0))} />
            <Row label="Totale IVA Inclusa" value={fmtEur2(preventivo.totale_iva_incl || 0)} bold />
          </div>
        </div>
      ) : <div className="text-zinc-500 italic">Preventivo non disponibile</div>}
    </div>
  );
}

function ChecklistTab({ c, save }) {
  const toggle = (i) => {
    const item = (c.checklist || [])[i];
    if (item.has_doc && !item.documento_url && !item.completata) {
      toast.error("Questa fase richiede il caricamento di un documento prima di essere flaggata come completata");
      return;
    }
    const cl = [...(c.checklist || [])]; cl[i] = { ...cl[i], completata: !cl[i].completata, data_completamento: cl[i].completata ? null : new Date().toISOString() };
    save({ checklist: cl });
  };
  const onUploadDoc = (i, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const cl = [...(c.checklist || [])]; cl[i] = { ...cl[i], documento_url: reader.result, documento_nome: file.name };
      save({ checklist: cl });
      toast.success("Documento caricato");
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      {(c.checklist || []).map((f, i) => (
        <div key={f.fase_id} className={`p-3 border rounded ${f.completata ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => toggle(i)} data-testid={`check-${f.fase_id}`}
              className={`h-6 w-6 rounded border-2 flex items-center justify-center shrink-0 ${f.completata ? "bg-emerald-500 border-emerald-500" : "border-zinc-300"}`}>
              {f.completata && <Check className="h-4 w-4 text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{f.order}. {f.name}</div>
              <div className="text-xs text-zinc-500">{f.description}</div>
            </div>
            {f.has_doc && (
              <div className="shrink-0 flex items-center gap-2">
                {f.documento_url ? (
                  <a href={f.documento_url} download={f.documento_nome} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" />{(f.documento_nome || "doc").slice(0, 20)}
                  </a>
                ) : (
                  <span className="text-xs text-rose-600 font-semibold">📄 Doc obbligatorio</span>
                )}
                <label className="cursor-pointer text-xs px-2 py-1 bg-zinc-200 rounded hover:bg-zinc-300 inline-flex items-center gap-1">
                  <Upload className="h-3 w-3" />{f.documento_url ? "Sostituisci" : "Carica"}
                  <input type="file" className="hidden" onChange={(e) => onUploadDoc(i, e)} data-testid={`upload-${f.fase_id}`} />
                </label>
              </div>
            )}
            {f.data_completamento && <span className="text-xs text-emerald-600 shrink-0">{new Date(f.data_completamento).toLocaleDateString("it-IT")}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const FASE_COLORS = ["#0F766E", "#2563EB", "#9333EA", "#F59E0B", "#DC2626", "#0EA5E9", "#10B981", "#F97316", "#8B5CF6", "#EC4899"];

function CalendarioTab({ c, save }) {
  const tasks = c.calendario || [];
  const today = new Date();
  const [editTask, setEditTask] = useState(null);
  const [start, setStart] = useState(c.data_inizio ? new Date(c.data_inizio) : new Date());
  const monthsToShow = 4;
  const daysPerMonth = 30;

  const addTask = () => setEditTask({ id: `task-${Date.now()}`, name: "Nuova lavorazione", color: FASE_COLORS[tasks.length % FASE_COLORS.length], data_inizio: today.toISOString().slice(0, 10), data_fine: new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10), subappaltatore: "", note: "" });

  const saveTask = (t) => {
    const ex = tasks.findIndex((x) => x.id === t.id);
    const newTasks = ex >= 0 ? tasks.map((x, i) => i === ex ? t : x) : [...tasks, t];
    save({ calendario: newTasks });
    setEditTask(null);
  };
  const delTask = (id) => save({ calendario: tasks.filter((t) => t.id !== id) });

  // build week columns starting from min(start, today)-7d
  const earliest = tasks.reduce((m, t) => { const d = new Date(t.data_inizio); return d < m ? d : m; }, new Date(start));
  const baseDate = new Date(earliest); baseDate.setDate(baseDate.getDate() - 3);
  const totalDays = monthsToShow * daysPerMonth;
  const dayWidth = 16;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><Label className="text-xs">Inizio commessa</Label><Input type="date" value={(c.data_inizio || "").slice(0, 10)} onChange={(e) => save({ data_inizio: new Date(e.target.value).toISOString() })} className="h-8 w-44" /></div>
          <div><Label className="text-xs">Fine prevista</Label><Input type="date" value={(c.data_fine || "").slice(0, 10)} onChange={(e) => save({ data_fine: new Date(e.target.value).toISOString() })} className="h-8 w-44" /></div>
        </div>
        <Button size="sm" onClick={addTask} data-testid="cal-add-task" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" />Lavorazione</Button>
      </div>

      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <div style={{ minWidth: totalDays * dayWidth + 250 }}>
            {/* Header dates */}
            <div className="flex sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono">
              <div className="w-[250px] shrink-0 px-3 py-2 font-semibold text-zinc-700 border-r">Lavorazione</div>
              <div className="flex">
                {Array.from({ length: totalDays }).map((_, d) => {
                  const dt = new Date(baseDate); dt.setDate(dt.getDate() + d);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isToday = dt.toDateString() === today.toDateString();
                  const showLabel = dt.getDate() === 1 || d === 0;
                  return (
                    <div key={d} className={`shrink-0 ${isWeekend ? "bg-zinc-100" : ""} ${isToday ? "bg-amber-100" : ""} border-r border-zinc-100 text-center`} style={{ width: dayWidth, height: 32 }}>
                      {showLabel && <div className="text-[9px] font-bold mt-1">{dt.toLocaleString("it-IT", { month: "short" })}</div>}
                      <div className="mt-0.5">{dt.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Task rows */}
            {tasks.map((t, ti) => {
              const ds = new Date(t.data_inizio); const de = new Date(t.data_fine);
              const startDay = Math.round((ds - baseDate) / 86400000);
              const dur = Math.max(1, Math.round((de - ds) / 86400000) + 1);
              return (
                <div key={t.id} className="flex border-b border-zinc-100 hover:bg-zinc-50 group">
                  <div className="w-[250px] shrink-0 px-3 py-2 border-r text-sm flex items-center justify-between gap-2">
                    <div className="truncate flex-1">
                      <div className="font-medium truncate">{t.name}</div>
                      {t.subappaltatore && <div className="text-[10px] text-zinc-500">{t.subappaltatore}</div>}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      <button onClick={() => setEditTask(t)}><Edit2 className="h-3 w-3 text-zinc-500" /></button>
                      <button onClick={() => delTask(t.id)}><Trash2 className="h-3 w-3 text-rose-500" /></button>
                    </div>
                  </div>
                  <div className="relative" style={{ width: totalDays * dayWidth, height: 36 }}>
                    <div className="absolute top-1.5 rounded text-white text-[10px] px-2 py-1 truncate font-medium cursor-pointer hover:opacity-80 shadow"
                         style={{ left: startDay * dayWidth, width: dur * dayWidth - 2, background: t.color }}
                         onClick={() => setEditTask(t)}
                         data-testid={`cal-task-${t.id}`}>
                      {t.name} ({dur}g)
                    </div>
                  </div>
                </div>
              );
            })}
            {!tasks.length && <div className="px-4 py-12 text-center text-zinc-500 text-sm">Nessuna lavorazione. Clicca "Lavorazione" per aggiungere.</div>}
          </div>
        </div>
      </div>
      {editTask && <TaskDialog task={editTask} onSave={saveTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}

function TaskDialog({ task, onSave, onClose }) {
  const [t, setT] = useState(task);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between"><h2 className="font-semibold">Lavorazione</h2><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="p-6 space-y-3">
          <div><Label>Nome</Label><Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} data-testid="task-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Inizio</Label><Input type="date" value={t.data_inizio} onChange={(e) => setT({ ...t, data_inizio: e.target.value })} data-testid="task-start" /></div>
            <div><Label>Fine</Label><Input type="date" value={t.data_fine} onChange={(e) => setT({ ...t, data_fine: e.target.value })} data-testid="task-end" /></div>
          </div>
          <div><Label>Subappaltatore</Label><Input value={t.subappaltatore} onChange={(e) => setT({ ...t, subappaltatore: e.target.value })} /></div>
          <div>
            <Label>Colore</Label>
            <div className="flex gap-1 flex-wrap mt-1">
              {FASE_COLORS.map((c) => (
                <button key={c} onClick={() => setT({ ...t, color: c })} className={`h-8 w-8 rounded border-2 ${t.color === c ? "border-zinc-900" : "border-zinc-200"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div><Label>Note</Label><Textarea rows={2} value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} /></div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annulla</Button><Button onClick={() => onSave(t)} data-testid="task-save" style={{ background: "var(--brand)", color: "white" }}>Salva</Button></div>
      </div>
    </div>
  );
}

function MaterialiTab({ c, save }) {
  const [items, setItems] = useState(c.materiali || []);
  const add = () => setItems([...items, { nome: "", fornitore: "", qty: 1, prezzo: 0, ordinato: false }]);
  return (
    <div>
      <div className="flex justify-end mb-3"><Button size="sm" onClick={add}><Plus className="h-3 w-3 mr-1" />Aggiungi</Button></div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-4" placeholder="Materiale" value={it.nome} onChange={(e) => { const c2 = [...items]; c2[i].nome = e.target.value; setItems(c2); }} />
            <Input className="col-span-3" placeholder="Fornitore" value={it.fornitore} onChange={(e) => { const c2 = [...items]; c2[i].fornitore = e.target.value; setItems(c2); }} />
            <Input className="col-span-1" type="number" placeholder="Qty" value={it.qty} onChange={(e) => { const c2 = [...items]; c2[i].qty = Number(e.target.value); setItems(c2); }} />
            <Input className="col-span-2" type="number" placeholder="Prezzo" value={it.prezzo} onChange={(e) => { const c2 = [...items]; c2[i].prezzo = Number(e.target.value); setItems(c2); }} />
            <label className="col-span-1 text-xs flex items-center gap-1"><input type="checkbox" checked={it.ordinato} onChange={(e) => { const c2 = [...items]; c2[i].ordinato = e.target.checked; setItems(c2); }} /> ord.</label>
            <button className="col-span-1" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600 mx-auto" /></button>
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={() => save({ materiali: items })}>Salva</Button>
    </div>
  );
}

function ComputoMetricoTab({ c }) {
  return <div className="text-zinc-500 text-sm">Il computo metrico riporta tutte le voci del preventivo con le quantità di cantiere.</div>;
}

function VociAcquistiTab({ c, save }) {
  const [items, setItems] = useState(c.voci_acquisti || []);
  return (
    <div>
      <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setItems([...items, { voce: "", subappaltatore: "", preventivato: 0, effettivo: 0, pagato: false }])}><Plus className="h-3 w-3 mr-1" />Aggiungi</Button></div>
      <table className="w-full text-sm">
        <thead><tr className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <th className="px-2 py-2 text-left">Voce</th><th className="px-2 py-2 text-left">Subappaltatore</th>
          <th className="px-2 py-2 text-right">Preventivato</th><th className="px-2 py-2 text-right">Effettivo</th>
          <th className="px-2 py-2 text-right">Delta</th><th className="px-2 py-2 text-center">Pagato</th><th></th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((v, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5"><Input value={v.voce} onChange={(e) => { const c2 = [...items]; c2[i].voce = e.target.value; setItems(c2); }} /></td>
              <td className="px-2 py-1.5"><Input value={v.subappaltatore} onChange={(e) => { const c2 = [...items]; c2[i].subappaltatore = e.target.value; setItems(c2); }} /></td>
              <td className="px-2 py-1.5"><Input type="number" className="text-right" value={v.preventivato} onChange={(e) => { const c2 = [...items]; c2[i].preventivato = Number(e.target.value); setItems(c2); }} /></td>
              <td className="px-2 py-1.5"><Input type="number" className="text-right" value={v.effettivo} onChange={(e) => { const c2 = [...items]; c2[i].effettivo = Number(e.target.value); setItems(c2); }} /></td>
              <td className={`px-2 py-1.5 text-right font-mono ${(v.effettivo - v.preventivato) > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtEur(v.effettivo - v.preventivato)}</td>
              <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={v.pagato} onChange={(e) => { const c2 = [...items]; c2[i].pagato = e.target.checked; setItems(c2); }} /></td>
              <td className="px-2 py-1.5"><button onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button className="mt-3" onClick={() => save({ voci_acquisti: items })}>Salva</Button>
    </div>
  );
}

function DocumentiTab({ c, save }) {
  const [items, setItems] = useState(c.documenti || []);
  const tavole = items.filter((d) => d.tipo === "tavola_progetto");
  const altri = items.filter((d) => d.tipo !== "tavola_progetto");
  return (
    <div>
      {tavole.length > 0 && (
        <div className="mb-5 p-3 border border-emerald-300 bg-emerald-50 rounded">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-800">Tavole di Progetto ({tavole.length})</span>
            <span className="text-[10px] uppercase tracking-widest bg-emerald-700 text-white px-2 py-0.5 rounded" data-testid="tavole-flag">CONFERMATE</span>
          </div>
          <div className="space-y-1.5">
            {tavole.map((d, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-white border border-emerald-200 rounded text-sm" data-testid={`tavola-item-${i}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="flex-1">{d.nome}</span>
                {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">apri</a>}
                <button onClick={() => setItems(items.filter((x) => x !== d))}><Trash2 className="h-3.5 w-3.5 text-rose-600" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setItems([...items, { nome: "", url: "", tipo: "PDF" }])}><Plus className="h-3 w-3 mr-1" />Aggiungi</Button></div>
      <div className="space-y-2">
        {altri.map((d, i) => (
          <div key={i} className="flex items-center gap-2 p-3 border border-zinc-200 rounded">
            <FileText className="h-5 w-5 text-zinc-500" />
            <Input className="flex-1" placeholder="Nome documento" value={d.nome} onChange={(e) => { const idx = items.indexOf(d); const c2 = [...items]; c2[idx] = { ...c2[idx], nome: e.target.value }; setItems(c2); }} />
            <Input className="flex-1" placeholder="URL" value={d.url} onChange={(e) => { const idx = items.indexOf(d); const c2 = [...items]; c2[idx] = { ...c2[idx], url: e.target.value }; setItems(c2); }} />
            <button onClick={() => setItems(items.filter((x) => x !== d))}><Trash2 className="h-4 w-4 text-rose-600" /></button>
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={() => save({ documenti: items })}>Salva</Button>
    </div>
  );
}

function DatiEconomiciTab({ c, save }) {
  const [loc, setLoc] = useState({ fatturato: c.fatturato || 0, incassato: c.incassato || 0, costi_effettivi: c.costi_effettivi || 0, note_economiche: c.note_economiche || "" });
  return (
    <div className="grid grid-cols-2 gap-4 max-w-2xl">
      <div><Label>Fatturato (€)</Label><Input type="number" value={loc.fatturato} onChange={(e) => setLoc({ ...loc, fatturato: Number(e.target.value) })} /></div>
      <div><Label>Incassato (€)</Label><Input type="number" value={loc.incassato} onChange={(e) => setLoc({ ...loc, incassato: Number(e.target.value) })} /></div>
      <div><Label>Costi effettivi (€)</Label><Input type="number" value={loc.costi_effettivi} onChange={(e) => setLoc({ ...loc, costi_effettivi: Number(e.target.value) })} /></div>
      <div><Label>Margine</Label><Input disabled value={fmtEur2((loc.fatturato || 0) - (loc.costi_effettivi || 0))} /></div>
      <div className="col-span-2"><Label>Note economiche</Label><Textarea rows={3} value={loc.note_economiche} onChange={(e) => setLoc({ ...loc, note_economiche: e.target.value })} /></div>
      <Button onClick={() => save(loc)}>Salva</Button>
    </div>
  );
}

const Row = ({ label, value, bold }) => <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><span>{label}</span><span>{value}</span></div>;
