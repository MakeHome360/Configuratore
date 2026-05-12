import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Plus, FileText, Upload, AlertTriangle, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const Page = ({ children }) => <div className="p-6 max-w-6xl mx-auto space-y-6">{children}</div>;

export default function SubappaltatoreDettaglio() {
  const { id } = useParams();
  const [cantieri, setCantieri] = useState([]);
  const [sub, setSub] = useState(null);
  const [docData, setDocData] = useState(null);  // { documenti, completezza, ok_per_assegnazione }
  const [loading, setLoading] = useState(true);

  const reload = () => {
    api.get(`/subappaltatori/${id}/cantieri`).then(r => setCantieri(r.data || [])).catch(() => {}).finally(() => setLoading(false));
    api.get("/subappaltatori").then(r => setSub((r.data || []).find(s => s.id === id))).catch(() => {});
    api.get(`/subappaltatori/${id}/documenti`).then(r => setDocData(r.data)).catch(() => {});
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  const okPerAss = docData?.ok_per_assegnazione;

  return (
    <Page>
      <div>
        <Link to="/dashboard-subappaltatori" className="text-xs text-blue-600 hover:underline mono">← dashboard subappaltatori</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{sub?.nome || "Subappaltatore"}</h1>
            <p className="text-sm text-zinc-500 mt-1">{sub?.categoria || ""} · {cantieri.length} assegnazioni</p>
          </div>
          {docData && (
            <div data-testid="sub-ready-badge" className={`text-xs px-3 py-1.5 rounded ${okPerAss ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-rose-100 text-rose-700 border border-rose-300"}`}>
              {okPerAss ? (
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Pronto per ricevere affidamenti</span>
              ) : (
                <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> Documenti incompleti — NON può ricevere affidamenti</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SEZIONE DOCUMENTI */}
      <DocumentiSubSection subId={id} docData={docData} reload={reload} />

      {/* SEZIONE CANTIERI */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-3">Cantieri assegnati</h2>
        {loading ? <div className="text-zinc-400 mono">caricamento…</div>
          : cantieri.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded p-6 text-zinc-500" data-testid="no-cantieri">Nessun cantiere assegnato a questo subappaltatore.</div>
          ) : cantieri.map(a => (
            <CantiereCard key={a.id} ass={a} onRefresh={reload} />
          ))}
      </div>
    </Page>
  );
}

function DocumentiSubSection({ subId, docData, reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "durc", nome: "", file_url: "", data_emissione: "", data_scadenza: "", note: "" });
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (f) => {
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm(prev => ({ ...prev, file_url: window.location.origin + (r.data.url || ""), nome: prev.nome || f.name }));
      toast.success("File caricato");
    } catch (e) { toast.error("Errore upload: " + (e.response?.data?.detail || e.message)); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.file_url) { toast.error("Carica prima il file"); return; }
    if (!form.nome) { toast.error("Inserisci un nome documento"); return; }
    try {
      await api.post(`/subappaltatori/${subId}/documenti`, form);
      toast.success("Documento salvato");
      setOpen(false);
      setForm({ tipo: "durc", nome: "", file_url: "", data_emissione: "", data_scadenza: "", note: "" });
      reload();
    } catch (e) { toast.error("Errore: " + (e.response?.data?.detail || e.message)); }
  };

  const remove = async (docId) => {
    if (!window.confirm("Eliminare questo documento?")) return;
    try { await api.delete(`/subappaltatori/${subId}/documenti/${docId}`); reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  if (!docData) return <div className="text-zinc-500 text-sm">Caricamento documenti…</div>;

  return (
    <div className="bg-white border border-zinc-200 rounded">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Documenti del sub-appaltatore</h2>
          <p className="text-xs text-zinc-500 mt-0.5">DURC, visura, assicurazione, ecc. devono essere validi per poter ricevere affidamenti.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="sub-doc-add"><Plus size={14} className="mr-1.5" /> Carica documento</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
          <th className="px-3 py-2 text-left">Tipo richiesto</th><th className="px-3 py-2 text-left">Documento</th><th className="px-3 py-2 text-left">Emissione</th><th className="px-3 py-2 text-left">Scadenza</th><th className="px-3 py-2 text-center">Stato</th><th></th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {(docData.completezza || []).map(c => {
            const d = c.doc;
            return (
              <tr key={c.tipo} className={!c.valido && c.obbligatorio ? "bg-rose-50/40" : ""}>
                <td className="px-3 py-2">
                  <div className="font-medium">{c.label}</div>
                  {c.obbligatorio && <div className="text-[10px] text-rose-600 font-bold uppercase">Obbligatorio</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {d ? <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline" data-testid={`sub-doc-link-${c.tipo}`}><FileText size={12} className="inline mr-1" />{d.nome}</a> : <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-3 py-2 mono text-xs">{d?.data_emissione || "—"}</td>
                <td className={`px-3 py-2 mono text-xs ${c.scaduto ? "text-rose-700 font-bold" : ""}`}>{d?.data_scadenza || "—"}</td>
                <td className="px-3 py-2 text-center">
                  {c.valido && <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">OK</span>}
                  {c.presente && c.scaduto && <span className="text-[11px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded">SCADUTO</span>}
                  {!c.presente && c.obbligatorio && <span className="text-[11px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded">MANCANTE</span>}
                  {!c.presente && !c.obbligatorio && <span className="text-[11px] px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded">opzionale</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {d && <button className="text-rose-600 p-1" onClick={() => remove(d.id)} data-testid={`sub-doc-del-${c.tipo}`}><Trash2 size={14} /></button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Carica documento sub-appaltatore</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div><Label className="text-xs">Tipo documento</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger data-testid="sub-doc-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(docData.completezza || []).map(c => <SelectItem key={c.tipo} value={c.tipo}>{c.label}{c.obbligatorio ? " *" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome documento</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Es: DURC del 12/03/2026" data-testid="sub-doc-nome" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data emissione</Label><Input type="date" value={form.data_emissione} onChange={e => setForm({ ...form, data_emissione: e.target.value })} /></div>
              <div><Label className="text-xs">Data scadenza</Label><Input type="date" value={form.data_scadenza} onChange={e => setForm({ ...form, data_scadenza: e.target.value })} data-testid="sub-doc-scad" /></div>
            </div>
            <div><Label className="text-xs">File (PDF, JPG, PNG)</Label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => uploadFile(e.target.files?.[0])} disabled={uploading} className="block text-xs w-full border border-zinc-300 rounded p-2" data-testid="sub-doc-file" />
              {form.file_url && <div className="text-[11px] text-emerald-700 mt-1">✓ File caricato</div>}
            </div>
            <div><Label className="text-xs">Note</Label><Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} style={{ background: "var(--brand)", color: "white" }} disabled={uploading || !form.file_url} data-testid="sub-doc-save">Salva documento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CantiereCard({ ass, onRefresh }) {
  const [newAv, setNewAv] = useState({ descrizione: "", percentuale: 50, note: "" });
  const [open, setOpen] = useState(false);

  const addAvanzamento = async () => {
    try {
      await api.post(`/subappaltatori/assegnazioni/${ass.id}/avanzamenti`, newAv);
      toast.success("Avanzamento dichiarato. In attesa di convalida.");
      setNewAv({ descrizione: "", percentuale: 50, note: "" });
      setOpen(false);
      onRefresh();
    } catch (e) { toast.error("Errore"); }
  };

  const convalida = async (avId) => {
    try {
      await api.post(`/subappaltatori/assegnazioni/${ass.id}/avanzamenti/${avId}/convalida`);
      toast.success("Avanzamento convalidato. Pagamento sbloccato.");
      onRefresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  const c = ass.commessa || {};
  return (
    <div className="bg-white border border-zinc-200 rounded p-4 space-y-3 mb-3" data-testid={`ass-card-${ass.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{c.numero || "Commessa"} · {c.cliente?.nome || c.cliente?.cognome || ""}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{ass.descrizione_lavori || "—"}</div>
        </div>
        <div className="text-right">
          <div className="mono text-sm">€ {(ass.importo_pattuito || 0).toLocaleString("it-IT")}</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">{ass.stato}</div>
        </div>
      </div>
      <div className="border-t border-zinc-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Avanzamenti dichiarati</div>
          <Button size="sm" variant="outline" className="rounded-sm h-7" onClick={() => setOpen(!open)} data-testid={`add-av-${ass.id}`}>
            <Plus size={12} className="mr-1" /> Dichiara avanzamento
          </Button>
        </div>
        {open && (
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded space-y-2">
            <Input placeholder="Descrizione (es. completato 50% impianto idraulico)" value={newAv.descrizione} onChange={e => setNewAv({...newAv, descrizione: e.target.value})} className="rounded-sm h-8" data-testid="new-av-desc" />
            <div className="flex gap-2 items-center">
              <Label className="text-xs">% completamento:</Label>
              <Input type="number" min={0} max={100} value={newAv.percentuale} onChange={e => setNewAv({...newAv, percentuale: parseFloat(e.target.value) || 0})} className="rounded-sm h-8 w-20 mono" data-testid="new-av-pct" />
            </div>
            <Textarea placeholder="Note" rows={2} value={newAv.note} onChange={e => setNewAv({...newAv, note: e.target.value})} className="rounded-sm" />
            <Button size="sm" className="rounded-sm h-8 bg-zinc-900 text-white" onClick={addAvanzamento} data-testid="submit-av">Dichiara</Button>
          </div>
        )}
        <div className="space-y-1.5 mt-2">
          {(ass.avanzamenti || []).length === 0 ? (
            <div className="text-xs text-zinc-400 mono">Nessun avanzamento dichiarato</div>
          ) : (ass.avanzamenti || []).map(av => (
            <div key={av.id} className={`flex items-center justify-between text-xs p-2 rounded ${av.convalidato ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`} data-testid={`av-${av.id}`}>
              <div className="flex-1">
                <div className="font-medium">{av.descrizione} · {av.percentuale}%</div>
                <div className="text-[10px] text-zinc-500 mono">{av.dichiarato_il?.slice(0, 10)} · {av.note}</div>
              </div>
              {av.convalidato ? (
                <span className="text-emerald-700 mono text-[10px] flex items-center gap-1"><Check size={12} /> CONVALIDATO</span>
              ) : (
                <Button size="sm" variant="outline" className="rounded-sm h-7 border-amber-500 text-amber-700" onClick={() => convalida(av.id)} data-testid={`convalida-${av.id}`}>
                  Convalida
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
