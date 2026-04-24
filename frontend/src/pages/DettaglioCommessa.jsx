import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, fmtEur2, statoCommessaBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Save, Plus, Trash2, FileText, Upload } from "lucide-react";

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
    const cl = [...(c.checklist || [])]; cl[i] = { ...cl[i], completata: !cl[i].completata, data_completamento: cl[i].completata ? null : new Date().toISOString() };
    save({ checklist: cl });
  };
  return (
    <div className="space-y-2">
      {(c.checklist || []).map((f, i) => (
        <div key={f.fase_id} className="flex items-center gap-3 p-3 border border-zinc-200 rounded hover:bg-zinc-50">
          <button onClick={() => toggle(i)} data-testid={`check-${f.fase_id}`}
            className={`h-5 w-5 rounded border-2 flex items-center justify-center ${f.completata ? "bg-emerald-500 border-emerald-500" : "border-zinc-300"}`}>
            {f.completata && <Check className="h-3 w-3 text-white" />}
          </button>
          <div className="flex-1">
            <div className="font-medium text-sm">{f.order}. {f.name}</div>
            <div className="text-xs text-zinc-500">{f.description}</div>
          </div>
          {f.has_doc && <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded">Doc</span>}
          {f.data_completamento && <span className="text-xs text-emerald-600">{new Date(f.data_completamento).toLocaleDateString("it-IT")}</span>}
        </div>
      ))}
    </div>
  );
}

function CalendarioTab({ c, save }) {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-lg">
      <div><Label>Data inizio</Label><Input type="date" value={(c.data_inizio || "").slice(0, 10)} onChange={(e) => save({ data_inizio: new Date(e.target.value).toISOString() })} /></div>
      <div><Label>Data fine prevista</Label><Input type="date" value={(c.data_fine || "").slice(0, 10)} onChange={(e) => save({ data_fine: new Date(e.target.value).toISOString() })} /></div>
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
  return (
    <div>
      <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setItems([...items, { nome: "", url: "", tipo: "PDF" }])}><Plus className="h-3 w-3 mr-1" />Aggiungi</Button></div>
      <div className="space-y-2">
        {items.map((d, i) => (
          <div key={i} className="flex items-center gap-2 p-3 border border-zinc-200 rounded">
            <FileText className="h-5 w-5 text-zinc-500" />
            <Input className="flex-1" placeholder="Nome documento" value={d.nome} onChange={(e) => { const c2 = [...items]; c2[i].nome = e.target.value; setItems(c2); }} />
            <Input className="flex-1" placeholder="URL" value={d.url} onChange={(e) => { const c2 = [...items]; c2[i].url = e.target.value; setItems(c2); }} />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600" /></button>
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
